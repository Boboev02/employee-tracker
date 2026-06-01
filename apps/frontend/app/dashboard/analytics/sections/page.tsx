'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

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
  finance:'Финансы', income:'Доходы', calculator:'Калькулятор',
  advertising:'Реклама', highlights:'Акции', complaints:'Жалобы', warehouse:'Склад',
  dashboard:'Дашборд', rating:'Рейтинг', support:'Поддержка', other:'Прочее',
};

function fmtSec(s: number) {
  if (!s || s <= 0) return '—';
  if (s < 60) return s + 'с';
  if (s < 3600) return Math.floor(s / 60) + 'м ' + (s % 60) + 'с';
  return Math.floor(s / 3600) + 'ч ' + Math.floor((s % 3600) / 60) + 'м';
}

export default function AnalyticsSectionsPage() {
  const router = useRouter();
  const [data, setData]       = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [days, setDays]       = useState(1);
  const [platform, setPlatform] = useState('ALL');
  const [selectedUser, setSelectedUser] = useState('ALL');
  const [selectedSection, setSelectedSection] = useState('ALL');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    loadData(t);
  }, [days]);

  const loadData = async (t: string) => {
    setLoading(true);
    try {
      const [activity, emps] = await Promise.all([
        fetch(`https://employee-tracker.ru/api/v1/analytics/activity/summary?days=${days}`, { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
        fetch('https://employee-tracker.ru/api/v1/employees', { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
      ]);
      if (Array.isArray(activity)) setData(activity);
      if (Array.isArray(emps)) setEmployees(emps);
    } catch(e) {} finally { setLoading(false); }
  };

  // Flatten all sections
  const allSections: any[] = [];
  data.forEach(emp => {
    if (!emp.sections) return;
    Object.entries(emp.sections as Record<string,any>).forEach(([key,val]:any) => {
      const [plat, section] = key.split(':');
      if (section === 'other' || section === 'unknown') return;
      allSections.push({ userId:emp.userId, userName:emp.name, platform:plat, section, key, clicks:(val.clicks??0)+(val.events??0), timeSeconds:val.timeSeconds??0, actions:val.actions??{} });
    });
  });

  const filtered = allSections.filter(s => {
    if (platform !== 'ALL' && s.platform !== platform) return false;
    if (selectedUser !== 'ALL' && s.userId !== selectedUser) return false;
    if (selectedSection !== 'ALL' && s.section !== selectedSection) return false;
    return s.clicks > 0 || s.timeSeconds > 0;
  });

  // Aggregate by section
  const aggregated: Record<string,any> = {};
  filtered.forEach(s => {
    const key = s.platform + ':' + s.section;
    if (!aggregated[key]) aggregated[key] = { platform:s.platform, section:s.section, clicks:0, timeSeconds:0, actions:{} };
    aggregated[key].clicks += s.clicks;
    aggregated[key].timeSeconds += s.timeSeconds;
    Object.entries(s.actions as Record<string,number>).forEach(([k,v]) => {
      aggregated[key].actions[k] = (aggregated[key].actions[k] ?? 0) + v;
    });
  });

  const sorted = Object.values(aggregated).sort((a,b)=>b.clicks-a.clicks);
  const maxClicks = Math.max(...sorted.map(s=>s.clicks), 1);
  const totalClicks = sorted.reduce((s,r)=>s+r.clicks, 0);
  const totalTime   = sorted.reduce((s,r)=>s+r.timeSeconds, 0);

  const allSectionNames = [...new Set(allSections.map(s=>s.section))];
  const card: React.CSSProperties = { background:'#fff', borderRadius:'12px', padding:'16px 18px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', border:'1px solid #eee' };
  const selStyle: React.CSSProperties = { background:'#F5F3FC', border:'1.5px solid #E0DDF0', borderRadius:'9px', padding:'7px 12px', fontSize:'13px', color:'#1a1a2e', outline:'none', cursor:'pointer' };

  return (
    <div style={{ minHeight:'100vh', background:'#EBE8F6' }}>
      {/* Header */}
      <div style={{ background:'#fff', borderBottom:'1px solid #eee', padding:'16px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10, boxShadow:'0 2px 8px rgba(108,92,231,0.06)' }}>
        <div>
          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
            <button onClick={()=>router.push('/dashboard/analytics')} style={{ background:'none', border:'none', cursor:'pointer', color:'#aaa', fontSize:'13px', display:'flex', alignItems:'center', gap:'4px' }}>
              ← Назад
            </button>
            <h1 style={{ fontSize:'18px', fontWeight:700, color:'#1a1a2e', margin:0 }}>Активность по разделам</h1>
          </div>
          <p style={{ fontSize:'12px', color:'#aaa', margin:'2px 0 0' }}>{totalClicks.toLocaleString('ru')} кликов · {fmtSec(totalTime)} активного времени</p>
        </div>
        {/* Filters */}
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          {[{v:1,l:'Сегодня'},{v:7,l:'7 дней'},{v:14,l:'14 дней'},{v:30,l:'30 дней'}].map(d => (
            <button key={d.v} onClick={()=>setDays(d.v)}
              style={{ padding:'6px 14px', borderRadius:'8px', border:'none', fontSize:'12px', fontWeight:500, cursor:'pointer', background:days===d.v?'#6C5CE7':'#F5F3FC', color:days===d.v?'white':'#666', transition:'all 0.15s' }}>
              {d.l}
            </button>
          ))}
          <select value={platform} onChange={e=>setPlatform(e.target.value)} style={selStyle}>
            <option value="ALL">Все платформы</option>
            <option value="WILDBERRIES">Wildberries</option>
            <option value="OZON">Ozon</option>
          </select>
          <select value={selectedUser} onChange={e=>setSelectedUser(e.target.value)} style={selStyle}>
            <option value="ALL">Все сотрудники</option>
            {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ padding:'24px 28px', display:'flex', flexDirection:'column', gap:'16px' }}>
        {/* Summary KPI */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'14px' }}>
          {[
            { label:'Всего кликов', value:totalClicks.toLocaleString('ru'), icon:'ti-mouse', color:'#6C5CE7', bg:'#EDE9FF' },
            { label:'Активное время', value:fmtSec(totalTime), icon:'ti-clock', color:'#4A90E2', bg:'#E3F2FD' },
            { label:'Уникальных разделов', value:sorted.length, icon:'ti-layout-grid', color:'#43A047', bg:'#E8F5E9' },
            { label:'Сотрудников', value:data.length, icon:'ti-users', color:'#FB8C00', bg:'#FFF3E0' },
          ].map((k,i) => (
            <div key={i} style={{ ...card, display:'flex', alignItems:'center', gap:'12px' }}>
              <div style={{ width:'40px', height:'40px', borderRadius:'10px', background:k.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className={'ti '+k.icon} style={{ fontSize:'18px', color:k.color }} aria-hidden="true" />
              </div>
              <div>
                <p style={{ fontSize:'20px', fontWeight:700, color:'#1a1a2e', margin:0, lineHeight:1 }}>{k.value}</p>
                <p style={{ fontSize:'11px', color:'#aaa', margin:'4px 0 0' }}>{k.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Top section highlight */}
        {sorted.length > 0 && (
          <div style={{ background:'#6C5CE7', borderRadius:'14px', padding:'18px 22px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <div>
              <p style={{ fontSize:'11px', color:'rgba(255,255,255,0.7)', margin:'0 0 4px', fontWeight:600, letterSpacing:'0.5px' }}>ТОП РАЗДЕЛ</p>
              <p style={{ fontSize:'20px', fontWeight:700, color:'white', margin:0 }}>
                {sorted[0].platform==='WILDBERRIES'?'WB':'OZ'} · {SECTION_LABELS[sorted[0].section]??sorted[0].section}
              </p>
            </div>
            <div style={{ textAlign:'right' }}>
              <p style={{ fontSize:'28px', fontWeight:700, color:'white', margin:0 }}>{sorted[0].clicks.toLocaleString('ru')}</p>
              <p style={{ fontSize:'12px', color:'rgba(255,255,255,0.7)', margin:0 }}>кликов · {fmtSec(sorted[0].timeSeconds)}</p>
            </div>
          </div>
        )}

        {/* Sections table */}
        <div style={card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'14px' }}>
            <h2 style={{ fontSize:'14px', fontWeight:700, color:'#1a1a2e', margin:0 }}>Активность по разделам</h2>
            <span style={{ fontSize:'12px', color:'#aaa' }}>{sorted.length} разделов</span>
          </div>
          {loading ? (
            <div style={{ padding:'40px', textAlign:'center', color:'#aaa' }}>Загрузка...</div>
          ) : sorted.length === 0 ? (
            <div style={{ padding:'40px', textAlign:'center' }}>
              <div style={{ fontSize:'40px', marginBottom:'12px' }}>📊</div>
              <p style={{ color:'#aaa', fontSize:'13px' }}>Нет данных за выбранный период</p>
            </div>
          ) : sorted.map((s,i) => {
            const isWB = s.platform==='WILDBERRIES';
            const color = isWB ? '#6C5CE7' : '#4A90E2';
            const pct = Math.round(s.clicks/maxClicks*100);
            const topActions = Object.entries(s.actions as Record<string,number>).sort((a,b)=>b[1]-a[1]).slice(0,3);
            return (
              <div key={i} style={{ padding:'12px 0', borderBottom:'1px solid #f5f5f5' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'6px' }}>
                  <span style={{ fontSize:'12px', fontWeight:700, color:'#aaa', width:'20px' }}>#{i+1}</span>
                  <span style={{ fontSize:'10px', fontWeight:700, color, background:isWB?'#EDE9FF':'#E3F2FD', padding:'2px 7px', borderRadius:'6px' }}>{isWB?'WB':'OZ'}</span>
                  <span style={{ fontSize:'14px', fontWeight:500, color:'#1a1a2e', flex:1 }}>{SECTION_LABELS[s.section]??s.section}</span>
                  <div style={{ textAlign:'right' }}>
                    <span style={{ fontSize:'16px', fontWeight:700, color }}>{s.clicks.toLocaleString('ru')}</span>
                    <span style={{ fontSize:'11px', color:'#aaa', marginLeft:'8px' }}>{fmtSec(s.timeSeconds)}</span>
                  </div>
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                  <span style={{ width:'20px' }}></span>
                  <div style={{ flex:1, height:'5px', background:'#F5F3FC', borderRadius:'3px', overflow:'hidden' }}>
                    <div style={{ height:'5px', width:pct+'%', background:color, borderRadius:'3px', transition:'width 0.5s' }} />
                  </div>
                  {topActions.length > 0 && (
                    <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                      {topActions.map(([action,count]:any) => (
                        <span key={action} style={{ fontSize:'10px', color:'#888', background:'#f5f5f5', padding:'2px 7px', borderRadius:'6px' }}>
                          {action.replace(/^(wb_|ozon_)/,'').replace(/_/g,' ')} {count}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* By employee */}
        {data.length > 0 && (
          <div style={card}>
            <h2 style={{ fontSize:'14px', fontWeight:700, color:'#1a1a2e', margin:'0 0 14px' }}>По сотрудникам</h2>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(280px,1fr))', gap:'10px' }}>
              {data.map((emp:any) => {
                const empSecs = Object.entries(emp.sections??{} as Record<string,any>)
                  .filter(([k,v]:any) => !k.endsWith(':other') && (v.clicks||v.events||v.timeSeconds))
                  .sort((a:any,b:any)=>((b[1].clicks??0)+(b[1].events??0))-((a[1].clicks??0)+(a[1].events??0)))
                  .slice(0,3);
                const totalEmpClicks = Object.values(emp.sections??{} as Record<string,any>).reduce((s:number,v:any)=>s+(v.clicks??0)+(v.events??0),0);
                return (
                  <div key={emp.userId} style={{ background:'#F5F3FC', borderRadius:'10px', padding:'12px 14px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
                      <div style={{ width:'30px', height:'30px', borderRadius:'50%', background:'#6C5CE7', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <span style={{ color:'white', fontSize:'11px', fontWeight:600 }}>{emp.name?.charAt(0)}</span>
                      </div>
                      <div style={{ flex:1 }}>
                        <p style={{ fontSize:'13px', fontWeight:600, color:'#1a1a2e', margin:0 }}>{emp.name}</p>
                        <p style={{ fontSize:'11px', color:'#aaa', margin:0 }}>{totalEmpClicks} кликов</p>
                      </div>
                    </div>
                    {empSecs.map(([key,val]:any) => {
                      const [plat, sec] = key.split(':');
                      const c = (val.clicks??0)+(val.events??0);
                      const isWB = plat==='WILDBERRIES';
                      const color = isWB?'#6C5CE7':'#4A90E2';
                      return (
                        <div key={key} style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'4px' }}>
                          <span style={{ fontSize:'9px', fontWeight:700, color, background:isWB?'#EDE9FF':'#E3F2FD', padding:'1px 5px', borderRadius:'4px', flexShrink:0 }}>{isWB?'WB':'OZ'}</span>
                          <span style={{ fontSize:'12px', color:'#555', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{SECTION_LABELS[sec]??sec}</span>
                          <span style={{ fontSize:'12px', fontWeight:600, color }}>{c}</span>
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
