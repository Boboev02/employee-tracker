const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

// ─── Sidebar layout ───────────────────────────────────────────
write('components/layouts/Sidebar.tsx', `'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSocket } from '@/lib/useSocket';

const NAV = [
  { href: '/dashboard',              icon: '⊞', label: 'Дашборд' },
  { href: '/dashboard/employees',    icon: '👥', label: 'Сотрудники' },
  { href: '/dashboard/tasks',        icon: '✓',  label: 'Задачи' },
  { href: '/dashboard/analytics',    icon: '📊', label: 'Аналитика' },
];

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [user, setUser]   = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const { connected }     = useSocket(token);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    const u = localStorage.getItem('user');
    if (!t || !u) { router.push('/login'); return; }
    setToken(t);
    setUser(JSON.parse(u));
  }, []);

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    router.push('/login');
  };

  return (
    <aside className="w-56 flex-shrink-0 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      {/* Logo */}
      <div className="h-14 flex items-center gap-3 px-5 border-b border-gray-100">
        <div className="w-7 h-7 bg-indigo-600 rounded-lg flex items-center justify-center text-white text-xs font-bold">ET</div>
        <span className="font-bold text-gray-900 text-sm">Employee Tracker</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
        {NAV.map(item => {
          const active = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              className={"flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors " +
                (active
                  ? 'bg-indigo-50 text-indigo-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900')}>
              <span className="text-base">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-3 border-t border-gray-100">
        {/* WS status */}
        <div className="flex items-center gap-2 px-3 py-1.5 mb-2">
          <span className={"w-2 h-2 rounded-full flex-shrink-0 " + (connected ? 'bg-green-500 animate-pulse' : 'bg-gray-300')} />
          <span className={"text-xs font-medium " + (connected ? 'text-green-600' : 'text-gray-400')}>
            {connected ? 'Онлайн' : 'Офлайн'}
          </span>
        </div>

        {/* User */}
        {user && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-lg hover:bg-gray-50 group">
            <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
              {user.name?.charAt(0) ?? 'U'}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-gray-800 truncate">{user.name}</p>
              <p className="text-[10px] text-gray-400 truncate">{user.roles?.[0]}</p>
            </div>
            <button onClick={handleLogout}
              className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all text-xs"
              title="Выйти">✕</button>
          </div>
        )}
      </div>
    </aside>
  );
}
`);

// ─── Dashboard layout with sidebar ───────────────────────────
write('app/dashboard/layout.tsx', `import { Sidebar } from '@/components/layouts/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
`);

// ─── Updated dashboard page ───────────────────────────────────
write('app/dashboard/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token  = localStorage.getItem('access_token');
    if (!stored || !token) { router.push('/login'); return; }
    setUser(JSON.parse(stored));

    fetch('http://localhost:3001/api/v1/analytics/stats', {
      headers: { Authorization: 'Bearer ' + token },
    }).then(r => r.json()).then(setStats).catch(() => {});
  }, []);

  const cards = [
    { label: 'Сотрудников', value: stats?.totalUsers ?? '—', href: '/dashboard/employees', icon: '👥', color: 'text-indigo-600' },
    { label: 'Задач',       value: stats?.totalTasks ?? '—', href: '/dashboard/tasks',     icon: '✓',  color: 'text-blue-600' },
    { label: 'В работе',    value: stats?.activeTasks ?? '—', href: '/dashboard/tasks',    icon: '▶',  color: 'text-yellow-600' },
    { label: 'Выполнено',   value: stats ? stats.completionRate + '%' : '—', href: '/dashboard/analytics', icon: '📊', color: 'text-green-600' },
  ];

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">
          Добро пожаловать{user ? ', ' + user.name : ''}!
        </h1>
        <p className="text-gray-500 mt-1 text-sm">Обзор организации</p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map(card => (
          <Link key={card.label} href={card.href}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md transition-shadow group">
            <div className="flex items-center justify-between mb-3">
              <span className="text-2xl">{card.icon}</span>
              <span className="text-xs text-gray-400 group-hover:text-indigo-500 transition-colors">→</span>
            </div>
            <p className={"text-3xl font-bold tabular-nums " + card.color}>{card.value}</p>
            <p className="text-sm text-gray-500 mt-1">{card.label}</p>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {[
          { title: 'Сотрудники', desc: 'Управление командой, роли, статусы', href: '/dashboard/employees', icon: '👥' },
          { title: 'Задачи',     desc: 'Канбан доска, приоритеты, статусы', href: '/dashboard/tasks',     icon: '📋' },
          { title: 'Аналитика', desc: 'Графики, KPI, продуктивность',       href: '/dashboard/analytics', icon: '📊' },
        ].map(item => (
          <Link key={item.title} href={item.href}
            className="bg-white rounded-xl border border-gray-200 p-5 hover:shadow-md hover:border-indigo-200 transition-all group">
            <div className="text-3xl mb-3">{item.icon}</div>
            <h3 className="font-semibold text-gray-900 group-hover:text-indigo-700 transition-colors">{item.title}</h3>
            <p className="text-sm text-gray-500 mt-1">{item.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
`);

// ─── Remove back buttons from sub-pages ──────────────────────
// Tasks page - remove back button header
const tasksPage = fs.readFileSync('app/dashboard/tasks/page.tsx', 'utf8');
const tasksFixed = tasksPage.replace(
  `      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-gray-600">← Назад</button>
          <h1 className="font-bold">Задачи</h1>
        </div>`,
  `      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-gray-900">Задачи</h1>
        </div>`
);
fs.writeFileSync('app/dashboard/tasks/page.tsx', tasksFixed);

console.log('\n✅ Sidebar created');
