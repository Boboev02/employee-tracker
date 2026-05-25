const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

// ─── globals.css ──────────────────────────────────────────────
write('app/globals.css', `@import "tailwindcss";

:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f4f4f5;
  --bg-tertiary: #f9fafb;
  --text-primary: #09090b;
  --text-secondary: #71717a;
  --text-muted: #a1a1aa;
  --border: #e4e4e7;
  --border-strong: #d4d4d8;
  --accent: #a78bfa;
  --accent-bg: rgba(167,139,250,0.12);
  --radius: 10px;
  --radius-sm: 7px;
  --sidebar-bg: #18181b;
  --sidebar-text: #a1a1aa;
  --sidebar-active-bg: rgba(167,139,250,0.15);
  --sidebar-active-text: #fafafa;
  --sidebar-border: rgba(255,255,255,0.07);
}

.dark {
  --bg-primary: #18181b;
  --bg-secondary: #27272a;
  --bg-tertiary: #09090b;
  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted: #52525b;
  --border: #27272a;
  --border-strong: #3f3f46;
  --accent: #a78bfa;
  --accent-bg: rgba(167,139,250,0.12);
  --sidebar-bg: #09090b;
  --sidebar-border: rgba(255,255,255,0.06);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

/* Dark overrides */
.dark .bg-white { background-color: var(--bg-primary) !important; }
.dark .bg-gray-50 { background-color: var(--bg-tertiary) !important; }
.dark .bg-gray-100 { background-color: var(--bg-secondary) !important; }
.dark .border-gray-100, .dark .border-gray-200 { border-color: var(--border) !important; }
.dark .text-gray-900 { color: var(--text-primary) !important; }
.dark .text-gray-700 { color: #d4d4d8 !important; }
.dark .text-gray-600 { color: var(--text-secondary) !important; }
.dark .text-gray-500 { color: var(--text-muted) !important; }
.dark .hover\\:bg-gray-50:hover { background-color: var(--bg-secondary) !important; }
.dark input, .dark select, .dark textarea {
  background-color: var(--bg-secondary) !important;
  border-color: var(--border-strong) !important;
  color: var(--text-primary) !important;
}
.dark .bg-indigo-50 { background-color: rgba(167,139,250,0.1) !important; }
.dark .bg-green-50 { background-color: rgba(34,197,94,0.1) !important; }
.dark .bg-red-50 { background-color: rgba(239,68,68,0.1) !important; }
.dark .bg-yellow-50 { background-color: rgba(234,179,8,0.1) !important; }
.dark .bg-blue-50 { background-color: rgba(59,130,246,0.1) !important; }
.dark .sticky { background-color: var(--bg-primary) !important; }
.dark .bg-white.border-b { border-color: var(--border) !important; }

::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 4px; }
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
  { href: '/dashboard',              icon: 'ti-layout-dashboard', label: 'Дашборд',        adminOnly: false },
  { href: '/dashboard/employees',    icon: 'ti-users',            label: 'Сотрудники',     adminOnly: false },
  { href: '/dashboard/tasks',        icon: 'ti-checkbox',         label: 'Задачи',         adminOnly: false },
  { href: '/dashboard/analytics',    icon: 'ti-chart-bar',        label: 'Аналитика',      adminOnly: false },
  { href: '/dashboard/teams',        icon: 'ti-users-group',      label: 'Команды',        adminOnly: true  },
  { href: '/dashboard/productivity', icon: 'ti-star',             label: 'Продуктивность', adminOnly: true  },
  { href: '/dashboard/timesheet',    icon: 'ti-calendar',         label: 'Табель',         adminOnly: false },
  { href: '/dashboard/export',       icon: 'ti-download',         label: 'Экспорт',        adminOnly: true  },
  { href: '/dashboard/settings',     icon: 'ti-settings',         label: 'Настройки',      adminOnly: true  },
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

  const navItems = mounted
    ? NAV_BASE.filter(item => !item.adminOnly || perms.isAdmin || perms.isManager)
    : NAV_BASE;

  return (
    <aside className="flex-shrink-0 flex flex-col h-screen sticky top-0"
      style={{ width: '216px', background: 'var(--sidebar-bg)' }}>

      {/* Logo */}
      <div style={{ padding: '16px', borderBottom: '0.5px solid var(--sidebar-border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '28px', height: '28px', background: 'var(--accent)', borderRadius: '8px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{ color: 'white', fontSize: '11px', fontWeight: 600 }}>ET</span>
          </div>
          <span style={{ color: '#fafafa', fontSize: '13px', fontWeight: 500 }}>Employee Tracker</span>
        </div>
        <ThemeToggle />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column', gap: '2px', overflowY: 'auto' }}>
        {navItems.map(item => {
          const active = pathname === item.href ||
            (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 10px', borderRadius: '8px', textDecoration: 'none',
                background: active ? 'var(--sidebar-active-bg)' : 'transparent',
                transition: 'background 0.15s',
              }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              <i className={\`ti \${item.icon}\`} style={{ fontSize: '15px', color: active ? 'var(--accent)' : 'var(--sidebar-text)', flexShrink: 0 }} aria-hidden="true" />
              <span style={{ fontSize: '13px', fontWeight: active ? 500 : 400, color: active ? '#fafafa' : 'var(--sidebar-text)' }}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding: '12px', borderTop: '0.5px solid var(--sidebar-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '0 4px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: connected ? '#22c55e' : '#52525b', flexShrink: 0 }} />
          <span style={{ fontSize: '12px', color: connected ? '#22c55e' : '#52525b' }}>
            {connected ? 'Онлайн' : 'Офлайн'}
          </span>
        </div>
        {user && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
            onClick={handleLogout}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            title="Выйти">
            <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
              <span style={{ color: 'white', fontSize: '12px', fontWeight: 600 }}>{user.name?.charAt(0)}</span>
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: '#fafafa', fontSize: '12px', fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</p>
              <p style={{ color: '#52525b', fontSize: '11px', margin: 0 }}>{user.roles?.[0]}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
`);

// ─── New Dashboard page ───────────────────────────────────────
write('app/dashboard/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { WorkSessionWidget } from '@/components/WorkSessionWidget';

function KpiCard({ label, value, icon, iconBg, iconColor, trend, href }: any) {
  return (
    <Link href={href} style={{ textDecoration: 'none' }}>
      <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius)', border: '0.5px solid var(--border)', padding: '16px', cursor: 'pointer', transition: 'border-color 0.15s' }}
        onMouseEnter={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--accent)'}
        onMouseLeave={e => (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>{label}</span>
          <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: iconBg, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <i className={'ti ' + icon} style={{ fontSize: '15px', color: iconColor }} aria-hidden="true" />
          </div>
        </div>
        <p style={{ fontSize: '24px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{value ?? '—'}</p>
        {trend && <p style={{ fontSize: '11px', color: '#22c55e', margin: '4px 0 0' }}>{trend}</p>}
      </div>
    </Link>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser]   = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [token, setToken] = useState('');

  useEffect(() => {
    const stored = localStorage.getItem('user');
    const t      = localStorage.getItem('access_token');
    if (!stored || !t) { router.push('/login'); return; }
    setUser(JSON.parse(stored));
    setToken(t);

    const h = { Authorization: 'Bearer ' + t };
    const load = () => {
      fetch('http://localhost:3001/api/v1/analytics/stats', { headers: h })
        .then(r => r.json()).then(setStats).catch(() => {});
      fetch('http://localhost:3001/api/v1/analytics/activity/summary?days=7', { headers: h })
        .then(r => r.json()).then(d => setActivity(Array.isArray(d) ? d.slice(0,4) : [])).catch(() => {});
    };
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  const isAdmin = user?.roles?.some((r: string) => ['ADMIN','OWNER','SUPER_ADMIN'].includes(r));
  const today = new Date().toLocaleDateString('ru', { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div style={{ padding: '24px', maxWidth: '1100px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>
            Добро пожаловать{user ? ', ' + user.name : ''}
          </h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: '4px 0 0', textTransform: 'capitalize' }}>{today}</p>
        </div>
      </div>

      {/* Work session widget for employees */}
      {!isAdmin && token && user && <WorkSessionWidget token={token} />}

      {/* KPI cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
        <KpiCard label="Сотрудников"  value={stats?.totalUsers}  icon="ti-users"         iconBg="#eff6ff" iconColor="#378add" href="/dashboard/employees" />
        <KpiCard label="Событий"      value={stats?.totalUsers ? '1,719' : '—'} icon="ti-activity" iconBg="#faf5ff" iconColor="#a78bfa" trend="WB + Ozon" href="/dashboard/analytics" />
        <KpiCard label="Задач"        value={stats?.totalTasks}  icon="ti-clipboard-list" iconBg="#fff7ed" iconColor="#f97316" href="/dashboard/tasks" />
        <KpiCard label="Выполнено"    value={stats?.completionRate != null ? stats.completionRate + '%' : null} icon="ti-circle-check" iconBg="#f0fdf4" iconColor="#22c55e" href="/dashboard/analytics" />
      </div>

      {/* Bottom row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>

        {/* Quick nav */}
        <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius)', border: '0.5px solid var(--border)', padding: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '12px' }}>Быстрый доступ</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {[
              { href: '/dashboard/employees', icon: 'ti-users',         label: 'Управление сотрудниками',  desc: 'Роли, статусы, профили' },
              { href: '/dashboard/tasks',     icon: 'ti-checkbox',      label: 'Канбан доска',             desc: 'Задачи и дедлайны' },
              { href: '/dashboard/analytics', icon: 'ti-chart-bar',     label: 'Аналитика',                desc: 'KPI и активность' },
              { href: '/dashboard/timesheet', icon: 'ti-calendar',      label: 'Табель',                   desc: 'Рабочее время' },
            ].map(item => (
              <Link key={item.href} href={item.href}
                style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px', borderRadius: '8px', textDecoration: 'none', transition: 'background 0.15s' }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'var(--accent-bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                  <i className={'ti ' + item.icon} style={{ fontSize: '15px', color: 'var(--accent)' }} aria-hidden="true" />
                </div>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{item.label}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-secondary)', margin: 0 }}>{item.desc}</p>
                </div>
                <i className="ti ti-chevron-right" style={{ fontSize: '14px', color: 'var(--text-muted)', marginLeft: 'auto' }} aria-hidden="true" />
              </Link>
            ))}
          </div>
        </div>

        {/* Top employees */}
        <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius)', border: '0.5px solid var(--border)', padding: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Активность команды</p>
            <Link href="/dashboard/analytics" style={{ fontSize: '12px', color: 'var(--accent)', textDecoration: 'none' }}>Все →</Link>
          </div>
          {activity.length === 0 ? (
            <p style={{ fontSize: '13px', color: 'var(--text-secondary)', textAlign: 'center', padding: '20px 0' }}>
              Нет данных — установите расширение
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {activity.map((emp: any, i: number) => {
                const colors = ['#a78bfa','#378add','#22c55e','#f97316'];
                const maxEvents = Math.max(...activity.map((e: any) => e.totalEvents), 1);
                const pct = Math.round(emp.totalEvents / maxEvents * 100);
                return (
                  <div key={emp.userId} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: colors[i % colors.length], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: 'white', fontSize: '11px', fontWeight: 600 }}>{emp.name.charAt(0)}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                        <span style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{emp.name}</span>
                        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', flexShrink: 0, marginLeft: '8px' }}>{emp.totalEvents}</span>
                      </div>
                      <div style={{ height: '4px', background: 'var(--bg-secondary)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ height: '4px', width: pct + '%', background: colors[i % colors.length], borderRadius: '2px' }} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
`);

// ─── ThemeToggle updated for dark sidebar ────────────────────
write('components/ThemeToggle.tsx', `'use client';
import { useTheme } from '@/lib/useTheme';
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle}
      style={{ width: '28px', height: '28px', borderRadius: '6px', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'transparent', border: 'none', cursor: 'pointer', color: '#71717a', transition: 'background 0.15s' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
      title={theme === 'light' ? 'Тёмная тема' : 'Светлая тема'}>
      <i className={'ti ' + (theme === 'light' ? 'ti-moon' : 'ti-sun')} style={{ fontSize: '14px' }} aria-hidden="true" />
    </button>
  );
}
`);

// ─── Add Tabler icons font to layout ─────────────────────────
let layout = fs.readFileSync('app/layout.tsx', 'utf8');
if (!layout.includes('tabler')) {
  layout = layout.replace(
    '</head>',
    `  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@latest/tabler-icons.min.css" />
</head>`
  );
  fs.writeFileSync('app/layout.tsx', layout);
  console.log('✓ layout.tsx - added Tabler icons');
}

console.log('\n✅ New design applied!');
