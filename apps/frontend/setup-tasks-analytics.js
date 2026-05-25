const fs = require('fs');
const path = require('path');
function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

// ─── TASKS PAGE ───────────────────────────────────────────────
write('app/dashboard/tasks/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/usePermissions';

const STATUS_COLS = [
  { id: 'NEW',         label: 'Новые',        color: '#a1a1aa', dot: '#d4d4d8' },
  { id: 'IN_PROGRESS', label: 'В работе',     color: '#378add', dot: '#378add' },
  { id: 'REVIEW',      label: 'Проверка',     color: '#f97316', dot: '#f97316' },
  { id: 'BLOCKED',     label: 'Заблокировано',color: '#ef4444', dot: '#ef4444' },
  { id: 'DONE',        label: 'Готово',       color: '#22c55e', dot: '#22c55e' },
];

const PRIORITY_STYLE: Record<string, { color: string; label: string }> = {
  LOW:      { color: '#a1a1aa', label: 'Низкий' },
  MEDIUM:   { color: '#378add', label: 'Средний' },
  HIGH:     { color: '#f97316', label: 'Высокий' },
  CRITICAL: { color: '#ef4444', label: 'Критич.' },
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
    fetch('http://localhost:3001/api/v1/employees', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(d => setEmployees(Array.isArray(d) ? d : [])).catch(() => {});
  }, []);

  const loadKanban = async (t: string) => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/v1/tasks/kanban', { headers: { Authorization: 'Bearer ' + t } });
      const data = await res.json(); setColumns(data);
    } finally { setLoading(false); }
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('http://localhost:3001/api/v1/tasks', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ ...newTask, assigneeId: newTask.assigneeId || undefined, dueDate: newTask.dueDate || undefined }),
    });
    setNewTask({ title: '', priority: 'MEDIUM', description: '', assigneeId: '', dueDate: '' });
    setShowForm(false); loadKanban(token);
  };

  const moveTask = async (id: string, status: string) => {
    await fetch('http://localhost:3001/api/v1/tasks/' + id + '/move', {
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
`);
console.log('✓ tasks page done');

// ─── ANALYTICS PAGE ───────────────────────────────────────────
write('app/dashboard/analytics/page.tsx', `'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const STATUS_COLORS: Record<string, string> = { NEW: '#d4d4d8', IN_PROGRESS: '#378add', REVIEW: '#f97316', DONE: '#22c55e', OVERDUE: '#ef4444', BLOCKED: '#a78bfa' };
const STATUS_LABELS: Record<string, string> = { NEW: 'Новые', IN_PROGRESS: 'В работе', REVIEW: 'Проверка', DONE: 'Готово', OVERDUE: 'Просрочено', BLOCKED: 'Заблок.' };
const PRIORITY_COLORS: Record<string, string> = { CRITICAL: '#ef4444', HIGH: '#f97316', MEDIUM: '#378add', LOW: '#a1a1aa' };
const PRIORITY_LABELS: Record<string, string> = { CRITICAL: 'Критич.', HIGH: 'Высокий', MEDIUM: 'Средний', LOW: 'Низкий' };
const PLATFORM_COLORS: Record<string, string> = { WILDBERRIES: '#a78bfa', OZON: '#378add', OTHER: '#d4d4d8' };
const PLATFORM_LABELS: Record<string, string> = { WILDBERRIES: 'Wildberries', OZON: 'Ozon', OTHER: 'Прочее' };
const PERIODS = [{ l: 'Сегодня', v: '1' },{ l: '7 дней', v: '7' },{ l: '14 дней', v: '14' },{ l: '30 дней', v: '30' }];

const tooltipStyle = { background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: '8px', fontSize: '12px' };

function StatCard({ title, value, color }: any) {
  return (
    <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px' }}>
      <p style={{ fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: '0 0 8px' }}>{title}</p>
      <p style={{ fontSize: '24px', fontWeight: 600, color: color ?? 'var(--text-primary)', margin: 0 }}>{value ?? '—'}</p>
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [token, setToken]           = useState('');
  const [stats, setStats]           = useState<any>(null);
  const [byStatus, setByStatus]     = useState<any[]>([]);
  const [byPriority, setByPriority] = useState<any[]>([]);
  const [byDay, setByDay]           = useState<any[]>([]);
  const [employees, setEmployees]   = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [activity, setActivity]     = useState<any[]>([]);
  const [platforms, setPlatforms]   = useState<any[]>([]);
  const [hourly, setHourly]         = useState<any[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState<'tasks' | 'activity'>('tasks');
  const [period, setPeriod]         = useState('7');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    fetch('http://localhost:3001/api/v1/employees', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(d => setAllEmployees(Array.isArray(d) ? d : []));
    loadAll(t, '7', '', '');
    const interval = setInterval(() => {
      const ct = localStorage.getItem('access_token');
      if (ct) loadAll(ct, period, selectedEmployee, selectedPlatform);
    }, 60_000);
    return () => clearInterval(interval);
  }, []);

  const loadAll = useCallback(async (t: string, days: string, empId: string, platform: string) => {
    setLoading(true);
    const h = { Authorization: 'Bearer ' + t };
    const base = 'http://localhost:3001/api/v1/analytics';
    const params = new URLSearchParams({ days });
    if (empId) params.set('userId', empId);
    if (platform) params.set('platform', platform);
    try {
      const [s, bs, bp, bd, emp, act, plat, hour, total] = await Promise.all([
        fetch(base + '/stats', { headers: h }).then(r => r.json()),
        fetch(base + '/tasks/by-status', { headers: h }).then(r => r.json()),
        fetch(base + '/tasks/by-priority', { headers: h }).then(r => r.json()),
        fetch(base + '/tasks/by-day?days=' + days, { headers: h }).then(r => r.json()),
        fetch(base + '/employees', { headers: h }).then(r => r.json()),
        fetch(base + '/activity/summary?' + params, { headers: h }).then(r => r.json()),
        fetch(base + '/activity/platforms?' + params, { headers: h }).then(r => r.json()),
        fetch(base + '/activity/hourly?' + params, { headers: h }).then(r => r.json()),
        fetch(base + '/activity/total', { headers: h }).then(r => r.json()),
      ]);
      setStats(s); setByStatus(Array.isArray(bs) ? bs.filter((x: any) => x.count > 0) : []);
      setByPriority(Array.isArray(bp) ? bp.filter((x: any) => x.count > 0) : []);
      setByDay(Array.isArray(bd) ? bd : []); setEmployees(Array.isArray(emp) ? emp : []);
      setActivity(Array.isArray(act) ? act : []); setPlatforms(Array.isArray(plat) ? plat : []);
      setHourly(Array.isArray(hour) ? hour : []);
      setTotalEvents(typeof total === 'number' ? total : 0);
      setLastUpdated(new Date());
    } finally { setLoading(false); }
  }, []);

  const applyFilters = (p = period, e = selectedEmployee, pl = selectedPlatform) => loadAll(token, p, e, pl);
  const hasFilters = period !== '7' || selectedEmployee !== '' || selectedPlatform !== '';
  const hasActivity = totalEvents > 0;
  const filteredActivity = selectedEmployee ? activity.filter(a => a.userId === selectedEmployee) : activity;

  const tabBtnStyle = (active: boolean) => ({ padding: '6px 14px', borderRadius: '7px', fontSize: '13px', fontWeight: active ? 500 : 400, border: 'none', cursor: 'pointer', background: active ? 'var(--bg-primary)' : 'transparent', color: active ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'all 0.15s' });
  const selectStyle = { background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', color: 'var(--text-primary)', outline: 'none' };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-tertiary)' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-primary)', borderBottom: '0.5px solid var(--border)', padding: '14px 24px', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <h1 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Аналитика</h1>
          {lastUpdated && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Обновлено {lastUpdated.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</span>}
        </div>
        {/* Filters */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '3px', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '3px' }}>
            {PERIODS.map(opt => (
              <button key={opt.v} onClick={() => { setPeriod(opt.v); applyFilters(opt.v); }}
                style={{ padding: '4px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: period === opt.v ? 500 : 400, border: 'none', cursor: 'pointer', background: period === opt.v ? 'var(--bg-primary)' : 'transparent', color: period === opt.v ? 'var(--text-primary)' : 'var(--text-muted)' }}>
                {opt.l}
              </button>
            ))}
          </div>
          <select value={selectedEmployee} onChange={e => { setSelectedEmployee(e.target.value); applyFilters(period, e.target.value); }} style={selectStyle}>
            <option value="">Все сотрудники</option>
            {allEmployees.map(emp => <option key={emp.id} value={emp.id}>{emp.name}</option>)}
          </select>
          <select value={selectedPlatform} onChange={e => { setSelectedPlatform(e.target.value); applyFilters(period, selectedEmployee, e.target.value); }} style={selectStyle}>
            <option value="">Все платформы</option>
            <option value="WILDBERRIES">Wildberries</option>
            <option value="OZON">Ozon</option>
          </select>
          {hasFilters && <button onClick={() => { setPeriod('7'); setSelectedEmployee(''); setSelectedPlatform(''); loadAll(token,'7','',''); }} style={{ fontSize: '12px', color: 'var(--text-muted)', background: 'none', border: 'none', cursor: 'pointer', textDecoration: 'underline' }}>Сбросить</button>}
          {loading && <span style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: 'auto' }}>Обновление...</span>}
        </div>
      </div>

      <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* KPI */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
          <StatCard title="Сотрудников" value={stats?.totalUsers} />
          <StatCard title="Задач"        value={stats?.totalTasks} />
          <StatCard title="В работе"     value={stats?.activeTasks} color="#378add" />
          <StatCard title="Выполнено"    value={stats?.completionRate != null ? stats.completionRate + '%' : null} color="#22c55e" />
          <StatCard title="Событий"      value={totalEvents ? totalEvents.toLocaleString('ru') : null} color={hasActivity ? '#a78bfa' : undefined} />
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '3px', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '3px', width: 'fit-content' }}>
          <button style={tabBtnStyle(activeTab === 'tasks')}    onClick={() => setActiveTab('tasks')}>✓ Задачи</button>
          <button style={tabBtnStyle(activeTab === 'activity')} onClick={() => setActiveTab('activity')}>⏱ Активность</button>
        </div>

        {/* TASKS TAB */}
        {activeTab === 'tasks' && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px' }}>
                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 14px' }}>По статусам</p>
                {byStatus.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Нет данных</p> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={byStatus.map(d => ({ name: STATUS_LABELS[d.status] ?? d.status, count: d.count, status: d.status }))} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                      <XAxis dataKey="name" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                      <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} allowDecimals={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Bar dataKey="count" radius={[4,4,0,0]}>
                        {byStatus.map((e: any, i: number) => <Cell key={i} fill={STATUS_COLORS[e.status] ?? '#d4d4d8'} />)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px' }}>
                <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 14px' }}>По приоритетам</p>
                {byPriority.length === 0 ? <p style={{ color: 'var(--text-muted)', fontSize: '13px', textAlign: 'center', padding: '20px' }}>Нет данных</p> : (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <ResponsiveContainer width="55%" height={180}>
                      <PieChart>
                        <Pie data={byPriority.map(d => ({ name: PRIORITY_LABELS[d.priority], value: d.count, priority: d.priority }))} innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                          {byPriority.map((e: any, i: number) => <Cell key={i} fill={PRIORITY_COLORS[e.priority] ?? '#d4d4d8'} />)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {byPriority.map((d: any, i: number) => (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px' }}>
                          <span style={{ width: '10px', height: '10px', borderRadius: '3px', background: PRIORITY_COLORS[d.priority] ?? '#d4d4d8', flexShrink: 0 }} />
                          <span style={{ color: 'var(--text-secondary)' }}>{PRIORITY_LABELS[d.priority]}</span>
                          <span style={{ fontWeight: 600, color: 'var(--text-primary)', marginLeft: 'auto' }}>{d.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px' }}>
              <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 14px' }}>Задачи за {PERIODS.find(p => p.v === period)?.l ?? period + ' дней'}</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={byDay} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                  <XAxis dataKey="date" tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} allowDecimals={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="created" name="Создано"   stroke="#a78bfa" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="done"    name="Выполнено" stroke="#22c55e" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Employee task table */}
            <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Задачи по сотрудникам</p>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Сотрудник','Создано','В работе','Выполнено','Прогресс'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--bg-secondary)', borderBottom: '0.5px solid var(--border)', textAlign: h === 'Сотрудник' ? 'left' : 'center' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.filter(e => !selectedEmployee || e.id === selectedEmployee).map(emp => {
                    const total = emp.created || 1; const pct = Math.round(emp.completed / total * 100);
                    return (
                      <tr key={emp.id}>
                        <td style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ color: 'white', fontSize: '11px', fontWeight: 600 }}>{emp.name.charAt(0)}</span>
                            </div>
                            <div>
                              <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{emp.name}</p>
                              <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>{emp.role}</p>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>{emp.created}</td>
                        <td style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', textAlign: 'center', fontSize: '13px', fontWeight: 500, color: '#378add' }}>{emp.inProgress}</td>
                        <td style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', textAlign: 'center', fontSize: '13px', fontWeight: 500, color: '#22c55e' }}>{emp.completed}</td>
                        <td style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <div style={{ flex: 1, height: '4px', background: 'var(--bg-secondary)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ height: '4px', width: pct + '%', background: '#22c55e', borderRadius: '2px' }} />
                            </div>
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '28px', textAlign: 'right' }}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ACTIVITY TAB */}
        {activeTab === 'activity' && (
          <>
            {!hasActivity ? (
              <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '48px', textAlign: 'center' }}>
                <p style={{ fontSize: '36px', marginBottom: '12px' }}>🔌</p>
                <p style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '6px' }}>Нет данных активности</p>
                <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Установи Chrome расширение и открой WB или Ozon</p>
              </div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                  <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 14px' }}>По платформам</p>
                    {platforms.filter(p => !selectedPlatform || p.platform === selectedPlatform).map((p: any, i: number) => (
                      <div key={i} style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 500, color: PLATFORM_COLORS[p.platform] ?? '#d4d4d8' }}>{PLATFORM_LABELS[p.platform] ?? p.platform}</span>
                          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{p.estimatedMins}м · {p.percent}%</span>
                        </div>
                        <div style={{ height: '6px', background: 'var(--bg-secondary)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ height: '6px', width: p.percent + '%', background: PLATFORM_COLORS[p.platform] ?? '#d4d4d8', borderRadius: '3px', transition: 'width 0.5s' }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px' }}>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: '0 0 14px' }}>По часам</p>
                    <ResponsiveContainer width="100%" height={160}>
                      <BarChart data={hourly.filter((_: any, i: number) => i >= 7 && i <= 22)} margin={{ top: 0, right: 5, left: -25, bottom: 0 }} barSize={14}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
                        <XAxis dataKey="label" tick={{ fontSize: 9, fill: 'var(--text-secondary)' }} interval={2} />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--text-secondary)' }} allowDecimals={false} />
                        <Tooltip contentStyle={tooltipStyle} />
                        <Bar dataKey="events" fill="#a78bfa" radius={[3,3,0,0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </div>

                {/* Activity table */}
                <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', display: 'flex', justifyContent: 'space-between', background: 'var(--bg-secondary)' }}>
                    <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Активность сотрудников</p>
                    <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{PERIODS.find(p => p.v === period)?.l}</span>
                  </div>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr>
                        {['Сотрудник','Событий','~Время','Активность'].map(h => (
                          <th key={h} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--bg-secondary)', borderBottom: '0.5px solid var(--border)', textAlign: h === 'Сотрудник' ? 'left' : 'center' }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filteredActivity.map((emp: any) => {
                        const max = Math.max(...filteredActivity.map((e: any) => e.totalEvents), 1);
                        const pct = Math.round(emp.totalEvents / max * 100);
                        return (
                          <tr key={emp.userId} style={{ cursor: 'pointer' }}
                            onClick={() => { setSelectedEmployee(emp.userId); applyFilters(period, emp.userId); }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                            <td style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                  <span style={{ color: 'white', fontSize: '11px', fontWeight: 600 }}>{emp.name.charAt(0)}</span>
                                </div>
                                <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{emp.name}</span>
                              </div>
                            </td>
                            <td style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', textAlign: 'center', fontSize: '13px', fontWeight: 500, color: '#a78bfa' }}>{emp.totalEvents.toLocaleString('ru')}</td>
                            <td style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', textAlign: 'center', fontSize: '13px', color: 'var(--text-secondary)' }}>
                              {emp.totalEstimatedMins >= 60 ? Math.floor(emp.totalEstimatedMins/60) + 'ч ' + (emp.totalEstimatedMins%60) + 'м' : emp.totalEstimatedMins + 'м'}
                            </td>
                            <td style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)' }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <div style={{ flex: 1, height: '4px', background: 'var(--bg-secondary)', borderRadius: '2px', overflow: 'hidden' }}>
                                  <div style={{ height: '4px', width: pct + '%', background: '#a78bfa', borderRadius: '2px' }} />
                                </div>
                                <span style={{ fontSize: '11px', color: 'var(--text-muted)', width: '28px' }}>{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}
`);
console.log('✓ analytics page done');
console.log('\n✅ Tasks & Analytics updated');
