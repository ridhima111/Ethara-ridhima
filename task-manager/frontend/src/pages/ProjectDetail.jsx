import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { projectsAPI, tasksAPI, authAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { format, isPast, parseISO, isValid } from 'date-fns';

const Avatar = ({ name, size = '' }) => {
  const initials = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() || '?';
  const colors = ['#6c63ff', '#3b82f6', '#22c55e', '#f59e0b', '#ef4444', '#8b5cf6'];
  const color = colors[name?.charCodeAt(0) % colors.length] || colors[0];
  return <div className={`avatar ${size}`} style={{ background: color }}>{initials}</div>;
};

const STATUSES = ['todo', 'in_progress', 'review', 'done'];
const STATUS_LABELS = { todo: 'To Do', in_progress: 'In Progress', review: 'Review', done: 'Done' };
const STATUS_COLORS = {
  todo: 'var(--text-3)',
  in_progress: 'var(--blue)',
  review: 'var(--yellow)',
  done: 'var(--green)',
};
const PRIORITIES = ['low', 'medium', 'high', 'urgent'];
const PRIORITY_COLORS = {
  low: 'var(--text-3)', medium: 'var(--blue)', high: 'var(--yellow)', urgent: 'var(--red)'
};

// ─── Task Modal ──────────────────────────────────────────────────────────────
const TaskModal = ({ task, projectId, members, onClose, onSave, canEdit }) => {
  const { user } = useAuth();
  const [form, setForm] = useState(task ? {
    title: task.title, description: task.description || '',
    status: task.status, priority: task.priority,
    due_date: task.due_date || '', assignee_id: task.assignee_id || '',
  } : { title: '', description: '', status: 'todo', priority: 'medium', due_date: '', assignee_id: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState('');
  const [commentLoading, setCommentLoading] = useState(false);

  useEffect(() => {
    if (task) {
      tasksAPI.get(projectId, task.id).then(r => setComments(r.data.comments || []));
    }
  }, [task, projectId]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    try {
      const payload = { ...form, assignee_id: form.assignee_id || null, due_date: form.due_date || null };
      await onSave(payload);
      onClose();
    } catch (err) {
      setError(err.response?.data?.errors?.[0]?.msg || err.response?.data?.error || 'Failed');
    } finally { setLoading(false); }
  };

  const handleComment = async () => {
    if (!newComment.trim()) return;
    setCommentLoading(true);
    try {
      const r = await tasksAPI.addComment(projectId, task.id, { content: newComment });
      setComments(c => [...c, r.data.comment]);
      setNewComment('');
    } finally { setCommentLoading(false); }
  };

  const isOverdue = form.due_date && isPast(parseISO(form.due_date)) && form.status !== 'done';

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 600 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h2 style={{ fontSize: 18 }}>{task ? 'Task Details' : 'Create Task'}</h2>
          <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose}>✕</button>
        </div>

        {error && <div className="alert alert-error" style={{ marginBottom: 16 }}>{error}</div>}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Title *</label>
            <input className="form-input" required placeholder="Task title"
              value={form.title} onChange={e => setForm(p => ({ ...p, title: e.target.value }))}
              disabled={task && !canEdit} />
          </div>
          <div className="form-group">
            <label className="form-label">Description</label>
            <textarea className="form-input" placeholder="Add details..."
              value={form.description} onChange={e => setForm(p => ({ ...p, description: e.target.value }))}
              disabled={task && !canEdit} />
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Status</label>
              <select className="form-input" value={form.status} onChange={e => setForm(p => ({ ...p, status: e.target.value }))}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">Priority</label>
              <select className="form-input" value={form.priority} onChange={e => setForm(p => ({ ...p, priority: e.target.value }))}>
                {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
              </select>
            </div>
          </div>
          <div className="grid-2">
            <div className="form-group">
              <label className="form-label">Assignee</label>
              <select className="form-input" value={form.assignee_id} onChange={e => setForm(p => ({ ...p, assignee_id: e.target.value }))}>
                <option value="">Unassigned</option>
                {members.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
              </select>
            </div>
            <div className="form-group">
              <label className="form-label">
                Due Date {isOverdue && <span style={{ color: 'var(--red)', marginLeft: 4 }}>⚠ Overdue</span>}
              </label>
              <input type="date" className="form-input"
                value={form.due_date}
                onChange={e => setForm(p => ({ ...p, due_date: e.target.value }))}
                style={{ colorScheme: 'dark' }}
              />
            </div>
          </div>

          {task && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', display: 'flex', gap: 16 }}>
              <span>Created by {task.creator_name}</span>
              <span>Updated {format(parseISO(task.updated_at), 'MMM d, yyyy')}</span>
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 4 }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" /> : (task ? 'Save Changes' : 'Create Task')}
            </button>
          </div>
        </form>

        {/* Comments */}
        {task && (
          <>
            <div className="divider" />
            <h4 style={{ marginBottom: 12, fontSize: 14 }}>💬 Comments ({comments.length})</h4>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
              {comments.map(c => (
                <div key={c.id} style={{ display: 'flex', gap: 10 }}>
                  <Avatar name={c.user_name} size="avatar-sm" />
                  <div style={{ flex: 1 }}>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'baseline', marginBottom: 4 }}>
                      <span style={{ fontSize: 13, fontWeight: 600 }}>{c.user_name}</span>
                      <span style={{ fontSize: 11, color: 'var(--text-3)' }}>
                        {format(parseISO(c.created_at), 'MMM d, HH:mm')}
                      </span>
                    </div>
                    <div style={{ fontSize: 13, color: 'var(--text-2)', background: 'var(--bg-3)', padding: '8px 12px', borderRadius: 8 }}>
                      {c.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input className="form-input" style={{ flex: 1 }} placeholder="Add a comment..."
                value={newComment} onChange={e => setNewComment(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleComment()} />
              <button className="btn btn-primary btn-sm" onClick={handleComment} disabled={commentLoading || !newComment.trim()}>
                {commentLoading ? <span className="spinner" /> : 'Send'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

// ─── Member Modal ─────────────────────────────────────────────────────────────
const MemberModal = ({ projectId, currentMembers, onClose, onSave }) => {
  const [allUsers, setAllUsers] = useState([]);
  const [selectedUser, setSelectedUser] = useState('');
  const [role, setRole] = useState('member');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    authAPI.getUsers().then(r => setAllUsers(r.data.users));
  }, []);

  const existingIds = new Set(currentMembers.map(m => m.id));
  const available = allUsers.filter(u => !existingIds.has(u.id));

  const handleAdd = async () => {
    if (!selectedUser) return;
    setLoading(true);
    try {
      await projectsAPI.addMember(projectId, { userId: parseInt(selectedUser), role });
      onSave();
      onClose();
    } catch (err) {
      console.error(err);
    } finally { setLoading(false); }
  };

  return (
    <div className="modal-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal" style={{ maxWidth: 420 }}>
        <h2 style={{ marginBottom: 20, fontSize: 18 }}>Add Team Member</h2>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div className="form-group">
            <label className="form-label">Select User</label>
            <select className="form-input" value={selectedUser} onChange={e => setSelectedUser(e.target.value)}>
              <option value="">Choose a user...</option>
              {available.map(u => <option key={u.id} value={u.id}>{u.name} ({u.email})</option>)}
            </select>
          </div>
          <div className="form-group">
            <label className="form-label">Project Role</label>
            <select className="form-input" value={role} onChange={e => setRole(e.target.value)}>
              <option value="member">Member</option>
              <option value="admin">Admin</option>
            </select>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button className="btn btn-primary" onClick={handleAdd} disabled={!selectedUser || loading}>
              {loading ? <span className="spinner" /> : 'Add Member'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Task Card ────────────────────────────────────────────────────────────────
const TaskCard = ({ task, onClick }) => {
  const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && task.status !== 'done';
  return (
    <div onClick={onClick} style={{
      background: 'var(--bg-3)', border: '1px solid var(--border)',
      borderRadius: 8, padding: '12px 14px', cursor: 'pointer',
      transition: 'all 0.15s',
      borderLeft: `3px solid ${PRIORITY_COLORS[task.priority]}`,
    }}
      onMouseOver={e => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.background = 'var(--bg-4)'; }}
      onMouseOut={e => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.background = 'var(--bg-3)'; }}
    >
      <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6, lineHeight: 1.4 }}>{task.title}</div>
      {task.description && (
        <div style={{ fontSize: 11, color: 'var(--text-3)', marginBottom: 8, overflow: 'hidden',
          display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical' }}>
          {task.description}
        </div>
      )}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
        <span className={`badge badge-${task.priority}`}>{task.priority}</span>
        {task.due_date && (
          <span style={{ fontSize: 11, color: isOverdue ? 'var(--red)' : 'var(--text-3)' }}>
            {isOverdue ? '⚠' : '📅'} {format(parseISO(task.due_date), 'MMM d')}
          </span>
        )}
        {task.assignee_name && (
          <div style={{ marginLeft: 'auto' }}>
            <Avatar name={task.assignee_name} size="avatar-sm" />
          </div>
        )}
      </div>
    </div>
  );
};

// ─── Main Page ────────────────────────────────────────────────────────────────
export default function ProjectDetail() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [project, setProject] = useState(null);
  const [members, setMembers] = useState([]);
  const [stats, setStats] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('kanban'); // kanban | list
  const [activeTab, setActiveTab] = useState('tasks'); // tasks | members
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);
  const [showMemberModal, setShowMemberModal] = useState(false);
  const [filters, setFilters] = useState({ status: '', priority: '', search: '' });

  const fetchProject = useCallback(() => {
    projectsAPI.get(id).then(r => {
      setProject(r.data.project);
      setMembers(r.data.members);
      setStats(r.data.stats);
    });
  }, [id]);

  const fetchTasks = useCallback(() => {
    const params = {};
    if (filters.status) params.status = filters.status;
    if (filters.priority) params.priority = filters.priority;
    if (filters.search) params.search = filters.search;
    tasksAPI.list(id, params).then(r => setTasks(r.data.tasks));
  }, [id, filters]);

  useEffect(() => {
    Promise.all([
      projectsAPI.get(id),
      tasksAPI.list(id),
    ]).then(([pr, tr]) => {
      setProject(pr.data.project);
      setMembers(pr.data.members);
      setStats(pr.data.stats);
      setTasks(tr.data.tasks);
    }).finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { fetchTasks(); }, [filters]);

  const handleCreateTask = async (form) => {
    const r = await tasksAPI.create(id, form);
    setTasks(t => [r.data.task, ...t]);
    fetchProject();
  };

  const handleUpdateTask = async (form) => {
    const r = await tasksAPI.update(id, selectedTask.id, form);
    setTasks(t => t.map(task => task.id === selectedTask.id ? r.data.task : task));
    fetchProject();
  };

  const handleDeleteTask = async (taskId) => {
    if (!confirm('Delete this task?')) return;
    await tasksAPI.delete(id, taskId);
    setTasks(t => t.filter(task => task.id !== taskId));
    fetchProject();
  };

  const handleDeleteProject = async () => {
    if (!confirm('Delete this project and all its tasks? This cannot be undone.')) return;
    await projectsAPI.delete(id);
    navigate('/projects');
  };

  const handleRemoveMember = async (userId) => {
    if (!confirm('Remove this member?')) return;
    await projectsAPI.removeMember(id, userId);
    fetchProject();
  };

  const membership = members.find(m => m.id === user?.id);
  const isProjectAdmin = membership?.project_role === 'admin' || user?.role === 'admin';

  const tasksByStatus = STATUSES.reduce((acc, s) => {
    acc[s] = tasks.filter(t => t.status === s);
    return acc;
  }, {});

  const canEditTask = (task) => {
    return task.creator_id === user?.id || task.assignee_id === user?.id || isProjectAdmin;
  };

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  if (!project) return <div className="empty-state"><h3>Project not found</h3><Link to="/projects">← Back</Link></div>;

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 6 }}>
              <Link to="/projects" style={{ color: 'var(--accent-2)' }}>Projects</Link> /
            </div>
            <h1 style={{ fontSize: 24, marginBottom: 6 }}>{project.name}</h1>
            {project.description && (
              <p style={{ color: 'var(--text-2)', fontSize: 14 }}>{project.description}</p>
            )}
          </div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span className={`badge badge-${project.status}`} style={{ fontSize: 12 }}>{project.status}</span>
            {isProjectAdmin && (
              <button className="btn btn-danger btn-sm" onClick={handleDeleteProject}>Delete Project</button>
            )}
          </div>
        </div>

        {/* Stats bar */}
        {stats && (
          <div style={{ display: 'flex', gap: 20, marginTop: 16, fontSize: 13, color: 'var(--text-2)', flexWrap: 'wrap' }}>
            {[
              { label: 'Todo', value: stats.todo, color: 'var(--text-3)' },
              { label: 'In Progress', value: stats.in_progress, color: 'var(--blue)' },
              { label: 'Review', value: stats.review, color: 'var(--yellow)' },
              { label: 'Done', value: stats.done, color: 'var(--green)' },
              stats.overdue > 0 ? { label: 'Overdue', value: stats.overdue, color: 'var(--red)' } : null,
            ].filter(Boolean).map(s => (
              <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: s.color, display: 'inline-block' }} />
                <strong style={{ color: s.color }}>{s.value}</strong> {s.label}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 20, borderBottom: '1px solid var(--border)', paddingBottom: 0 }}>
        {[['tasks', '📋 Tasks'], ['members', '👥 Members']].map(([tab, label]) => (
          <button key={tab} onClick={() => setActiveTab(tab)}
            style={{
              background: 'none', border: 'none', padding: '8px 16px', cursor: 'pointer',
              color: activeTab === tab ? 'var(--text)' : 'var(--text-2)',
              borderBottom: `2px solid ${activeTab === tab ? 'var(--accent)' : 'transparent'}`,
              marginBottom: -1, fontFamily: 'DM Sans', fontSize: 14, fontWeight: activeTab === tab ? 600 : 400,
              transition: 'all 0.15s',
            }}
          >{label}</button>
        ))}
      </div>

      {/* Tasks tab */}
      {activeTab === 'tasks' && (
        <div>
          {/* Task controls */}
          <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap', alignItems: 'center' }}>
            <input className="form-input" placeholder="Search tasks..." style={{ width: 200 }}
              value={filters.search} onChange={e => setFilters(p => ({ ...p, search: e.target.value }))} />
            <select className="form-input" style={{ width: 130 }} value={filters.status}
              onChange={e => setFilters(p => ({ ...p, status: e.target.value }))}>
              <option value="">All Status</option>
              {STATUSES.map(s => <option key={s} value={s}>{STATUS_LABELS[s]}</option>)}
            </select>
            <select className="form-input" style={{ width: 130 }} value={filters.priority}
              onChange={e => setFilters(p => ({ ...p, priority: e.target.value }))}>
              <option value="">All Priority</option>
              {PRIORITIES.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
            </select>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
              {/* View toggle */}
              {['kanban', 'list'].map(v => (
                <button key={v} className={`btn btn-sm ${view === v ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setView(v)}>
                  {v === 'kanban' ? '⊞ Kanban' : '☰ List'}
                </button>
              ))}
              <button className="btn btn-primary btn-sm" onClick={() => { setSelectedTask(null); setShowTaskModal(true); }}>
                + New Task
              </button>
            </div>
          </div>

          {/* Kanban View */}
          {view === 'kanban' && (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, overflowX: 'auto' }}>
              {STATUSES.map(status => (
                <div key={status} style={{
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  borderRadius: 12, padding: 12, minHeight: 300,
                }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                    marginBottom: 12, padding: '0 2px',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: STATUS_COLORS[status], display: 'inline-block' }} />
                      <span style={{ fontSize: 13, fontWeight: 700, fontFamily: 'Syne' }}>{STATUS_LABELS[status]}</span>
                    </div>
                    <span style={{ fontSize: 11, background: 'var(--bg-4)', padding: '2px 7px', borderRadius: 999, color: 'var(--text-3)' }}>
                      {tasksByStatus[status]?.length || 0}
                    </span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {tasksByStatus[status]?.map(task => (
                      <TaskCard key={task.id} task={task} onClick={() => { setSelectedTask(task); setShowTaskModal(true); }} />
                    ))}
                    {tasksByStatus[status]?.length === 0 && (
                      <div style={{ padding: '16px 8px', textAlign: 'center', color: 'var(--text-3)', fontSize: 12 }}>
                        No tasks
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* List View */}
          {view === 'list' && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              {tasks.length === 0 ? (
                <div className="empty-state" style={{ padding: 48 }}>
                  <div className="icon">📋</div>
                  <h3>No tasks yet</h3>
                  <p style={{ fontSize: 13 }}>Create your first task to get started.</p>
                </div>
              ) : (
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ borderBottom: '1px solid var(--border)' }}>
                      {['Title', 'Status', 'Priority', 'Assignee', 'Due Date', ''].map((h, i) => (
                        <th key={i} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 12, fontWeight: 600, color: 'var(--text-3)', fontFamily: 'DM Sans' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {tasks.map(task => {
                      const isOverdue = task.due_date && isPast(parseISO(task.due_date)) && task.status !== 'done';
                      return (
                        <tr key={task.id} style={{ borderBottom: '1px solid var(--border)', cursor: 'pointer', transition: 'background 0.1s' }}
                          onMouseOver={e => e.currentTarget.style.background = 'var(--bg-3)'}
                          onMouseOut={e => e.currentTarget.style.background = 'transparent'}
                          onClick={() => { setSelectedTask(task); setShowTaskModal(true); }}
                        >
                          <td style={{ padding: '12px 16px', fontSize: 13, fontWeight: 500, maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</td>
                          <td style={{ padding: '12px 16px' }}><span className={`badge badge-${task.status}`}>{task.status?.replace('_',' ')}</span></td>
                          <td style={{ padding: '12px 16px' }}><span className={`badge badge-${task.priority}`}>{task.priority}</span></td>
                          <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-2)' }}>
                            {task.assignee_name ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                                <Avatar name={task.assignee_name} size="avatar-sm" />
                                {task.assignee_name}
                              </div>
                            ) : <span style={{ color: 'var(--text-3)' }}>—</span>}
                          </td>
                          <td style={{ padding: '12px 16px', fontSize: 12, color: isOverdue ? 'var(--red)' : 'var(--text-3)' }}>
                            {task.due_date ? format(parseISO(task.due_date), 'MMM d, yyyy') : '—'}
                            {isOverdue && ' ⚠'}
                          </td>
                          <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                            {canEditTask(task) && (
                              <button className="btn btn-danger btn-sm btn-icon"
                                style={{ opacity: 0.7 }}
                                onClick={() => handleDeleteTask(task.id)}>🗑</button>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </div>
      )}

      {/* Members tab */}
      {activeTab === 'members' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 16 }}>
            {isProjectAdmin && (
              <button className="btn btn-primary" onClick={() => setShowMemberModal(true)}>+ Add Member</button>
            )}
          </div>
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {members.map((m, i) => (
              <div key={m.id} style={{
                display: 'flex', alignItems: 'center', gap: 14, padding: '14px 20px',
                borderBottom: i < members.length - 1 ? '1px solid var(--border)' : 'none',
              }}>
                <Avatar name={m.name} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 14, fontWeight: 600 }}>{m.name}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{m.email}</div>
                </div>
                <span className={`badge badge-${m.project_role}`}>{m.project_role}</span>
                {m.global_role === 'admin' && <span className="badge badge-admin">Global Admin</span>}
                {isProjectAdmin && m.id !== user?.id && (
                  <button className="btn btn-danger btn-sm" onClick={() => handleRemoveMember(m.id)}>Remove</button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Task Modal */}
      {showTaskModal && (
        <TaskModal
          task={selectedTask}
          projectId={id}
          members={members}
          canEdit={!selectedTask || canEditTask(selectedTask)}
          onClose={() => { setShowTaskModal(false); setSelectedTask(null); }}
          onSave={selectedTask ? handleUpdateTask : handleCreateTask}
        />
      )}

      {/* Member Modal */}
      {showMemberModal && (
        <MemberModal
          projectId={id}
          currentMembers={members}
          onClose={() => setShowMemberModal(false)}
          onSave={() => { fetchProject(); }}
        />
      )}
    </div>
  );
}
