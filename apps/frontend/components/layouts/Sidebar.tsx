'use client';
import { useIsMobile } from '@/hooks/useIsMobile';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState, useRef } from 'react';
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
  { href: '/dashboard/reports',      icon: 'ti-file-report',      label: 'Отчёты и экспорт', admin: true  },
  { href: '/dashboard/knowledge',    icon: 'ti-book',             label: 'База знаний',    admin: false },
  { href: '/dashboard/routines',     icon: 'ti-repeat',           label: 'Рутины',         admin: false },
  { href: '/dashboard/kpi',          icon: 'ti-target',           label: 'KPI',            admin: true  },
  { href: '/dashboard/sales',        icon: 'ti-chart-arrows',     label: 'Продажи WB',     admin: true  },
  { href: '/dashboard/notebook', icon: 'ti-notebook', label: 'Мой блокнот', admin: false },
  { href: '/dashboard/settings',     icon: 'ti-settings',         label: 'Настройки',      admin: true  },
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

  const items = mounted
    ? NAV.filter(n => !n.admin || perms.isAdmin || perms.isManager)
    : NAV.filter(n => !n.admin);

  const NOTIF_ICONS: Record<string, string> = {
    task_assigned: 'ti-clipboard-plus',
    task_status:   'ti-refresh',
    task_comment:  'ti-message',
    task_overdue:  'ti-alarm',
  };

  return (
    <>
      {/* Mobile hamburger button */}
      {isMobile && (
        <button
          onClick={() => setMobileOpen(o => !o)}
          style={{ position:'fixed', top:'12px', left:'12px', zIndex:1001, width:'40px', height:'40px', borderRadius:'10px', background:'#13151c', border:'0.5px solid rgba(255,255,255,0.1)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(0,0,0,0.3)' }}>
          <i className={mobileOpen ? 'ti ti-x' : 'ti ti-menu-2'} style={{ fontSize:'18px', color:'#e2e4ed' }} aria-hidden="true"/>
        </button>
      )}

      {/* Mobile overlay */}
      {isMobile && mobileOpen && (
        <div onClick={() => setMobileOpen(false)}
          style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:999, backdropFilter:'blur(2px)' }}/>
      )}

      <aside style={{
        width: '220px', flexShrink: 0, display: 'flex', flexDirection: 'column', height: '100vh',
        background: '#13151c', borderRight: '0.5px solid rgba(255,255,255,0.06)',
        ...(isMobile ? {
          position: 'fixed', top: 0, left: 0, zIndex: 1000,
          transform: mobileOpen ? 'translateX(0)' : 'translateX(-100%)',
          transition: 'transform 0.25s cubic-bezier(0.4,0,0.2,1)',
          boxShadow: mobileOpen ? '4px 0 24px rgba(0,0,0,0.4)' : 'none',
        } : {
          position: 'sticky', top: 0,
        }),
      }}>

      {/* Logo + ThemeToggle */}
      <div style={{ padding:'16px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'30px', height:'30px', background:'#8b7cf6', borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <span style={{ color:'white', fontSize:'11px', fontWeight:700 }}>ET</span>
          </div>
          <span style={{ color:'#e2e4ed', fontSize:'13px', fontWeight:500 }}>Employee Tracker</span>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
          {/* Bell */}
          <div ref={bellRef} style={{ position:'relative' }}>
            <button onClick={()=>{ setShowNotifs(!showNotifs); if (!showNotifs && unread > 0) markAllRead(); }}
              style={{ width:'28px', height:'28px', background:'transparent', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'6px', transition:'background 0.15s', position:'relative' }}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.08)'}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}
              title="Уведомления">
              <i className="ti ti-bell" style={{ fontSize:'16px', color: unread > 0 ? '#f59e0b' : '#6b7090' }} aria-hidden="true"/>
              {unread > 0 && (
                <span style={{ position:'absolute', top:'2px', right:'2px', width:'14px', height:'14px', borderRadius:'50%', background:'#ef4444', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'8px', fontWeight:700, color:'white', border:'1.5px solid #13151c' }}>
                  {unread > 9 ? '9+' : unread}
                </span>
              )}
            </button>

            {/* Notifications dropdown */}
            {showNotifs && (
              <div style={{ position:'fixed', top:'48px', left:'8px', width:'320px', background:'#1a1d26', border:'0.5px solid rgba(255,255,255,0.1)', borderRadius:'14px', boxShadow:'0 8px 32px rgba(0,0,0,0.4)', zIndex:1000, overflow:'hidden' }}>
                <div style={{ padding:'12px 14px', borderBottom:'0.5px solid rgba(255,255,255,0.07)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                  <span style={{ fontSize:'13px', fontWeight:600, color:'#e2e4ed' }}>Уведомления</span>
                  {notifs.some(n => !n.isRead) && (
                    <button onClick={markAllRead}
                      style={{ fontSize:'11px', color:'#8b7cf6', background:'none', border:'none', cursor:'pointer', fontWeight:500 }}>
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
                      onClick={()=>{ markRead(n.id); if (n.taskId) { setShowNotifs(false); router.push('/dashboard/tasks/'+n.taskId); } }}
                      style={{ padding:'10px 14px', borderBottom:'0.5px solid rgba(255,255,255,0.05)', cursor:n.taskId?'pointer':'default', background:n.isRead?'transparent':'rgba(139,124,246,0.06)', transition:'background 0.1s', display:'flex', gap:'10px', alignItems:'flex-start' }}
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
        <div style={{ display:'flex', alignItems:'center', gap:'8px', background:'rgba(255,255,255,0.06)', borderRadius:'8px', padding:'7px 10px', cursor:'text' }}
          onClick={()=>setShowSearch(true)}>
          <i className="ti ti-search" style={{ fontSize:'14px', color:'#6b7090', flexShrink:0 }} aria-hidden="true"/>
          <input value={searchQ} onChange={e=>doSearch(e.target.value)}
            onFocus={()=>setShowSearch(true)}
            placeholder="Поиск..." style={{ background:'none', border:'none', outline:'none', fontSize:'12px', color:'#c8cad8', width:'100%', fontFamily:'inherit' }}/>
          {searchQ && <button onClick={()=>{setSearchQ('');setSearchRes(null);}} style={{ background:'none',border:'none',cursor:'pointer',color:'#6b7090',padding:0,fontSize:'14px',lineHeight:1 }}>×</button>}
        </div>
        {showSearch && searchRes && (
          <div style={{ position:'absolute', top:'100%', left:'8px', right:'8px', background:'#1a1d26', border:'0.5px solid rgba(255,255,255,0.1)', borderRadius:'12px', boxShadow:'0 8px 32px rgba(0,0,0,0.4)', zIndex:1000, overflow:'hidden', maxHeight:'360px', overflowY:'auto' }}>
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
              <i className={'ti ' + item.icon} style={{ fontSize:'17px', color: active ? '#8b7cf6' : '#6b7090', flexShrink:0, lineHeight:1 }} aria-hidden="true"/>
              <span style={{ fontSize:'13px', fontWeight: active ? 500 : 400, color: active ? '#e2e4ed' : '#8b909e' }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding:'10px 8px', borderTop:'0.5px solid rgba(255,255,255,0.07)' }}>
        {user && (
          <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 10px', borderRadius:'8px', cursor:'pointer', transition:'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            onClick={() => router.push('/dashboard/profile')}
            title="Мой профиль">
            <div style={{ width:'30px', height:'30px', borderRadius:'50%', background:'#8b7cf6', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, position:'relative' }}>
              <span style={{ color:'white', fontSize:'12px', fontWeight:600 }}>{user.name?.charAt(0)}</span>
              <span style={{ position:'absolute', bottom:'0', right:'0', width:'8px', height:'8px', borderRadius:'50%', background: connected ? '#4ade80' : '#4a4d5e', border:'1.5px solid #13151c' }} />
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ color:'#c8cad8', fontSize:'12px', fontWeight:500, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.name}</p>
              <p style={{ color:'#4a4d5e', fontSize:'10px', margin:0 }}>Профиль →</p>
            </div>
          </div>
        )}
      </div>
          </aside>
    </>
  );
}