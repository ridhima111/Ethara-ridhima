const express = require('express');
const { body, query, validationResult } = require('express-validator');
const db = require('../models/db');
const { authenticate, requireProjectAccess } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

// GET /api/projects/:projectId/tasks
router.get('/', authenticate, requireProjectAccess, (req, res) => {
  const { status, priority, assignee, search } = req.query;
  let sql = `
    SELECT t.*, 
      u.name as assignee_name, u.email as assignee_email,
      c.name as creator_name
    FROM tasks t
    LEFT JOIN users u ON t.assignee_id = u.id
    JOIN users c ON t.creator_id = c.id
    WHERE t.project_id = ?
  `;
  const params = [req.params.projectId];

  if (status) { sql += ' AND t.status = ?'; params.push(status); }
  if (priority) { sql += ' AND t.priority = ?'; params.push(priority); }
  if (assignee) { sql += ' AND t.assignee_id = ?'; params.push(assignee); }
  if (search) { sql += ' AND (t.title LIKE ? OR t.description LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }

  sql += ' ORDER BY CASE t.priority WHEN "urgent" THEN 1 WHEN "high" THEN 2 WHEN "medium" THEN 3 ELSE 4 END, t.created_at DESC';

  const tasks = db.prepare(sql).all(...params);
  res.json({ tasks });
});

// POST /api/projects/:projectId/tasks
router.post('/', authenticate, requireProjectAccess, [
  body('title').trim().notEmpty().withMessage('Title required'),
  body('description').optional().trim(),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('status').optional().isIn(['todo', 'in_progress', 'review', 'done']),
  body('due_date').optional().isDate(),
  body('assignee_id').optional().isInt(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { title, description, priority = 'medium', status = 'todo', due_date, assignee_id } = req.body;

  try {
    // Validate assignee is project member
    if (assignee_id) {
      const isMember = db.prepare(
        'SELECT id FROM project_members WHERE project_id = ? AND user_id = ?'
      ).get(req.params.projectId, assignee_id);
      if (!isMember) return res.status(400).json({ error: 'Assignee must be a project member' });
    }

    const result = db.prepare(`
      INSERT INTO tasks (title, description, priority, status, due_date, assignee_id, project_id, creator_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(title, description || null, priority, status, due_date || null, assignee_id || null, req.params.projectId, req.user.id);

    db.prepare(
      'UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?'
    ).run(req.params.projectId);

    // Log activity
    db.prepare(
      'INSERT INTO activity_log (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, 'created', 'task', result.lastInsertRowid, JSON.stringify({ title }));

    const task = db.prepare(`
      SELECT t.*, u.name as assignee_name, c.name as creator_name
      FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id JOIN users c ON t.creator_id = c.id
      WHERE t.id = ?
    `).get(result.lastInsertRowid);

    res.status(201).json({ task });
  } catch (err) {
    res.status(500).json({ error: 'Server error', details: err.message });
  }
});

// GET /api/projects/:projectId/tasks/:id
router.get('/:id', authenticate, requireProjectAccess, (req, res) => {
  const task = db.prepare(`
    SELECT t.*, u.name as assignee_name, u.email as assignee_email, c.name as creator_name
    FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id JOIN users c ON t.creator_id = c.id
    WHERE t.id = ? AND t.project_id = ?
  `).get(req.params.id, req.params.projectId);

  if (!task) return res.status(404).json({ error: 'Task not found' });

  const comments = db.prepare(`
    SELECT cm.*, u.name as user_name FROM comments cm
    JOIN users u ON cm.user_id = u.id
    WHERE cm.task_id = ? ORDER BY cm.created_at ASC
  `).all(req.params.id);

  res.json({ task, comments });
});

// PUT /api/projects/:projectId/tasks/:id
router.put('/:id', authenticate, requireProjectAccess, [
  body('title').optional().trim().notEmpty(),
  body('status').optional().isIn(['todo', 'in_progress', 'review', 'done']),
  body('priority').optional().isIn(['low', 'medium', 'high', 'urgent']),
  body('due_date').optional(),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?').get(req.params.id, req.params.projectId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  // Only creator, assignee, or project admin can edit
  const membership = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.projectId, req.user.id);
  const canEdit = task.creator_id === req.user.id || task.assignee_id === req.user.id || membership?.role === 'admin' || req.user.role === 'admin';
  if (!canEdit) return res.status(403).json({ error: 'Not authorized to edit this task' });

  const { title, description, status, priority, due_date, assignee_id } = req.body;
  const fields = [];
  const values = [];

  if (title !== undefined) { fields.push('title = ?'); values.push(title); }
  if (description !== undefined) { fields.push('description = ?'); values.push(description); }
  if (status !== undefined) { fields.push('status = ?'); values.push(status); }
  if (priority !== undefined) { fields.push('priority = ?'); values.push(priority); }
  if (due_date !== undefined) { fields.push('due_date = ?'); values.push(due_date || null); }
  if (assignee_id !== undefined) { fields.push('assignee_id = ?'); values.push(assignee_id || null); }
  fields.push('updated_at = CURRENT_TIMESTAMP');
  values.push(req.params.id);

  db.prepare(`UPDATE tasks SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  db.prepare('UPDATE projects SET updated_at = CURRENT_TIMESTAMP WHERE id = ?').run(req.params.projectId);

  // Log status change
  if (status && status !== task.status) {
    db.prepare(
      'INSERT INTO activity_log (user_id, action, entity_type, entity_id, details) VALUES (?, ?, ?, ?, ?)'
    ).run(req.user.id, 'status_changed', 'task', req.params.id, JSON.stringify({ from: task.status, to: status }));
  }

  const updated = db.prepare(`
    SELECT t.*, u.name as assignee_name, c.name as creator_name
    FROM tasks t LEFT JOIN users u ON t.assignee_id = u.id JOIN users c ON t.creator_id = c.id
    WHERE t.id = ?
  `).get(req.params.id);

  res.json({ task: updated });
});

// DELETE /api/projects/:projectId/tasks/:id
router.delete('/:id', authenticate, requireProjectAccess, (req, res) => {
  const task = db.prepare('SELECT * FROM tasks WHERE id = ? AND project_id = ?').get(req.params.id, req.params.projectId);
  if (!task) return res.status(404).json({ error: 'Task not found' });

  const membership = db.prepare('SELECT role FROM project_members WHERE project_id = ? AND user_id = ?').get(req.params.projectId, req.user.id);
  const canDelete = task.creator_id === req.user.id || membership?.role === 'admin' || req.user.role === 'admin';
  if (!canDelete) return res.status(403).json({ error: 'Not authorized' });

  db.prepare('DELETE FROM tasks WHERE id = ?').run(req.params.id);
  res.json({ message: 'Task deleted' });
});

// POST /api/projects/:projectId/tasks/:id/comments
router.post('/:id/comments', authenticate, requireProjectAccess, [
  body('content').trim().notEmpty().withMessage('Comment content required'),
], (req, res) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

  const { content } = req.body;
  const result = db.prepare(
    'INSERT INTO comments (task_id, user_id, content) VALUES (?, ?, ?)'
  ).run(req.params.id, req.user.id, content);

  const comment = db.prepare(
    'SELECT cm.*, u.name as user_name FROM comments cm JOIN users u ON cm.user_id = u.id WHERE cm.id = ?'
  ).get(result.lastInsertRowid);

  res.status(201).json({ comment });
});

module.exports = router;
