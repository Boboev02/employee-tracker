'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { WorkSessionWidget } from '@/components/WorkSessionWidget';

const SECTION_LABELS: Record<string,string> = {
  orders:'Заказы', feedbacks:'Отзывы', reviews:'Отзывы', questions:'Вопросы',
  products:'Товары', brands:'Бренды', content:'Контент', abtest:'A/B тест',
  prices:'Цены и скидки', cashback:'Кэшбэк', promotions:'Акции', promotion:'Продвижение',
  claims:'Претензии', chat:'Чат с покупателями',
  supplies:'Поставки', supply:'Поставки', stocks:'Остатки', remains:'Остатки',
  orders_fbo:'Заказы FBO', orders_fbs:'Заказы FBS', returns:'Возвраты',
  analytics:'Аналитика', content_analytics:'Аналитика контента',
  search_analytics:'Поисковая аналитика', platform_analytics:'Аналитика платформы',
  analytics_search:'Поисковая аналитика',
  finance:'Финансы', fintech:'Финансы', income:'Доходы', calculator:'Калькулятор',
  advertising:'Реклама', highlights:'Акции', complaints:'Жалобы', warehouse:'Склад',
  dashboard:'Дашборд', rating:'Рейтинг', support:'Поддержка', other:'Прочее',
};

const TASK_STATUS: Record<string,{color:string;bg:string;label:string}> = {
  NEW:         { color:'#FB8C00', bg:'#FFF3E0', label:'Новая' },
  IN_PROGRESS: { color:'#1565C0', bg:'#E3F2FD', label:'В работе' },
  REVIEW:      { color:'#6C5CE7', bg:'#EDE9FF', label:'Проверка' },
  DONE:        { color:'#2E7D32', bg:'#E8F5E9', label:'Готово' },
  BLOCKED:     { color:'#C62828', bg:'#FFEBEE', label:'Заблок.' },
};

const AVATAR_COLORS = ['#6C5CE7','#4A90E2','#43A047','#FB8C00','#E53935','#F9A825','#00ACC1'];
function avatarColor(name: string) { return AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length]; }

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

export default function DashboardPage() {
  const router = useRouter();
  const [token, setToken]         = useState('');
  const [stats, setStats]         = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [presence, setPresence]   = useState<any[]>([]);
  const [tasks, setTasks]         = useState<any[]>([]);
  const [sections, setSections]   = useState<any[]>([]);
  const [totalClicks, setTotalClicks] = useState(0);
  const [loading, setLoading]     = useState(true);
  const [now, setNow]             = useState(new Date());

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t); loadAll(t);
    const iv = setInterval(() => { loadAll(t); setNow(new Date()); }, 60000);
    return () => clearInterval(iv);
  }, []);

  const loadAll = async (t: string) => {
    try {
      const [s, emps, p, tk, sec] = await Promise.all([
        fetch('https://employee-tracker.ru/api/v1/analytics/stats', { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
        fetch('https://employee-tracker.ru/api/v1/employees',       { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
        fetch('https://employee-tracker.ru/api/v1/presence',        { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
        fetch('https://employee-tracker.ru/api/v1/tasks',           { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
        fetch('https://employee-tracker.ru/api/v1/analytics/activity/summary?days=7', { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
      ]);
      if (s && !s.error) setStats(s);
      if (Array.isArray(emps)) setEmployees(emps);
      if (Array.isArray(tk)) setTasks(tk);
      if (Array.isArray(p)) setPresence(p);
      else if (p && typeof p === 'object' && !p.error) {
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

  const card: React.CSSProperties = { background:'#fff', borderRadius:'12px', padding:'16px 18px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', border:'1px solid #eee' };

  return (
    <div style={{ minHeight:'100vh', background:'#EBE8F6' }}>
      {/* Header */}
      <div style={{ background:'#fff', borderBottom:'1px solid #eee', padding:'16px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10, boxShadow:'0 2px 8px rgba(108,92,231,0.06)' }}>
        <div>
          <h1 style={{ fontSize:'17px', fontWeight:700, color:'#1a1a2e', margin:0 }}>{greeting}, <span style={{ color:'#6C5CE7' }}>{userName}</span>!</h1>
          <p style={{ fontSize:'12px', color:'#aaa', margin:'2px 0 0' }}>{now.toLocaleDateString('ru',{weekday:'long',day:'numeric',month:'long'})}</p>
        </div>
        <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
          {onlineCount > 0 && <span style={{ fontSize:'12px', color:'#2E7D32', background:'#E8F5E9', padding:'5px 12px', borderRadius:'20px', fontWeight:500 }}>● {onlineCount} онлайн</span>}
          {overdueTasks.length > 0 && <span onClick={()=>router.push('/dashboard/tasks')} style={{ fontSize:'12px', color:'#C62828', background:'#FFEBEE', padding:'5px 12px', borderRadius:'20px', fontWeight:500, cursor:'pointer' }}>⚠ {overdueTasks.length} просрочено</span>}
        </div>
      </div>

      <div style={{ padding:'24px 28px', display:'flex', flexDirection:'column', gap:'18px' }}>
        {token && <WorkSessionWidget token={token} />}

        {/* KPI 4 карточки */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px' }}>
          {[
            { label:'Сотрудников', value:employees.length||0, sub:onlineCount+' онлайн', subColor:'#2E7D32', icon:'ti-users', accent:'#6C5CE7', accBg:'#EDE9FF', featured:true },
            { label:'Кликов / 7 дней', value:totalClicks>0?totalClicks.toLocaleString('ru'):0, sub:'WB + Ozon', subColor:'#888', icon:'ti-mouse', accent:'#4A90E2', accBg:'#E3F2FD', featured:false },
            { label:'Задач всего', value:stats?.totalTasks??0, sub:overdueTasks.length>0?overdueTasks.length+' просрочено':'все в срок', subColor:overdueTasks.length>0?'#C62828':'#2E7D32', icon:'ti-checkbox', accent:'#43A047', accBg:'#E8F5E9', featured:false },
            { label:'Выполнено', value:stats?.completionRate!=null?stats.completionRate+'%':'0%', sub:(stats?.completedTasks??0)+' из '+(stats?.totalTasks??0), subColor:'#888', icon:'ti-chart-pie', accent:'#FB8C00', accBg:'#FFF3E0', featured:false },
          ].map((k,i) => (
            <div key={i} style={{ ...card, background: k.featured ? '#6C5CE7' : '#fff', position:'relative', overflow:'hidden', transition:'transform 0.2s, box-shadow 0.2s' }}
              onMouseEnter={e => { (e.currentTarget as HTMLElement).style.transform='translateY(-2px)'; (e.currentTarget as HTMLElement).style.boxShadow='0 6px 20px rgba(108,92,231,0.15)'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.transform='none'; (e.currentTarget as HTMLElement).style.boxShadow='0 2px 8px rgba(0,0,0,0.06)'; }}>
              <div style={{ position:'absolute', top:'-10px', right:'-10px', width:'60px', height:'60px', borderRadius:'50%', background: k.featured?'rgba(255,255,255,0.1)':k.accBg, pointerEvents:'none' }} />
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px' }}>
                <p style={{ fontSize:'10px', fontWeight:600, color:k.featured?'rgba(255,255,255,0.7)':'#aaa', textTransform:'uppercase', letterSpacing:'0.7px', margin:0 }}>{k.label}</p>
                <div style={{ width:'30px', height:'30px', borderRadius:'8px', background:k.featured?'rgba(255,255,255,0.15)':k.accBg, display:'flex', alignItems:'center', justifyContent:'center' }}>
                  <i className={'ti '+k.icon} style={{ fontSize:'15px', color:k.featured?'white':k.accent }} aria-hidden="true" />
                </div>
              </div>
              <p style={{ fontSize:'26px', fontWeight:700, color:k.featured?'white':'#1a1a2e', margin:'0 0 6px', letterSpacing:'-1px', lineHeight:1 }}>{k.value}</p>
              <p style={{ fontSize:'11px', color:k.featured?'rgba(255,255,255,0.7)':k.subColor, margin:0, fontWeight:500 }}>{k.sub}</p>
            </div>
          ))}
        </div>

        {/* 3 колонки */}
        <div style={{ display:'grid', gridTemplateColumns:'1.4fr 1fr 1fr', gap:'14px' }}>

          {/* Топ разделы */}
          <div style={card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px' }}>
              <div>
                <p style={{ fontSize:'14px', fontWeight:600, color:'#1a1a2e', margin:0 }}>Активность по разделам</p>
                <p style={{ fontSize:'11px', color:'#aaa', margin:'2px 0 0' }}>топ WB + Ozon за 7 дней</p>
              </div>
              <button onClick={()=>router.push('/dashboard/analytics/sections')} style={{ fontSize:'11px', color:'#6C5CE7', background:'#EDE9FF', border:'none', padding:'4px 10px', borderRadius:'8px', cursor:'pointer', fontWeight:500 }}>Все →</button>
            </div>
            {sections.length===0 ? (
              <div style={{ textAlign:'center', padding:'24px 0' }}>
                <div style={{ fontSize:'32px', marginBottom:'8px' }}>📊</div>
                <p style={{ fontSize:'13px', color:'#aaa', margin:0 }}>Откройте WB или Ozon</p>
              </div>
            ) : sections.map(s => {
              const isWB = s.platform==='WILDBERRIES';
              const color = isWB ? '#6C5CE7' : '#4A90E2';
              const pct = Math.round(s.clicks/maxClicks*100);
              const time = fmtSec(s.timeSeconds);
              return (
                <div key={s.key} style={{ marginBottom:'10px' }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'5px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                      <span style={{ fontSize:'9px', fontWeight:700, color, background:isWB?'#EDE9FF':'#E3F2FD', padding:'1px 5px', borderRadius:'4px' }}>{isWB?'WB':'OZ'}</span>
                      <span style={{ fontSize:'13px', color:'#333' }}>{SECTION_LABELS[s.section]??s.section}</span>
                    </div>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      {time && <span style={{ fontSize:'10px', color:'#aaa' }}>⏱ {time}</span>}
                      <span style={{ fontSize:'13px', fontWeight:600, color }}>{s.clicks}</span>
                    </div>
                  </div>
                  <div style={{ height:'4px', background:'#f0f0f0', borderRadius:'3px', overflow:'hidden' }}>
                    <div style={{ height:'4px', width:pct+'%', background:color, borderRadius:'3px' }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Команда */}
          <div style={card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px' }}>
              <div>
                <p style={{ fontSize:'14px', fontWeight:600, color:'#1a1a2e', margin:0 }}>Команда</p>
                <p style={{ fontSize:'11px', color:'#aaa', margin:'2px 0 0' }}>статус сотрудников</p>
              </div>
              <button onClick={()=>router.push('/dashboard/employees')} style={{ fontSize:'11px', color:'#6C5CE7', background:'#EDE9FF', border:'none', padding:'4px 10px', borderRadius:'8px', cursor:'pointer', fontWeight:500 }}>Все →</button>
            </div>
            {presence.slice(0,5).map((emp:any) => {
              const isAlert = !emp.isOnline && emp.lastActivityAt && (Date.now()-emp.lastActivityAt)>2*3600000;
              return (
                <div key={emp.userId}
                  style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 10px', borderRadius:'10px', cursor:'pointer', marginBottom:'4px', background:'#F5F3FC', border:'1px solid transparent', transition:'all 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = '#E0DDF0'; (e.currentTarget as HTMLElement).style.background = '#EDE9FF'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'transparent'; (e.currentTarget as HTMLElement).style.background = '#F5F3FC'; }}
                  onClick={()=>router.push('/dashboard/employees/'+emp.userId)}>
                  <div style={{ position:'relative', flexShrink:0 }}>
                    <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:avatarColor(emp.name), display:'flex', alignItems:'center', justifyContent:'center' }}>
                      <span style={{ color:'white', fontSize:'12px', fontWeight:600 }}>{emp.name?.charAt(0)}</span>
                    </div>
                    <span style={{ position:'absolute', bottom:0, right:0, width:'9px', height:'9px', borderRadius:'50%', background:emp.isOnline?'#43A047':isAlert?'#E53935':'#ccc', border:'2px solid #F5F3FC' }} />
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:'13px', fontWeight:500, color:'#1a1a2e', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{emp.name}</p>
                    <p style={{ fontSize:'11px', color:emp.isOnline?'#43A047':isAlert?'#E53935':'#aaa', margin:0 }}>{emp.isOnline?'● Онлайн':emp.lastActivityAt?timeAgo(emp.lastActivityAt):'Офлайн'}</p>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Задачи */}
          <div style={card}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'16px' }}>
              <div>
                <p style={{ fontSize:'14px', fontWeight:600, color:'#1a1a2e', margin:0 }}>Задачи</p>
                <p style={{ fontSize:'11px', color:'#aaa', margin:'2px 0 0' }}>последние обновления</p>
              </div>
              <button onClick={()=>router.push('/dashboard/tasks')} style={{ fontSize:'11px', color:'#6C5CE7', background:'#EDE9FF', border:'none', padding:'4px 10px', borderRadius:'8px', cursor:'pointer', fontWeight:500 }}>Все →</button>
            </div>
            {tasks.slice(0,5).map((t:any) => {
              const ss = TASK_STATUS[t.status]??TASK_STATUS.NEW;
              const overdue = t.dueDate && new Date(t.dueDate)<new Date() && t.status!=='DONE';
              return (
                <div key={t.id}
                  style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 10px', background:overdue?'#FFEBEE':'#F5F3FC', borderRadius:'10px', marginBottom:'4px', cursor:'pointer', border:overdue?'1px solid rgba(229,57,53,0.2)':'1px solid transparent', transition:'all 0.15s' }}
                  onMouseEnter={e => { if (!overdue) (e.currentTarget as HTMLElement).style.background = '#EDE9FF'; }}
                  onMouseLeave={e => { if (!overdue) (e.currentTarget as HTMLElement).style.background = '#F5F3FC'; }}
                  onClick={()=>router.push('/dashboard/tasks/'+t.id)}>
                  <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:ss.color, flexShrink:0 }} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <p style={{ fontSize:'13px', fontWeight:500, color:'#1a1a2e', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</p>
                    <p style={{ fontSize:'11px', color:overdue?'#C62828':ss.color, margin:0 }}>{overdue?'⚠ Просрочено':t.dueDate?'До '+new Date(t.dueDate).toLocaleDateString('ru',{day:'numeric',month:'short'}):ss.label}</p>
                  </div>
                  <span style={{ fontSize:'10px', fontWeight:600, color:ss.color, background:ss.bg, padding:'2px 7px', borderRadius:'6px', flexShrink:0 }}>{ss.label}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
