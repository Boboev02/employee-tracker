'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WorkSessionWidget } from '@/components/WorkSessionWidget';

const SECTION_LABELS: Record<string,string> = {
  // Товары
  orders:'Заказы', feedbacks:'Отзывы', reviews:'Отзывы', questions:'Вопросы',
  products:'Товары', brands:'Бренды', content:'Контент', abtest:'A/B тест карточки',
  recommendations:'Рекомендации', substitution:'Подмена артикула',
  // Цены
  prices:'Цены и скидки', cashback:'Кэшбэк', promotions:'Акции', promotion:'Продвижение',
  // Отзывы
  claims:'Претензии покупателей', chat:'Чат с покупателями',
  // Склад
  supplies:'Поставки', supply:'Поставки', stocks:'Остатки', remains:'Остатки',
  orders_fbo:'Заказы FBO', orders_fbs:'Заказы FBS', returns:'Возвраты', logistics:'Логистика',
  // Аналитика
  analytics:'Аналитика', content_analytics:'Аналитика контента',
  search_analytics:'Поисковая аналитика', platform_analytics:'Аналитика платформы',
  analytics_search:'Поисковая аналитика',
  // Финансы
  finance:'Финансы', fintech:'Финансы', income:'Доходы и расходы', calculator:'Калькулятор прибыли',
  // Реклама
  advertising:'Реклама',
  // Ozon
  highlights:'Акции и хайлайты', complaints:'Жалобы', warehouse:'Склад',
  certificates:'Сертификаты', merge:'Объединение товаров', dashboard:'Дашборд',
  // Прочее
  rating:'Рейтинг', tariffs:'Тарифы', levels:'Уровни продавца', showcase:'Витрина продавца',
  monetization:'Монетизация данных', support:'Поддержка', knowledge:'База знаний', other:'Прочее',
};

const TASK_STATUS: Record<string,{color:string;label:string}> = {
  NEW:         { color:'var(--text-muted)',  label:'Новая' },
  IN_PROGRESS: { color:'var(--blue)',        label:'В работе' },
  REVIEW:      { color:'var(--orange)',      label:'Проверка' },
  DONE:        { color:'var(--green)',       label:'Готово' },
  BLOCKED:     { color:'var(--red)',         label:'Заблок.' },
};

function Avatar({ name, bg, size=32 }: { name:string; bg:string; size?:number }) {
  return (
    <div style={{ width:size+'px', height:size+'px', borderRadius:'50%', background:bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <span style={{ color:'white', fontSize:size*0.38+'px', fontWeight:600 }}>{name?.charAt(0)}</span>
    </div>
  );
}

const AVATAR_COLORS = ['#8b7cf6','#4d9de0','#22c55e','#f97316','#ef4444','#eab308','#14b8a6'];
function avatarColor(name: string) { return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length]; }

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken]       = useState('');
  const [stats, setStats]       = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [presence, setPresence] = useState<any[]>([]);
  const [tasks, setTasks]       = useState<any[]>([]);
  const [sections, setSections] = useState<any[]>([]);
  const [totalClicks, setTotalClicks] = useState(0);
  const [loading, setLoading]   = useState(true);
  const [now, setNow]           = useState(new Date());

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    loadAll(t);
    const iv = setInterval(() => { loadAll(t); setNow(new Date()); }, 60000);
    return () => clearInterval(iv);
  }, []);

  const loadAll = async (t: string) => {
    try {
      // Auto-refresh token if expired
    const checkToken = async () => {
      const res = await fetch('https://employee-tracker.ru/api/v1/auth/me', {
        headers: { Authorization: 'Bearer ' + t }
      });
      if (res.status === 401) {
        const refresh = await fetch('https://employee-tracker.ru/api/v1/auth/refresh', {
          method: 'POST', headers: { Authorization: 'Bearer ' + t }
        });
        if (refresh.ok) {
          const data = await refresh.json();
          localStorage.setItem('access_token', data.accessToken);
          return data.accessToken;
        } else {
          router.push('/login'); return null;
        }
      }
      return t;
    };
    const validToken = await checkToken();
    if (!validToken) return;
    t = validToken;

    const [s, emps, p, tk, sec] = await Promise.all([
        fetch('https://employee-tracker.ru/api/v1/analytics/stats',      { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
        fetch('https://employee-tracker.ru/api/v1/employees',            { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
        fetch('https://employee-tracker.ru/api/v1/presence',             { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
        fetch('https://employee-tracker.ru/api/v1/tasks',                { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
        fetch('https://employee-tracker.ru/api/v1/analytics/activity/summary?days=7', { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
      ]);

      if (s && !s.error) setStats(s);
      if (Array.isArray(emps)) setEmployees(emps);
      if (Array.isArray(tk)) setTasks(tk);

      // Presence
      if (Array.isArray(p)) {
        setPresence(p);
      } else if (p && typeof p === 'object' && !p.error) {
        const empArr = Array.isArray(emps) ? emps : [];
        const empMap = Object.fromEntries(empArr.map((e:any) => [e.id, e.name]));
        setPresence(Object.values(p).map((v:any) => ({
          userId: v.userId,
          name: empMap[v.userId] ?? 'Сотрудник',
          isOnline: v.status === 'ONLINE',
          lastActivityAt: v.lastActivityAt,
          currentSection: null,
        })));
      }

      // Sections
      if (Array.isArray(sec)) {
        const map: Record<string,{clicks:number;timeSeconds:number;platform:string}> = {};
        let clicks = 0;
        sec.forEach((emp:any) => {
          if (!emp.sections) return;
          Object.entries(emp.sections as Record<string,any>).forEach(([key,val]:any) => {
            const [plat,section] = key.split(':');
            if (section==='other') return;
            if (!map[key]) map[key] = { clicks:0, timeSeconds:0, platform:plat };
            const c = (val.clicks??0) + (val.events??0);
            map[key].clicks += c;
            map[key].timeSeconds += val.timeSeconds??0;
            clicks += c;
          });
        });
        setTotalClicks(clicks);
        setSections(
          Object.entries(map)
            .map(([key,val]) => ({ key, section:key.split(':')[1], ...val }))
            .filter(s => s.clicks > 0 || s.timeSeconds > 0)
            .sort((a,b) => b.clicks - a.clicks)
            .slice(0, 5)
        );
      }
    } catch(e) {} finally { setLoading(false); }
  };

  const onlineCount   = presence.filter(p => p.isOnline).length;
  const overdueTasks  = tasks.filter(t => t.dueDate && new Date(t.dueDate)<new Date() && t.status!=='DONE');
  const maxClicks     = Math.max(...sections.map(s=>s.clicks), 1);

  const alerts: {type:'error'|'warning'; msg:string; href:string}[] = [];
  if (overdueTasks.length > 0) alerts.push({ type:'error', msg: overdueTasks.length+' задач просрочено', href:'/dashboard/tasks' });
  const longOffline = presence.filter(p => !p.isOnline && p.lastActivityAt && (Date.now()-p.lastActivityAt) > 2*3600000);
  longOffline.forEach(p => alerts.push({ type:'warning', msg: p.name+' не активен 2+ часа', href:'/dashboard/employees' }));

  const greeting = now.getHours()<12?'Доброе утро':now.getHours()<18?'Добрый день':'Добрый вечер';

  const card: React.CSSProperties = { background:'var(--bg-primary)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', padding:'16px' };

  function fmtSec(s:number) {
    if (!s||s<=0) return null;
    if (s<60) return s+'с';
    if (s<3600) return Math.floor(s/60)+'м';
    return Math.floor(s/3600)+'ч '+Math.floor((s%3600)/60)+'м';
  }

  function timeAgo(ts:number) {
    const d = Math.floor((Date.now()-ts)/60000);
    if (d<1) return 'только что';
    if (d<60) return d+'м назад';
    return Math.floor(d/60)+'ч назад';
  }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-tertiary)' }}>

      {/* Header */}
      <div style={{ background:'var(--bg-primary)', borderBottom:'0.5px solid var(--border)', padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10 }}>
        <div>
          <h1 style={{ fontSize:'16px', fontWeight:600, color:'var(--text-primary)', margin:0 }}>{greeting}, {employees.find((e:any)=>e.email===JSON.parse(localStorage.getItem('user')||'{}')?.email)?.name?.split(' ')[0] ?? 'Admin'}!</h1>
          <p style={{ fontSize:'12px', color:'var(--text-muted)', margin:'2px 0 0' }}>{now.toLocaleDateString('ru',{weekday:'long',day:'numeric',month:'long'})} · обновлено {now.toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'})}</p>
        </div>
        {onlineCount > 0 && (
          <span style={{ fontSize:'12px', color:'var(--green)', background:'var(--green-bg)', padding:'4px 12px', borderRadius:'20px', display:'flex', alignItems:'center', gap:'5px' }}>
            <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'var(--green)' }} />
            {onlineCount} онлайн
          </span>
        )}
      </div>

      <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:'14px' }}>
        {token && <WorkSessionWidget token={token} />}

        {/* Alerts */}
        {alerts.map((a,i) => (
          <div key={i} style={{ background:a.type==='error'?'var(--red-bg)':'var(--orange-bg)', border:'0.5px solid '+(a.type==='error'?'var(--red)':'var(--orange)'), borderRadius:'var(--radius)', padding:'11px 16px', display:'flex', alignItems:'center', gap:'10px' }}>
            <i className={'ti '+(a.type==='error'?'ti-alert-triangle':'ti-clock')} style={{ fontSize:'16px', color:a.type==='error'?'var(--red)':'var(--orange)', flexShrink:0 }} aria-hidden="true" />
            <p style={{ fontSize:'13px', color:a.type==='error'?'var(--red)':'var(--orange)', margin:0, flex:1, fontWeight:500 }}>{a.msg}</p>
            <button onClick={()=>router.push(a.href)} style={{ fontSize:'12px', color:a.type==='error'?'var(--red)':'var(--orange)', background:'none', border:'none', cursor:'pointer', fontWeight:500 }}>Подробнее →</button>
          </div>
        ))}

        {/* KPI row */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px' }}>
          <div style={card}>
            <p style={{ fontSize:'11px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', margin:'0 0 8px' }}>Сотрудников</p>
            <p style={{ fontSize:'26px', fontWeight:600, color:'var(--text-primary)', margin:'0 0 4px' }}>{employees.length||'—'}</p>
            <p style={{ fontSize:'12px', color:'var(--green)', margin:0 }}>{onlineCount} онлайн</p>
          </div>
          <div style={card}>
            <p style={{ fontSize:'11px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', margin:'0 0 8px' }}>Кликов</p>
            <p style={{ fontSize:'26px', fontWeight:600, color:'var(--accent)', margin:'0 0 4px' }}>{totalClicks>0?totalClicks.toLocaleString('ru'):'—'}</p>
            <p style={{ fontSize:'12px', color:'var(--text-muted)', margin:0 }}>за 7 дней</p>
          </div>
          <div style={card}>
            <p style={{ fontSize:'11px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', margin:'0 0 8px' }}>Задач</p>
            <p style={{ fontSize:'26px', fontWeight:600, color:'var(--text-primary)', margin:'0 0 4px' }}>{stats?.totalTasks??'—'}</p>
            <p style={{ fontSize:'12px', color:overdueTasks.length>0?'var(--red)':'var(--green)', margin:0 }}>{overdueTasks.length>0?overdueTasks.length+' просрочено':'всё в срок'}</p>
          </div>
          <div style={card}>
            <p style={{ fontSize:'11px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.06em', margin:'0 0 8px' }}>Выполнено</p>
            <p style={{ fontSize:'26px', fontWeight:600, color:'var(--green)', margin:'0 0 4px' }}>{stats?.completionRate!=null?stats.completionRate+'%':'—'}</p>
            <p style={{ fontSize:'12px', color:'var(--text-muted)', margin:0 }}>{(stats?.completedTasks??0)+' из '+(stats?.totalTasks??0)}</p>
          </div>
        </div>

        {/* 3-column row */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>

          {/* Топ разделы */}
          <div style={card}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
              <p style={{ fontSize:'14px', fontWeight:600, color:'var(--text-primary)', margin:0 }}>Топ разделы</p>
              <button onClick={()=>router.push('/dashboard/analytics/sections')}
                style={{ fontSize:'11px', color:'var(--accent)', background:'var(--accent-bg)', border:'none', padding:'3px 9px', borderRadius:'6px', cursor:'pointer', fontWeight:500 }}>
                Все →
              </button>
            </div>
            {sections.length===0 ? (
              <p style={{ fontSize:'13px', color:'var(--text-muted)', textAlign:'center', padding:'20px 0' }}>Нет данных — откройте WB или Ozon</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {sections.map(s => {
                  const isWB = s.platform==='WILDBERRIES';
                  const color = isWB ? 'var(--accent)' : 'var(--blue)';
                  const label = SECTION_LABELS[s.section] ?? s.section;
                  const pct = Math.round(s.clicks/maxClicks*100);
                  return (
                    <div key={s.key}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                        <span style={{ fontSize:'13px', color:'var(--text-primary)' }}>
                          <span style={{ fontSize:'10px', fontWeight:600, marginRight:'5px', color }}>{isWB?'WB':'OZ'}</span>
                          {label}
                        </span>
                        <span style={{ fontSize:'13px', fontWeight:600, color }}>{s.clicks}</span>
                      </div>
                      <div style={{ height:'4px', background:'var(--bg-secondary)', borderRadius:'2px', overflow:'hidden' }}>
                        <div style={{ height:'4px', width:pct+'%', background:color, borderRadius:'2px' }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Команда сейчас */}
          <div style={card}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
              <p style={{ fontSize:'14px', fontWeight:600, color:'var(--text-primary)', margin:0 }}>Команда сейчас</p>
              <button onClick={()=>router.push('/dashboard/employees')}
                style={{ fontSize:'11px', color:'var(--accent)', background:'var(--accent-bg)', border:'none', padding:'3px 9px', borderRadius:'6px', cursor:'pointer', fontWeight:500 }}>
                Все →
              </button>
            </div>
            {presence.length===0 ? (
              <p style={{ fontSize:'13px', color:'var(--text-muted)', textAlign:'center', padding:'20px 0' }}>Нет данных</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                {presence.slice(0,5).map((emp:any) => {
                  const isAlert = !emp.isOnline && emp.lastActivityAt && (Date.now()-emp.lastActivityAt) > 2*3600000;
                  return (
                    <div key={emp.userId} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'6px 8px', borderRadius:'8px', background:isAlert?'var(--red-bg)':'var(--bg-secondary)', cursor:'pointer' }}
                      onClick={()=>router.push('/dashboard/employees/'+emp.userId)}>
                      <div style={{ position:'relative', flexShrink:0 }}>
                        <div style={{ width:'30px', height:'30px', borderRadius:'50%', background:avatarColor(emp.name), display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <span style={{ color:'white', fontSize:'12px', fontWeight:600 }}>{emp.name?.charAt(0)}</span>
                        </div>
                        <span style={{ position:'absolute', bottom:0, right:0, width:'8px', height:'8px', borderRadius:'50%', background:emp.isOnline?'var(--green)':isAlert?'var(--red)':'var(--text-muted)', border:'1.5px solid var(--bg-primary)' }} />
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:'13px', fontWeight:500, color:isAlert?'var(--red)':'var(--text-primary)', margin:0 }}>{emp.name}</p>
                        <p style={{ fontSize:'11px', color:isAlert?'var(--red)':'var(--text-muted)', margin:0 }}>
                          {emp.isOnline ? 'Онлайн' : emp.lastActivityAt ? timeAgo(emp.lastActivityAt) : 'Офлайн'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Задачи */}
          <div style={card}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
              <p style={{ fontSize:'14px', fontWeight:600, color:'var(--text-primary)', margin:0 }}>Задачи</p>
              <button onClick={()=>router.push('/dashboard/tasks')}
                style={{ fontSize:'11px', color:'var(--accent)', background:'var(--accent-bg)', border:'none', padding:'3px 9px', borderRadius:'6px', cursor:'pointer', fontWeight:500 }}>
                Все →
              </button>
            </div>
            {tasks.length===0 ? (
              <p style={{ fontSize:'13px', color:'var(--text-muted)', textAlign:'center', padding:'20px 0' }}>Нет задач</p>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {tasks.slice(0,5).map((t:any) => {
                  const ss = TASK_STATUS[t.status] ?? TASK_STATUS.NEW;
                  const overdue = t.dueDate && new Date(t.dueDate)<new Date() && t.status!=='DONE';
                  return (
                    <div key={t.id} style={{ display:'flex', alignItems:'flex-start', gap:'10px', padding:'8px 10px', background:'var(--bg-secondary)', borderRadius:'8px', cursor:'pointer', border: overdue?'0.5px solid var(--red)':'none' }}
                      onClick={()=>router.push('/dashboard/tasks/'+t.id)}>
                      <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:ss.color, flexShrink:0, marginTop:'4px' }} />
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:'13px', fontWeight:500, color:'var(--text-primary)', margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</p>
                        <p style={{ fontSize:'11px', color:overdue?'var(--red)':ss.color, margin:0 }}>{overdue?'Просрочено':t.dueDate?'До '+new Date(t.dueDate).toLocaleDateString('ru',{day:'numeric',month:'short'}):ss.label}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
