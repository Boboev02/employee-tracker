const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

write('app/dashboard/analytics/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts';

const STATUS_COLORS: Record<string, string> = {
  NEW: '#71717a', IN_PROGRESS: '#2563eb', REVIEW: '#d97706',
  DONE: '#16a34a', OVERDUE: '#dc2626', BLOCKED: '#7c3aed',
};
const STATUS_LABELS: Record<string, string> = {
  NEW: 'Новые', IN_PROGRESS: 'В работе', REVIEW: 'Проверка',
  DONE: 'Готово', OVERDUE: 'Просрочено', BLOCKED: 'Заблок.',
};
const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: '#dc2626', HIGH: '#d97706', MEDIUM: '#2563eb', LOW: '#16a34a',
};
const PRIORITY_LABELS: Record<string, string> = {
  CRITICAL: 'Критический', HIGH: 'Высокий', MEDIUM: 'Средний', LOW: 'Низкий',
};
const PLATFORM_COLORS: Record<string, string> = {
  WILDBERRIES: '#7c3aed', OZON: '#2563eb', OTHER: '#94a3b8',
};
const PLATFORM_LABELS: Record<string, string> = {
  WILDBERRIES: 'Wildberries', OZON: 'Ozon', OTHER: 'Прочее',
};

function StatCard({ title, value, sub, color }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      <p className={"text-3xl font-bold " + (color ?? "text-gray-900")}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-gray-400">
      <p className="text-4xl mb-3">📊</p>
      <p className="text-sm">{message}</p>
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
  const [activity, setActivity]     = useState<any[]>([]);
  const [platforms, setPlatforms]   = useState<any[]>([]);
  const [hourly, setHourly]         = useState<any[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState<'tasks' | 'activity'>('tasks');

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    loadAll(t);
  }, []);

  const loadAll = async (t: string) => {
    setLoading(true);
    try {
      const h = { Authorization: 'Bearer ' + t };
      const base = 'http://localhost:3001/api/v1/analytics';
      const [s, bs, bp, bd, emp, act, plat, hour, total] = await Promise.all([
        fetch(base + '/stats',              { headers: h }).then(r => r.json()),
        fetch(base + '/tasks/by-status',    { headers: h }).then(r => r.json()),
        fetch(base + '/tasks/by-priority',  { headers: h }).then(r => r.json()),
        fetch(base + '/tasks/by-day?days=14', { headers: h }).then(r => r.json()),
        fetch(base + '/employees',          { headers: h }).then(r => r.json()),
        fetch(base + '/activity/summary',   { headers: h }).then(r => r.json()),
        fetch(base + '/activity/platforms', { headers: h }).then(r => r.json()),
        fetch(base + '/activity/hourly',    { headers: h }).then(r => r.json()),
        fetch(base + '/activity/total',     { headers: h }).then(r => r.json()),
      ]);
      setStats(s);
      setByStatus(Array.isArray(bs) ? bs.filter((x: any) => x.count > 0) : []);
      setByPriority(Array.isArray(bp) ? bp.filter((x: any) => x.count > 0) : []);
      setByDay(Array.isArray(bd) ? bd : []);
      setEmployees(Array.isArray(emp) ? emp : []);
      setActivity(Array.isArray(act) ? act : []);
      setPlatforms(Array.isArray(plat) ? plat : []);
      setHourly(Array.isArray(hour) ? hour : []);
      setTotalEvents(typeof total === 'number' ? total : 0);
    } finally { setLoading(false); }
  };

  const hasActivity = totalEvents > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Аналитика</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Загрузка...</div>
      ) : (
        <div className="p-6 flex flex-col gap-6">

          {/* KPI */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <StatCard title="Сотрудников"  value={stats?.totalUsers ?? 0} />
            <StatCard title="Задач"         value={stats?.totalTasks ?? 0} />
            <StatCard title="В работе"      value={stats?.activeTasks ?? 0} color="text-blue-600" />
            <StatCard title="Выполнено"     value={(stats?.completionRate ?? 0) + '%'} color="text-green-600" />
            <StatCard title="Событий"       value={totalEvents.toLocaleString('ru')}
              sub={hasActivity ? 'от расширения' : 'установи расширение'} color={hasActivity ? 'text-indigo-600' : 'text-gray-400'} />
          </div>

          {/* Tabs */}
          <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit">
            {(['tasks', 'activity'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={"px-4 py-1.5 rounded-md text-sm font-medium transition-colors " +
                  (activeTab === tab ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700')}>
                {tab === 'tasks' ? '✓ Задачи' : '⏱ Активность'}
              </button>
            ))}
          </div>

          {/* TASKS TAB */}
          {activeTab === 'tasks' && (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">По статусам</h3>
                  {byStatus.length === 0 ? <EmptyState message="Нет задач" /> : (
                    <ResponsiveContainer width="100%" height={200}>
                      <BarChart data={byStatus.map(d => ({ name: STATUS_LABELS[d.status] ?? d.status, count: d.count, status: d.status }))}
                        margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                        <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                        <Tooltip formatter={(v: any) => [v, 'Задач']} />
                        <Bar dataKey="count" radius={[4,4,0,0]}>
                          {byStatus.map((entry: any, i: number) => (
                            <Cell key={i} fill={STATUS_COLORS[entry.status] ?? '#94a3b8'} />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  )}
                </div>
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-4">По приоритетам</h3>
                  {byPriority.length === 0 ? <EmptyState message="Нет задач" /> : (
                    <div className="flex items-center gap-4">
                      <ResponsiveContainer width="55%" height={180}>
                        <PieChart>
                          <Pie data={byPriority.map(d => ({ name: PRIORITY_LABELS[d.priority], value: d.count, priority: d.priority }))}
                            innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                            {byPriority.map((entry: any, i: number) => (
                              <Cell key={i} fill={PRIORITY_COLORS[entry.priority] ?? '#94a3b8'} />
                            ))}
                          </Pie>
                          <Tooltip formatter={(v: any) => [v, 'Задач']} />
                        </PieChart>
                      </ResponsiveContainer>
                      <div className="flex flex-col gap-2">
                        {byPriority.map((d: any, i: number) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <span className="w-3 h-3 rounded-sm" style={{ background: PRIORITY_COLORS[d.priority] ?? '#94a3b8' }} />
                            <span className="text-gray-600">{PRIORITY_LABELS[d.priority]}</span>
                            <span className="font-semibold ml-auto">{d.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="bg-white rounded-xl border border-gray-200 p-5">
                <h3 className="text-sm font-semibold text-gray-700 mb-4">Задачи за 14 дней</h3>
                <ResponsiveContainer width="100%" height={180}>
                  <LineChart data={byDay} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                    <Line type="monotone" dataKey="created" name="Создано" stroke="#2563eb" strokeWidth={2} dot={false} />
                    <Line type="monotone" dataKey="done"    name="Выполнено" stroke="#16a34a" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </>
          )}

          {/* ACTIVITY TAB */}
          {activeTab === 'activity' && (
            <>
              {!hasActivity ? (
                <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
                  <p className="text-5xl mb-4">🔌</p>
                  <h3 className="text-lg font-semibold text-gray-700 mb-2">Нет данных активности</h3>
                  <p className="text-sm text-gray-500 max-w-md mx-auto">
                    Установи Chrome расширение и открой seller.wildberries.ru или seller.ozon.ru.
                    Данные появятся автоматически через несколько минут.
                  </p>
                </div>
              ) : (
                <>
                  {/* Platform breakdown */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                      <h3 className="text-sm font-semibold text-gray-700 mb-4">Активность по платформам</h3>
                      <div className="flex flex-col gap-3">
                        {platforms.map((p: any, i: number) => (
                          <div key={i}>
                            <div className="flex justify-between text-sm mb-1">
                              <span className="font-medium" style={{ color: PLATFORM_COLORS[p.platform] ?? '#94a3b8' }}>
                                {PLATFORM_LABELS[p.platform] ?? p.platform}
                              </span>
                              <span className="text-gray-500">{p.estimatedMins}м · {p.percent}%</span>
                            </div>
                            <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                              <div className="h-full rounded-full transition-all"
                                style={{ width: p.percent + '%', background: PLATFORM_COLORS[p.platform] ?? '#94a3b8' }} />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Hourly heatmap */}
                    <div className="bg-white rounded-xl border border-gray-200 p-5">
                      <h3 className="text-sm font-semibold text-gray-700 mb-4">Активность по часам (7 дней)</h3>
                      <ResponsiveContainer width="100%" height={160}>
                        <BarChart data={hourly.filter((_: any, i: number) => i >= 7 && i <= 22)}
                          margin={{ top: 0, right: 5, left: -25, bottom: 0 }} barSize={14}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                          <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={2} />
                          <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                          <Tooltip formatter={(v: any) => [v + ' событий', 'Активность']} />
                          <Bar dataKey="events" fill="#6366f1" radius={[3,3,0,0]} />
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </div>

                  {/* Activity by employee */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5">
                    <h3 className="text-sm font-semibold text-gray-700 mb-4">Активность сотрудников (7 дней)</h3>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-gray-100">
                          <th className="text-left py-2 text-xs text-gray-500 font-semibold uppercase">Сотрудник</th>
                          <th className="text-center py-2 text-xs text-gray-500 font-semibold uppercase">Событий</th>
                          <th className="text-center py-2 text-xs text-gray-500 font-semibold uppercase">~Время</th>
                          <th className="text-left py-2 text-xs text-gray-500 font-semibold uppercase">Активность</th>
                        </tr>
                      </thead>
                      <tbody>
                        {activity.map((emp: any) => {
                          const maxEvents = Math.max(...activity.map((e: any) => e.totalEvents), 1);
                          const pct = Math.round(emp.totalEvents / maxEvents * 100);
                          return (
                            <tr key={emp.userId} className="border-b border-gray-50 hover:bg-gray-50">
                              <td className="py-2.5">
                                <div className="flex items-center gap-2">
                                  <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                                    {emp.name.charAt(0)}
                                  </div>
                                  <span className="font-medium">{emp.name}</span>
                                </div>
                              </td>
                              <td className="py-2.5 text-center font-medium text-indigo-600">{emp.totalEvents.toLocaleString('ru')}</td>
                              <td className="py-2.5 text-center text-gray-600">
                                {emp.totalEstimatedMins >= 60
                                  ? Math.floor(emp.totalEstimatedMins / 60) + 'ч ' + (emp.totalEstimatedMins % 60) + 'м'
                                  : emp.totalEstimatedMins + 'м'}
                              </td>
                              <td className="py-2.5 w-48">
                                <div className="flex items-center gap-2">
                                  <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                    <div className="h-full bg-indigo-500 rounded-full" style={{ width: pct + '%' }} />
                                  </div>
                                  <span className="text-xs text-gray-400 w-8">{pct}%</span>
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
      )}
    </div>
  );
}
`);

console.log('\n✅ Active time frontend created');
