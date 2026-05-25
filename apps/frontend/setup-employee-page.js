const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

write('app/dashboard/employees/[id]/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

const PLATFORM_COLORS: Record<string, string> = {
  WILDBERRIES: '#7c3aed', OZON: '#2563eb', OTHER: '#94a3b8',
};
const PLATFORM_LABELS: Record<string, string> = {
  WILDBERRIES: 'Wildberries', OZON: 'Ozon', OTHER: 'Прочее',
};
const ROLE_COLORS: Record<string, string> = {
  ADMIN: 'bg-purple-100 text-purple-700', MANAGER: 'bg-blue-100 text-blue-700',
  EMPLOYEE: 'bg-green-100 text-green-700', VIEWER: 'bg-gray-100 text-gray-600',
};
const STATUS_LABELS: Record<string, string> = {
  NEW: 'Новые', IN_PROGRESS: 'В работе', REVIEW: 'Проверка', DONE: 'Готово',
};

export default function EmployeeProfilePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();

  const [token, setToken]       = useState('');
  const [employee, setEmployee] = useState<any>(null);
  const [activity, setActivity] = useState<any>(null);
  const [platforms, setPlatforms] = useState<any[]>([]);
  const [hourly, setHourly]     = useState<any[]>([]);
  const [tasks, setTasks]       = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [period, setPeriod]     = useState('7');

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    loadAll(t, '7');
  }, [id]);

  const loadAll = async (t: string, days: string) => {
    setLoading(true);
    try {
      const h = { Authorization: 'Bearer ' + t };
      const params = new URLSearchParams({ days, userId: id });

      const [empRes, actRes, platRes, hourRes, tasksRes] = await Promise.all([
        fetch('http://localhost:3001/api/v1/employees/' + id,          { headers: h }),
        fetch('http://localhost:3001/api/v1/analytics/activity/summary?' + params, { headers: h }),
        fetch('http://localhost:3001/api/v1/analytics/activity/platforms?' + params, { headers: h }),
        fetch('http://localhost:3001/api/v1/analytics/activity/hourly?' + params,   { headers: h }),
        fetch('http://localhost:3001/api/v1/tasks?assigneeId=' + id,   { headers: h }),
      ]);

      const [emp, act, plat, hour, tsk] = await Promise.all([
        empRes.json(), actRes.json(), platRes.json(), hourRes.json(), tasksRes.json(),
      ]);

      setEmployee(emp);
      const userActivity = Array.isArray(act) ? act.find((a: any) => a.userId === id) : null;
      setActivity(userActivity);
      setPlatforms(Array.isArray(plat) ? plat : []);
      setHourly(Array.isArray(hour) ? hour : []);
      setTasks(Array.isArray(tsk) ? tsk : []);
    } finally { setLoading(false); }
  };

  if (loading) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Загрузка...</div>
  );

  if (!employee) return (
    <div className="flex items-center justify-center h-64 text-gray-400">Сотрудник не найден</div>
  );

  const totalMins = activity?.totalEstimatedMins ?? 0;
  const totalEvents = activity?.totalEvents ?? 0;
  const tasksDone = tasks.filter((t: any) => t.status === 'DONE').length;
  const tasksInProgress = tasks.filter((t: any) => t.status === 'IN_PROGRESS').length;

  // Activity by day from summary
  const dayData = activity?.days ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard/employees')}
          className="text-gray-400 hover:text-gray-600 text-sm">← Назад</button>
        <h1 className="text-xl font-bold text-gray-900">Профиль сотрудника</h1>
      </div>

      <div className="p-6 flex flex-col gap-6">

        {/* Profile card */}
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start gap-5">
            <div className="w-16 h-16 rounded-full bg-indigo-500 flex items-center justify-center text-white text-2xl font-bold flex-shrink-0">
              {employee.name?.charAt(0)}
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h2 className="text-2xl font-bold text-gray-900">{employee.name}</h2>
                <span className={"text-xs font-medium px-2 py-1 rounded-full " + (ROLE_COLORS[employee.roles?.[0]] ?? 'bg-gray-100 text-gray-600')}>
                  {employee.roles?.[0] ?? 'EMPLOYEE'}
                </span>
                <span className={"text-xs font-medium px-2 py-1 rounded-full " +
                  (employee.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700')}>
                  {employee.status === 'ACTIVE' ? 'Активен' : 'Заблокирован'}
                </span>
              </div>
              <p className="text-gray-500 text-sm">{employee.email}</p>
              <p className="text-xs text-gray-400 mt-1">
                В системе с {new Date(employee.createdAt).toLocaleDateString('ru', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </div>

            {/* Period selector */}
            <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
              {[{l:'7д',v:'7'},{l:'14д',v:'14'},{l:'30д',v:'30'}].map(opt => (
                <button key={opt.v}
                  onClick={() => { setPeriod(opt.v); loadAll(token, opt.v); }}
                  className={"px-3 py-1 rounded-md text-xs font-medium transition-colors " +
                    (period === opt.v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500')}>
                  {opt.l}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-1">Событий</p>
            <p className="text-3xl font-bold text-indigo-600">{totalEvents.toLocaleString('ru')}</p>
            <p className="text-xs text-gray-400 mt-1">за {period} дней</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-1">~Активное время</p>
            <p className="text-3xl font-bold text-gray-900">
              {totalMins >= 60 ? Math.floor(totalMins/60) + 'ч ' + (totalMins%60) + 'м' : totalMins + 'м'}
            </p>
            <p className="text-xs text-gray-400 mt-1">за {period} дней</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-1">Задач выполнено</p>
            <p className="text-3xl font-bold text-green-600">{tasksDone}</p>
            <p className="text-xs text-gray-400 mt-1">из {tasks.length} всего</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <p className="text-sm text-gray-500 mb-1">В работе</p>
            <p className="text-3xl font-bold text-blue-600">{tasksInProgress}</p>
            <p className="text-xs text-gray-400 mt-1">активных задач</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Activity by day */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Активность по дням</h3>
            {dayData.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">Нет данных активности</p>
            ) : (
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={dayData.map((d: any) => ({ date: d.date.slice(5), events: d.eventCount }))}
                  margin={{ top: 0, right: 5, left: -25, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                  <Tooltip formatter={(v: any) => [v, 'Событий']} />
                  <Bar dataKey="events" fill="#6366f1" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Platforms */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Платформы</h3>
            {platforms.length === 0 ? (
              <p className="text-center text-gray-400 py-8 text-sm">Нет данных</p>
            ) : (
              <div className="flex flex-col gap-4 mt-2">
                {platforms.map((p: any, i: number) => (
                  <div key={i}>
                    <div className="flex justify-between text-sm mb-1.5">
                      <span className="font-medium" style={{ color: PLATFORM_COLORS[p.platform] }}>
                        {PLATFORM_LABELS[p.platform] ?? p.platform}
                      </span>
                      <span className="text-gray-500">{p.estimatedMins}м · {p.percent}%</span>
                    </div>
                    <div className="h-2.5 bg-gray-100 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all"
                        style={{ width: p.percent + '%', background: PLATFORM_COLORS[p.platform] ?? '#94a3b8' }} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Activity by hour */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-4">Активность по часам</h3>
          <ResponsiveContainer width="100%" height={150}>
            <BarChart data={hourly.filter((_: any, i: number) => i >= 7 && i <= 21)}
              margin={{ top: 0, right: 5, left: -25, bottom: 0 }} barSize={18}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 9 }} interval={1} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip formatter={(v: any) => [v, 'Событий']} />
              <Bar dataKey="events" fill="#6366f1" radius={[3,3,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Tasks */}
        {tasks.length > 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">Задачи сотрудника</h3>
            <div className="flex flex-col gap-2">
              {tasks.slice(0, 10).map((task: any) => (
                <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 border border-gray-100">
                  <span className={"text-xs font-medium px-2 py-0.5 rounded " +
                    (task.status === 'DONE' ? 'bg-green-100 text-green-700' :
                     task.status === 'IN_PROGRESS' ? 'bg-blue-100 text-blue-700' :
                     'bg-gray-100 text-gray-600')}>
                    {STATUS_LABELS[task.status] ?? task.status}
                  </span>
                  <span className="text-sm font-medium text-gray-900 flex-1 truncate">{task.title}</span>
                  <span className={"text-xs px-2 py-0.5 rounded font-medium " +
                    (task.priority === 'CRITICAL' ? 'bg-red-100 text-red-600' :
                     task.priority === 'HIGH' ? 'bg-orange-100 text-orange-600' :
                     'bg-gray-100 text-gray-500')}>
                    {task.priority === 'CRITICAL' ? 'Критич.' : task.priority === 'HIGH' ? 'Высокий' : task.priority}
                  </span>
                </div>
              ))}
              {tasks.length > 10 && (
                <p className="text-xs text-gray-400 text-center py-1">+{tasks.length - 10} задач</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
`);

// Update employees list page to add clickable rows
const empPage = fs.readFileSync('app/dashboard/employees/page.tsx', 'utf8');
const updatedEmpPage = empPage.replace(
  '<tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">',
  '<tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors cursor-pointer" onClick={() => router.push(\'/dashboard/employees/\' + emp.id)}>'
);
fs.writeFileSync('app/dashboard/employees/page.tsx', updatedEmpPage);
console.log('✓ employees list updated with clickable rows');

console.log('\n✅ Employee profile page created');
