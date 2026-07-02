'use client';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WorkSessionWidget } from '@/components/WorkSessionWidget';

const SECTION_LABELS: Record<string,string> = {
  orders:'Заказы', feedbacks:'Отзывы', reviews:'Отзывы', questions:'Вопросы',
  products:'Товары', brands:'Бренды', content:'Контент', abtest:'A/B тест',
  prices:'Цены и скидки', cashback:'Кэшбэк', promotions:'Акции', promotion:'Продвижение',
  claims:'Претензии', chat:'Чат с покупателями',
  supplies:'Поставки', supply:'Поставки', stocks:'Остатки', remains:'Остатки',
  orders_fbo:'Заказы FBO', orders_fbs:'Заказы FBS', returns:'Возвраты', logistics:'Логистика',
  analytics:'Аналитика', content_analytics:'Аналитика контента',
  search_analytics:'Поисковая аналитика', platform_analytics:'Аналитика платформы',
  analytics_search:'Поисковая аналитика',
  finance:'Финансы', fintech:'Финансы', income:'Доходы', calculator:'Калькулятор',
  advertising:'Реклама', highlights:'Акции', complaints:'Жалобы', warehouse:'Склад',
  dashboard:'Дашборд', rating:'Рейтинг', support:'Поддержка', other:'Прочее',
};

const TASK_STATUS: Record<string,{color:string;bg:string;label:string}> = {
  NEW:         { color:'#6B7280', bg:'#F3F4F6',  label:'Новая' },
  IN_PROGRESS: { color:'#2563EB', bg:'#DBEAFE',  label:'В работе' },
  REVIEW:      { color:'#D97706', bg:'#FEF3C7',  label:'Проверка' },
  DONE:        { color:'#16A34A', bg:'#DCFCE7',  label:'Готово' },
  BLOCKED:     { color:'#DC2626', bg:'#FEE2E2',  label:'Заблок.' },
};

const AVATAR_COLORS = ['#7F77DD','#2563EB','#16A34A','#D97706','#DC2626','#0891B2','#7C3AED'];
const avatarColor = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0)??0) % AVATAR_COLORS.length];

function fmtSec(s: number) {
  if (!s||s<=0) return null;
  if (s<60) return s+'с';
  if (s<3600) return Math.floor(s/60)+'м';
  return Math.floor(s/3600)+'ч '+Math.floor((s%3600)/60)+'м';
}
function timeAgo(ts: number) {
  const d = Math.floor((Date.now()-ts)/60000);
  if (d<1) return 'только что';
  if (d<60) return d+'м назад';
  return Math.floor(d/60)+'ч назад';
}

function SectionHeader({ title, open, onToggle }: { title: string; open: boolean; onToggle: () => void }) {
  return (
    <div onClick={onToggle} style={{ display:'flex', alignItems:'center', justifyContent:'space-between', cursor:'pointer', padding:'4px 0', userSelect:'none' }}>
      <h2 style={{ fontSize:'15px', fontWeight:700, color:'#1a1040', margin:0 }}>{title}</h2>
      <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'white', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 8px rgba(127,119,221,0.12)', transition:'transform 0.2s', transform: open?'rotate(180deg)':'none' }}>
        <i className="ti ti-chevron-down" style={{ fontSize:'14px', color:'#9B97CC' }} aria-hidden="true" />
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [trialDays, setTrialDays] = useState<number|null>(null);
  const [token, setToken]           = useState('');
  const [stats, setStats]           = useState<any>(null);
  const [employees, setEmployees]   = useState<any[]>([]);
  const [presence, setPresence]     = useState<any[]>([]);
  const [tasks, setTasks]           = useState<any[]>([]);
  const [sections, setSections]     = useState<any[]>([]);
  const [totalClicks, setTotalClicks] = useState(0);
  const [loading, setLoading]       = useState(true);
  const [now, setNow]               = useState(new Date());

  // Section open/close state
  const [openKpi, setOpenKpi]         = useState(true);
  const [openActivity, setOpenActivity] = useState(true);
  const [openTasks, setOpenTasks]     = useState(true);
  const [projects, setProjects]       = useState<any[]>([]);
  const [products, setProducts]       = useState<any[]>([]);
  const [openProjects, setOpenProjects] = useState(true);
  const [openProducts, setOpenProducts] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    const u = localStorage.getItem('user');
    if (u) {
      try {
        const parsed = JSON.parse(u);
        if (parsed.org?.trialEndsAt) {
          const days = Math.ceil((new Date(parsed.org.trialEndsAt).getTime() - Date.now()) / 86400000);
          if (days > 0 && days <= 14) setTrialDays(days);
        }
      } catch {}
    }
    if (!t) { router.push('/login'); return; }
    setToken(t); loadAll(t);
    const iv = setInterval(() => { loadAll(t); setNow(new Date()); }, 60000);
    return () => clearInterval(iv);
  }, []);

  const loadAll = async (t: string) => {
    try {
      const checkToken = async () => {
        const res = await fetch('https://employee-tracker.ru/api/v1/auth/me', { headers: { Authorization: 'Bearer ' + t } });
        if (res.status === 401) {
          const refresh = await fetch('https://employee-tracker.ru/api/v1/auth/refresh', { method: 'POST', headers: { Authorization: 'Bearer ' + t } });
          if (refresh.ok) { const data = await refresh.json(); localStorage.setItem('access_token', data.accessToken); return data.accessToken; }
          else { router.push('/login'); return null; }
        }
        return t;
      };
      const validToken = await checkToken();
      if (!validToken) return;
      t = validToken;

      const [s, emps, p, tk, sec, proj, prod] = await Promise.all([
        fetch('https://employee-tracker.ru/api/v1/analytics/stats',              { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
        fetch('https://employee-tracker.ru/api/v1/employees',                    { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
        fetch('https://employee-tracker.ru/api/v1/presence',                     { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
        fetch('https://employee-tracker.ru/api/v1/tasks',                        { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
        fetch('https://employee-tracker.ru/api/v1/analytics/activity/summary?days=7', { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
        fetch('https://employee-tracker.ru/api/v1/projects?limit=6',             { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()).catch(()=>[]),
        fetch('https://employee-tracker.ru/api/v1/products?limit=6',             { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()).catch(()=>({})),
      ]);

      if (s && !s.error) setStats(s);
      if (Array.isArray(emps)) setEmployees(emps);
      if (Array.isArray(tk)) setTasks(tk);
      if (Array.isArray(proj)) setProjects(proj);
      if (prod?.products) setProducts(prod.products.slice(0,6));

      if (Array.isArray(p)) {
        setPresence(p);
      } else if (p && typeof p === 'object' && !p.error) {
        const empArr = Array.isArray(emps) ? emps : [];
        const empMap = Object.fromEntries(empArr.map((e:any) => [e.id, e.name]));
        setPresence(Object.values(p).map((v:any) => ({ userId:v.userId, name:empMap[v.userId]??'Сотрудник', isOnline:v.status==='ONLINE', lastActivityAt:v.lastActivityAt })));
      }

      if (Array.isArray(sec)) {
        const map: Record<string,any> = {};
        let clicks = 0;
        sec.forEach((emp:any) => {
          if (!emp.sections) return;
          Object.entries(emp.sections as Record<string,any>).forEach(([key,val]:any) => {
            const [plat, section] = key.split(':');
            if (section==='other') return;
            if (!map[key]) map[key] = { clicks:0, timeSeconds:0, platform:plat };
            const c = (val.clicks??0)+(val.events??0);
            map[key].clicks += c; map[key].timeSeconds += val.timeSeconds??0; clicks += c;
          });
        });
        setTotalClicks(clicks);
        setSections(Object.entries(map).map(([key,val]) => ({ key, section:key.split(':')[1], ...val })).filter(s=>s.clicks>0||s.timeSeconds>0).sort((a,b)=>b.clicks-a.clicks).slice(0,5));
      }
    } catch(e) {} finally { setLoading(false); }
  };

  const onlineCount  = presence.filter(p => p.isOnline).length;
  const overdueTasks = tasks.filter(t => t.dueDate && new Date(t.dueDate)<new Date() && t.status!=='DONE');
  const maxClicks    = Math.max(...sections.map(s=>s.clicks), 1);
  const greeting     = now.getHours()<12?'Доброе утро':now.getHours()<18?'Добрый день':'Добрый вечер';
  const userName     = employees.find((e:any)=>e.email===JSON.parse(localStorage.getItem('user')||'{}')?.email)?.name?.split(' ')[0] ?? 'Admin';

  // Shared styles
  const pageStyle: React.CSSProperties = { minHeight:'100vh', background:'#ECEAF8' };
  const cardStyle: React.CSSProperties = { background:'white', borderRadius:'16px', padding:'16px 18px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' };
  const pillStyle = (color: string, bg: string): React.CSSProperties => ({ fontSize:'10px', fontWeight:600, color, background:bg, padding:'3px 8px', borderRadius:'20px', display:'inline-flex', alignItems:'center', gap:'3px' });

  return (
    <div style={pageStyle}>
      {/* ── Header ── */}
      <div style={{ background:'white', borderBottom:'none', padding: isMobile ? '12px 16px' : '16px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10, boxShadow:'0 4px 16px rgba(127,119,221,0.06)' }}>
        <div>
          <h1 style={{ fontSize: isMobile ? '16px' : '18px', fontWeight:800, color:'#1a1040', margin:0, letterSpacing:'-0.5px' }}>{greeting}, {userName}!</h1>
          <p style={{ fontSize:'11px', color:'#9B97CC', margin:'2px 0 0', display:'flex', alignItems:'center', gap:'6px' }}>
            {now.toLocaleDateString('ru',{weekday:'long',day:'numeric',month:'long'})}
            <span style={{ width:'3px', height:'3px', borderRadius:'50%', background:'#D4D0F0', display:'inline-block' }} />
            обновлено {now.toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'})}
          </p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          {onlineCount > 0 && (
            <span style={pillStyle('#16A34A','#DCFCE7')}>
              <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:'#16A34A' }} />
              {onlineCount} онлайн
            </span>
          )}
          {overdueTasks.length > 0 && (
            <span onClick={()=>router.push('/dashboard/tasks')} style={{ ...pillStyle('#DC2626','#FEE2E2'), cursor:'pointer' }}>
              <i className="ti ti-alert-triangle" style={{ fontSize:'11px' }} aria-hidden="true" />
              {overdueTasks.length} просрочено
            </span>
          )}
          <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'linear-gradient(135deg,#7F77DD,#5248C5)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(127,119,221,0.3)' }}>
            <span style={{ color:'white', fontSize:'13px', fontWeight:700 }}>{userName?.charAt(0)}</span>
          </div>
        </div>
      </div>

      <div style={{ padding: isMobile ? '12px' : '20px 28px', display:'flex', flexDirection:'column', gap:'16px' }}>
        {trialDays !== null && (
          <div style={{background:'linear-gradient(135deg,#7F77DD,#5248C5)',borderRadius:'16px',padding:'14px 20px',display:'flex',alignItems:'center',gap:'14px',boxShadow:'0 4px 16px rgba(127,119,221,0.25)'}}>
            <span style={{fontSize:'24px'}}>🎁</span>
            <div style={{flex:1}}>
              <p style={{fontSize:'13px',fontWeight:700,color:'white',margin:0}}>Пробный период: осталось {trialDays} {trialDays===1?'день':trialDays<5?'дня':'дней'}</p>
              <p style={{fontSize:'11px',color:'rgba(255,255,255,0.75)',margin:0}}>Для продолжения работы подключите подписку</p>
            </div>
            <button onClick={()=>router.push('/dashboard/settings')} style={{background:'white',color:'#7F77DD',border:'none',borderRadius:'10px',padding:'8px 16px',fontSize:'12px',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap'}}>
              Подключить →
            </button>
          </div>
        )}
        {token && <WorkSessionWidget token={token} />}

        {/* ── СЕКЦИЯ: Обзор ── */}
        <div style={{ background:'white', borderRadius:'20px', padding:'18px 20px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' }}>
          <SectionHeader title="Обзор" open={openKpi} onToggle={()=>setOpenKpi(v=>!v)} />
          {openKpi && (
            <div style={{ display:'grid', gridTemplateColumns: isMobile ? 'repeat(2,1fr)' : 'repeat(4,1fr)', gap:'12px', marginTop:'16px' }}>
              {[
                { label:'Сотрудников', value:employees.length||0, sub:onlineCount+' онлайн', subColor:'#16A34A', icon:'ti-users', accent:'#7F77DD', accBg:'#EDE9FE', badge:'+'+onlineCount, badgeColor:'#16A34A', badgeBg:'#DCFCE7' },
                { label:'Кликов / 7 дней', value:totalClicks>0?totalClicks.toLocaleString('ru'):0, sub:'WB + Ozon', subColor:'#9B97CC', icon:'ti-mouse', accent:'#2563EB', accBg:'#DBEAFE', badge:'+12%', badgeColor:'#16A34A', badgeBg:'#DCFCE7' },
                { label:'Задач всего', value:stats?.totalTasks??0, sub:overdueTasks.length>0?overdueTasks.length+' просрочено':'все в срок', subColor:overdueTasks.length>0?'#DC2626':'#16A34A', icon:'ti-checkbox', accent:'#16A34A', accBg:'#DCFCE7', badge:overdueTasks.length>0?'-'+overdueTasks.length:'✓', badgeColor:overdueTasks.length>0?'#DC2626':'#16A34A', badgeBg:overdueTasks.length>0?'#FEE2E2':'#DCFCE7' },
                { label:'Выполнено', value:stats?.completionRate!=null?stats.completionRate+'%':'0%', sub:(stats?.completedTasks??0)+' из '+(stats?.totalTasks??0), subColor:'#9B97CC', icon:'ti-chart-pie', accent:'#7C3AED', accBg:'#EDE9FE', badge:'+5%', badgeColor:'#7C3AED', badgeBg:'#EDE9FE' },
              ].map((k,i) => (
                <div key={i} style={{ ...cardStyle, position:'relative', overflow:'hidden', paddingTop:'14px' }}>
                  {/* % badge top right */}
                  <div style={{ position:'absolute', top:'12px', right:'12px', fontSize:'10px', fontWeight:700, color:k.badgeColor, background:k.badgeBg, padding:'2px 7px', borderRadius:'10px' }}>{k.badge}</div>
                  {/* Icon */}
                  <div style={{ width:'36px', height:'36px', borderRadius:'12px', background:k.accBg, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'12px' }}>
                    <i className={'ti '+k.icon} style={{ fontSize:'18px', color:k.accent }} aria-hidden="true" />
                  </div>
                  <p style={{ fontSize:'10px', color:'#9B97CC', margin:'0 0 4px', fontWeight:500, textTransform:'uppercase', letterSpacing:'0.5px' }}>{k.label}</p>
                  <p style={{ fontSize:'26px', fontWeight:800, color:'#1a1040', margin:'0 0 4px', letterSpacing:'-1px', lineHeight:1 }}>{k.value}</p>
                  <p style={{ fontSize:'11px', color:k.subColor, margin:0, fontWeight:500 }}>{k.sub}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── СЕКЦИЯ: Активность ── */}
        <div style={{ background:'white', borderRadius:'20px', padding:'18px 20px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' }}>
          <SectionHeader title="Активность" open={openActivity} onToggle={()=>setOpenActivity(v=>!v)} />
          {openActivity && (
            <div style={{ display:'grid', gridTemplateColumns:'200px 1fr 1fr', gap:'12px', marginTop:'16px' }}>
              {/* Purple featured card */}
              <div style={{ background:'linear-gradient(135deg,#7F77DD 0%,#5248C5 100%)', borderRadius:'16px', padding:'18px', display:'flex', flexDirection:'column', gap:'8px', boxShadow:'0 8px 24px rgba(127,119,221,0.3)' }}>
                <p style={{ fontSize:'10px', color:'rgba(255,255,255,0.7)', margin:0, fontWeight:500, textTransform:'uppercase', letterSpacing:'0.5px' }}>Топ раздел</p>
                {sections.length > 0 ? (
                  <>
                    <p style={{ fontSize:'13px', fontWeight:700, color:'white', margin:0 }}>
                      {sections[0].platform==='WILDBERRIES'?'WB':'OZ'} · {SECTION_LABELS[sections[0].section]??sections[0].section}
                    </p>
                    <p style={{ fontSize:'28px', fontWeight:800, color:'white', margin:0, letterSpacing:'-1px', lineHeight:1 }}>{sections[0].clicks.toLocaleString('ru')}</p>
                    <p style={{ fontSize:'10px', color:'rgba(255,255,255,0.6)', margin:0 }}>кликов за 7 дней</p>
                    {fmtSec(sections[0].timeSeconds) && (
                      <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.8)', margin:0 }}>⏱ {fmtSec(sections[0].timeSeconds)} активного времени</p>
                    )}
                  </>
                ) : (
                  <p style={{ fontSize:'13px', color:'rgba(255,255,255,0.7)', margin:0 }}>Откройте WB или Ozon</p>
                )}
              </div>

              {/* Sections bar chart */}
              <div style={cardStyle}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                  <p style={{ fontSize:'13px', fontWeight:700, color:'#1a1040', margin:0 }}>Топ разделы</p>
                  <button onClick={()=>router.push('/dashboard/analytics/sections')}
                    style={{ fontSize:'10px', color:'#7F77DD', background:'#EDE9FE', border:'none', borderRadius:'20px', padding:'3px 10px', cursor:'pointer', fontWeight:600 }}>
                    Все →
                  </button>
                </div>
                {sections.length===0 ? (
                  <p style={{ fontSize:'12px', color:'#9B97CC', textAlign:'center', padding:'16px 0' }}>Нет данных</p>
                ) : sections.map(s => {
                  const isWB = s.platform==='WILDBERRIES';
                  const color = isWB ? '#7F77DD' : '#2563EB';
                  const pct   = Math.round(s.clicks/maxClicks*100);
                  return (
                    <div key={s.key} style={{ marginBottom:'10px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                          <span style={{ fontSize:'9px', fontWeight:700, color, background:isWB?'#EDE9FE':'#DBEAFE', padding:'1px 5px', borderRadius:'4px' }}>{isWB?'WB':'OZ'}</span>
                          <span style={{ fontSize:'12px', color:'#374151' }}>{SECTION_LABELS[s.section]??s.section}</span>
                        </div>
                        <span style={{ fontSize:'12px', fontWeight:700, color }}>{s.clicks.toLocaleString('ru')}</span>
                      </div>
                      <div style={{ height:'6px', background:'#F3F4F6', borderRadius:'3px', overflow:'hidden' }}>
                        <div style={{ height:'6px', width:pct+'%', background:color, borderRadius:'3px', transition:'width 0.5s ease' }} />
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Team */}
              <div style={cardStyle}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
                  <p style={{ fontSize:'13px', fontWeight:700, color:'#1a1040', margin:0 }}>Команда</p>
                  <button onClick={()=>router.push('/dashboard/employees')}
                    style={{ fontSize:'10px', color:'#7F77DD', background:'#EDE9FE', border:'none', borderRadius:'20px', padding:'3px 10px', cursor:'pointer', fontWeight:600 }}>
                    Все →
                  </button>
                </div>
                {presence.slice(0,5).map((emp:any) => {
                  const isAlert = !emp.isOnline && emp.lastActivityAt && (Date.now()-emp.lastActivityAt)>2*3600000;
                  return (
                    <div key={emp.userId}
                      style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 10px', borderRadius:'12px', cursor:'pointer', marginBottom:'4px', transition:'background 0.15s', background:'#F8F7FF' }}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#EDE9FE'}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='#F8F7FF'}
                      onClick={()=>router.push('/dashboard/employees/'+emp.userId)}>
                      <div style={{ position:'relative', flexShrink:0 }}>
                        <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:avatarColor(emp.name), display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <span style={{ color:'white', fontSize:'12px', fontWeight:600 }}>{emp.name?.charAt(0)}</span>
                        </div>
                        <span style={{ position:'absolute', bottom:0, right:0, width:'9px', height:'9px', borderRadius:'50%', background:emp.isOnline?'#16A34A':isAlert?'#DC2626':'#D1D5DB', border:'2px solid white' }} />
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:'12px', fontWeight:600, color:'#1a1040', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.name}</p>
                        <p style={{ fontSize:'10px', color:emp.isOnline?'#16A34A':isAlert?'#DC2626':'#9B97CC', margin:0 }}>
                          {emp.isOnline?'● Онлайн':emp.lastActivityAt?timeAgo(emp.lastActivityAt):'Офлайн'}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* ── СЕКЦИЯ: Задачи ── */}
        <div style={{ background:'white', borderRadius:'20px', padding:'18px 20px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <SectionHeader title="Последние задачи" open={openTasks} onToggle={()=>setOpenTasks(v=>!v)} />
            <button onClick={()=>router.push('/dashboard/tasks')}
              style={{ fontSize:'11px', color:'#7F77DD', background:'#EDE9FE', border:'none', borderRadius:'20px', padding:'5px 14px', cursor:'pointer', fontWeight:600, marginLeft:'12px' }}>
              Все задачи →
            </button>
          </div>
          {openTasks && (
            <div style={{ marginTop:'16px', overflow:'hidden', borderRadius:'12px', border:'1px solid #F3F4F6' }}>
              {/* Table header */}
              <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 120px', padding:'8px 16px', background:'#F8F7FF', borderBottom:'1px solid #F3F4F6' }}>
                {['Задача','Исполнитель','Дедлайн','Приоритет','Статус'].map(h => (
                  <span key={h} style={{ fontSize:'10px', fontWeight:600, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px' }}>{h}</span>
                ))}
              </div>
              {tasks.length===0 ? (
                <div style={{ padding:'32px', textAlign:'center' }}>
                  <p style={{ fontSize:'13px', color:'#9B97CC', margin:0 }}>Нет задач</p>
                </div>
              ) : tasks.slice(0,6).map((t:any, i:number) => {
                const ss      = TASK_STATUS[t.status] ?? TASK_STATUS.NEW;
                const overdue = t.dueDate && new Date(t.dueDate)<new Date() && t.status!=='DONE';
                const PRIORITY_LABELS: Record<string,{l:string;c:string;bg:string}> = {
                  LOW:      { l:'Низкий',   c:'#6B7280', bg:'#F3F4F6' },
                  MEDIUM:   { l:'Средний',  c:'#2563EB', bg:'#DBEAFE' },
                  HIGH:     { l:'Высокий',  c:'#D97706', bg:'#FEF3C7' },
                  CRITICAL: { l:'Критич.',  c:'#DC2626', bg:'#FEE2E2' },
                };
                const pr = PRIORITY_LABELS[t.priority] ?? PRIORITY_LABELS.MEDIUM;
                return (
                  <div key={t.id}
                    style={{ display:'grid', gridTemplateColumns:'2fr 1fr 1fr 1fr 120px', padding:'10px 16px', borderBottom:i<tasks.length-1?'1px solid #F9F8FF':'none', cursor:'pointer', transition:'background 0.1s', alignItems:'center', background:overdue?'#FFF5F5':'white' }}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background=overdue?'#FEE2E2':'#F8F7FF'}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background=overdue?'#FFF5F5':'white'}
                    onClick={()=>router.push('/dashboard/tasks/'+t.id)}>
                    <span style={{ fontSize:'13px', fontWeight:500, color:'#1a1040', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</span>
                    <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                      {t.assignee ? (
                        <>
                          <div style={{ width:'20px', height:'20px', borderRadius:'50%', background:'#7F77DD', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            <span style={{ color:'white', fontSize:'8px', fontWeight:700 }}>{t.assignee.name?.charAt(0)}</span>
                          </div>
                          <span style={{ fontSize:'11px', color:'#6B7280', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.assignee.name?.split(' ')[0]}</span>
                        </>
                      ) : <span style={{ fontSize:'11px', color:'#D1D5DB' }}>—</span>}
                    </div>
                    <span style={{ fontSize:'11px', color:overdue?'#DC2626':'#6B7280' }}>
                      {t.dueDate ? new Date(t.dueDate).toLocaleDateString('ru',{day:'numeric',month:'short'}) : '—'}
                    </span>
                    <span style={{ fontSize:'10px', fontWeight:600, color:pr.c, background:pr.bg, padding:'3px 8px', borderRadius:'20px', display:'inline-block' }}>{pr.l}</span>
                    <span style={{ fontSize:'10px', fontWeight:600, color:ss.color, background:ss.bg, padding:'3px 8px', borderRadius:'20px', display:'inline-block' }}>{ss.label}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Projects Section */}
        {projects.length > 0 && (
          <div style={{ background:'white', borderRadius:'var(--radius)', padding:'20px', boxShadow:'var(--shadow-sm)' }}>
            <SectionHeader title="Проекты" open={openProjects} onToggle={()=>setOpenProjects(v=>!v)} />
            {openProjects && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))', gap:'10px', marginTop:'14px' }}>
                {projects.map((p:any) => (
                  <a key={p.id} href={'/dashboard/projects/'+p.id} style={{ textDecoration:'none' }}>
                    <div style={{ padding:'14px', borderRadius:'12px', border:'1px solid #EDE9FE', cursor:'pointer', transition:'box-shadow 0.15s' }}
                      onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.boxShadow='0 4px 12px rgba(127,119,221,0.15)'}
                      onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.boxShadow='none'}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                        <div style={{ width:'10px', height:'10px', borderRadius:'50%', background:p.color??'#7F77DD', flexShrink:0 }} />
                        <span style={{ fontSize:'13px', fontWeight:700, color:'#1a1040', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                      </div>
                      <div style={{ display:'flex', justifyContent:'space-between', fontSize:'11px', color:'#9B97CC' }}>
                        <span style={{ background:(p.status==='ACTIVE'?'#10B981':'#9B97CC')+'20', color:p.status==='ACTIVE'?'#10B981':'#9B97CC', borderRadius:'6px', padding:'2px 8px', fontWeight:600 }}>
                          {p.status==='ACTIVE'?'Активный':p.status==='COMPLETED'?'Завершён':'На паузе'}
                        </span>
                        {p._count?.tasks > 0 && <span>{p._count.tasks} задач</span>}
                      </div>
                    </div>
                  </a>
                ))}
                <a href="/dashboard/projects" style={{ textDecoration:'none' }}>
                  <div style={{ padding:'14px', borderRadius:'12px', border:'1px dashed #EDE9FE', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#9B97CC', fontSize:'13px', fontWeight:600 }}>
                    Все проекты →
                  </div>
                </a>
              </div>
            )}
          </div>
        )}

        {/* Products Section */}
        {products.length > 0 && (
          <div style={{ background:'white', borderRadius:'var(--radius)', padding:'20px', boxShadow:'var(--shadow-sm)' }}>
            <SectionHeader title="Карточки товаров" open={openProducts} onToggle={()=>setOpenProducts(v=>!v)} />
            {openProducts && (
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:'10px', marginTop:'14px' }}>
                {products.map((p:any) => (
                  <a key={p.id} href={'/dashboard/products/'+p.id} style={{ textDecoration:'none' }}>
                    <div style={{ borderRadius:'12px', overflow:'hidden', border:'1px solid #EDE9FE', cursor:'pointer', transition:'box-shadow 0.15s' }}
                      onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.boxShadow='0 4px 12px rgba(127,119,221,0.15)'}
                      onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.boxShadow='none'}>
                      <div style={{ aspectRatio:'1', background:'#F8F7FF', overflow:'hidden' }}>
                        {p.photoUrl
                          ? <img src={p.photoUrl} alt={p.name} style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                          : <div style={{ width:'100%', height:'100%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'24px' }}>📦</div>
                        }
                      </div>
                      <div style={{ padding:'8px' }}>
                        <p style={{ fontSize:'11px', fontWeight:600, color:'#1a1040', margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</p>
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                          <span style={{ fontSize:'10px', background:p.marketplace==='WB'?'#8B2FC920':'#005BFF20', color:p.marketplace==='WB'?'#8B2FC9':'#005BFF', borderRadius:'4px', padding:'1px 6px', fontWeight:700 }}>{p.marketplace}</span>
                          {p._count?.tasks > 0 && <span style={{ fontSize:'10px', color:'#9B97CC' }}>{p._count.tasks} задач</span>}
                        </div>
                      </div>
                    </div>
                  </a>
                ))}
                <a href="/dashboard/products" style={{ textDecoration:'none' }}>
                  <div style={{ borderRadius:'12px', border:'1px dashed #EDE9FE', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#9B97CC', fontSize:'12px', fontWeight:600, padding:'20px 10px', textAlign:'center' }}>
                    Все карточки →
                  </div>
                </a>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
