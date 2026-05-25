const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

// ─── New globals.css ──────────────────────────────────────────
write('app/globals.css', `@import "tailwindcss";

:root {
  --background: #ffffff;
  --foreground: #0a0a0a;
  --card: #ffffff;
  --card-foreground: #0a0a0a;
  --border: #e5e7eb;
  --input: #e5e7eb;
  --primary: #18181b;
  --primary-foreground: #fafafa;
  --muted: #f4f4f5;
  --muted-foreground: #71717a;
  --accent: #f4f4f5;
  --accent-foreground: #18181b;
  --ring: #18181b;
  --radius: 0.5rem;
  --sidebar-width: 220px;
}

.dark {
  --background: #09090b;
  --foreground: #fafafa;
  --card: #18181b;
  --card-foreground: #fafafa;
  --border: #27272a;
  --input: #27272a;
  --primary: #fafafa;
  --primary-foreground: #18181b;
  --muted: #27272a;
  --muted-foreground: #a1a1aa;
  --accent: #27272a;
  --accent-foreground: #fafafa;
  --ring: #d4d4d8;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--background);
  color: var(--foreground);
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* Dark mode overrides */
.dark body { background-color: var(--background); color: var(--foreground); }
.dark .bg-white { background-color: var(--card) !important; }
.dark .bg-gray-50 { background-color: var(--background) !important; }
.dark .bg-gray-100 { background-color: var(--muted) !important; }
.dark .border-gray-100, .dark .border-gray-200 { border-color: var(--border) !important; }
.dark .text-gray-900 { color: var(--foreground) !important; }
.dark .text-gray-700 { color: #d4d4d8 !important; }
.dark .text-gray-600 { color: #a1a1aa !important; }
.dark .text-gray-500 { color: #71717a !important; }
.dark .text-gray-400 { color: #52525b !important; }
.dark .hover\\:bg-gray-50:hover { background-color: var(--muted) !important; }
.dark .hover\\:bg-gray-100:hover { background-color: #27272a !important; }
.dark input, .dark select, .dark textarea {
  background-color: var(--input) !important;
  border-color: var(--border) !important;
  color: var(--foreground) !important;
}
.dark .bg-indigo-50 { background-color: #1e1b4b !important; }
.dark .bg-green-50 { background-color: #052e16 !important; }
.dark .bg-red-50 { background-color: #450a0a !important; }
.dark .bg-yellow-50 { background-color: #422006 !important; }
.dark .bg-blue-50 { background-color: #0c1a4b !important; }
.dark .sticky { background-color: var(--card) !important; }
.dark .bg-white.border-b { border-color: var(--border) !important; }

/* Scrollbar */
::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
`);

// ─── New Sidebar ──────────────────────────────────────────────
write('components/layouts/Sidebar.tsx', `'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSocket } from '@/lib/useSocket';
import { usePermissions } from '@/lib/usePermissions';
import { ThemeToggle } from '@/components/ThemeToggle';

const NAV_BASE = [
  { href: '/dashboard',              icon: '⊞', label: 'Дашборд',        adminOnly: false },
  { href: '/dashboard/employees',    icon: '👥', label: 'Сотрудники',     adminOnly: false },
  { href: '/dashboard/tasks',        icon: '✓',  label: 'Задачи',         adminOnly: false },
  { href: '/dashboard/analytics',    icon: '📊', label: 'Аналитика',      adminOnly: false },
  { href: '/dashboard/teams',        icon: '🏷️',  label: 'Команды',        adminOnly: true  },
  { href: '/dashboard/productivity', icon: '⭐', label: 'Продуктивность', adminOnly: true  },
  { href: '/dashboard/export',       icon: '↓',  label: 'Экспорт',        adminOnly: true  },
  { href: '/dashboard/timesheet',    icon: '🗓️',  label: 'Табель',          adminOnly: false },
  { href: '/dashboard/settings',     icon: '⚙️',  label: 'Настройки',      adminOnly: true  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [user, setUser]   = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const { connected }     = useSocket(token);
  const perms             = usePermissions();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

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
    <aside style={{ width: '220px' }} className="flex-shrink-0 flex flex-col h-screen sticky top-0 border-r"
      style={{ borderColor: 'var(--border)', background: 'var(--card)' }}>

      {/* Logo */}
      <div className="h-14 flex items-center justify-between px-4 border-b" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-2.5">
          <div className="w-6 h-6 bg-zinc-900 dark:bg-zinc-100 rounded-md flex items-center justify-center">
            <span className="text-white dark:text-zinc-900 text-xs font-black">ET</span>
          </div>
          <span className="font-semibold text-sm" style={{ color: 'var(--foreground)' }}>Employee Tracker</span>
        </div>
        <ThemeToggle />
      </div>

      {/* Nav */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5 overflow-y-auto">
        {(mounted ? NAV_BASE.filter(item => !item.adminOnly || perms.isAdmin || perms.isManager) : NAV_BASE).map(item => {
          const active = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              className={"flex items-center gap-2.5 px-3 py-2 rounded-md text-sm transition-colors " +
                (active
                  ? 'bg-zinc-100 dark:bg-zinc-800 font-medium'
                  : 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50')}
              style={{ color: active ? 'var(--foreground)' : 'var(--muted-foreground)' }}>
              <span className="text-sm w-4 text-center">{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="px-2 py-3 border-t" style={{ borderColor: 'var(--border)' }}>
        {/* WS status */}
        <div className="flex items-center gap-2 px-3 py-1.5 mb-1">
          <span className={"w-1.5 h-1.5 rounded-full flex-shrink-0 " + (connected ? 'bg-green-500' : 'bg-zinc-300')} />
          <span className="text-xs" style={{ color: 'var(--muted-foreground)' }}>
            {connected ? 'Онлайн' : 'Офлайн'}
          </span>
        </div>

        {/* User */}
        {user && (
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-md hover:bg-zinc-50 dark:hover:bg-zinc-800/50 group cursor-pointer transition-colors"
            onClick={handleLogout} title="Выйти">
            <div className="w-6 h-6 rounded-full bg-zinc-800 dark:bg-zinc-200 flex items-center justify-center flex-shrink-0">
              <span className="text-white dark:text-zinc-900 text-xs font-bold">{user.name?.charAt(0)}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate" style={{ color: 'var(--foreground)' }}>{user.name}</p>
              <p className="text-xs truncate" style={{ color: 'var(--muted-foreground)' }}>{user.roles?.[0]}</p>
            </div>
            <span className="text-xs opacity-0 group-hover:opacity-100 transition-opacity" style={{ color: 'var(--muted-foreground)' }}>↗</span>
          </div>
        )}
      </div>
    </aside>
  );
}
`);

// ─── New Dashboard ────────────────────────────────────────────
write('app/dashboard/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { WorkSessionWidget } from '@/components/WorkSessionWidget';

function StatCard({ label, value, href, trend }: { label: string; value: any; href: string; trend?: string }) {
  return (
    <Link href={href} className="block p-5 rounded-xl border transition-all hover:shadow-sm group"
      style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
      <p className="text-xs font-medium mb-3" style={{ color: 'var(--muted-foreground)' }}>{label}</p>
      <p className="text-2xl font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>{value ?? '—'}</p>
      {trend && <p className="text-xs mt-2" style={{ color: 'var(--muted-foreground)' }}>{trend}</p>}
    </Link>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser]   = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [token, setToken] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    const t      = localStorage.getItem('access_token');
    if (!stored || !t) { router.push('/login'); return; }
    setUser(JSON.parse(stored));
    setToken(t);

    const loadStats = () => {
      fetch('http://localhost:3001/api/v1/analytics/stats', {
        headers: { Authorization: 'Bearer ' + t },
      }).then(r => r.json()).then(setStats).catch(() => {});
    };
    loadStats();
    const interval = setInterval(loadStats, 30_000);
    return () => clearInterval(interval);
  }, []);

  const isAdmin = user?.roles?.some((r: string) => ['ADMIN','OWNER','SUPER_ADMIN'].includes(r));

  return (
    <div className="p-6 max-w-5xl">
      {!isAdmin && token && user && (
        <div className="mb-6">
          <WorkSessionWidget token={token} />
        </div>
      )}

      <div className="mb-6">
        <h1 className="text-xl font-semibold tracking-tight" style={{ color: 'var(--foreground)' }}>
          Добро пожаловать{user ? ', ' + user.name : ''}
        </h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--muted-foreground)' }}>
          Обзор организации
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
        <StatCard label="Сотрудников"  value={stats?.totalUsers}     href="/dashboard/employees" />
        <StatCard label="Задач"        value={stats?.totalTasks}      href="/dashboard/tasks" />
        <StatCard label="В работе"     value={stats?.activeTasks}     href="/dashboard/tasks" />
        <StatCard label="Выполнено"    value={stats?.completionRate != null ? stats.completionRate + '%' : null} href="/dashboard/analytics" />
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { title: 'Сотрудники',  desc: 'Управление командой',    href: '/dashboard/employees', icon: '👥' },
          { title: 'Задачи',      desc: 'Канбан доска',           href: '/dashboard/tasks',     icon: '✓'  },
          { title: 'Аналитика',   desc: 'Графики и KPI',          href: '/dashboard/analytics', icon: '📊' },
        ].map(item => (
          <Link key={item.title} href={item.href}
            className="flex items-center gap-3 p-4 rounded-xl border transition-all hover:shadow-sm group"
            style={{ background: 'var(--card)', borderColor: 'var(--border)' }}>
            <span className="text-xl">{item.icon}</span>
            <div>
              <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>{item.title}</p>
              <p className="text-xs" style={{ color: 'var(--muted-foreground)' }}>{item.desc}</p>
            </div>
            <span className="ml-auto text-xs opacity-0 group-hover:opacity-100 transition-opacity"
              style={{ color: 'var(--muted-foreground)' }}>→</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
`);

// ─── New ThemeToggle ──────────────────────────────────────────
write('components/ThemeToggle.tsx', `'use client';
import { useTheme } from '@/lib/useTheme';
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle}
      className="w-7 h-7 rounded-md flex items-center justify-center transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
      style={{ color: 'var(--muted-foreground)' }}
      title={theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}>
      <span className="text-sm">{theme === 'light' ? '🌙' : '☀️'}</span>
    </button>
  );
}
`);

// ─── New Layout wrapper ───────────────────────────────────────
write('app/dashboard/layout.tsx', `import { Sidebar } from '@/components/layouts/Sidebar';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen" style={{ background: 'var(--background)' }}>
      <Sidebar />
      <main className="flex-1 min-w-0 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}
`);

console.log('\n✅ New design applied');
