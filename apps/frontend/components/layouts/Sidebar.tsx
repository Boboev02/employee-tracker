'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSocket } from '@/lib/useSocket';
import { usePermissions } from '@/lib/usePermissions';
import { ThemeToggle } from '@/components/ThemeToggle';

const NAV = [
  { href: '/dashboard',              icon: 'ti-layout-dashboard', label: 'Дашборд',        admin: false },
  { href: '/dashboard/employees',    icon: 'ti-users',            label: 'Сотрудники',     admin: false },
  { href: '/dashboard/tasks',        icon: 'ti-checkbox',         label: 'Задачи',         admin: false },
  { href: '/dashboard/analytics',    icon: 'ti-chart-bar',        label: 'Аналитика',      admin: false },
  { href: '/dashboard/teams',        icon: 'ti-tag',              label: 'Команды',        admin: true  },
  { href: '/dashboard/productivity', icon: 'ti-star',             label: 'Продуктивность', admin: true  },
  { href: '/dashboard/timesheet',    icon: 'ti-calendar',         label: 'Табель',         admin: false },
  { href: '/dashboard/reports',      icon: 'ti-file-report',      label: 'Отчёты',         admin: true  },
  { href: '/dashboard/export',       icon: 'ti-download',         label: 'Экспорт',        admin: true  },
  { href: '/dashboard/knowledge',     icon: 'ti-book',             label: 'База знаний',    admin: false },
  { href: '/dashboard/routines',  icon: 'ti-repeat',   label: 'Рутины' },
  { href: '/dashboard/settings',     icon: 'ti-settings',         label: 'Настройки',      admin: true  },
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

  const items = mounted
    ? NAV.filter(n => !n.admin || perms.isAdmin || perms.isManager)
    : NAV.filter(n => !n.admin);

  return (
    <aside style={{ width:'220px', flexShrink:0, display:'flex', flexDirection:'column', height:'100vh', position:'sticky', top:0, background:'#13151c', borderRight:'0.5px solid rgba(255,255,255,0.06)' }}>

      {/* Logo + ThemeToggle */}
      <div style={{ padding:'16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'30px', height:'30px', background:'#8b7cf6', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <span style={{ color:'white', fontSize:'11px', fontWeight:700 }}>ET</span>
          </div>
          <span style={{ color:'#e2e4ed', fontSize:'13px', fontWeight:500 }}>Employee Tracker</span>
        </div>
        <ThemeToggle />
      </div>

      {/* Divider */}
      <div style={{ height:'0.5px', background:'rgba(255,255,255,0.07)', margin:'0 12px' }} />

      {/* Nav */}
      <nav style={{ flex:1, padding:'10px 8px', display:'flex', flexDirection:'column', gap:'1px', overflowY:'auto' }}>
        {items.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 10px', borderRadius:'8px', textDecoration:'none', background: active ? 'rgba(139,124,246,0.15)' : 'transparent', transition:'background 0.15s' }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              <i className={'ti ' + item.icon} style={{ fontSize:'17px', color: active ? '#8b7cf6' : '#6b7090', flexShrink:0, lineHeight:1 }} aria-hidden="true" />
              <span style={{ fontSize:'13px', fontWeight: active ? 500 : 400, color: active ? '#e2e4ed' : '#8b909e' }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer — user only */}
      <div style={{ padding:'10px 8px', borderTop:'0.5px solid rgba(255,255,255,0.07)' }}>
        {user && (
          <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 10px', borderRadius:'8px', cursor:'pointer', transition:'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            onClick={() => { localStorage.removeItem('access_token'); localStorage.removeItem('user'); router.push('/login'); }}
            title="Выйти">
            <div style={{ width:'30px', height:'30px', borderRadius:'50%', background:'#8b7cf6', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, position:'relative' }}>
              <span style={{ color:'white', fontSize:'12px', fontWeight:600 }}>{user.name?.charAt(0)}</span>
              <span style={{ position:'absolute', bottom:'0', right:'0', width:'8px', height:'8px', borderRadius:'50%', background: connected ? '#4ade80' : '#4a4d5e', border:'1.5px solid #13151c' }} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ color:'#c8cad8', fontSize:'12px', fontWeight:500, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.name}</p>
              <p style={{ color:'#4a4d5e', fontSize:'10px', margin:0 }}>{user.roles?.[0] ?? 'EMPLOYEE'}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
