'use client';
import { useIsMobile } from '@/hooks/useIsMobile';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
import { useSocket } from '@/lib/useSocket';
import { usePermissions } from '@/lib/usePermissions';
import { ThemeToggle } from '@/components/ThemeToggle';

type NavItem = { href: string; icon: string; label: string; admin: boolean };
type NavGroup = { id: string; label: string; icon: string; items: NavItem[] };
type NavEntry = NavItem | NavGroup;

const isGroup = (e: NavEntry): e is NavGroup => 'items' in e;

const NAV: NavEntry[] = [
  { href: '/dashboard/command-center', icon: 'ti-topology-star-3', label: '⚡ Command Center', admin: false },
  { href: '/dashboard',              icon: 'ti-layout-dashboard', label: 'Дашборд',        admin: false },
  { href: '/dashboard/chat',         icon: 'ti-message-circle',   label: 'Чат',            admin: false },

  {
    id: 'crm', label: 'CRM и клиенты', icon: 'ti-users-group',
    items: [
      { href: '/dashboard/subscribers', icon: 'ti-users-group', label: 'CRM · Подписчики', admin: false },
    ],
  },

  {
    id: 'people', label: 'Люди', icon: 'ti-users',
    items: [
      { href: '/dashboard/employees',    icon: 'ti-users',    label: 'Сотрудники',     admin: false },
      { href: '/dashboard/productivity', icon: 'ti-star',     label: 'Продуктивность', admin: true  },
      { href: '/dashboard/timesheet',    icon: 'ti-calendar', label: 'Табель',         admin: false },
      { href: '/dashboard/kpi',          icon: 'ti-target',   label: 'KPI',            admin: true  },
    ],
  },

  {
    id: 'pm', label: 'Управление проектами и задачами', icon: 'ti-briefcase',
    items: [
      { href: '/dashboard/tasks',        icon: 'ti-checkbox',         label: 'Задачи',         admin: false },
      { href: '/dashboard/home',          icon: 'ti-home',             label: 'Мои задачи',     admin: false },
      { href: '/dashboard/projects',     icon: 'ti-layout-kanban',    label: 'Проекты',        admin: false },
      { href: '/dashboard/teams',        icon: 'ti-tag',              label: 'Команды',        admin: true  },
      { href: '/dashboard/dictionaries', icon: 'ti-list-details',     label: 'Справочники',    admin: true  },
      { href: '/dashboard/settings/custom-fields', icon: 'ti-adjustments-horizontal', label: 'Поля задач', admin: true },
      { href: '/dashboard/routines',     icon: 'ti-repeat',           label: 'Рутины',         admin: false },
    ],
  },

  {
    id: 'commerce', label: 'Товары и продажи', icon: 'ti-package',
    items: [
      { href: '/dashboard/products', icon: 'ti-package',      label: 'Карточки товаров', admin: false },
      { href: '/dashboard/sales',    icon: 'ti-chart-arrows', label: 'Продажи WB',       admin: true  },
      { href: '/dashboard/reviews',  icon: 'ti-star',         label: 'Отзывы WB',        admin: true  },
    ],
  },

  {
    id: 'analytics', label: 'Аналитика и отчётность', icon: 'ti-chart-bar',
    items: [
      { href: '/dashboard/analytics', icon: 'ti-chart-bar',   label: 'Аналитика',       admin: false },
      { href: '/dashboard/reports',   icon: 'ti-file-report', label: 'Отчёты и экспорт', admin: true  },
    ],
  },

  {
    id: 'tools', label: 'Инструменты', icon: 'ti-tool',
    items: [
      { href: '/dashboard/calls',     icon: 'ti-video',    label: 'Видеозвонки', admin: false },
      { href: '/dashboard/notebook',  icon: 'ti-notebook', label: 'Мой блокнот', admin: false },
      { href: '/dashboard/knowledge', icon: 'ti-book',     label: 'База знаний', admin: false },
    ],
  },

  {
    id: 'system', label: 'Система', icon: 'ti-settings',
    items: [
      { href: '/dashboard/settings', icon: 'ti-settings',    label: 'Настройки',       admin: true },
      { href: '/dashboard/audit',    icon: 'ti-shield-lock', label: 'Журнал действий', admin: true },
    ],
  },
];

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return m + ' мин назад';
  const h = Math.floor(m / 60);
  if (h < 24) return h + ' ч назад';
  return Math.floor(h / 24) + ' д назад';
}

export function Sidebar() {
  const isMobile = useIsMobile();
  const [mobileOpen, setMobileOpen] = useState(false);
  const pathname  = usePathname();
  const router    = useRouter();
  const [user, setUser]         = useState<any>(null);
  const [token, setToken]       = useState<string | null>(null);
  const { connected }           = useSocket(token);
  const perms                   = usePermissions();
  const [mounted, setMounted]   = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  // Search
  const [showSearch, setShowSearch] = useState(false);
  const [searchQ, setSearchQ]       = useState('');
  const [searchRes, setSearchRes]   = useState<any>(null);
  const [searching, setSearching]   = useState(false);
  const searchRef                   = useRef<HTMLDivElement>(null);

  const doSearch = async (q: string) => {
    setSearchQ(q);
    if (q.length < 2) { setSearchRes(null); return; }
    setSearching(true);
    const t = localStorage.getItem('access_token');
    if (!t) return;
    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/search?q=' + encodeURIComponent(q), { headers: { Authorization: 'Bearer ' + t } });
      setSearchRes(await res.json());
    } catch {} finally { setSearching(false); }
  };

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearch(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Notifications
  const [notifs, setNotifs]         = useState<any[]>([]);
  const [unread, setUnread]         = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const bellRef                     = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    const u = localStorage.getItem('user');
    if (!t || !u) { router.push('/login'); return; }
    setToken(t); setUser(JSON.parse(u));
    // Подтягиваем свежие данные (в т.ч. недавно загруженный аватар) — localStorage хранит снимок со времени входа
    fetch('https://employee-tracker.ru/api/v1/auth/me', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.ok ? r.json() : null)
      .then(fresh => { if (fresh) { setUser(fresh); localStorage.setItem('user', JSON.stringify(fresh)); } })
      .catch(() => {});
    loadNotifs(t);
    const iv = setInterval(() => loadNotifs(t), 30000);
    return () => clearInterval(iv);
  }, []);

  const loadNotifs = async (t: string) => {
    try {
      const [all, cnt] = await Promise.all([
        fetch('https://employee-tracker.ru/api/v1/notifications',             { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
        fetch('https://employee-tracker.ru/api/v1/notifications/unread-count',{ headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
      ]);
      if (Array.isArray(all)) setNotifs(all.slice(0, 20));
      if (typeof cnt === 'number') setUnread(cnt);
    } catch {}
  };

  const markAllRead = async () => {
    const t = localStorage.getItem('access_token');
    if (!t) return;
    await fetch('https://employee-tracker.ru/api/v1/notifications/read-all', { method: 'PATCH', headers: { Authorization: 'Bearer ' + t } });
    setUnread(0);
    setNotifs(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const markRead = async (id: string) => {
    const t = localStorage.getItem('access_token');
    if (!t) return;
    await fetch(`https://employee-tracker.ru/api/v1/notifications/${id}/read`, { method: 'PATCH', headers: { Authorization: 'Bearer ' + t } });
    setNotifs(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnread(prev => Math.max(0, prev - 1));
  };

  // Close on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setShowNotifs(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filterAdmin = (n: NavItem) => !n.admin || perms.isAdmin || perms.isManager;
  const items: NavEntry[] = mounted
    ? NAV.map(e => isGroup(e) ? { ...e, items: e.items.filter(filterAdmin) } : e).filter(e => isGroup(e) ? e.items.length > 0 : filterAdmin(e))
    : NAV.filter(e => !isGroup(e) && !e.admin);

  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({ pm: true });
  const toggleGroup = (id: string) => setOpenGroups(p => ({ ...p, [id]: !p[id] }));

  const NOTIF_ICONS: Record<string, string> = {
    task_assigned: 'ti-clipboard-plus',
    task_status:   'ti-refresh',
    task_comment:  'ti-message',
    task_overdue:  'ti-alarm',
  };

  const S = {
    sidebar: {
      width:'220px', flexShrink:0, display:'flex', flexDirection:'column' as const, height:'100vh',
      background:'var(--sidebar-bg)', borderRight:'1px solid var(--sidebar-border)',
    } as React.CSSProperties,
    logo: { padding:'16px 14px 12px', display:'flex', alignItems:'center', justifyContent:'space-between', borderBottom:'1px solid var(--border)' } as React.CSSProperties,
    searchWrap: { padding:'10px 10px 8px', position:'relative' as const } as React.CSSProperties,
    searchBox: { display:'flex', alignItems:'center', gap:'7px', background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'6px 10px' } as React.CSSProperties,
    nav: { flex:1, padding:'6px 8px', display:'flex', flexDirection:'column' as const, gap:'1px', overflowY:'auto' as const } as React.CSSProperties,
    footer: { padding:'8px 10px 12px', borderTop:'1px solid var(--border)' } as React.CSSProperties,
  };

  return (
    <>
      {/* Mobile hamburger */}
      {isMobile && (
        <button onClick={() => setMobileOpen(o => !o)}
          style={{ position:'fixed', top:'12px', left:'12px', zIndex:1001, width:'38px', height:'38px', borderRadius:'var(--radius)', background:'var(--bg-primary)', border:'1px solid var(--border)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'var(--shadow-md)' }}>
          <i className={mobileOpen ? 'ti ti-x' : 'ti ti-menu-2'} style={{ fontSize:'17px', color:'var(--text-secondary)' }} aria-hidden="true"/>
        </button>
      )}

      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div onClick={() => setMobileOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:999, backdropFilter:'blur(2px)' }}/>
      )}

      <aside style={{ ...S.sidebar, ...(isMobile ? { position:'fixed', top:0, left:0, zIndex:1000, transform:mobileOpen?'translateX(0)':'translateX(-100%)', transition:'transform 0.25s cubic-bezier(0.4,0,0.2,1)', boxShadow:mobileOpen?'var(--shadow-lg)':'none' } : { position:'sticky', top:0 }) }}>

      {/* Logo */}
      <div style={S.logo}>
        <div style={{ display:'flex', alignItems:'center', gap:'9px' }}>
          <div style={{ width:'28px', height:'28px', background:'var(--accent)', borderRadius:'var(--radius-sm)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <span style={{ color:'white', fontSize:'10px', fontWeight:700, letterSpacing:'-0.5px' }}>ET</span>
          </div>
          <span style={{ color:'var(--text-primary)', fontSize:'13px', fontWeight:600 }}>Employee Tracker</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
          {/* Bell */}
          <div ref={bellRef} style={{ position:'relative' }}>
            <button onClick={()=>{ setShowNotifs(!showNotifs); if (!showNotifs && unread > 0) markAllRead(); }}
              style={{ width:'28px', height:'28px', background:'transparent', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'var(--radius-sm)', transition:'background var(--transition)', position:'relative' }}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--bg-hover)'}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}
              title="Уведомления">
              <i className="ti ti-bell" style={{ fontSize:'16px', color: unread > 0 ? 'var(--orange)' : 'var(--text-muted)' }} aria-hidden="true"/>
              {unread > 0 && (
                <span style={{ position:'absolute', top:'2px', right:'2px', width:'14px', height:'14px', borderRadius:'50%', background:'#ef4444', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'8px', fontWeight:700, color:'white', border:'1.5px solid var(--bg-primary)' }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {/* Notifications dropdown */}
            {showNotifs && (
              <div style={{ position:'fixed', top:'48px', left:'8px', width:'320px', background:'var(--bg-primary)', border:'1px solid var(--border)', borderRadius:'var(--radius-xl)', boxShadow:'var(--shadow-lg)', zIndex:1000, overflow:'hidden' }}>
                <div style={{ padding:'12px 14px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:'13px', fontWeight:600, color:'var(--text-primary)' }}>Уведомления</span>
                  {notifs.some(n => !n.isRead) && (
                    <button onClick={markAllRead}
                      style={{ fontSize:'11px', color:'var(--accent)', background:'none', border:'none', cursor:'pointer', fontWeight:500 }}>
                      Прочитать все
                    </button>
                  )}
                </div>
                <div style={{ maxHeight:'360px', overflowY:'auto' }}>
                  {notifs.length === 0 ? (
                    <div style={{ padding:'32px', textAlign:'center', color:'#4a4d5e', fontSize:'12px' }}>
                      <i className="ti ti-bell-off" style={{ fontSize:'24px', display:'block', marginBottom:'8px' }} aria-hidden="true"/>
                      Нет уведомлений
                    </div>
                  ) : notifs.map(n => (
                    <div key={n.id}
                      onClick={()=>{ markRead(n.id); if (n.taskId) { setShowNotifs(false); router.push('/dashboard/tasks/'+n.taskId); } else if (n.subscriberId) { setShowNotifs(false); router.push('/dashboard/subscribers?open='+n.subscriberId); } }}
                      style={{ padding:'10px 14px', borderBottom:'0.5px solid rgba(255,255,255,0.05)', cursor:(n.taskId||n.subscriberId)?'pointer':'default', background:n.isRead?'transparent':'rgba(139,124,246,0.06)', transition:'background 0.1s', display:'flex', gap:'10px', alignItems:'flex-start' }}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.04)'}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=n.isRead?'transparent':'rgba(139,124,246,0.06)'}>
                      <div style={{ width:'28px', height:'28px', borderRadius:'8px', background:n.isRead?'rgba(255,255,255,0.06)':'rgba(139,124,246,0.2)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:'1px' }}>
                        <i className={`ti ${NOTIF_ICONS[n.type] ?? 'ti-bell'}`} style={{ fontSize:'14px', color:n.isRead?'#6b7090':'#8b7cf6' }} aria-hidden="true"/>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'2px' }}>
                          <p style={{ fontSize:'12px', fontWeight:n.isRead?400:600, color:n.isRead?'#8b909e':'#e2e4ed', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', flex:1 }}>{n.title}</p>
                          {!n.isRead && <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#8b7cf6', flexShrink:0 }}/>}
                        </div>
                        <p style={{ fontSize:'11px', color:'#6b7090', margin:'0 0 2px', lineHeight:1.4 }}>{n.body?.slice(0,80)}{n.body?.length>80?'...':''}</p>
                        <p style={{ fontSize:'10px', color:'#4a4d5e', margin:0 }}>{timeAgo(n.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
          <ThemeToggle />
        </div>
      </div>

      {/* Search */}
      <div ref={searchRef} style={{ padding:'0 8px 10px', position:'relative' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'8px', background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'6px 10px', cursor:'text' }}
          onClick={()=>setShowSearch(true)}>
          <i className="ti ti-search" style={{ fontSize:'14px', color:'#6b7090', flexShrink:0 }} aria-hidden="true"/>
          <input value={searchQ} onChange={e=>doSearch(e.target.value)}
            onFocus={()=>setShowSearch(true)}
            placeholder="Поиск..." style={{ background:'none', border:'none', outline:'none', fontSize:'12px', color:'var(--text-primary)', width:'100%', fontFamily:'inherit' }}/>
          {searchQ && <button onClick={()=>{setSearchQ('');setSearchRes(null);}} style={{ background:'none',border:'none',cursor:'pointer',color:'#6b7090',padding:0,fontSize:'14px',lineHeight:1 }}>×</button>}
        </div>
        {showSearch && searchRes && (
          <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'var(--bg-primary)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', boxShadow:'var(--shadow-lg)', zIndex:1000, overflow:'hidden', maxHeight:'360px', overflowY:'auto', marginTop:'4px' }}>
            {searching && <div style={{ padding:'12px 14px', color:'#6b7090', fontSize:'12px' }}>Поиск...</div>}
            {!searching && searchRes.tasks?.length===0 && searchRes.employees?.length===0 && searchRes.articles?.length===0 && (
              <div style={{ padding:'16px 14px', color:'#6b7090', fontSize:'12px', textAlign:'center' }}>Ничего не найдено</div>
            )}
            {searchRes.tasks?.length>0 && (
              <div>
                <div style={{ padding:'8px 14px 4px', fontSize:'10px', fontWeight:600, color:'#4a4d5e', textTransform:'uppercase', letterSpacing:'0.5px' }}>Задачи</div>
                {searchRes.tasks.map((t:any)=>(
                  <div key={t.id} onClick={()=>{router.push('/dashboard/tasks/'+t.id);setShowSearch(false);setSearchQ('');setSearchRes(null);}}
                    style={{ padding:'8px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', transition:'background 0.1s' }}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.05)'}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                    <i className="ti ti-checkbox" style={{ fontSize:'14px', color:'#6b7090', flexShrink:0 }} aria-hidden="true"/>
                    <span style={{ fontSize:'13px', color:'#c8cad8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</span>
                  </div>
                ))}
              </div>
            )}
            {searchRes.employees?.length>0 && (
              <div>
                <div style={{ padding:'8px 14px 4px', fontSize:'10px', fontWeight:600, color:'#4a4d5e', textTransform:'uppercase', letterSpacing:'0.5px' }}>Сотрудники</div>
                {searchRes.employees.map((e:any)=>(
                  <div key={e.id} onClick={()=>{router.push('/dashboard/employees/'+e.id);setShowSearch(false);setSearchQ('');setSearchRes(null);}}
                    style={{ padding:'8px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', transition:'background 0.1s' }}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.05)'}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                    <i className="ti ti-user" style={{ fontSize:'14px', color:'#6b7090', flexShrink:0 }} aria-hidden="true"/>
                    <span style={{ fontSize:'13px', color:'#c8cad8' }}>{e.name}</span>
                    <span style={{ fontSize:'11px', color:'#4a4d5e', marginLeft:'auto' }}>{e.email}</span>
                  </div>
                ))}
              </div>
            )}
            {searchRes.articles?.length>0 && (
              <div>
                <div style={{ padding:'8px 14px 4px', fontSize:'10px', fontWeight:600, color:'#4a4d5e', textTransform:'uppercase', letterSpacing:'0.5px' }}>База знаний</div>
                {searchRes.articles.map((a:any)=>(
                  <div key={a.id} onClick={()=>{router.push('/dashboard/knowledge');setShowSearch(false);setSearchQ('');setSearchRes(null);}}
                    style={{ padding:'8px 14px', cursor:'pointer', display:'flex', alignItems:'center', gap:'8px', transition:'background 0.1s' }}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.05)'}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                    <i className="ti ti-book" style={{ fontSize:'14px', color:'#6b7090', flexShrink:0 }} aria-hidden="true"/>
                    <span style={{ fontSize:'13px', color:'#c8cad8', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{a.category?.icon} {a.title}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Divider */}
      <div style={{ height:'1px', background:'var(--border)', margin:'0 8px' }} />

      {/* Nav */}
      <nav style={S.nav}>
        {items.map(entry => {
          if (isGroup(entry)) {
            const isOpen = openGroups[entry.id] ?? false;
            const groupActive = entry.items.some(it => pathname === it.href || (it.href !== '/dashboard' && pathname.startsWith(it.href)));
            return (
              <div key={entry.id}>
                <button onClick={() => toggleGroup(entry.id)}
                  style={{ display:'flex', alignItems:'center', gap:'9px', width:'100%', padding:'6px 10px', borderRadius:'var(--radius)', background: groupActive && !isOpen ? 'var(--accent-light)' : 'transparent', border:'none', cursor:'pointer', transition:'background var(--transition)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = (groupActive && !isOpen) ? 'var(--accent-light)' : 'transparent'}>
                  <i className={'ti ' + entry.icon} style={{ fontSize:'16px', color: groupActive ? 'var(--accent)' : 'var(--text-muted)', flexShrink:0, lineHeight:1 }} aria-hidden="true"/>
                  <span style={{ fontSize:'13px', fontWeight: groupActive ? 500 : 400, color: groupActive ? 'var(--accent)' : 'var(--text-secondary)', flex:1, textAlign:'left' }}>{entry.label}</span>
                  <i className={'ti ' + (isOpen ? 'ti-chevron-down' : 'ti-chevron-right')} style={{ fontSize:'13px', color:'var(--text-muted)', transition:'transform var(--transition)' }} aria-hidden="true"/>
                </button>
                {isOpen && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'1px', marginTop:'2px', marginLeft:'8px', paddingLeft:'12px', borderLeft:'1px solid var(--border)' }}>
                    {entry.items.map(item => {
                      const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
                      return (
                        <Link key={item.href} href={item.href}
                          style={{ display:'flex', alignItems:'center', gap:'9px', padding:'6px 10px', borderRadius:'var(--radius)', textDecoration:'none', background: active ? 'var(--accent-light)' : 'transparent', transition:'background var(--transition)' }}
                          onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
                          onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                          <i className={'ti ' + item.icon} style={{ fontSize:'15px', color: active ? 'var(--accent)' : 'var(--text-muted)', flexShrink:0, lineHeight:1 }} aria-hidden="true"/>
                          <span style={{ fontSize:'13px', fontWeight: active ? 500 : 400, color: active ? 'var(--accent)' : 'var(--text-secondary)' }}>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

          const item = entry;
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href}
              style={{ display:'flex', alignItems:'center', gap:'9px', padding:'6px 10px', borderRadius:'var(--radius)', textDecoration:'none', background: active ? 'var(--accent-light)' : 'transparent', transition:'background var(--transition)' }}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              <i className={'ti ' + item.icon} style={{ fontSize:'16px', color: active ? 'var(--accent)' : 'var(--text-muted)', flexShrink:0, lineHeight:1 }} aria-hidden="true"/>
              <span style={{ fontSize:'13px', fontWeight: active ? 500 : 400, color: active ? 'var(--accent)' : 'var(--text-secondary)' }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={S.footer}>
        {user && (
          <div style={{ display:'flex', alignItems:'center', gap:'9px', padding:'8px 10px', borderRadius:'var(--radius)', cursor:'pointer', transition:'background var(--transition)' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-hover)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            onClick={() => router.push('/dashboard/profile')}
            title="Мой профиль">
            <div style={{ width:'30px', height:'30px', borderRadius:'50%', background: user.avatarUrl ? 'transparent' : 'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, position:'relative', overflow:'hidden' }}>
              {user.avatarUrl
                ? <img src={user.avatarUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                : <span style={{ color:'white', fontSize:'12px', fontWeight:600 }}>{user.name?.charAt(0)}</span>}
              <span style={{ position:'absolute', bottom:'0', right:'0', width:'8px', height:'8px', borderRadius:'50%', background: connected ? '#4ade80' : '#4a4d5e', border:'1.5px solid var(--bg-primary)' }} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ color:'#c8cad8', fontSize:'12px', fontWeight:500, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.name}</p>
              <p style={{ color:'var(--text-muted)', fontSize:'10px', margin:0 }}>Профиль →</p>
            </div>
          </div>
        )}
      </div>
          </aside>
    </>
  );
}