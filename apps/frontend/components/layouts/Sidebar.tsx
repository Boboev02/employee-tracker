'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSocket } from '@/lib/useSocket';
import { usePermissions } from '@/lib/usePermissions';
import { ThemeToggle } from '@/components/ThemeToggle';

const NAV = [
  { group: 'МЕНЮ', items: [
    { href: '/dashboard',              icon: 'ti-layout-dashboard', label: 'Дашборд',        admin: false },
    { href: '/dashboard/analytics',    icon: 'ti-chart-bar',        label: 'Аналитика',      admin: false },
    { href: '/dashboard/employees',    icon: 'ti-users',            label: 'Сотрудники',     admin: false },
    { href: '/dashboard/tasks',        icon: 'ti-checkbox',         label: 'Задачи',         admin: false },
  ]},
  { group: 'УПРАВЛЕНИЕ', items: [
    { href: '/dashboard/teams',        icon: 'ti-tag',              label: 'Команды',        admin: true  },
    { href: '/dashboard/productivity', icon: 'ti-star',             label: 'Продуктивность', admin: true  },
    { href: '/dashboard/timesheet',    icon: 'ti-calendar',         label: 'Табель',         admin: false },
  ]},
  { group: 'ОТЧЁТЫ', items: [
    { href: '/dashboard/reports',      icon: 'ti-file-report',      label: 'Отчёты',         admin: true  },
    { href: '/dashboard/export',       icon: 'ti-download',         label: 'Экспорт',        admin: true  },
    { href: '/dashboard/knowledge',    icon: 'ti-book',             label: 'База знаний',    admin: false },
    { href: '/dashboard/settings',     icon: 'ti-settings',         label: 'Настройки',      admin: true  },
  ]},
];

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [user, setUser]       = useState<any>(null);
  const [token, setToken]     = useState<string | null>(null);
  const { connected }         = useSocket(token);
  const perms                 = usePermissions();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    const u = localStorage.getItem('user');
    if (!t || !u) { router.push('/login'); return; }
    setToken(t); setUser(JSON.parse(u));
  }, []);

  const canSee = (admin: boolean) => !admin || (mounted && (perms.isAdmin || perms.isManager));

  return (
    <aside style={{
      width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column',
      height: '100vh', position: 'sticky', top: 0,
      background: '#ffffff',
      borderRight: '1px solid #eeeeee',
      boxShadow: '2px 0 8px rgba(108,92,231,0.06)',
    }}>

      {/* Logo */}
      <div style={{ padding: '18px 16px 14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid #f0f0f0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{
            width: '32px', height: '32px', background: '#6C5CE7',
            borderRadius: '9px', display: 'flex', alignItems: 'center', justifyContent: 'center',
            flexShrink: 0, boxShadow: '0 4px 10px rgba(108,92,231,0.3)',
          }}>
            <span style={{ color: 'white', fontSize: '11px', fontWeight: 800 }}>ET</span>
          </div>
          <div>
            <span style={{ color: '#1a1a2e', fontSize: '13px', fontWeight: 700, display: 'block', lineHeight: 1.2 }}>Employee</span>
            <span style={{ color: '#aaa', fontSize: '11px', display: 'block', lineHeight: 1.2 }}>Tracker</span>
          </div>
        </div>
        <ThemeToggle />
      </div>

      {/* Nav */}
      <nav style={{ flex: 1, padding: '8px 10px', overflowY: 'auto' }}>
        {NAV.map(group => (
          <div key={group.group} style={{ marginBottom: '4px' }}>
            <div style={{ fontSize: '10px', fontWeight: 600, color: '#ccc', letterSpacing: '0.8px', padding: '8px 8px 4px', textTransform: 'uppercase' as const }}>
              {group.group}
            </div>
            {group.items.filter(item => canSee(item.admin)).map(item => {
              const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
              return (
                <Link key={item.href} href={item.href}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '9px',
                    padding: '8px 10px', borderRadius: '9px', textDecoration: 'none',
                    marginBottom: '1px',
                    background: active ? '#6C5CE7' : 'transparent',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = '#EDE9FF'; }}
                  onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                  <i className={'ti ' + item.icon} style={{
                    fontSize: '16px', flexShrink: 0, lineHeight: 1,
                    color: active ? 'white' : '#888',
                  }} aria-hidden="true" />
                  <span style={{
                    fontSize: '13px', fontWeight: active ? 600 : 400,
                    color: active ? 'white' : '#555',
                  }}>{item.label}</span>
                </Link>
              );
            })}
          </div>
        ))}
      </nav>

      {/* Upgrade card */}
      <div style={{ padding: '10px 12px', borderTop: '1px solid #f0f0f0' }}>
        <div style={{ background: '#1a1a2e', borderRadius: '12px', padding: '12px 14px', marginBottom: '10px' }}>
          <div style={{ fontSize: '12px', fontWeight: 600, color: 'white', marginBottom: '4px' }}>Тариф Pro</div>
          <div style={{ fontSize: '11px', color: '#888', marginBottom: '10px' }}>Расширенная аналитика и API</div>
          <div style={{ background: '#6C5CE7', color: 'white', borderRadius: '7px', padding: '6px', textAlign: 'center' as const, fontSize: '11px', fontWeight: 500, cursor: 'pointer' }}>
            Подробнее →
          </div>
        </div>

        {/* User */}
        {user && (
          <div
            style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '10px', cursor: 'pointer', transition: 'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#EDE9FF'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            onClick={() => { localStorage.removeItem('access_token'); localStorage.removeItem('user'); router.push('/login'); }}
            title="Выйти">
            <div style={{ position: 'relative', flexShrink: 0 }}>
              <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#6C5CE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <span style={{ color: 'white', fontSize: '12px', fontWeight: 600 }}>{user.name?.charAt(0)}</span>
              </div>
              <span style={{ position: 'absolute', bottom: 0, right: 0, width: '9px', height: '9px', borderRadius: '50%', background: connected ? '#43A047' : '#ccc', border: '2px solid white' }} />
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ color: '#1a1a2e', fontSize: '12px', fontWeight: 500, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{user.name}</p>
              <p style={{ color: '#aaa', fontSize: '10px', margin: 0 }}>{user.roles?.[0] ?? 'EMPLOYEE'}</p>
            </div>
            <i className="ti ti-logout" style={{ fontSize: '14px', color: '#ccc', flexShrink: 0 }} aria-hidden="true" />
          </div>
        )}
      </div>
    </aside>
  );
}
