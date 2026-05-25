'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/usePermissions';

const STATUS_COLS = [
  { id: 'NEW',         label: 'Новые',         color: 'var(--text-muted)', dot: 'var(--text-muted)' },
  { id: 'IN_PROGRESS', label: 'В работе',      color: 'var(--blue)',       dot: 'var(--blue)' },
  { id: 'REVIEW',      label: 'Проверка',      color: 'var(--orange)',     dot: 'var(--orange)' },
  { id: 'BLOCKED',     label: 'Заблокировано', color: 'var(--red)',        dot: 'var(--red)' },
  { id: 'DONE',        label: 'Готово',        color: 'var(--green)',      dot: 'var(--green)' },
];

const PRIORITY_STYLE: Record<string, { color: string; label: string }> = {
  LOW:      { color: 'var(--text-muted)', label: 'Низкий' },
  MEDIUM:   { color: 'var(--blue)',       label: 'Средний' },
  HIGH:     { color: 'var(--orange)',     label: 'Высокий' },
  CRITICAL: { color: 'var(--red)',        label: 'Критич.' },
};

export default function TasksPage() {
  const router  = useRouter();
  const perms   = usePermissions();
  const [columns, setColumns]   = useState<Record<string, any[]>>({});
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [newTask, setNewTask]   = useState({ title: '', priority: 'MEDIUM', description: '', assigneeId: '', dueDate: '' });
  const [token, setToken]       = useState('');
  const [mounted, setMounted]   = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t); loadKanban(t);
    fetch('https://employee-tracker.ru/api/v1/employees', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(d => setEmployees(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const loadKanban = async (t: string) => {
    setLoading(true);
    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/tasks/kanban', { headers: { Authorization: 'Bearer ' + t } });
      const data = await res.json(); setColumns(data);
    } finally { setLoading(false); }
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('https://employee-tracker.ru/api/v1/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ ...newTask, assigneeId: newTask.assigneeId || undefined, dueDate: newTask.dueDate || undefined }),
    });
    setNewTask({ title: '', priority: 'MEDIUM', description: '', assigneeId: '', dueDate: '' });
    setShowForm(false); loadKanban(token);
  };

  const moveTask = async (id: string, status: string) => {
    await fetch('https://employee-tracker.ru/api/v1/tasks/' + id + '/move', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ status }),
    });
    loadKanban(token);
  };

  const inputStyle = { width: '100%', background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none', fontFamily: 'inherit' };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-tertiary)', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-primary)', borderBottom: '0.5px solid var(--border)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Задачи</h1>
        {mounted && perms.canCreateTasks && (
          <button onClick={() => setShowForm(true)}
            style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
            + Новая задача
          </button>
        )}
      </div>

      {/* Kanban */}
      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)', fontSize: '13px' }}>Загрузка...</div>
      ) : (
        <div style={{ display: 'flex', gap: '0', flex: 1, overflowX: 'auto', padding: '0' }}>
          {STATUS_COLS.map(col => {
            const tasks = columns[col.id] ?? [];
            return (
              <div key={col.id} style={{ minWidth: '260px', flex: '1', borderRight: '0.5px solid var(--border)', display: 'flex', flexDirection: 'column' }}>
                {/* Column header */}
                <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', background: 'var(--bg-primary)', display: 'flex', alignItems: 'center', gap: '8px', position: 'sticky', top: '49px', zIndex: 9 }}>
                  <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: col.dot, flexShrink: 0 }} />
                  <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{col.label}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '2px' }}>{tasks.length}</span>
                </div>
                {/* Tasks */}
                <div style={{ flex: 1, padding: '10px', display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-tertiary)' }}>
                  {tasks.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '20px', fontSize: '12px', color: 'var(--text-muted)' }}>Нет задач</div>
                  ) : tasks.map(task => {
                    const ps = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.MEDIUM;
                    return (
                      <div key={task.id}
                        onClick={() => router.push('/dashboard/tasks/' + task.id)}
                        style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '12px', cursor: 'pointer', transition: 'border-color 0.15s' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'rgba(167,139,250,0.4)'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}>
                        <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 8px', lineHeight: 1.4 }}>{task.title}</p>

                        {/* Meta */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', marginBottom: task.assignee || task.dueDate ? '8px' : '0' }}>
                          <span style={{ fontSize: '11px', fontWeight: 500, color: ps.color }}>{ps.label}</span>
                          {task.dueDate && (
                            <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '6px', background: new Date(task.dueDate) < new Date() ? '#fef2f2' : '#f4f4f5', color: new Date(task.dueDate) < new Date() ? '#ef4444' : '#71717a' }}>
                              📅 {new Date(task.dueDate).toLocaleDateString('ru', { day: 'numeric', month: 'short' })}
                            </span>
                          )}
                          {task.assignee && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                              <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                <span style={{ color: 'white', fontSize: '8px', fontWeight: 700 }}>{task.assignee.name.charAt(0)}</span>
                              </div>
                              <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{task.assignee.name.split(' ')[0]}</span>
                            </div>
                          )}
                        </div>

                        {/* Actions */}
                        {mounted && perms.canUpdateAnyTask && (
                          <div style={{ display: 'flex', gap: '4px', marginTop: '8px' }} onClick={e => e.stopPropagation()}>
                            {col.id === 'NEW' && <button onClick={() => moveTask(task.id, 'IN_PROGRESS')} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: 'none', background: '#eff6ff', color: '#378add', cursor: 'pointer', fontWeight: 500 }}>В работу</button>}
                            {col.id === 'IN_PROGRESS' && <button onClick={() => moveTask(task.id, 'REVIEW')} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: 'none', background: '#fff7ed', color: '#f97316', cursor: 'pointer', fontWeight: 500 }}>На проверку</button>}
                            {col.id === 'REVIEW' && <button onClick={() => moveTask(task.id, 'DONE')} style={{ fontSize: '11px', padding: '3px 8px', borderRadius: '6px', border: 'none', background: '#f0fdf4', color: '#22c55e', cursor: 'pointer', fontWeight: 500 }}>Готово</button>}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius)', padding: '24px', width: '440px', border: '0.5px solid var(--border)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>Новая задача</h2>
            <form onSubmit={createTask} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input autoFocus placeholder="Название задачи" value={newTask.title} onChange={e => setNewTask({ ...newTask, title: e.target.value })} required style={inputStyle} />
              <textarea placeholder="Описание (необязательно)" value={newTask.description} onChange={e => setNewTask({ ...newTask, description: e.target.value })} rows={3} style={{ ...inputStyle, resize: 'none' }} />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Приоритет</label>
                  <select value={newTask.priority} onChange={e => setNewTask({ ...newTask, priority: e.target.value })} style={inputStyle}>
                    <option value="LOW">Низкий</option>
                    <option value="MEDIUM">Средний</option>
                    <option value="HIGH">Высокий</option>
                    <option value="CRITICAL">Критический</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Дедлайн</label>
                  <input type="date" value={newTask.dueDate} onChange={e => setNewTask({ ...newTask, dueDate: e.target.value })} min={new Date().toISOString().slice(0,10)} style={inputStyle} />
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '11px', color: 'var(--text-muted)', marginBottom: '4px' }}>Исполнитель</label>
                <select value={newTask.assigneeId} onChange={e => setNewTask({ ...newTask, assigneeId: e.target.value })} style={inputStyle}>
                  <option value="">Не назначен</option>
                  {employees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '0.5px solid var(--border)', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Отмена</button>
                <button type="submit" style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>Создать</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
