const fs = require('fs');
const path = require('path');
function write(p, c) { fs.mkdirSync(path.dirname(p),{recursive:true}); fs.writeFileSync(p,c); console.log('✓',p); }

write('app/dashboard/page.tsx', `'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { WorkSessionWidget } from '@/components/WorkSessionWidget';

const SECTION_LABELS: Record<string, string> = {
  orders:'Заказы', feedbacks:'Отзывы', reviews:'Отзывы', questions:'Вопросы',
  products:'Товары', prices:'Цены', stocks:'Остатки', supplies:'Поставки',
  advertising:'Реклама', analytics:'Аналитика', finance:'Финансы', chat:'Чат',
  promotions:'Акции', promotion:'Продвижение', logistics:'Логистика',
  remains:'Остатки', supply:'Поставки', rating:'Рейтинг', other:'Прочее',
};

function fmtTime(min: number) {
  if (!min || min <= 0) return null;
  if (min < 60) return min + 'м';
  return Math.floor(min/60) + 'ч ' + (min%60) + 'м';
}

function timeAgo(ts: string | null) {
  if (!ts) return null;
  const diff = Math.floor((Date.now() - new Date(ts).getTime()) / 60000);
  if (diff < 1) return 'только что';
  if (diff < 60) return diff + 'м назад';
  return Math.floor(diff/60) + 'ч назад';
}

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken]       = useState('');
  const [user, setUser]         = useState<any>(null);
  const [stats, setStats]       = useState<any>(null);
  const [activity, setActivity] = useState<any[]>([]);
  const [presence, setPresence] = useState<any[]>([]);
  const [tasks, setTasks]       = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [loading, setLoading]   = useState(true);
  const [now, setNow]           = useState(new Date());

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    const u = localStorage.getItem('user');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    if (u) setUser(JSON.parse(u));
    loadAll(t);
    const interval = setInterval(() => { loadAll(t); setNow(new Date()); }, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadAll = async (t: string) => {
    try {
      const [s, a, p, tk, ev, sec] = await Promise.all([
        fetch('http://localhost:3001/api/v1/analytics/stats', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
        fetch('http://localhost:3001/api/v1/analytics/employees', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
        fetch('http://localhost:3001/api/v1/presence', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
        fetch('http://localhost:3001/api/v1/tasks?limit=5&sortBy=dueDate', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
        fetch('http://localhost:3001/api/v1/analytics/activity/total', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
        fetch('http://localhost:3001/api/v1/analytics/activity/summary?days=1', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
      ]);
      if (s && !s.error) setStats(s);
      if (Array.isArray(a)) setActivity(a);
      if (Array.isArray(p)) setPresence(p);
      if (Array.isArray(tk)) setTasks(tk);
      if (ev?.total) setTotalEvents(ev.total);

      // Build section stats from today's activity
      if (Array.isArray(sec)) {
        const sectionMap: Record<string, { clicks: number; timeSeconds: number; platform: string }> = {};
        sec.forEach((emp: any) => {
          if (!emp.sections) return;
          Object.entries(emp.sections as Record<string, any>).forEach(([key, val]: [string, any]) => {
            const [plat, section] = key.split(':');
            if (section === 'other') return;
            if (!sectionMap[key]) sectionMap[key] = { clicks: 0, timeSeconds: 0, platform: plat };
            sectionMap[key].clicks += val.clicks ?? 0;
            sectionMap[key].timeSeconds += val.timeSeconds ?? 0;
          });
        });
        const sorted = Object.entries(sectionMap)
          .map(([key, val]) => ({ key, section: key.split(':')[1], ...val }))
          .sort((a, b) => b.clicks - a.clicks)
          .slice(0, 5);
        setSections(sorted);
      }
    } catch(e) {} finally { setLoading(false); }
  };

  // Alerts
  const alerts: { type: 'error' | 'warning'; msg: string }[] = [];
  const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE');
  if (overdueTasks.length > 0) alerts.push({ type: 'error', msg: overdueTasks.length + ' задач просрочено' });
  const offlineEmployees = presence.filter(p => !p.isOnline && p.lastSeen && (Date.now() - new Date(p.lastSeen).getTime()) < 3 * 3600000);
  if (offlineEmployees.length > 0) alerts.push({ type: 'warning', msg: offlineEmployees.map((e: any) => e.name).join(', ') + ' — нет активности 2+ часа' });

  const onlineCount = presence.filter(p => p.isOnline).length;
  const completionRate = stats?.completionRate ?? 0;
  const maxClicks = Math.max(...sections.map(s => s.clicks), 1);

  const card: React.CSSProperties = {
    background: 'var(--bg-primary)',
    border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '14px',
  };

  const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
    NEW:         { bg:'var(--bg-secondary)',  color:'var(--text-muted)',  label:'Новая' },
    IN_PROGRESS: { bg:'var(--blue-bg)',       color:'var(--blue)',        label:'В работе' },
    REVIEW:      { bg:'var(--orange-bg)',     color:'var(--orange)',      label:'Проверка' },
    DONE:        { bg:'var(--green-bg)',      color:'var(--green)',       label:'Готово' },
    BLOCKED:     { bg:'var(--red-bg)',        color:'var(--red)',         label:'Заблок.' },
  };

  const greeting = now.getHours() < 12 ? 'Доброе утро' : now.getHours() < 18 ? 'Добрый день' : 'Добрый вечер';

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-tertiary)' }}>

      {/* Header */}
      <div style={{ background:'var(--bg-primary)', borderBottom:'0.5px solid var(--border)', padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10 }}>
        <div>
          <h1 style={{ fontSize:'16px', fontWeight:600, color:'var(--text-primary)', margin:0 }}>{greeting}{user?.name ? ', ' + user.name.split(' ')[0] : ''}!</h1>
          <p style={{ fontSize:'12px', color:'var(--text-muted)', margin:'2px 0 0' }}>{now.toLocaleDateString('ru', { weekday:'long', day:'numeric', month:'long' })} · обновлено {now.toLocaleTimeString('ru', { hour:'2-digit', minute:'2-digit' })}</p>
        </div>
        <div style={{ display:'flex', gap:'6px', alignItems:'center' }}>
          {onlineCount > 0 && (
            <span style={{ fontSize:'12px', color:'var(--green)', background:'var(--green-bg)', padding:'4px 12px', borderRadius:'20px', display:'flex', alignItems:'center', gap:'5px' }}>
              <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'var(--green)', flexShrink:0 }} />
              {onlineCount} онлайн
            </span>
          )}
          {alerts.length > 0 && (
            <span style={{ fontSize:'12px', color:'var(--red)', background:'var(--red-bg)', padding:'4px 12px', borderRadius:'20px' }}>
              {alerts.length} алерт{alerts.length > 1 ? 'а' : ''}
            </span>
          )}
        </div>
      </div>

      <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:'14px' }}>

        {/* Work session */}
        {token && <WorkSessionWidget token={token} />}

        {/* Alerts */}
        {alerts.map((a, i) => (
          <div key={i} style={{ background: a.type==='error' ? 'var(--red-bg)' : 'var(--orange-bg)', border:'0.5px solid ' + (a.type==='error' ? 'var(--red)' : 'var(--orange)'), borderRadius:'var(--radius)', padding:'10px 16px', display:'flex', alignItems:'center', gap:'10px', opacity:0.9 }}>
            <span style={{ fontSize:'16px' }}>{a.type==='error' ? '⚠️' : '⏰'}</span>
            <p style={{ fontSize:'13px', color: a.type==='error' ? 'var(--red)' : 'var(--orange)', margin:0, flex:1, fontWeight:500 }}>{a.msg}</p>
            <button onClick={() => router.push(a.type==='error' ? '/dashboard/tasks' : '/dashboard/employees')}
              style={{ fontSize:'11px', color: a.type==='error' ? 'var(--red)' : 'var(--orange)', background:'none', border:'0.5px solid currentColor', borderRadius:'6px', padding:'3px 10px', cursor:'pointer' }}>
              Подробнее →
            </button>
          </div>
        ))}

        {/* KPI cards */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'10px' }}>
          {[
            { label:'Сотрудников', value: presence.length || stats?.totalUsers || '—', sub: onlineCount + ' онлайн', subColor:'var(--green)' },
            { label:'Событий сегодня', value: totalEvents > 0 ? totalEvents.toLocaleString('ru') : '—', sub:'за всё время', subColor:'var(--text-muted)' },
            { label:'Задач', value: stats?.totalTasks ?? '—', sub: overdueTasks.length > 0 ? overdueTasks.length + ' просрочено' : 'всё в срок', subColor: overdueTasks.length > 0 ? 'var(--red)' : 'var(--green)' },
            { label:'В работе', value: stats?.activeTasks ?? 0, sub:'задач активных', subColor:'var(--blue)', accent:'var(--blue)' },
            { label:'Выполнено', value: completionRate + '%', sub: (stats?.completedTasks ?? 0) + ' из ' + (stats?.totalTasks ?? 0), subColor:'var(--green)', accent:'var(--green)' },
          ].map(k => (
            <div key={k.label} style={card}>
              <p style={{ fontSize:'11px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', margin:'0 0 6px' }}>{k.label}</p>
              <p style={{ fontSize:'22px', fontWeight:600, color:(k as any).accent ?? 'var(--text-primary)', margin:'0 0 4px' }}>{k.value}</p>
              <p style={{ fontSize:'11px', color:k.subColor, margin:0 }}>{k.sub}</p>
            </div>
          ))}
        </div>

        {/* Middle row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'14px' }}>

          {/* Section activity */}
          <div style={card}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
              <p style={{ fontSize:'13px', fontWeight:600, color:'var(--text-primary)', margin:0 }}>Топ разделы сегодня</p>
              <button onClick={() => router.push('/dashboard/analytics/sections')}
                style={{ fontSize:'11px', color:'var(--accent)', background:'var(--accent-bg)', border:'none', padding:'4px 10px', borderRadius:'6px', cursor:'pointer', fontWeight:500 }}>
                Все разделы →
              </button>
            </div>
            {sections.length === 0 ? (
              <div style={{ textAlign:'center', padding:'20px', color:'var(--text-muted)', fontSize:'13px' }}>
                <p style={{ fontSize:'24px', marginBottom:'8px' }}>📊</p>
                Нет данных — откройте WB или Ozon с расширением
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {sections.map(s => {
                  const label = SECTION_LABELS[s.section] ?? s.section;
                  const isWB = s.platform === 'WILDBERRIES';
                  const color = isWB ? 'var(--accent)' : 'var(--blue)';
                  const pct = Math.round(s.clicks / maxClicks * 100);
                  return (
                    <div key={s.key}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'4px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'7px' }}>
                          <span style={{ fontSize:'10px', fontWeight:600, padding:'2px 6px', borderRadius:'4px', background: isWB ? 'rgba(139,124,246,0.12)' : 'rgba(77,157,224,0.12)', color }}>
                            {isWB ? 'WB' : 'OZ'}
                          </span>
                          <span style={{ fontSize:'13px', color:'var(--text-primary)', fontWeight:500 }}>{label}</span>
                        </div>
                        <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                          <span style={{ fontSize:'12px', color, fontWeight:600 }}>{s.clicks} кликов</span>
                          {s.timeSeconds > 0 && (
                            <span style={{ fontSize:'11px', color:'var(--text-muted)', background:'var(--bg-secondary)', padding:'2px 7px', borderRadius:'10px' }}>
                              ⏱ {s.timeSeconds < 60 ? s.timeSeconds+'с' : Math.floor(s.timeSeconds/60)+'м ' + (s.timeSeconds%60)+'с'}
                            </span>
                          )}
                        </div>
                      </div>
                      <div style={{ height:'5px', background:'var(--bg-secondary)', borderRadius:'3px', overflow:'hidden' }}>
                        <div style={{ height:'5px', width:pct+'%', background:color, borderRadius:'3px', transition:'width 0.5s' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Team status */}
          <div style={card}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
              <p style={{ fontSize:'13px', fontWeight:600, color:'var(--text-primary)', margin:0 }}>Команда сейчас</p>
              <button onClick={() => router.push('/dashboard/employees')}
                style={{ fontSize:'11px', color:'var(--accent)', background:'var(--accent-bg)', border:'none', padding:'4px 10px', borderRadius:'6px', cursor:'pointer', fontWeight:500 }}>
                Все →
              </button>
            </div>
            {presence.length === 0 ? (
              <div style={{ textAlign:'center', padding:'20px', color:'var(--text-muted)', fontSize:'13px' }}>
                <p style={{ fontSize:'24px', marginBottom:'8px' }}>👥</p>
                Нет данных о присутствии
              </div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {presence.slice(0, 6).map((emp: any) => {
                  const isOnline = emp.isOnline;
                  const ago = timeAgo(emp.lastSeen);
                  const isAlert = !isOnline && emp.lastSeen && (Date.now() - new Date(emp.lastSeen).getTime()) < 3 * 3600000;
                  const empActivity = activity.find((a: any) => a.userId === emp.userId);
                  const topSection = empActivity?.days?.[0]?.platforms ? null : null;

                  return (
                    <div key={emp.userId}
                      style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 10px', borderRadius:'8px', background: isAlert ? 'var(--red-bg)' : 'var(--bg-secondary)', border: isAlert ? '0.5px solid var(--red)' : 'none', cursor:'pointer' }}
                      onClick={() => router.push('/dashboard/employees/' + emp.userId)}>
                      <div style={{ position:'relative', flexShrink:0 }}>
                        <div style={{ width:'30px', height:'30px', borderRadius:'50%', background: isAlert ? 'var(--red)' : 'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <span style={{ color:'white', fontSize:'12px', fontWeight:600 }}>{emp.name?.charAt(0)}</span>
                        </div>
                        <span style={{ position:'absolute', bottom:0, right:0, width:'8px', height:'8px', borderRadius:'50%', background: isOnline ? 'var(--green)' : isAlert ? 'var(--red)' : 'var(--text-muted)', border:'1.5px solid var(--bg-primary)' }} />
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:'13px', fontWeight:500, color: isAlert ? 'var(--red)' : 'var(--text-primary)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.name}</p>
                        <p style={{ fontSize:'11px', color: isAlert ? 'var(--red)' : 'var(--text-muted)', margin:0 }}>
                          {isOnline ? 'Онлайн' : ago ? ago : 'Офлайн'}
                        </p>
                      </div>
                      {isAlert && <span style={{ fontSize:'16px' }}>⚠️</span>}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Tasks row */}
        <div style={card}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
            <p style={{ fontSize:'13px', fontWeight:600, color:'var(--text-primary)', margin:0 }}>Задачи</p>
            <div style={{ display:'flex', gap:'6px' }}>
              {overdueTasks.length > 0 && (
                <span style={{ fontSize:'11px', color:'var(--red)', background:'var(--red-bg)', padding:'3px 10px', borderRadius:'20px', fontWeight:500 }}>
                  {overdueTasks.length} просрочено
                </span>
              )}
              <button onClick={() => router.push('/dashboard/tasks')}
                style={{ fontSize:'11px', color:'var(--accent)', background:'var(--accent-bg)', border:'none', padding:'4px 10px', borderRadius:'6px', cursor:'pointer', fontWeight:500 }}>
                Все задачи →
              </button>
            </div>
          </div>
          {tasks.length === 0 ? (
            <div style={{ textAlign:'center', padding:'16px', color:'var(--text-muted)', fontSize:'13px' }}>Нет задач</div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {tasks.slice(0, 5).map((t: any) => {
                const ss = STATUS_STYLE[t.status] ?? STATUS_STYLE.NEW;
                const overdue = t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE';
                return (
                  <div key={t.id}
                    style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 12px', background:'var(--bg-secondary)', borderRadius:'8px', cursor:'pointer', border: overdue ? '0.5px solid var(--red)' : 'none' }}
                    onClick={() => router.push('/dashboard/tasks/' + t.id)}>
                    <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:ss.color, flexShrink:0 }} />
                    <p style={{ flex:1, fontSize:'13px', fontWeight:500, color:'var(--text-primary)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</p>
                    <span style={{ fontSize:'11px', fontWeight:500, padding:'3px 8px', borderRadius:'12px', background:ss.bg, color:ss.color, flexShrink:0 }}>{ss.label}</span>
                    {t.dueDate && (
                      <span style={{ fontSize:'11px', color: overdue ? 'var(--red)' : 'var(--text-muted)', flexShrink:0 }}>
                        {overdue ? '⚠ ' : ''}{new Date(t.dueDate).toLocaleDateString('ru', { day:'numeric', month:'short' })}
                      </span>
                    )}
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

console.log('\n✅ Dashboard updated');
