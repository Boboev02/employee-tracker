'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const SECTION_LABELS: Record<string,string> = {
  products:'Товары', brands:'Бренды', content:'Контент', abtest:'A/B тест',
  prices:'Цены и скидки', cashback:'Кэшбэк', promotions:'Акции', promotion:'Продвижение',
  feedbacks:'Отзывы', reviews:'Отзывы', questions:'Вопросы', claims:'Претензии', chat:'Чат',
  supplies:'Поставки', supply:'Поставки', stocks:'Остатки', remains:'Остатки',
  orders:'Заказы', orders_fbo:'Заказы FBO', orders_fbs:'Заказы FBS', returns:'Возвраты', logistics:'Логистика',
  analytics:'Аналитика', content_analytics:'Аналитика контента',
  search_analytics:'Поисковая аналитика', platform_analytics:'Аналитика платформы', analytics_search:'Поисковая аналитика',
  finance:'Финансы', income:'Доходы', calculator:'Калькулятор',
  advertising:'Реклама', highlights:'Акции', complaints:'Жалобы', warehouse:'Склад',
  dashboard:'Дашборд', rating:'Рейтинг', support:'Поддержка',
};

const ACTION_LABELS: Record<string,string> = {
  wb_review_reply:'Ответил на отзыв', ozon_review_reply:'Ответил на отзыв',
  wb_price_save:'Сохранил цены', wb_price_edit:'Изменил цену', ozon_price_save:'Сохранил цены',
  wb_stock_update:'Обновил остатки', ozon_stock_update:'Обновил остатки',
  wb_product_edit:'Редактировал товар', ozon_product_edit:'Редактировал товар',
  wb_supply_create:'Создал поставку', wb_ads_create:'Создал кампанию',
};

function fmtSec(s: number) {
  if (!s||s<=0) return null;
  if (s<60) return s+'с';
  if (s<3600) return Math.floor(s/60)+'м';
  return Math.floor(s/3600)+'ч '+Math.floor((s%3600)/60)+'м';
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month+1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  let d = new Date(year, month, 1).getDay();
  return d === 0 ? 6 : d - 1; // Пн=0
}

const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const DAY_NAMES = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const AVATAR_COLORS = ['#7F77DD','#2563EB','#16A34A','#D97706','#DC2626','#0891B2'];
const avatarColor = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0)??0) % AVATAR_COLORS.length];

export default function SectionAnalyticsPage() {
  const router = useRouter();
  const [token, setToken]         = useState('');
  const [events, setEvents]       = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedEmp, setSelectedEmp] = useState('');
  const [platform, setPlatform]   = useState<'ALL'|'WILDBERRIES'|'OZON'>('ALL');

  // Calendar state
  const today = new Date();
  const [calYear, setCalYear]   = useState(today.getFullYear());
  const [calMonth, setCalMonth] = useState(today.getMonth());
  const [selectedDate, setSelectedDate] = useState<string|null>(today.toISOString().slice(0,10));
  const [rangeStart, setRangeStart] = useState<string|null>(null);
  const [rangeEnd, setRangeEnd]     = useState<string|null>(null);
  const [mode, setMode]         = useState<'day'|'range'|'month'>('day');

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    fetch('https://employee-tracker.ru/api/v1/employees', { headers:{ Authorization:'Bearer '+t } })
      .then(r=>r.json()).then(d=>setEmployees(Array.isArray(d)?d:[]));
    // Load today
    loadByDate(t, today.toISOString().slice(0,10), today.toISOString().slice(0,10), '');
  }, []);

  const loadByDate = async (t: string, from: string, to: string, empId: string) => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ from, to });
      if (empId) params.set('userId', empId);
      const res = await fetch('https://employee-tracker.ru/api/v1/analytics/activity/summary?'+params, {
        headers:{ Authorization:'Bearer '+t },
      });
      const data = await res.json();
      setEvents(Array.isArray(data)?data:[]);
    } finally { setLoading(false); }
  };

  const handleDayClick = (dateStr: string) => {
    if (mode === 'day') {
      setSelectedDate(dateStr);
      setRangeStart(null); setRangeEnd(null);
      loadByDate(token, dateStr, dateStr, selectedEmp);
    } else if (mode === 'range') {
      if (!rangeStart || (rangeStart && rangeEnd)) {
        setRangeStart(dateStr); setRangeEnd(null); setSelectedDate(null);
      } else {
        const start = rangeStart < dateStr ? rangeStart : dateStr;
        const end   = rangeStart < dateStr ? dateStr : rangeStart;
        setRangeEnd(end); setRangeStart(start); setSelectedDate(null);
        loadByDate(token, start, end, selectedEmp);
      }
    }
  };

  const handleMonth = () => {
    const from = `${calYear}-${String(calMonth+1).padStart(2,'0')}-01`;
    const daysIn = getDaysInMonth(calYear, calMonth);
    const to = `${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(daysIn).padStart(2,'0')}`;
    setMode('month'); setSelectedDate(null); setRangeStart(from); setRangeEnd(to);
    loadByDate(token, from, to, selectedEmp);
  };

  const isInRange = (dateStr: string) => {
    if (mode==='day' && selectedDate===dateStr) return true;
    if (rangeStart && rangeEnd) return dateStr>=rangeStart && dateStr<=rangeEnd;
    if (rangeStart && !rangeEnd) return dateStr===rangeStart;
    return false;
  };

  const isRangeStart = (d: string) => d===rangeStart;
  const isRangeEnd   = (d: string) => d===rangeEnd;

  // Build stats
  const buildStats = () => {
    const stats: Record<string,any> = {};
    events.forEach((emp:any) => {
      if (!emp.sections) return;
      Object.entries(emp.sections as Record<string,any>).forEach(([key,val]:any) => {
        const [plat, section] = key.split(':');
        if (platform!=='ALL' && plat!==platform) return;
        if (section==='other'||section==='unknown') return;
        const id = plat+':'+section;
        if (!stats[id]) stats[id] = { section, label:SECTION_LABELS[section]??section, platform:plat, events:0, timeSeconds:0, actions:{} };
        stats[id].events += val.events??0;
        stats[id].timeSeconds += val.timeSeconds??0;
        if (val.actions) Object.entries(val.actions as Record<string,number>).forEach(([a,c])=>{ stats[id].actions[a]=(stats[id].actions[a]??0)+c; });
      });
    });
    return Object.values(stats).filter(s=>s.events>0||s.timeSeconds>0).sort((a,b)=>b.events-a.events);
  };

  const buildEmpStats = () => events.map((emp:any) => {
    let total=0, topSec='', topEv=0;
    if (emp.sections) Object.entries(emp.sections as Record<string,any>).forEach(([key,val]:any)=>{ const ev=(val as any).events??0; total+=ev; if(ev>topEv){topEv=ev;topSec=key.split(':')[1];} });
    return { ...emp, totalEvents:total, topSection:topSec };
  }).sort((a:any,b:any)=>b.totalEvents-a.totalEvents);

  const sectionStats = buildStats();
  const empStats = buildEmpStats();
  const maxEv = Math.max(...sectionStats.map(s=>s.events),1);
  const totalEv = sectionStats.reduce((s,r)=>s+r.events,0);
  const totalTime = sectionStats.reduce((s,r)=>s+r.timeSeconds,0);

  // Calendar render
  const daysInMonth = getDaysInMonth(calYear, calMonth);
  const firstDay    = getFirstDayOfMonth(calYear, calMonth);
  const calDays: (string|null)[] = [];
  for (let i=0;i<firstDay;i++) calDays.push(null);
  for (let d=1;d<=daysInMonth;d++) {
    calDays.push(`${calYear}-${String(calMonth+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`);
  }

  const dateLabel = mode==='day'&&selectedDate
    ? new Date(selectedDate+'T12:00:00').toLocaleDateString('ru',{day:'numeric',month:'long',year:'numeric'})
    : rangeStart&&rangeEnd
    ? `${new Date(rangeStart+'T12:00:00').toLocaleDateString('ru',{day:'numeric',month:'short'})} — ${new Date(rangeEnd+'T12:00:00').toLocaleDateString('ru',{day:'numeric',month:'short',year:'numeric'})}`
    : '';

  const card: React.CSSProperties = { background:'white', borderRadius:'20px', padding:'18px 20px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' };
  const sel: React.CSSProperties  = { background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'20px', padding:'6px 14px', fontSize:'12px', color:'#1a1040', outline:'none' };

  return (
    <div style={{ minHeight:'100vh', background:'#ECEAF8' }}>
      {/* Header */}
      <div style={{ background:'white', padding:'16px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10, boxShadow:'0 4px 16px rgba(127,119,221,0.06)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
          <button onClick={()=>router.push('/dashboard/analytics')}
            style={{ background:'#F8F7FF', border:'1px solid #EDE9FE', color:'#7F77DD', borderRadius:'20px', padding:'6px 14px', fontSize:'12px', fontWeight:700, cursor:'pointer' }}>
            ← Назад
          </button>
          <div>
            <h1 style={{ fontSize:'18px', fontWeight:800, color:'#1a1040', margin:0 }}>Активность по разделам</h1>
            {dateLabel && <p style={{ fontSize:'11px', color:'#9B97CC', margin:'2px 0 0' }}>{dateLabel} · {totalEv} кликов</p>}
          </div>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          <div style={{ display:'flex', gap:'3px', background:'#F8F7FF', borderRadius:'20px', padding:'3px' }}>
            {[{l:'День',v:'day'},{l:'Период',v:'range'},{l:'Месяц',v:'month'}].map(m=>(
              <button key={m.v} onClick={()=>{ setMode(m.v as any); if(m.v==='month') handleMonth(); }}
                style={{ padding:'5px 12px', borderRadius:'16px', fontSize:'11px', fontWeight:mode===m.v?700:500, border:'none', cursor:'pointer', background:mode===m.v?'linear-gradient(135deg,#7F77DD,#5248C5)':'transparent', color:mode===m.v?'white':'#9B97CC', transition:'all 0.2s', boxShadow:mode===m.v?'0 2px 8px rgba(127,119,221,0.3)':'none' }}>
                {m.l}
              </button>
            ))}
          </div>
          <div style={{ display:'flex', gap:'3px', background:'#F8F7FF', borderRadius:'20px', padding:'3px' }}>
            {[{l:'Все',v:'ALL'},{l:'WB',v:'WILDBERRIES'},{l:'OZ',v:'OZON'}].map(p=>(
              <button key={p.v} onClick={()=>setPlatform(p.v as any)}
                style={{ padding:'5px 12px', borderRadius:'16px', fontSize:'11px', fontWeight:platform===p.v?700:500, border:'none', cursor:'pointer', background:platform===p.v?'linear-gradient(135deg,#7F77DD,#5248C5)':'transparent', color:platform===p.v?'white':'#9B97CC', transition:'all 0.2s' }}>
                {p.l}
              </button>
            ))}
          </div>
          <select value={selectedEmp} onChange={e=>{ setSelectedEmp(e.target.value); if(selectedDate) loadByDate(token,selectedDate,selectedDate,e.target.value); else if(rangeStart&&rangeEnd) loadByDate(token,rangeStart,rangeEnd,e.target.value); }} style={sel}>
            <option value="">Все сотрудники</option>
            {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ padding:'20px 28px', display:'grid', gridTemplateColumns:'300px 1fr', gap:'16px', alignItems:'start' }}>
        {/* Calendar */}
        <div style={{ ...card, position:'sticky', top:'80px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
            <button onClick={()=>{ const d=new Date(calYear,calMonth-1,1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }}
              style={{ background:'#F8F7FF', border:'none', borderRadius:'8px', width:'28px', height:'28px', cursor:'pointer', fontSize:'14px', color:'#7F77DD', display:'flex', alignItems:'center', justifyContent:'center' }}>
              ‹
            </button>
            <div style={{ textAlign:'center' }}>
              <p style={{ fontSize:'14px', fontWeight:700, color:'#1a1040', margin:0 }}>{MONTHS_RU[calMonth]}</p>
              <p style={{ fontSize:'11px', color:'#9B97CC', margin:0 }}>{calYear}</p>
            </div>
            <button onClick={()=>{ const d=new Date(calYear,calMonth+1,1); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); }}
              style={{ background:'#F8F7FF', border:'none', borderRadius:'8px', width:'28px', height:'28px', cursor:'pointer', fontSize:'14px', color:'#7F77DD', display:'flex', alignItems:'center', justifyContent:'center' }}>
              ›
            </button>
          </div>

          {/* Day names */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', marginBottom:'6px' }}>
            {DAY_NAMES.map(d=><div key={d} style={{ textAlign:'center', fontSize:'10px', fontWeight:700, color:'#C4C0E8', padding:'4px 0' }}>{d}</div>)}
          </div>

          {/* Days grid */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'2px' }}>
            {calDays.map((dateStr,i)=>{
              if (!dateStr) return <div key={i}/>;
              const inRange = isInRange(dateStr);
              const isStart = isRangeStart(dateStr);
              const isEnd   = isRangeEnd(dateStr);
              const isToday = dateStr===today.toISOString().slice(0,10);
              const d = new Date(dateStr+'T12:00:00');
              const isWeekend = d.getDay()===0||d.getDay()===6;
              const isFuture  = dateStr>today.toISOString().slice(0,10);
              return (
                <button key={dateStr} onClick={()=>!isFuture&&handleDayClick(dateStr)} disabled={isFuture}
                  style={{ width:'100%', aspectRatio:'1', borderRadius:isStart||isEnd?'50%':inRange?'4px':'50%', border:'none', cursor:isFuture?'default':'pointer', fontSize:'12px', fontWeight:inRange?700:400, background:inRange?'linear-gradient(135deg,#7F77DD,#5248C5)':isToday?'#EDE9FE':'transparent', color:inRange?'white':isToday?'#7F77DD':isWeekend?'#C4C0E8':isFuture?'#E5E7EB':'#1a1040', transition:'all 0.15s', boxShadow:inRange&&(isStart||isEnd)?'0 2px 8px rgba(127,119,221,0.3)':'none' }}>
                  {parseInt(dateStr.slice(-2))}
                </button>
              );
            })}
          </div>

          {/* Quick selects */}
          <div style={{ display:'flex', flexDirection:'column', gap:'6px', marginTop:'16px', paddingTop:'16px', borderTop:'1px solid #F3F0FF' }}>
            {[
              { l:'Сегодня', fn:()=>{ const d=today.toISOString().slice(0,10); setMode('day'); setSelectedDate(d); setRangeStart(null); setRangeEnd(null); setCalYear(today.getFullYear()); setCalMonth(today.getMonth()); loadByDate(token,d,d,selectedEmp); } },
              { l:'Вчера', fn:()=>{ const d=new Date(today); d.setDate(d.getDate()-1); const s=d.toISOString().slice(0,10); setMode('day'); setSelectedDate(s); setRangeStart(null); setRangeEnd(null); setCalYear(d.getFullYear()); setCalMonth(d.getMonth()); loadByDate(token,s,s,selectedEmp); } },
              { l:'Эта неделя', fn:()=>{ const d=new Date(today); const day=d.getDay()||7; d.setDate(d.getDate()-day+1); const s=d.toISOString().slice(0,10); const e=today.toISOString().slice(0,10); setMode('range'); setRangeStart(s); setRangeEnd(e); setSelectedDate(null); loadByDate(token,s,e,selectedEmp); } },
              { l:'Этот месяц', fn:()=>handleMonth() },
            ].map(q=>(
              <button key={q.l} onClick={q.fn}
                style={{ padding:'7px 12px', borderRadius:'10px', border:'none', background:'#F8F7FF', color:'#7F77DD', fontSize:'12px', fontWeight:600, cursor:'pointer', textAlign:'left', transition:'all 0.15s' }}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#EDE9FE'}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='#F8F7FF'}>
                {q.l}
              </button>
            ))}
          </div>
        </div>

        {/* Right content */}
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          {loading ? (
            <div style={{ ...card, padding:'60px', textAlign:'center', color:'#9B97CC' }}>Загрузка...</div>
          ) : sectionStats.length===0 ? (
            <div style={{ ...card, padding:'60px', textAlign:'center' }}>
              <div style={{ fontSize:'40px', marginBottom:'12px' }}>📊</div>
              <p style={{ fontSize:'15px', fontWeight:700, color:'#1a1040', margin:'0 0 6px' }}>Нет данных</p>
              <p style={{ fontSize:'13px', color:'#9B97CC' }}>Нет активности за выбранный период</p>
            </div>
          ) : (
            <>
              {/* KPI */}
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'12px' }}>
                {[
                  { l:'Кликов', v:totalEv.toLocaleString('ru'), icon:'ti-mouse', accent:'#7F77DD', accBg:'#EDE9FE' },
                  { l:'Активное время', v:fmtSec(totalTime)??'—', icon:'ti-clock', accent:'#2563EB', accBg:'#DBEAFE' },
                  { l:'Разделов', v:sectionStats.length, icon:'ti-layout-grid', accent:'#16A34A', accBg:'#DCFCE7' },
                ].map((k,i)=>(
                  <div key={i} style={{ ...card, display:'flex', alignItems:'center', gap:'12px' }}>
                    <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:k.accBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                      <i className={'ti '+k.icon} style={{ fontSize:'20px', color:k.accent }} aria-hidden="true"/>
                    </div>
                    <div>
                      <p style={{ fontSize:'22px', fontWeight:800, color:'#1a1040', margin:0, letterSpacing:'-0.5px' }}>{k.v}</p>
                      <p style={{ fontSize:'11px', color:'#9B97CC', margin:0 }}>{k.l}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Sections list */}
              <div style={card}>
                <p style={{ fontSize:'14px', fontWeight:700, color:'#1a1040', margin:'0 0 16px' }}>По разделам</p>
                <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                  {sectionStats.map(s=>{
                    const isWB=s.platform==='WILDBERRIES';
                    const color=isWB?'#7F77DD':'#2563EB';
                    const pct=Math.round(s.events/maxEv*100);
                    const topActions=Object.entries(s.actions as Record<string,number>).filter(([k])=>!k.includes('ping')&&!k.includes('enter')&&!k.includes('leave')).sort((a,b)=>b[1]-a[1]).slice(0,3);
                    return (
                      <div key={s.platform+':'+s.section} style={{ padding:'12px 14px', background:'#F8F7FF', borderRadius:'12px' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                          <span style={{ fontSize:'9px', fontWeight:700, color, background:isWB?'#EDE9FE':'#DBEAFE', padding:'2px 7px', borderRadius:'6px', flexShrink:0 }}>{isWB?'WB':'OZ'}</span>
                          <span style={{ fontSize:'13px', fontWeight:600, color:'#1a1040', flex:1 }}>{s.label}</span>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px', flexShrink:0 }}>
                            <span style={{ fontSize:'14px', fontWeight:800, color, letterSpacing:'-0.5px' }}>{s.events.toLocaleString('ru')}</span>
                            {fmtSec(s.timeSeconds) && <span style={{ fontSize:'11px', color:'#9B97CC', background:'white', padding:'2px 8px', borderRadius:'8px' }}>⏱ {fmtSec(s.timeSeconds)}</span>}
                          </div>
                        </div>
                        <div style={{ height:'5px', background:'white', borderRadius:'3px', overflow:'hidden', marginBottom:topActions.length>0?'8px':'0' }}>
                          <div style={{ height:'5px', width:pct+'%', background:color, borderRadius:'3px', transition:'width 0.5s ease' }}/>
                        </div>
                        {topActions.length>0 && (
                          <div style={{ display:'flex', gap:'5px', flexWrap:'wrap' }}>
                            {topActions.map(([action,count])=>(
                              <span key={action} style={{ fontSize:'10px', color:'#6B7280', background:'white', padding:'2px 8px', borderRadius:'8px', border:'1px solid #F3F0FF' }}>
                                {ACTION_LABELS[action]??action.replace(/^(wb_|ozon_)/,'').replace(/_/g,' ')} {count}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* By employee */}
              {empStats.filter((e:any)=>e.totalEvents>0).length>0 && (
                <div style={{ ...card, padding:0, overflow:'hidden' }}>
                  <div style={{ padding:'14px 20px', borderBottom:'1px solid #F3F0FF' }}>
                    <p style={{ fontSize:'14px', fontWeight:700, color:'#1a1040', margin:0 }}>По сотрудникам</p>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column' }}>
                    {empStats.filter((e:any)=>e.totalEvents>0).map((emp:any,i:number)=>{
                      const topLabel = SECTION_LABELS[emp.topSection]??emp.topSection;
                      const empTime = emp.sections ? Object.values(emp.sections as Record<string,any>).reduce((s:number,v:any)=>s+(v.timeSeconds??0),0) as number : 0;
                      return (
                        <div key={emp.userId} style={{ display:'flex', alignItems:'center', gap:'14px', padding:'12px 20px', borderBottom:i<empStats.filter((e:any)=>e.totalEvents>0).length-1?'1px solid #F9F8FF':'none', transition:'background 0.1s' }}
                          onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#F8F7FF'}
                          onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                          <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:avatarColor(emp.name), display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                            <span style={{ color:'white', fontSize:'13px', fontWeight:700 }}>{emp.name?.charAt(0)}</span>
                          </div>
                          <div style={{ flex:1 }}>
                            <p style={{ fontSize:'13px', fontWeight:600, color:'#1a1040', margin:'0 0 3px' }}>{emp.name}</p>
                            {topLabel && <span style={{ fontSize:'10px', fontWeight:600, color:'#7F77DD', background:'#EDE9FE', padding:'2px 8px', borderRadius:'8px' }}>{topLabel}</span>}
                          </div>
                          <div style={{ textAlign:'right', flexShrink:0 }}>
                            <p style={{ fontSize:'16px', fontWeight:800, color:'#7F77DD', margin:0, letterSpacing:'-0.5px' }}>{emp.totalEvents.toLocaleString('ru')}</p>
                            {fmtSec(empTime as number) && <p style={{ fontSize:'11px', color:'#9B97CC', margin:0 }}>⏱ {fmtSec(empTime as number)}</p>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
