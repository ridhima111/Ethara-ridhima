import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { dashboardAPI } from '../api';
import { useAuth } from '../context/AuthContext';
import { format, isPast, parseISO } from 'date-fns';

const StatusBadge = ({ status }) => (
  <span className={`badge badge-${status}`}>{status?.replace('_', ' ')}</span>
);
const PriorityBadge = ({ priority }) => (
  <span className={`badge badge-${priority}`}>{priority}</span>
);

const StatCard = ({ value, label, icon, color }) => (
  <div className="card" style={{ padding: '18px 20px' }}>
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <span style={{ fontSize: 22 }}>{icon}</span>
      <span style={{ fontSize: 26, fontFamily: 'Syne', fontWeight: 800, color: color || 'var(--text)' }}>
        {value ?? 0}
      </span>
    </div>
    <div style={{ fontSize: 12, color: 'var(--text-3)', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
      {label}
    </div>
  </div>
);

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dashboardAPI.get()
      .then(r => setData(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  const s = data?.globalStats || {};

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard</h1>
          <p style={{ color: 'var(--text-2)', marginTop: 4 }}>
            Welcome back, {user?.name?.split(' ')[0]} 👋
          </p>
        </div>
      </div>

      {/* Stats */}
      <div className="grid-4" style={{ marginBottom: 28 }}>
        <StatCard value={s.active_tasks} label="Active Tasks" icon="📋" color="var(--blue)" />
        <StatCard value={s.completed_tasks} label="Completed" icon="✅" color="var(--green)" />
        <StatCard value={s.overdue_tasks} label="Overdue" icon="⚠️" color="var(--red)" />
        <StatCard value={s.active_projects} label="Projects" icon="◫" color="var(--accent-2)" />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
        {/* My Tasks */}
        <div className="card">
          <h3 style={{ marginBottom: 14, fontSize: 15 }}>
            {user?.role === 'admin' ? '🔥 Urgent & High Priority Tasks' : '📋 My Active Tasks'}
          </h3>
          {data?.myTasks?.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px' }}>
              <div>🎉</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6 }}>All caught up!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data?.myTasks?.slice(0, 6).map(task => (
                <Link key={task.id} to={`/projects/${task.project_id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 8,
                    background: 'var(--bg-3)',
                    transition: 'background 0.1s',
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--bg-4)'}
                  onMouseOut={e => e.currentTarget.style.background = 'var(--bg-3)'}
                >
                  <PriorityBadge priority={task.priority} />
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {task.title}
                  </span>
                  <StatusBadge status={task.status} />
                  {task.due_date && (
                    <span style={{ fontSize: 11, color: isPast(parseISO(task.due_date)) ? 'var(--red)' : 'var(--text-3)', whiteSpace: 'nowrap' }}>
                      {format(parseISO(task.due_date), 'MMM d')}
                    </span>
                  )}
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Overdue Tasks */}
        <div className="card">
          <h3 style={{ marginBottom: 14, fontSize: 15, color: data?.overdueTasks?.length ? 'var(--red)' : 'inherit' }}>
            ⏰ Overdue Tasks {data?.overdueTasks?.length > 0 && `(${data.overdueTasks.length})`}
          </h3>
          {data?.overdueTasks?.length === 0 ? (
            <div className="empty-state" style={{ padding: '24px' }}>
              <div>✨</div>
              <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6 }}>No overdue tasks!</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data?.overdueTasks?.slice(0, 6).map(task => (
                <Link key={task.id} to={`/projects/${task.project_id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '10px 12px', borderRadius: 8,
                    background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
                  }}
                >
                  <span style={{ fontSize: 11, color: 'var(--red)', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {format(parseISO(task.due_date), 'MMM d')}
                  </span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {task.title}
                  </span>
                  <span style={{ fontSize: 12, color: 'var(--text-3)' }}>{task.project_name}</span>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Project overview */}
      <div className="card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <h3 style={{ fontSize: 15 }}>◫ Projects Overview</h3>
          <Link to="/projects" className="btn btn-ghost btn-sm">View all →</Link>
        </div>
        {data?.projectStats?.length === 0 ? (
          <div className="empty-state" style={{ padding: '24px' }}>
            <div>◫</div>
            <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 6 }}>No projects yet</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data?.projectStats?.map(p => {
              const pct = p.total_tasks ? Math.round((p.done_tasks / p.total_tasks) * 100) : 0;
              return (
                <Link key={p.id} to={`/projects/${p.id}`}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 16,
                    padding: '12px 14px', borderRadius: 8,
                    background: 'var(--bg-3)',
                    transition: 'background 0.1s',
                  }}
                  onMouseOver={e => e.currentTarget.style.background = 'var(--bg-4)'}
                  onMouseOut={e => e.currentTarget.style.background = 'var(--bg-3)'}
                >
                  <span style={{ flex: 1, fontSize: 14, fontWeight: 600 }}>{p.name}</span>
                  <span className={`badge badge-${p.status}`}>{p.status}</span>
                  {p.overdue > 0 && (
                    <span style={{ fontSize: 12, color: 'var(--red)' }}>⚠ {p.overdue} overdue</span>
                  )}
                  <div style={{ width: 120 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4, fontSize: 11, color: 'var(--text-3)' }}>
                      <span>{p.done_tasks}/{p.total_tasks} tasks</span>
                      <span>{pct}%</span>
                    </div>
                    <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${pct}%`, background: 'var(--accent)', borderRadius: 2, transition: 'width 0.5s' }} />
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
