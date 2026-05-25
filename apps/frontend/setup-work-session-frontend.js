const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

// ─── Work session widget (shown in dashboard for EMPLOYEE) ────
write('components/WorkSessionWidget.tsx', `'use client';
import { useEffect, useState, useCallback } from 'react';

type Status = 'working' | 'break' | 'finished' | null;

function formatDuration(ms: number): string {
  const totalSecs = Math.floor(ms / 1000);
  const h = Math.floor(totalSecs / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  if (h > 0) return h + 'ч ' + m + 'м';
  if (m > 0) return m + 'м ' + s + 'с';
  return s + 'с';
}

export function WorkSessionWidget({ token }: { token: string }) {
  const [session, setSession]   = useState<any>(null);
  const [loading, setLoading]   = useState(true);
  const [acting, setActing]     = useState(false);
  const [elapsed, setElapsed]   = useState(0);
  const [now, setNow]           = useState(Date.now());

  const loadSession = useCallback(async () => {
    try {
      const res = await fetch('http://localhost:3001/api/v1/work-session/me', {
        headers: { Authorization: 'Bearer ' + token },
      });
      const data = await res.json();
      setSession(data);
    } finally { setLoading(false); }
  }, [token]);

  useEffect(() => {
    if (token) loadSession();
  }, [token, loadSession]);

  // Live timer
  useEffect(() => {
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  // Calculate work time
  useEffect(() => {
    if (!session?.startedAt) { setElapsed(0); return; }
    const end = session.finishedAt ?? now;
    const raw = end - session.startedAt - (session.totalBreakMs ?? 0);
    // If on break, subtract current break duration
    const currentBreak = session.status === 'break' && session.breakAt
      ? now - session.breakAt : 0;
    setElapsed(Math.max(0, raw - currentBreak));
  }, [session, now]);

  const action = async (endpoint: string) => {
    setActing(true);
    try {
      const res = await fetch('http://localhost:3001/api/v1/work-session/' + endpoint, {
        method: 'POST', headers: { Authorization: 'Bearer ' + token },
      });
      const data = await res.json();
      setSession(data);
    } finally { setActing(false); }
  };

  if (loading) return null;

  const status: Status = session?.status ?? null;

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-700">Мой рабочий день</h3>
        {status === 'working' && (
          <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
            Работаю
          </span>
        )}
        {status === 'break' && (
          <span className="flex items-center gap-1.5 text-xs text-yellow-600 font-medium">
            <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
            Перерыв
          </span>
        )}
        {status === 'finished' && (
          <span className="flex items-center gap-1.5 text-xs text-gray-400 font-medium">
            <span className="w-2 h-2 rounded-full bg-gray-300" />
            День завершён
          </span>
        )}
      </div>

      {/* Timer */}
      {status !== null && status !== 'finished' && (
        <div className="text-2xl font-bold text-gray-900 mb-3 tabular-nums">
          {formatDuration(elapsed)}
          {status === 'break' && (
            <span className="text-sm font-normal text-yellow-500 ml-2">перерыв</span>
          )}
        </div>
      )}

      {status === 'finished' && session?.startedAt && (
        <div className="text-sm text-gray-500 mb-3">
          Отработано: <span className="font-semibold text-gray-800">{formatDuration(elapsed)}</span>
        </div>
      )}

      {/* Start time */}
      {session?.startedAt && (
        <p className="text-xs text-gray-400 mb-3">
          Начало: {new Date(session.startedAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
          {session.finishedAt && ' · Конец: ' + new Date(session.finishedAt).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
        </p>
      )}

      {/* Buttons */}
      <div className="flex gap-2">
        {status === null && (
          <button onClick={() => action('start')} disabled={acting}
            className="flex-1 py-2 bg-green-500 text-white rounded-lg text-sm font-medium hover:bg-green-600 disabled:opacity-50 transition-colors">
            ▶ Начать работу
          </button>
        )}

        {status === 'working' && (
          <>
            <button onClick={() => action('break')} disabled={acting}
              className="flex-1 py-2 bg-yellow-100 text-yellow-700 rounded-lg text-sm font-medium hover:bg-yellow-200 disabled:opacity-50 transition-colors">
              ⏸ Перерыв
            </button>
            <button onClick={() => action('finish')} disabled={acting}
              className="flex-1 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-200 disabled:opacity-50 transition-colors">
              ■ Закончить
            </button>
          </>
        )}

        {status === 'break' && (
          <>
            <button onClick={() => action('break-end')} disabled={acting}
              className="flex-1 py-2 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 disabled:opacity-50 transition-colors">
              ▶ Продолжить
            </button>
            <button onClick={() => action('finish')} disabled={acting}
              className="flex-1 py-2 bg-red-100 text-red-600 rounded-lg text-sm font-medium hover:bg-red-200 disabled:opacity-50 transition-colors">
              ■ Закончить
            </button>
          </>
        )}

        {status === 'finished' && (
          <div className="flex-1 py-2 bg-gray-50 text-gray-400 rounded-lg text-sm text-center">
            День завершён ✓
          </div>
        )}
      </div>
    </div>
  );
}
`);

// ─── Update dashboard page to show widget for employees ──────
let dashboard = fs.readFileSync('app/dashboard/page.tsx', 'utf8');

// Add imports
dashboard = dashboard.replace(
  `'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';`,
  `'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { WorkSessionWidget } from '@/components/WorkSessionWidget';`
);

// Add token state
dashboard = dashboard.replace(
  `  const [stats, setStats] = useState<any>(null);`,
  `  const [stats, setStats] = useState<any>(null);
  const [token, setToken]   = useState('');`
);

// Set token
dashboard = dashboard.replace(
  `    setUser(JSON.parse(stored));`,
  `    setUser(JSON.parse(stored));
    setToken(token);`
);

// Add widget before cards — only for non-admin users
dashboard = dashboard.replace(
  `      <div className="mb-8">`,
  `      {user && !user.roles?.includes('ADMIN') && !user.roles?.includes('OWNER') && !user.roles?.includes('SUPER_ADMIN') && (
        <WorkSessionWidget token={token} />
      )}
      <div className="mb-8">`
);

fs.writeFileSync('app/dashboard/page.tsx', dashboard);
console.log('✓ dashboard updated with WorkSessionWidget');

// ─── Update timesheet to show manual sessions ─────────────────
// Add org today sessions to timesheet page
let timesheet = fs.readFileSync('app/dashboard/timesheet/page.tsx', 'utf8');
timesheet = timesheet.replace(
  `  const [employees, setEmployees] = useState<any[]>([]);`,
  `  const [employees, setEmployees] = useState<any[]>([]);
  const [todaySessions, setTodaySessions] = useState<any[]>([]);`
);

timesheet = timesheet.replace(
  `    loadEmployees(t);
    load(t, '14', '');`,
  `    loadEmployees(t);
    load(t, '14', '');
    loadTodaySessions(t);`
);

timesheet = timesheet.replace(
  `  const loadEmployees = async (t: string) => {`,
  `  const loadTodaySessions = async (t: string) => {
    try {
      const res = await fetch('http://localhost:3001/api/v1/work-session/org/today', {
        headers: { Authorization: 'Bearer ' + t },
      });
      const d = await res.json();
      setTodaySessions(Array.isArray(d) ? d : []);
    } catch {}
  };

  const loadEmployees = async (t: string) => {`
);

// Add today's sessions table before main timesheet
timesheet = timesheet.replace(
  `          {/* Summary cards */}`,
  `          {/* Today's manual sessions */}
          {todaySessions.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="text-sm font-semibold text-gray-700 mb-4">Сегодня — ручные отметки</h3>
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left py-2 text-xs text-gray-500 font-semibold uppercase">Сотрудник</th>
                    <th className="text-center py-2 text-xs text-gray-500 font-semibold uppercase">Начал</th>
                    <th className="text-center py-2 text-xs text-gray-500 font-semibold uppercase">Закончил</th>
                    <th className="text-center py-2 text-xs text-gray-500 font-semibold uppercase">Работал</th>
                    <th className="text-center py-2 text-xs text-gray-500 font-semibold uppercase">Перерыв</th>
                    <th className="text-left py-2 text-xs text-gray-500 font-semibold uppercase">Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {todaySessions.map((s: any) => (
                    <tr key={s.userId} className="border-b border-gray-50 hover:bg-gray-50">
                      <td className="py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">{s.name.charAt(0)}</div>
                          <span className="font-medium text-gray-900 text-sm">{s.name}</span>
                        </div>
                      </td>
                      <td className="py-2.5 text-center text-gray-700 font-medium">{s.startedAt ?? '—'}</td>
                      <td className="py-2.5 text-center text-gray-700">{s.finishedAt ?? '—'}</td>
                      <td className="py-2.5 text-center text-indigo-600 font-medium">
                        {s.workMinutes >= 60 ? Math.floor(s.workMinutes/60) + 'ч ' + (s.workMinutes%60) + 'м' : s.workMinutes + 'м'}
                      </td>
                      <td className="py-2.5 text-center text-yellow-600">{s.breakMinutes ? s.breakMinutes + 'м' : '—'}</td>
                      <td className="py-2.5">
                        <span className={"text-xs px-2 py-0.5 rounded font-medium " + (
                          s.status === 'working'  ? 'bg-green-100 text-green-700' :
                          s.status === 'break'    ? 'bg-yellow-100 text-yellow-700' :
                          s.status === 'finished' ? 'bg-gray-100 text-gray-500' :
                          'bg-gray-50 text-gray-400'
                        )}>
                          {s.status === 'working' ? 'Работает' : s.status === 'break' ? 'Перерыв' : s.status === 'finished' ? 'Завершил' : 'Не начал'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary cards */}`
);

fs.writeFileSync('app/dashboard/timesheet/page.tsx', timesheet);
console.log('✓ timesheet updated');

console.log('\n✅ Work session frontend created');
