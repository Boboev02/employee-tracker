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
  XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer
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

function StatCard({ title, value, sub, color }: any) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5">
      <p className="text-sm text-gray-500 mb-1">{title}</p>
      <p className={"text-3xl font-bold " + (color ?? "text-gray-900")}>{value}</p>
      {sub && <p className="text-xs text-gray-400 mt-1">{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [token, setToken]       = useState('');
  const [stats, setStats]       = useState<any>(null);
  const [byStatus, setByStatus] = useState<any[]>([]);
  const [byPriority, setByPriority] = useState<any[]>([]);
  const [byDay, setByDay]       = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    loadAll(t);
  }, []);

  const loadAll = async (t: string) => {
    setLoading(true);
    try {
      const headers = { Authorization: 'Bearer ' + t };
      const base = 'http://localhost:3001/api/v1/analytics';
      const [s, bs, bp, bd, emp] = await Promise.all([
        fetch(base + '/stats',            { headers }).then(r => r.json()),
        fetch(base + '/tasks/by-status',  { headers }).then(r => r.json()),
        fetch(base + '/tasks/by-priority',{ headers }).then(r => r.json()),
        fetch(base + '/tasks/by-day?days=14', { headers }).then(r => r.json()),
        fetch(base + '/employees',        { headers }).then(r => r.json()),
      ]);
      setStats(s);
      setByStatus(Array.isArray(bs) ? bs.filter(x => x.count > 0) : []);
      setByPriority(Array.isArray(bp) ? bp.filter(x => x.count > 0) : []);
      setByDay(Array.isArray(bd) ? bd : []);
      setEmployees(Array.isArray(emp) ? emp : []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-gray-600 text-sm">← Назад</button>
        <h1 className="text-xl font-bold text-gray-900">Аналитика</h1>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Загрузка...</div>
      ) : (
        <div className="p-6 flex flex-col gap-6">

          {/* KPI cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <StatCard title="Сотрудников" value={stats?.totalUsers ?? 0} sub="в организации" />
            <StatCard title="Задач всего" value={stats?.totalTasks ?? 0} sub="создано" />
            <StatCard title="В работе" value={stats?.activeTasks ?? 0} color="text-blue-600" sub="активных задач" />
            <StatCard title="Выполнено" value={(stats?.completionRate ?? 0) + '%'} color="text-green-600" sub={"из " + (stats?.totalTasks ?? 0) + " задач"} />
          </div>

          {/* Charts row 1 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Tasks by status */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Задачи по статусам</h3>
              {byStatus.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Нет данных</p>
              ) : (
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={byStatus.map(d => ({ name: STATUS_LABELS[d.status] ?? d.status, count: d.count, status: d.status }))}
                    margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                    <Tooltip formatter={(v: any) => [v, 'Задач']} />
                    <Bar dataKey="count" radius={[4,4,0,0]}>
                      {byStatus.map((entry, i) => (
                        <Cell key={i} fill={STATUS_COLORS[entry.status] ?? '#94a3b8'} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              )}
            </div>

            {/* Tasks by priority */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Задачи по приоритетам</h3>
              {byPriority.length === 0 ? (
                <p className="text-gray-400 text-sm text-center py-8">Нет данных</p>
              ) : (
                <div className="flex items-center gap-4">
                  <ResponsiveContainer width="55%" height={200}>
                    <PieChart>
                      <Pie data={byPriority.map(d => ({ name: PRIORITY_LABELS[d.priority] ?? d.priority, value: d.count, priority: d.priority }))}
                        innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
                        {byPriority.map((entry, i) => (
                          <Cell key={i} fill={PRIORITY_COLORS[entry.priority] ?? '#94a3b8'} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(v: any) => [v, 'Задач']} />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="flex flex-col gap-2">
                    {byPriority.map((d, i) => (
                      <div key={i} className="flex items-center gap-2 text-sm">
                        <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ background: PRIORITY_COLORS[d.priority] ?? '#94a3b8' }} />
                        <span className="text-gray-600">{PRIORITY_LABELS[d.priority] ?? d.priority}</span>
                        <span className="font-semibold text-gray-900 ml-auto">{d.count}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Tasks by day chart */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Задачи за 14 дней</h3>
            <ResponsiveContainer width="100%" height={200}>
              <LineChart data={byDay} margin={{ top: 0, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                <XAxis dataKey="date" tick={{ fontSize: 10 }} tickFormatter={d => d.slice(5)} interval="preserveStartEnd" />
                <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                <Tooltip labelFormatter={l => 'Дата: ' + l} />
                <Legend iconSize={8} wrapperStyle={{ fontSize: 12 }} />
                <Line type="monotone" dataKey="created" name="Создано" stroke="#2563eb" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="done"    name="Выполнено" stroke="#16a34a" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Employee leaderboard */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Сотрудники — задачи</h3>
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left py-2 text-xs text-gray-500 font-semibold uppercase">Сотрудник</th>
                  <th className="text-center py-2 text-xs text-gray-500 font-semibold uppercase">Создано</th>
                  <th className="text-center py-2 text-xs text-gray-500 font-semibold uppercase">В работе</th>
                  <th className="text-center py-2 text-xs text-gray-500 font-semibold uppercase">Выполнено</th>
                  <th className="text-left py-2 text-xs text-gray-500 font-semibold uppercase">Прогресс</th>
                </tr>
              </thead>
              <tbody>
                {employees.map((emp, i) => {
                  const total = emp.created || 1;
                  const pct = Math.round(emp.completed / total * 100);
                  return (
                    <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                            {emp.name.charAt(0)}
                          </div>
                          <div>
                            <p className="font-medium text-gray-900">{emp.name}</p>
                            <p className="text-xs text-gray-400">{emp.role}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-2.5 text-center text-gray-600">{emp.created}</td>
                      <td className="py-2.5 text-center text-blue-600 font-medium">{emp.inProgress}</td>
                      <td className="py-2.5 text-center text-green-600 font-medium">{emp.completed}</td>
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                            <div className="h-full bg-green-500 rounded-full" style={{ width: pct + '%' }} />
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

        </div>
      )}
    </div>
  );
}
`);

console.log('\n✅ Analytics frontend created');
