const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

write('app/dashboard/timesheet/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const STATUS_CONFIG: Record<string, { label: string; color: string; dot: string }> = {
  present:     { label: 'Присутствует', color: 'bg-green-50 text-green-700',  dot: 'bg-green-500' },
  late:        { label: 'Опоздание',    color: 'bg-yellow-50 text-yellow-700', dot: 'bg-yellow-400' },
  early_leave: { label: 'Ранний уход',  color: 'bg-orange-50 text-orange-700', dot: 'bg-orange-400' },
  absent:      { label: 'Отсутствует',  color: 'bg-red-50 text-red-600',      dot: 'bg-red-400' },
  weekend:     { label: 'Выходной',     color: 'bg-gray-50 text-gray-400',    dot: 'bg-gray-200' },
  no_data:     { label: 'Нет данных',   color: 'bg-gray-50 text-gray-300',    dot: 'bg-gray-100' },
};

function formatMins(mins: number): string {
  if (!mins) return '—';
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h > 0 ? h + 'ч ' + m + 'м' : m + 'м';
}

export default function TimesheetPage() {
  const router = useRouter();
  const [token, setToken]   = useState('');
  const [data, setData]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('14');
  const [selectedUser, setSelectedUser] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    loadEmployees(t);
    load(t, '14', '');
  }, []);

  const loadEmployees = async (t: string) => {
    const res = await fetch('http://localhost:3001/api/v1/employees', {
      headers: { Authorization: 'Bearer ' + t },
    });
    const d = await res.json();
    setEmployees(Array.isArray(d) ? d : []);
  };

  const load = async (t: string, days: string, uid: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ days });
      if (uid) params.set('userId', uid);
      const res = await fetch('http://localhost:3001/api/v1/timesheet?' + params, {
        headers: { Authorization: 'Bearer ' + t },
      });
      const d = await res.json();
      setData(Array.isArray(d) ? d : []);
    } finally { setLoading(false); }
  };

  // Get all unique dates from first row
  const dates = data[0]?.days?.map((d: any) => ({ date: d.date, dayOfWeek: d.dayOfWeek })) ?? [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Табель рабочего времени</h1>
          <p className="text-sm text-gray-500 mt-0.5">Время начала и окончания работы по данным трекера</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Period */}
          <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
            {[{l:'7д',v:'7'},{l:'14д',v:'14'},{l:'30д',v:'30'}].map(opt => (
              <button key={opt.v}
                onClick={() => { setPeriod(opt.v); load(token, opt.v, selectedUser); }}
                className={"px-3 py-1 rounded-md text-xs font-medium transition-colors " +
                  (period === opt.v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500')}>
                {opt.l}
              </button>
            ))}
          </div>
          {/* Employee filter */}
          <select value={selectedUser}
            onChange={e => { setSelectedUser(e.target.value); load(token, period, e.target.value); }}
            className="text-sm border border-gray-200 rounded-lg px-3 py-1.5 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-400">
            <option value="">Все сотрудники</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Загрузка...</div>
      ) : (
        <div className="p-6 flex flex-col gap-6">

          {/* Summary cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { label: 'Сотрудников',    value: data.length,                                          color: 'text-gray-900' },
              { label: 'Присутствовали', value: data.reduce((s, r) => s + r.presentDays, 0),          color: 'text-green-600' },
              { label: 'Опозданий',      value: data.reduce((s, r) => s + r.lateDays, 0),             color: 'text-yellow-600' },
              { label: 'Отсутствий',     value: data.reduce((s, r) => s + r.absentDays, 0),           color: 'text-red-500' },
            ].map(card => (
              <div key={card.label} className="bg-white rounded-xl border border-gray-200 p-4">
                <p className="text-sm text-gray-500">{card.label}</p>
                <p className={"text-2xl font-bold " + card.color}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Timesheet table */}
          <div className="bg-white rounded-xl border border-gray-200 overflow-x-auto">
            <table className="text-xs min-w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-4 py-3 font-semibold text-gray-600 sticky left-0 bg-gray-50 min-w-40">Сотрудник</th>
                  <th className="text-center px-3 py-3 font-semibold text-gray-500 min-w-16">Среднее</th>
                  {dates.map((d: any) => (
                    <th key={d.date} className="text-center px-2 py-3 font-semibold text-gray-500 min-w-20">
                      <div>{d.dayOfWeek}</div>
                      <div className="text-gray-400 font-normal">{d.date.slice(5)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map(row => (
                  <tr key={row.userId} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-4 py-2 sticky left-0 bg-white hover:bg-gray-50">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {row.name.charAt(0)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 text-xs">{row.name}</p>
                          <p className="text-gray-400 text-xs">{row.avgStartTime} — {row.avgEndTime}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-2 text-center">
                      <div className="text-gray-700 font-medium">{row.avgStartTime}</div>
                      <div className="text-gray-400">{formatMins(Math.round(row.totalWorkMinutes / (row.presentDays || 1)))}/д</div>
                    </td>
                    {row.days.map((day: any) => {
                      const cfg = STATUS_CONFIG[day.status] ?? STATUS_CONFIG.no_data;
                      return (
                        <td key={day.date} className="px-2 py-2 text-center">
                          {day.status === 'weekend' || day.status === 'no_data' ? (
                            <div className={"text-xs px-1 py-0.5 rounded " + cfg.color}>—</div>
                          ) : day.status === 'absent' ? (
                            <div className="text-xs px-1 py-0.5 rounded bg-red-50 text-red-500 font-medium">Нет</div>
                          ) : (
                            <div className={"text-xs rounded px-1 py-0.5 " + cfg.color}>
                              <div className="font-medium">{day.firstEvent}</div>
                              <div className="opacity-70">{day.lastEvent}</div>
                              {day.lateMinutes > 15 && (
                                <div className="text-yellow-600 font-medium">+{day.lateMinutes}м</div>
                              )}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div className="flex gap-4 flex-wrap">
            {Object.entries(STATUS_CONFIG).filter(([k]) => k !== 'no_data').map(([key, cfg]) => (
              <div key={key} className="flex items-center gap-1.5 text-xs text-gray-500">
                <span className={"w-2 h-2 rounded-full flex-shrink-0 " + cfg.dot} />
                {cfg.label}
              </div>
            ))}
          </div>

        </div>
      )}
    </div>
  );
}
`);

// Add to sidebar
const sidebar = fs.readFileSync('components/layouts/Sidebar.tsx', 'utf8');
if (!sidebar.includes('/dashboard/timesheet')) {
  const updated = sidebar.replace(
    `{ href: '/dashboard/settings',     icon: '⚙️',  label: 'Настройки',      adminOnly: true  },`,
    `{ href: '/dashboard/timesheet',    icon: '🗓️',  label: 'Табель',          adminOnly: false },
    { href: '/dashboard/settings',     icon: '⚙️',  label: 'Настройки',      adminOnly: true  },`
  );
  fs.writeFileSync('components/layouts/Sidebar.tsx', updated);
  console.log('✓ sidebar updated');
}

console.log('\n✅ Timesheet frontend created');
