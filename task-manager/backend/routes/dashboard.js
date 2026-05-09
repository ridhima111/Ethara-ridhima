const express = require('express');
const db = require('../models/db');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

// GET /api/dashboard - aggregated stats for current user
router.get('/', authenticate, (req, res) => {
  const userId = req.user.id;
  const isAdmin = req.user.role === 'admin';

  // My tasks (assigned to me)
  const myTasks = db.prepare(`
    SELECT t.*, p.name as project_name, u.name as assignee_name
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    LEFT JOIN users u ON t.assignee_id = u.id
    WHERE t.assignee_id = ? AND t.status != 'done'
    ORDER BY t.due_date ASC NULLS LAST, 
      CASE t.priority WHEN 'urgent' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 ELSE 4 END
    LIMIT 10
  `).all(userId);

  // Overdue tasks
  const overdueTasks = db.prepare(`
    SELECT t.*, p.name as project_name, u.name as assignee_name
    FROM tasks t
    JOIN projects p ON t.project_id = p.id
    LEFT JOIN users u ON t.assignee_id = u.id
    ${isAdmin ? '' : `JOIN project_members pm ON pm.project_id = t.project_id AND pm.user_id = ${userId}`}
    WHERE t.due_date < DATE('now') AND t.status != 'done'
    ORDER BY t.due_date ASC
    LIMIT 10
  `).all();

  // Project stats
  const projectStats = isAdmin
    ? db.prepare(`
        SELECT p.id, p.name, p.status,
          COUNT(t.id) as total_tasks,
          SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END) as done_tasks,
          SUM(CASE WHEN t.due_date < DATE('now') AND t.status!='done' THEN 1 ELSE 0 END) as overdue
        FROM projects p
        LEFT JOIN tasks t ON t.project_id = p.id
        GROUP BY p.id ORDER BY p.updated_at DESC LIMIT 6
      `).all()
    : db.prepare(`
        SELECT p.id, p.name, p.status, pm.role as my_role,
          COUNT(t.id) as total_tasks,
          SUM(CASE WHEN t.status='done' THEN 1 ELSE 0 END) as done_tasks,
          SUM(CASE WHEN t.due_date < DATE('now') AND t.status!='done' THEN 1 ELSE 0 END) as overdue
        FROM projects p
        JOIN project_members pm ON pm.project_id = p.id AND pm.user_id = ?
        LEFT JOIN tasks t ON t.project_id = p.id
        GROUP BY p.id ORDER BY p.updated_at DESC LIMIT 6
      `).all(userId);

  // Global stats
  const globalStats = isAdmin
    ? db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM tasks WHERE status != 'done') as active_tasks,
          (SELECT COUNT(*) FROM tasks WHERE status = 'done') as completed_tasks,
          (SELECT COUNT(*) FROM tasks WHERE due_date < DATE('now') AND status != 'done') as overdue_tasks,
          (SELECT COUNT(*) FROM projects WHERE status = 'active') as active_projects,
          (SELECT COUNT(*) FROM users) as total_users
      `).get()
    : db.prepare(`
        SELECT
          (SELECT COUNT(*) FROM tasks WHERE assignee_id = ? AND status != 'done') as active_tasks,
          (SELECT COUNT(*) FROM tasks WHERE assignee_id = ? AND status = 'done') as completed_tasks,
          (SELECT COUNT(*) FROM tasks WHERE assignee_id = ? AND due_date < DATE('now') AND status != 'done') as overdue_tasks,
          (SELECT COUNT(DISTINCT project_id) FROM project_members WHERE user_id = ?) as active_projects,
          0 as total_users
      `).get(userId, userId, userId, userId);

  // Task status breakdown
  const tasksByStatus = isAdmin
    ? db.prepare(`
        SELECT status, COUNT(*) as count FROM tasks GROUP BY status
      `).all()
    : db.prepare(`
        SELECT status, COUNT(*) as count FROM tasks WHERE assignee_id = ? GROUP BY status
      `).all(userId);

  // Recent activity
  const recentActivity = db.prepare(`
    SELECT al.*, u.name as user_name, u.email
    FROM activity_log al JOIN users u ON al.user_id = u.id
    ORDER BY al.created_at DESC LIMIT 10
  `).all();

  res.json({
    myTasks,
    overdueTasks,
    projectStats,
    globalStats,
    tasksByStatus,
    recentActivity,
  });
});

module.exports = router;
