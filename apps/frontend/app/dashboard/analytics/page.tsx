'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';

const STATUS_COLORS: Record<string, string> = { NEW:'var(--text-muted)', IN_PROGRESS:'var(--blue)', REVIEW:'var(--orange)', DONE:'var(--green)', OVERDUE:'var(--red)', BLOCKED:'var(--accent)' };
const STATUS_LABELS: Record<string, string> = { NEW: 'Новые', IN_PROGRESS: 'В работе', REVIEW: 'Проверка', DONE: 'Готово', OVERDUE: 'Просрочено', BLOCKED: 'Заблок.' };
const PRIORITY_COLORS: Record<string, string> = { CRITICAL:'var(--red)', HIGH:'var(--orange)', MEDIUM:'var(--blue)', LOW:'var(--text-muted)' };
const PRIORITY_LABELS: Record<string, string> = { CRITICAL: 'Критич.', HIGH: 'Высокий', MEDIUM: 'Средний', LOW: 'Низкий' };
const PLATFORM_COLORS: Record<string, string> = { WILDBERRIES:'var(--accent)', OZON:'var(--blue)', OTHER:'var(--text-muted)' };
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
  const [activeTab, setActiveTab]   = useState<'tasks' | 'activity' | 'feed'>('tasks');
  const [period, setPeriod]         = useState('7');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [feed, setFeed] = useState<any[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    fetch('https://employee-tracker.ru/api/v1/employees', { headers: { Authorization: 'Bearer ' + t } })
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
    const base = 'https://employee-tracker.ru/api/v1/analytics';
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

  const loadFeed = async (t: string) => {
    setFeedLoading(true);
    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/analytics/activity/feed?limit=100', { headers: { Authorization: 'Bearer ' + t } });
      const data = await res.json();
      if (Array.isArray(data)) setFeed(data);
    } catch(e) {} finally { setFeedLoading(false); }
  };
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
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', gap:'3px', background:'var(--bg-secondary)', borderRadius:'8px', padding:'3px' }}>
            <button style={tabBtnStyle(activeTab === 'tasks')}    onClick={() => setActiveTab('tasks')}>✓ Задачи</button>
            <button style={tabBtnStyle(activeTab === 'activity')} onClick={() => setActiveTab('activity')}>⏱ Активность</button>
            <button style={tabBtnStyle(activeTab === 'feed')} onClick={() => { setActiveTab('feed' as any); loadFeed(token); }}>🔴 Живой фид</button>
          </div>
          <a href="/dashboard/analytics/sections" style={{ fontSize:'12px', color:'var(--accent)', textDecoration:'none', padding:'6px 12px', borderRadius:'8px', background:'var(--accent-bg)', fontWeight:500 }}>
            📊 По разделам →
          </a>
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

        {(activeTab as any) === 'feed' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <p style={{ fontSize:'13px', color:'var(--text-muted)', margin:0 }}>
                {feedLoading ? 'Загрузка...' : feed.length + ' последних событий'}
              </p>
              <button onClick={()=>loadFeed(token)} style={{ fontSize:'12px', color:'var(--accent)', background:'var(--accent-bg)', border:'none', borderRadius:'7px', padding:'5px 12px', cursor:'pointer', fontWeight:500 }}>
                ↻ Обновить
              </button>
            </div>
            {feed.length===0 && !feedLoading ? (
              <div style={{ background:'var(--bg-primary)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', padding:'48px', textAlign:'center' }}>
                <p style={{ fontSize:'36px', marginBottom:'12px' }}>📡</p>
                <p style={{ fontSize:'15px', fontWeight:500, color:'var(--text-primary)', marginBottom:'6px' }}>Нет событий</p>
                <p style={{ fontSize:'13px', color:'var(--text-muted)' }}>Откройте WB или Ozon с установленным расширением</p>
              </div>
            ) : (
              <div style={{ background:'var(--bg-primary)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', overflow:'hidden' }}>
                {feed.map((event:any, i:number) => {
                  const isWB = event.platform==='WILDBERRIES';
                  const pd = event.platformData as any;
                  const section = pd?.section && pd.section!=='other' ? pd.section : null;
                  const evtType = event.eventType as string;
                  const isPing = evtType.includes('ping');
                  const isEnter = evtType.includes('enter');
                  const isLeave = evtType.includes('leave');
                  const color = isPing?'var(--text-muted)':isEnter?'var(--green)':isLeave?'var(--orange)':'var(--accent)';
                  const icon = isPing?'⏱':isEnter?'▶':isLeave?'⏸':'⚡';
                  const ago = Math.floor((Date.now()-new Date(event.createdAt).getTime())/60000);
                  const agoStr = ago<1?'только что':ago<60?ago+'м назад':Math.floor(ago/60)+'ч назад';
                  const avatarColors = ['#8b7cf6','#4d9de0','#22c55e','#f97316','#ef4444','#14b8a6'];
                  const avatarBg = avatarColors[(event.userName?.charCodeAt(0)??0)%avatarColors.length];
                  const actionLabels: Record<string,string> = { wb_review_reply:'Ответил на отзыв', wb_review_complaint:'Жалоба на отзыв', ozon_review_reply:'Ответил на отзыв', wb_price_save:'Сохранил цены', wb_price_edit:'Изменил цену', ozon_price_save:'Сохранил цены', wb_stock_update:'Обновил остатки', ozon_stock_update:'Обновил остатки', wb_product_edit:'Редактировал товар', ozon_product_edit:'Редактировал товар' };
                  const sectionLabels: Record<string,string> = { feedbacks:'Отзывы', reviews:'Отзывы', products:'Товары', prices:'Цены', advertising:'Реклама', analytics:'Аналитика', stocks:'Остатки', chat:'Чат', orders:'Заказы', finance:'Финансы', dashboard:'Дашборд' };
                  const label = actionLabels[evtType] ?? (isEnter?'Зашёл в раздел':isLeave?'Вышел из раздела':isPing?'Активен':evtType.replace(/^(wb_|ozon_)/,'').replace(/_/g,' '));
                  return (
                    <div key={event.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 16px', borderBottom:i<feed.length-1?'0.5px solid var(--border)':'none', opacity:isPing?0.5:1 }}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--bg-secondary)'}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                      <div style={{ width:'30px', height:'30px', borderRadius:'50%', background:avatarBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <span style={{ color:'white', fontSize:'11px', fontWeight:600 }}>{event.userName?.charAt(0)}</span>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                          <span style={{ fontSize:'13px', fontWeight:500, color:'var(--text-primary)' }}>{event.userName}</span>
                          <span style={{ fontSize:'11px', fontWeight:700, color:isWB?'var(--accent)':'var(--blue)', background:isWB?'var(--accent-bg)':'rgba(77,157,224,0.1)', padding:'1px 6px', borderRadius:'4px' }}>{isWB?'WB':'OZ'}</span>
                          {section && <span style={{ fontSize:'11px', color:'var(--text-muted)' }}>{sectionLabels[section]??section}</span>}
                        </div>
                        <p style={{ fontSize:'12px', color, margin:'1px 0 0' }}>{icon} {label}</p>
                      </div>
                      <span style={{ fontSize:'11px', color:'var(--text-muted)', flexShrink:0 }}>{agoStr}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
