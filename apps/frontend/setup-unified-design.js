const fs = require('fs');
const path = require('path');
function write(p, c) { fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p,c); console.log('✓',p); }

// ─── 1. GLOBALS.CSS — soft dark theme ────────────────────────
write('app/globals.css', `@import "tailwindcss";

:root {
  --bg-primary:    #ffffff;
  --bg-secondary:  #f4f4f5;
  --bg-tertiary:   #f9fafb;
  --text-primary:  #09090b;
  --text-secondary:#71717a;
  --text-muted:    #a1a1aa;
  --border:        #e4e4e7;
  --border-strong: #d4d4d8;
  --accent:        #8b7cf6;
  --accent-hover:  #7c6ef0;
  --accent-bg:     rgba(139,124,246,0.10);
  --radius:        10px;
  --radius-sm:     7px;
  --sidebar-bg:    #13151c;
  --sidebar-text:  #6b7090;
  --sidebar-active-bg: rgba(139,124,246,0.14);
  --sidebar-border:rgba(255,255,255,0.06);
  --green:  #22c55e; --green-bg:  #f0fdf4;
  --blue:   #4d9de0; --blue-bg:   #eff6ff;
  --orange: #f97316; --orange-bg: #fff7ed;
  --red:    #ef4444; --red-bg:    #fef2f2;
  --yellow: #eab308; --yellow-bg: #fefce8;
}

.dark {
  --bg-primary:    #1c1e26;
  --bg-secondary:  #22253a;
  --bg-tertiary:   #14151e;
  --text-primary:  #e2e4ed;
  --text-secondary:#9294a3;
  --text-muted:    #4a4d5e;
  --border:        rgba(255,255,255,0.07);
  --border-strong: rgba(255,255,255,0.12);
  --accent:        #8b7cf6;
  --accent-hover:  #9d8ff8;
  --accent-bg:     rgba(139,124,246,0.14);
  --sidebar-bg:    #13151c;
  --sidebar-border:rgba(255,255,255,0.06);
  --green:  #4ade80; --green-bg:  rgba(74,222,128,0.10);
  --blue:   #60a5fa; --blue-bg:   rgba(96,165,250,0.10);
  --orange: #fb923c; --orange-bg: rgba(251,146,60,0.10);
  --red:    #f87171; --red-bg:    rgba(248,113,113,0.10);
  --yellow: #facc15; --yellow-bg: rgba(250,204,21,0.10);
}

*{box-sizing:border-box;margin:0;padding:0;}
body{background:var(--bg-tertiary);color:var(--text-primary);font-family:-apple-system,BlinkMacSystemFont,'Inter','Segoe UI',sans-serif;font-size:14px;line-height:1.5;-webkit-font-smoothing:antialiased;}
input,select,textarea,button{font-family:inherit;}
input:focus,select:focus,textarea:focus{outline:none;box-shadow:0 0 0 2px rgba(139,124,246,0.25);}

.dark .bg-white{background-color:var(--bg-primary)!important;}
.dark .bg-gray-50{background-color:var(--bg-tertiary)!important;}
.dark .bg-gray-100{background-color:var(--bg-secondary)!important;}
.dark .border-gray-100,.dark .border-gray-200{border-color:var(--border)!important;}
.dark .text-gray-900{color:var(--text-primary)!important;}
.dark .text-gray-700{color:#c8cad8!important;}
.dark .text-gray-600{color:var(--text-secondary)!important;}
.dark .text-gray-500{color:var(--text-muted)!important;}
.dark .hover\\:bg-gray-50:hover{background-color:var(--bg-secondary)!important;}
.dark input,.dark select,.dark textarea{background-color:var(--bg-secondary)!important;border-color:var(--border-strong)!important;color:var(--text-primary)!important;}
.dark .sticky{background-color:var(--bg-primary)!important;}
.dark .bg-indigo-50{background-color:var(--accent-bg)!important;}
.dark .bg-green-50{background-color:var(--green-bg)!important;}
.dark .bg-red-50{background-color:var(--red-bg)!important;}
.dark .bg-yellow-50{background-color:var(--yellow-bg)!important;}
.dark .bg-blue-50{background-color:var(--blue-bg)!important;}

::-webkit-scrollbar{width:4px;height:4px;}
::-webkit-scrollbar-track{background:transparent;}
::-webkit-scrollbar-thumb{background:var(--border-strong);border-radius:4px;}
`);

// ─── 2. SIDEBAR ───────────────────────────────────────────────
write('components/layouts/Sidebar.tsx', `'use client';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useSocket } from '@/lib/useSocket';
import { usePermissions } from '@/lib/usePermissions';
import { ThemeToggle } from '@/components/ThemeToggle';

const NAV = [
  { href: '/dashboard',              icon: '⊞', label: 'Дашборд',        admin: false },
  { href: '/dashboard/employees',    icon: '👥', label: 'Сотрудники',     admin: false },
  { href: '/dashboard/tasks',        icon: '✓',  label: 'Задачи',         admin: false },
  { href: '/dashboard/analytics',    icon: '📊', label: 'Аналитика',      admin: false },
  { href: '/dashboard/teams',        icon: '🏷',  label: 'Команды',        admin: true  },
  { href: '/dashboard/productivity', icon: '⭐', label: 'Продуктивность', admin: true  },
  { href: '/dashboard/timesheet',    icon: '📅', label: 'Табель',         admin: false },
  { href: '/dashboard/export',       icon: '↓',  label: 'Экспорт',        admin: true  },
  { href: '/dashboard/settings',     icon: '⚙',  label: 'Настройки',      admin: true  },
];

export function Sidebar() {
  const pathname = usePathname();
  const router   = useRouter();
  const [user, setUser] = useState<any>(null);
  const [token, setToken] = useState<string | null>(null);
  const { connected } = useSocket(token);
  const perms = usePermissions();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    const u = localStorage.getItem('user');
    if (!t || !u) { router.push('/login'); return; }
    setToken(t); setUser(JSON.parse(u));
  }, []);

  const items = mounted ? NAV.filter(n => !n.admin || perms.isAdmin || perms.isManager) : NAV;

  const itemStyle = (active: boolean): React.CSSProperties => ({
    display:'flex', alignItems:'center', gap:'10px', padding:'7px 10px',
    borderRadius:'8px', textDecoration:'none', cursor:'pointer',
    background: active ? 'var(--sidebar-active-bg)' : 'transparent',
    transition:'background 0.15s',
  });

  return (
    <aside style={{ width:'216px', flexShrink:0, display:'flex', flexDirection:'column', height:'100vh', position:'sticky', top:0, background:'var(--sidebar-bg)' }}>
      {/* Logo */}
      <div style={{ padding:'14px 16px', borderBottom:'0.5px solid var(--sidebar-border)', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          <div style={{ width:'26px', height:'26px', background:'var(--accent)', borderRadius:'7px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <span style={{ color:'white', fontSize:'10px', fontWeight:700 }}>ET</span>
          </div>
          <span style={{ color:'#e2e4ed', fontSize:'13px', fontWeight:500 }}>Employee Tracker</span>
        </div>
        <ThemeToggle />
      </div>

      {/* Nav */}
      <nav style={{ flex:1, padding:'8px', display:'flex', flexDirection:'column', gap:'2px', overflowY:'auto' }}>
        {items.map(item => {
          const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href));
          return (
            <Link key={item.href} href={item.href} style={itemStyle(active)}
              onMouseEnter={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.05)'; }}
              onMouseLeave={e => { if (!active) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
              <span style={{ fontSize:'14px', color: active ? 'var(--accent)' : 'var(--sidebar-text)', width:'18px', textAlign:'center', flexShrink:0 }}>{item.icon}</span>
              <span style={{ fontSize:'13px', fontWeight: active ? 500 : 400, color: active ? '#e2e4ed' : 'var(--sidebar-text)' }}>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      {/* Footer */}
      <div style={{ padding:'10px', borderTop:'0.5px solid var(--sidebar-border)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'6px', padding:'4px 8px', marginBottom:'6px' }}>
          <span style={{ width:'6px', height:'6px', borderRadius:'50%', background: connected ? '#4ade80' : '#4a4d5e', flexShrink:0 }} />
          <span style={{ fontSize:'11px', color: connected ? '#4ade80' : '#4a4d5e' }}>{connected ? 'Онлайн' : 'Офлайн'}</span>
        </div>
        {user && (
          <div onClick={() => { localStorage.removeItem('access_token'); localStorage.removeItem('user'); router.push('/login'); }}
            style={{ display:'flex', alignItems:'center', gap:'8px', padding:'8px', borderRadius:'8px', cursor:'pointer', transition:'background 0.15s' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.06)'}
            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
            title="Выйти">
            <div style={{ width:'26px', height:'26px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <span style={{ color:'white', fontSize:'11px', fontWeight:600 }}>{user.name?.charAt(0)}</span>
            </div>
            <div style={{ flex:1, minWidth:0 }}>
              <p style={{ color:'#c8cad8', fontSize:'12px', fontWeight:500, margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{user.name}</p>
              <p style={{ color:'var(--sidebar-text)', fontSize:'10px', margin:0 }}>{user.roles?.[0]}</p>
            </div>
          </div>
        )}
      </div>
    </aside>
  );
}
`);

// ─── 3. THEME TOGGLE ─────────────────────────────────────────
write('components/ThemeToggle.tsx', `'use client';
import { useTheme } from '@/lib/useTheme';
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle} title={theme==='light'?'Тёмная тема':'Светлая тема'}
      style={{ width:'28px', height:'28px', borderRadius:'6px', display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', color:'#4a4d5e', transition:'background 0.15s', fontSize:'13px' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.08)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
      {theme==='light'?'🌙':'☀️'}
    </button>
  );
}
`);

// ─── 4. WORK SESSION WIDGET ───────────────────────────────────
write('components/WorkSessionWidget.tsx', `'use client';
import { useEffect, useState } from 'react';

interface Props { token: string; }

export function WorkSessionWidget({ token }: Props) {
  const [session, setSession] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/v1/work-session/me', { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) setSession(await res.json());
    } catch {}
  };

  useEffect(() => { if (token) load(); }, [token]);

  useEffect(() => {
    if (!session?.startedAt || session.status === 'finished') return;
    const tick = () => {
      const start = new Date(session.startedAt).getTime();
      const breakMins = session.breakMinutes ?? 0;
      setElapsed(Math.floor((Date.now() - start) / 60000) - breakMins);
    };
    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, [session]);

  const action = async (endpoint: string) => {
    setLoading(true);
    try {
      await fetch('http://localhost:3001/api/v1/work-session/' + endpoint, { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
      await load();
    } finally { setLoading(false); }
  };

  const fmt = (m: number) => m >= 60 ? Math.floor(m/60) + 'ч ' + (m%60) + 'м' : m + 'м';
  const s = session?.status;

  const card: React.CSSProperties = { background:'var(--bg-primary)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 16px', display:'flex', alignItems:'center', gap:'14px' };
  const btn = (bg: string, color: string): React.CSSProperties => ({ background:bg, color, border:'none', padding:'7px 14px', borderRadius:'7px', fontSize:'12px', fontWeight:500, cursor:loading?'not-allowed':'pointer', opacity:loading?0.6:1 });

  return (
    <div style={card}>
      <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'var(--accent-bg)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <span style={{ fontSize:'16px' }}>⏱</span>
      </div>
      <div style={{ flex:1 }}>
        <p style={{ fontSize:'12px', fontWeight:500, color:'var(--text-primary)', margin:'0 0 2px' }}>
          {!s || s==='finished' ? 'Рабочий день не начат' : s==='working' ? 'Рабочее время: ' + fmt(elapsed) : s==='break' ? 'Перерыв' : 'Неизвестно'}
        </p>
        <p style={{ fontSize:'11px', color:'var(--text-muted)', margin:0 }}>
          {s==='working' ? 'Нажмите «Перерыв» или «Завершить»' : s==='break' ? 'Нажмите «Продолжить» чтобы вернуться' : 'Нажмите «Начать» чтобы отметить приход'}
        </p>
      </div>
      <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
        {(!s || s==='finished') && <button style={btn('var(--accent)','white')} onClick={() => action('start')}>▶ Начать</button>}
        {s==='working' && <>
          <button style={btn('var(--bg-secondary)','var(--text-secondary)')} onClick={() => action('break')}>⏸ Перерыв</button>
          <button style={btn('var(--red-bg)','var(--red)')} onClick={() => action('finish')}>■ Завершить</button>
        </>}
        {s==='break' && <button style={btn('var(--green-bg)','var(--green)')} onClick={() => action('break-end')}>▶ Продолжить</button>}
      </div>
    </div>
  );
}
`);

// ─── 5. EMPLOYEE PROFILE PAGE ─────────────────────────────────
write('app/dashboard/employees/[id]/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  ADMIN:    { bg: 'var(--accent-bg)',  color: 'var(--accent)' },
  MANAGER:  { bg: 'var(--blue-bg)',    color: 'var(--blue)' },
  EMPLOYEE: { bg: 'var(--green-bg)',   color: 'var(--green)' },
  VIEWER:   { bg: 'var(--bg-secondary)', color: 'var(--text-muted)' },
  HR:       { bg: 'var(--orange-bg)', color: 'var(--orange)' },
};

export default function EmployeeProfilePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [token, setToken] = useState('');
  const [emp, setEmp]     = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    Promise.all([
      fetch('http://localhost:3001/api/v1/employees/' + id, { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
      fetch('http://localhost:3001/api/v1/analytics/employees', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
      fetch('http://localhost:3001/api/v1/analytics/activity/summary?userId=' + id, { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
    ]).then(([e, empStats, activity]) => {
      setEmp(e);
      const my = Array.isArray(empStats) ? empStats.find((x: any) => x.id === id) : null;
      const myAct = Array.isArray(activity) ? activity.find((x: any) => x.userId === id) : null;
      setStats({ ...my, ...myAct });
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'200px', color:'var(--text-muted)', fontSize:'13px' }}>Загрузка...</div>;
  if (!emp) return <div style={{ padding:'24px', color:'var(--text-muted)', fontSize:'13px' }}>Сотрудник не найден</div>;

  const role = emp.roles?.[0] ?? 'EMPLOYEE';
  const rs = ROLE_STYLE[role] ?? ROLE_STYLE.VIEWER;

  const card: React.CSSProperties = { background:'var(--bg-primary)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', padding:'20px' };
  const label: React.CSSProperties = { fontSize:'11px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', margin:'0 0 8px' };
  const row: React.CSSProperties = { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'0.5px solid var(--border)' };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-tertiary)' }}>
      {/* Header */}
      <div style={{ background:'var(--bg-primary)', borderBottom:'0.5px solid var(--border)', padding:'14px 24px', display:'flex', alignItems:'center', gap:'12px', position:'sticky', top:0, zIndex:10 }}>
        <button onClick={() => router.push('/dashboard/employees')} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'13px', color:'var(--text-muted)', padding:'4px 8px', borderRadius:'6px' }}>← Назад</button>
        <h1 style={{ fontSize:'16px', fontWeight:600, color:'var(--text-primary)', margin:0 }}>{emp.name}</h1>
        <span style={{ fontSize:'11px', fontWeight:500, padding:'3px 8px', borderRadius:'20px', background:rs.bg, color:rs.color }}>{role}</span>
      </div>

      <div style={{ padding:'24px', display:'grid', gridTemplateColumns:'280px 1fr', gap:'16px', maxWidth:'960px' }}>

        {/* Left panel */}
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <div style={{ ...card, textAlign:'center' }}>
            <div style={{ width:'64px', height:'64px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
              <span style={{ color:'white', fontSize:'24px', fontWeight:600 }}>{emp.name.charAt(0)}</span>
            </div>
            <h2 style={{ fontSize:'16px', fontWeight:600, color:'var(--text-primary)', margin:'0 0 4px' }}>{emp.name}</h2>
            <p style={{ fontSize:'12px', color:'var(--text-muted)', margin:'0 0 12px' }}>{emp.email}</p>
            <span style={{ fontSize:'12px', fontWeight:500, padding:'4px 12px', borderRadius:'20px', background:rs.bg, color:rs.color }}>{role}</span>
          </div>

          <div style={card}>
            <p style={label}>Информация</p>
            {[
              { l:'Статус', v: <span style={{ fontSize:'12px', color: emp.status==='ACTIVE' ? 'var(--green)' : 'var(--red)' }}>{emp.status==='ACTIVE'?'Активен':'Заблокирован'}</span> },
              { l:'Email', v: emp.email },
              { l:'В организации', v: new Date(emp.createdAt).toLocaleDateString('ru') },
            ].map(item => (
              <div key={item.l} style={{ ...row, fontSize:'13px' }}>
                <span style={{ color:'var(--text-muted)' }}>{item.l}</span>
                <span style={{ color:'var(--text-primary)', fontWeight:500 }}>{item.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
            {[
              { l:'Создано задач', v: stats?.created ?? '—', color:'var(--text-primary)' },
              { l:'Выполнено задач', v: stats?.completed ?? '—', color:'var(--green)' },
              { l:'Событий', v: stats?.totalEvents ?? '—', color:'var(--accent)' },
            ].map(s => (
              <div key={s.l} style={{ ...card }}>
                <p style={{ fontSize:'11px', color:'var(--text-muted)', margin:'0 0 6px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{s.l}</p>
                <p style={{ fontSize:'22px', fontWeight:600, color:s.color, margin:0 }}>{s.v}</p>
              </div>
            ))}
          </div>

          <div style={card}>
            <p style={label}>Активность</p>
            {stats?.totalEvents > 0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {[
                  { l:'Всего событий', v: stats.totalEvents },
                  { l:'~Время работы', v: stats.totalEstimatedMins >= 60 ? Math.floor(stats.totalEstimatedMins/60)+'ч '+(stats.totalEstimatedMins%60)+'м' : (stats.totalEstimatedMins??0)+'м' },
                  { l:'Активных дней', v: stats.activeDays ?? '—' },
                ].map(item => (
                  <div key={item.l} style={{ ...row, fontSize:'13px' }}>
                    <span style={{ color:'var(--text-muted)' }}>{item.l}</span>
                    <span style={{ color:'var(--text-primary)', fontWeight:500 }}>{item.v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign:'center', padding:'24px', color:'var(--text-muted)', fontSize:'13px' }}>
                <p style={{ fontSize:'24px', marginBottom:'8px' }}>📊</p>
                Нет данных активности. Установите расширение Chrome.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
`);

// ─── 6. TASK DETAIL PAGE ─────────────────────────────────────
write('app/dashboard/tasks/[id]/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  NEW:         { bg:'var(--bg-secondary)', color:'var(--text-muted)',   label:'Новая' },
  IN_PROGRESS: { bg:'var(--blue-bg)',      color:'var(--blue)',          label:'В работе' },
  REVIEW:      { bg:'var(--orange-bg)',    color:'var(--orange)',        label:'Проверка' },
  DONE:        { bg:'var(--green-bg)',     color:'var(--green)',         label:'Готово' },
  BLOCKED:     { bg:'var(--red-bg)',       color:'var(--red)',           label:'Заблокирована' },
};
const PRIORITY_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  LOW:      { bg:'var(--bg-secondary)', color:'var(--text-muted)',  label:'Низкий' },
  MEDIUM:   { bg:'var(--blue-bg)',      color:'var(--blue)',         label:'Средний' },
  HIGH:     { bg:'var(--orange-bg)',    color:'var(--orange)',       label:'Высокий' },
  CRITICAL: { bg:'var(--red-bg)',       color:'var(--red)',          label:'Критический' },
};

export default function TaskDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [token, setToken]       = useState('');
  const [user, setUser]         = useState<any>(null);
  const [task, setTask]         = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [userMap, setUserMap]   = useState<Record<string, string>>({});
  const [loading, setLoading]   = useState(true);
  const [comment, setComment]   = useState('');
  const [posting, setPosting]   = useState(false);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    const u = localStorage.getItem('user');
    if (!t) { router.push('/login'); return; }
    setToken(t); if (u) setUser(JSON.parse(u));
    loadTask(t);
    fetch('http://localhost:3001/api/v1/employees', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(data => {
        if (Array.isArray(data)) {
          const map: Record<string,string> = {};
          data.forEach((e: any) => { map[e.id] = e.name; });
          setUserMap(map); setEmployees(data);
        }
      });
  }, [id]);

  const loadTask = async (t: string) => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/v1/tasks/' + id, { headers: { Authorization: 'Bearer ' + t } });
      const data = await res.json(); setTask(data);
      setComments(Array.isArray(data.comments) ? data.comments : []);
    } finally { setLoading(false); }
  };

  const updateField = async (field: string, value: any) => {
    setSaving(true);
    try {
      await fetch('http://localhost:3001/api/v1/tasks/' + id, {
        method:'PATCH', headers:{'Content-Type':'application/json', Authorization:'Bearer '+token},
        body: JSON.stringify({ [field]: value || null }),
      });
      loadTask(token);
    } finally { setSaving(false); }
  };

  const moveTask = async (status: string) => {
    await fetch('http://localhost:3001/api/v1/tasks/' + id + '/move', {
      method:'PATCH', headers:{'Content-Type':'application/json', Authorization:'Bearer '+token},
      body: JSON.stringify({ status }),
    });
    loadTask(token);
  };

  const postComment = async () => {
    if (!comment.trim()) return;
    setPosting(true);
    try {
      await fetch('http://localhost:3001/api/v1/tasks/' + id + '/comments', {
        method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer '+token},
        body: JSON.stringify({ content: comment.trim() }),
      });
      setComment(''); loadTask(token);
    } finally { setPosting(false); }
  };

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'200px', color:'var(--text-muted)', fontSize:'13px' }}>Загрузка...</div>;
  if (!task)   return <div style={{ padding:'24px', color:'var(--text-muted)', fontSize:'13px' }}>Задача не найдена</div>;

  const ss = STATUS_STYLE[task.status] ?? STATUS_STYLE.NEW;
  const ps = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.MEDIUM;
  const card: React.CSSProperties = { background:'var(--bg-primary)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', padding:'18px' };
  const inputStyle: React.CSSProperties = { width:'100%', background:'var(--bg-secondary)', border:'0.5px solid var(--border)', borderRadius:'8px', padding:'7px 10px', fontSize:'12px', color:'var(--text-primary)', outline:'none', opacity: saving ? 0.6 : 1 };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-tertiary)' }}>
      {/* Header */}
      <div style={{ background:'var(--bg-primary)', borderBottom:'0.5px solid var(--border)', padding:'14px 24px', display:'flex', alignItems:'center', gap:'12px', position:'sticky', top:0, zIndex:10 }}>
        <button onClick={() => router.push('/dashboard/tasks')} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'13px', color:'var(--text-muted)', padding:'4px 8px', borderRadius:'6px' }}>← Назад</button>
        <h1 style={{ fontSize:'15px', fontWeight:600, color:'var(--text-primary)', margin:0, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.title}</h1>
        <span style={{ fontSize:'11px', fontWeight:500, padding:'3px 8px', borderRadius:'20px', background:ss.bg, color:ss.color, flexShrink:0 }}>{ss.label}</span>
      </div>

      <div style={{ padding:'20px 24px', display:'grid', gridTemplateColumns:'1fr 280px', gap:'16px' }}>

        {/* Main */}
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <div style={card}>
            <p style={{ fontSize:'12px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', margin:'0 0 10px' }}>Описание</p>
            {task.description ? (
              <p style={{ fontSize:'13px', color:'var(--text-secondary)', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{task.description}</p>
            ) : (
              <p style={{ fontSize:'13px', color:'var(--text-muted)', fontStyle:'italic' }}>Описание не добавлено</p>
            )}
          </div>

          {/* Comments */}
          <div style={card}>
            <p style={{ fontSize:'12px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', margin:'0 0 14px' }}>
              Комментарии {comments.length > 0 && <span style={{ fontWeight:400, color:'var(--text-muted)' }}>({comments.length})</span>}
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'16px' }}>
              {comments.length === 0 ? (
                <p style={{ textAlign:'center', fontSize:'13px', color:'var(--text-muted)', padding:'12px' }}>Комментариев пока нет</p>
              ) : comments.map((c: any, i: number) => (
                <div key={c.id ?? i} style={{ display:'flex', gap:'10px' }}>
                  <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <span style={{ color:'white', fontSize:'11px', fontWeight:600 }}>{(userMap[c.authorId] ?? c.author?.name ?? '?').charAt(0)}</span>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'baseline', gap:'8px', marginBottom:'4px' }}>
                      <span style={{ fontSize:'13px', fontWeight:500, color:'var(--text-primary)' }}>{userMap[c.authorId] ?? c.author?.name ?? 'Пользователь'}</span>
                      <span style={{ fontSize:'11px', color:'var(--text-muted)' }}>{new Date(c.createdAt).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                    </div>
                    <div style={{ background:'var(--bg-secondary)', borderRadius:'8px', padding:'10px 12px', fontSize:'13px', color:'var(--text-secondary)', lineHeight:1.5 }}>{c.content}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:'10px' }}>
              <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:'2px' }}>
                <span style={{ color:'white', fontSize:'11px', fontWeight:600 }}>{user?.name?.charAt(0) ?? 'U'}</span>
              </div>
              <div style={{ flex:1 }}>
                <textarea value={comment} onChange={e => setComment(e.target.value)}
                  onKeyDown={e => { if (e.key==='Enter' && (e.metaKey||e.ctrlKey)) postComment(); }}
                  placeholder="Написать комментарий... (Cmd+Enter)" rows={3}
                  style={{ width:'100%', background:'var(--bg-secondary)', border:'0.5px solid var(--border)', borderRadius:'8px', padding:'10px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', resize:'none', fontFamily:'inherit' }} />
                <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'6px' }}>
                  <button onClick={postComment} disabled={posting || !comment.trim()}
                    style={{ background:'var(--accent)', color:'white', border:'none', padding:'7px 14px', borderRadius:'8px', fontSize:'12px', fontWeight:500, cursor:'pointer', opacity: posting||!comment.trim() ? 0.5 : 1 }}>
                    {posting ? 'Отправляю...' : 'Отправить'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>

          {/* Status actions */}
          <div style={card}>
            <p style={{ fontSize:'12px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', margin:'0 0 10px' }}>Статус</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {task.status==='NEW' && <button onClick={() => moveTask('IN_PROGRESS')} style={{ padding:'8px', borderRadius:'8px', border:'none', background:'var(--blue-bg)', color:'var(--blue)', fontSize:'12px', fontWeight:500, cursor:'pointer' }}>▶ Взять в работу</button>}
              {task.status==='IN_PROGRESS' && <button onClick={() => moveTask('REVIEW')} style={{ padding:'8px', borderRadius:'8px', border:'none', background:'var(--orange-bg)', color:'var(--orange)', fontSize:'12px', fontWeight:500, cursor:'pointer' }}>👁 На проверку</button>}
              {task.status==='REVIEW' && <button onClick={() => moveTask('DONE')} style={{ padding:'8px', borderRadius:'8px', border:'none', background:'var(--green-bg)', color:'var(--green)', fontSize:'12px', fontWeight:500, cursor:'pointer' }}>✓ Завершить</button>}
              {task.status!=='NEW' && task.status!=='DONE' && <button onClick={() => moveTask('BLOCKED')} style={{ padding:'8px', borderRadius:'8px', border:'none', background:'var(--red-bg)', color:'var(--red)', fontSize:'12px', fontWeight:500, cursor:'pointer' }}>🚫 Заблокировать</button>}
            </div>
          </div>

          {/* Details */}
          <div style={card}>
            <p style={{ fontSize:'12px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', margin:'0 0 12px' }}>Детали</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              <div>
                <p style={{ fontSize:'11px', color:'var(--text-muted)', margin:'0 0 5px' }}>Приоритет</p>
                <span style={{ fontSize:'11px', fontWeight:500, padding:'3px 8px', borderRadius:'12px', background:ps.bg, color:ps.color }}>{ps.label}</span>
              </div>
              <div>
                <p style={{ fontSize:'11px', color:'var(--text-muted)', margin:'0 0 5px' }}>Исполнитель</p>
                <select value={task.assigneeId ?? ''} onChange={e => updateField('assigneeId', e.target.value)} disabled={saving} style={inputStyle}>
                  <option value="">Не назначен</option>
                  {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <p style={{ fontSize:'11px', color:'var(--text-muted)', margin:'0 0 5px' }}>Дедлайн</p>
                <input type="date" value={task.dueDate ? task.dueDate.slice(0,10) : ''} onChange={e => updateField('dueDate', e.target.value)} disabled={saving} style={inputStyle} />
                {task.dueDate && (
                  <p style={{ fontSize:'11px', margin:'4px 0 0', color: new Date(task.dueDate)<new Date() ? 'var(--red)' : new Date(task.dueDate)<new Date(Date.now()+3*864e5) ? 'var(--yellow)' : 'var(--green)' }}>
                    {new Date(task.dueDate)<new Date() ? '⚠ Просрочено' : new Date(task.dueDate)<new Date(Date.now()+3*864e5) ? '⏰ Скоро' : '✓ '+new Date(task.dueDate).toLocaleDateString('ru',{day:'numeric',month:'long'})}
                  </p>
                )}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', paddingTop:'8px', borderTop:'0.5px solid var(--border)' }}>
                <span style={{ color:'var(--text-muted)' }}>Создана</span>
                <span style={{ color:'var(--text-secondary)' }}>{new Date(task.createdAt).toLocaleDateString('ru')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
`);

// ─── 7. DASHBOARD LAYOUT ────────────────────────────────────
write('app/dashboard/layout.tsx', `import { Sidebar } from '@/components/layouts/Sidebar';
export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg-tertiary)' }}>
      <Sidebar />
      <main style={{ flex:1, minWidth:0, overflowY:'auto' }}>{children}</main>
    </div>
  );
}
`);

// ─── 8. ROOT PAGE redirect ────────────────────────────────────
write('app/page.tsx', `import { redirect } from 'next/navigation';
export default function RootPage() { redirect('/dashboard'); }
`);

console.log('\n✅ Unified design applied to all pages');
