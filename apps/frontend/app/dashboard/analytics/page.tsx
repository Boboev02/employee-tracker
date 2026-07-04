'use client';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { AnimatedNumber } from '@/components/AnimatedNumber';

const PLATFORM_COLORS: Record<string,string> = { WILDBERRIES:'#7F77DD', OZON:'#2563EB', OTHER:'#9B97CC' };
const STATUS_COLORS: Record<string,string>   = { NEW:'#9B97CC', IN_PROGRESS:'#2563EB', REVIEW:'#D97706', DONE:'#16A34A', OVERDUE:'#DC2626', BLOCKED:'#7F77DD' };
const STATUS_LABELS: Record<string,string>   = { NEW:'Новые', IN_PROGRESS:'В работе', REVIEW:'Проверка', DONE:'Готово', OVERDUE:'Просрочено', BLOCKED:'Заблок.' };
const PRIORITY_COLORS: Record<string,string> = { CRITICAL:'#DC2626', HIGH:'#D97706', MEDIUM:'#2563EB', LOW:'#9B97CC' };
const PRIORITY_LABELS: Record<string,string> = { CRITICAL:'Критич.', HIGH:'Высокий', MEDIUM:'Средний', LOW:'Низкий' };
const PERIODS = [{ l:'Сегодня', v:'1' },{ l:'7 дней', v:'7' },{ l:'14 дней', v:'14' },{ l:'30 дней', v:'30' }];

const AVATAR_COLORS = ['#7F77DD','#2563EB','#16A34A','#D97706','#DC2626','#0891B2'];
const avatarColor = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0)??0) % AVATAR_COLORS.length];

const tooltipStyle = { background:'white', border:'1px solid #EDE9FE', borderRadius:'10px', fontSize:'12px', boxShadow:'0 4px 16px rgba(127,119,221,0.12)', color:'#1a1040' };

function KpiCard({ title, value, sub, subColor, icon, accent, accBg, badge, badgeC, badgeBg, idx=0 }: any) {
  return (
    <div className="float-in hover-lift" style={{ background:'white', borderRadius:'20px', padding:'16px 18px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)', position:'relative', overflow:'hidden', animationDelay:(idx*0.07)+'s' }}>
      <div style={{ position:'absolute', top:'12px', right:'12px', fontSize:'10px', fontWeight:700, color:badgeC, background:badgeBg, padding:'2px 8px', borderRadius:'10px' }}>{badge}</div>
      <div className="icon-pop" style={{ width:'36px', height:'36px', borderRadius:'12px', background:accBg, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'10px' }}>
        <i className={'ti '+icon} style={{ fontSize:'18px', color:accent }} aria-hidden="true"/>
      </div>
      <p style={{ fontSize:'10px', color:'#9B97CC', margin:'0 0 3px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>{title}</p>
      <p style={{ fontSize:'24px', fontWeight:800, color:'#1a1040', margin:'0 0 3px', letterSpacing:'-1px', lineHeight:1 }}>
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : (value ?? '—')}
      </p>
      {sub && <p style={{ fontSize:'11px', color:subColor??'#9B97CC', margin:0, fontWeight:500 }}>{sub}</p>}
    </div>
  );
}

export default function AnalyticsPage() {
  const router = useRouter();
  const isMobile = useIsMobile();
  const [token, setToken]           = useState('');
  const [stats, setStats]           = useState<any>(null);
  const [byStatus, setByStatus]     = useState<any[]>([]);
  const [byPriority, setByPriority] = useState<any[]>([]);
  const [byDay, setByDay]           = useState<any[]>([]);
  const [employees, setEmployees]   = useState<any[]>([]);
  const [allEmployees, setAllEmployees] = useState<any[]>([]);
  const [activity, setActivity]     = useState<any[]>([]);
  const [platforms, setPlatforms]   = useState<any[]>([]);
  const [hourly, setHourly]         = useState<any[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [feed, setFeed]             = useState<any[]>([]);
  const [feedLoading, setFeedLoading] = useState(false);
  const [loading, setLoading]       = useState(true);
  const [activeTab, setActiveTab]   = useState<'tasks'|'activity'|'feed'>('tasks');
  const [period, setPeriod]         = useState('7');
  const [selectedEmployee, setSelectedEmployee] = useState('');
  const [selectedPlatform, setSelectedPlatform] = useState('');
  const [lastUpdated, setLastUpdated] = useState<Date|null>(null);
  const [compare, setCompare]       = useState(false);
  const [prevActivity, setPrevActivity] = useState<any[]>([]);
  const [prevByDay, setPrevByDay]   = useState<any[]>([]);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    fetch('https://employee-tracker.ru/api/v1/employees', { headers:{ Authorization:'Bearer '+t } })
      .then(r=>r.json()).then(d=>setAllEmployees(Array.isArray(d)?d:[]));
    loadAll(t,'7','','');
    const interval = setInterval(() => { const ct=localStorage.getItem('access_token'); if(ct) loadAll(ct,period,selectedEmployee,selectedPlatform); }, 60000);
    return () => clearInterval(interval);
  }, []);

  const loadAll = useCallback(async (t: string, days: string, empId: string, platform: string) => {
    setLoading(true);
    const h = { Authorization:'Bearer '+t };
    const base = 'https://employee-tracker.ru/api/v1/analytics';
    const params = new URLSearchParams({ days });
    if (empId) params.set('userId', empId);
    if (platform) params.set('platform', platform);
    try {
      const [s, bs, bp, bd, emp, act, plat, hour, total] = await Promise.all([
        fetch(base+'/stats',                  { headers:h }).then(r=>r.json()),
        fetch(base+'/tasks/by-status',        { headers:h }).then(r=>r.json()),
        fetch(base+'/tasks/by-priority',      { headers:h }).then(r=>r.json()),
        fetch(base+'/tasks/by-day?days='+days, { headers:h }).then(r=>r.json()),
        fetch(base+'/employees',              { headers:h }).then(r=>r.json()),
        fetch(base+'/activity/summary?'+params, { headers:h }).then(r=>r.json()),
        fetch(base+'/activity/platforms?'+params, { headers:h }).then(r=>r.json()),
        fetch(base+'/activity/hourly?days='+days+(empId?'&userId='+empId:''), { headers:h }).then(r=>r.json()),
        fetch(base+'/activity/total',         { headers:h }).then(r=>r.json()),
      ]);
      setStats(s);
      setByStatus(Array.isArray(bs)?bs.filter((x:any)=>x.count>0):[]);
      setByPriority(Array.isArray(bp)?bp.filter((x:any)=>x.count>0):[]);
      setByDay(Array.isArray(bd)?bd:[]);
      setEmployees(Array.isArray(emp)?emp:[]);
      setActivity(Array.isArray(act)?act:[]);
      setPlatforms(Array.isArray(plat)?plat:[]);
      setHourly(Array.isArray(hour)?hour:[]);
      setTotalEvents(typeof total==='number'?total:0);
      setLastUpdated(new Date());
    } finally { setLoading(false); }
  }, []);

  const loadComparePeriod = async (t: string, days: string, empId: string, platform: string) => {
    const h = { Authorization:'Bearer '+t };
    const base = 'https://employee-tracker.ru/api/v1/analytics';
    const daysNum = parseInt(days);
    const toDate = new Date(); toDate.setDate(toDate.getDate() - daysNum);
    const fromDate = new Date(); fromDate.setDate(fromDate.getDate() - daysNum * 2);
    const from = fromDate.toISOString().slice(0,10);
    const to   = toDate.toISOString().slice(0,10);
    const params = new URLSearchParams({ from, to });
    if (empId) params.set('userId', empId);
    if (platform) params.set('platform', platform);
    try {
      const [act, bd] = await Promise.all([
        fetch(base+'/activity/summary?'+params, { headers:h }).then(r=>r.json()),
        fetch(base+'/tasks/by-day?days='+days, { headers:h }).then(r=>r.json()),
      ]);
      setPrevActivity(Array.isArray(act)?act:[]);
      setPrevByDay(Array.isArray(bd)?bd:[]);
    } catch {}
  };

  const loadFeed = async (t: string) => {
    setFeedLoading(true);
    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/analytics/activity/feed?limit=100', { headers:{ Authorization:'Bearer '+t } });
      const data = await res.json();
      if (Array.isArray(data)) setFeed(data);
    } catch(e) {} finally { setFeedLoading(false); }
  };

  const applyFilters = (p=period, e=selectedEmployee, pl=selectedPlatform) => loadAll(token,p,e,pl);
  const hasFilters   = period!=='7' || selectedEmployee!=='' || selectedPlatform!=='';
  const filteredActivity = selectedEmployee?activity.filter(a=>a.userId===selectedEmployee):activity;

  const card: React.CSSProperties = { background:'white', borderRadius:'20px', padding:'18px 20px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' };

  const tabBtn = (id: typeof activeTab, label: string) => (
    <button onClick={()=>{ setActiveTab(id); if(id==='feed') loadFeed(token); }}
      style={{ padding:'7px 18px', borderRadius:'20px', fontSize:'12px', fontWeight:activeTab===id?700:500, border:'none', cursor:'pointer', background:activeTab===id?'linear-gradient(135deg,#7F77DD,#5248C5)':'transparent', color:activeTab===id?'white':'#9B97CC', transition:'all 0.2s', boxShadow:activeTab===id?'0 4px 10px rgba(127,119,221,0.3)':'none' }}>
      {label}
    </button>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#ECEAF8' }}>
      {/* Header */}
      <div style={{ background:'white', padding: isMobile ? '12px 16px' : '16px 28px', position:'sticky', top:0, zIndex:10, boxShadow:'0 4px 16px rgba(127,119,221,0.06)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'12px' }}>
          <div>
            <h1 style={{ fontSize:'18px', fontWeight:800, color:'#1a1040', margin:0 }}>Аналитика</h1>
            {lastUpdated && <p style={{ fontSize:'11px', color:'#9B97CC', margin:'2px 0 0' }}>обновлено {lastUpdated.toLocaleTimeString('ru',{hour:'2-digit',minute:'2-digit'})}</p>}
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:'8px', flexWrap:'wrap' }}>
            <div style={{ display:'flex', gap:'3px', background:'#F8F7FF', borderRadius:'20px', padding:'3px' }}>
              {PERIODS.map(opt => (
                <button key={opt.v} onClick={()=>{ setPeriod(opt.v); applyFilters(opt.v); }}
                  style={{ padding:'5px 12px', borderRadius:'16px', fontSize:'11px', fontWeight:period===opt.v?700:500, border:'none', cursor:'pointer', background:period===opt.v?'linear-gradient(135deg,#7F77DD,#5248C5)':'transparent', color:period===opt.v?'white':'#9B97CC', transition:'all 0.2s', boxShadow:period===opt.v?'0 2px 8px rgba(127,119,221,0.3)':'none' }}>
                  {opt.l}
                </button>
              ))}
            </div>
            <select value={selectedEmployee} onChange={e=>{ setSelectedEmployee(e.target.value); applyFilters(period,e.target.value); }}
              style={{ background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'20px', padding:'6px 12px', fontSize:'12px', color:'#1a1040', outline:'none' }}>
              <option value="">Все сотрудники</option>
              {allEmployees.map(emp=><option key={emp.id} value={emp.id}>{emp.name}</option>)}
            </select>
            <select value={selectedPlatform} onChange={e=>{ setSelectedPlatform(e.target.value); applyFilters(period,selectedEmployee,e.target.value); }}
              style={{ background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'20px', padding:'6px 12px', fontSize:'12px', color:'#1a1040', outline:'none' }}>
              <option value="">Все платформы</option>
              <option value="WILDBERRIES">Wildberries</option>
              <option value="OZON">Ozon</option>
            </select>
            {hasFilters && <button onClick={()=>{ setPeriod('7'); setSelectedEmployee(''); setSelectedPlatform(''); loadAll(token,'7','',''); }} style={{ fontSize:'11px', color:'#9B97CC', background:'none', border:'none', cursor:'pointer', textDecoration:'underline' }}>Сбросить</button>}
          </div>
        </div>
      </div>

      <div style={{ padding: isMobile ? '12px' : '20px 28px', display:'flex', flexDirection:'column', gap:'16px' }}>
        {/* KPI */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'12px' }}>
          <KpiCard idx={0} title="Сотрудников" value={stats?.totalUsers} sub={`${stats?.totalUsers??0} в команде`} icon="ti-users" accent="#7F77DD" accBg="#EDE9FE" badge="+0" badgeC="#7F77DD" badgeBg="#EDE9FE"/>
          <KpiCard idx={1} title="Задач" value={stats?.totalTasks} sub={`${stats?.activeTasks??0} в работе`} subColor="#2563EB" icon="ti-checkbox" accent="#2563EB" accBg="#DBEAFE" badge="актив" badgeC="#2563EB" badgeBg="#DBEAFE"/>
          <KpiCard idx={2} title="В работе" value={stats?.activeTasks} sub="прямо сейчас" subColor="#D97706" icon="ti-loader" accent="#D97706" accBg="#FEF3C7" badge="⏱" badgeC="#D97706" badgeBg="#FEF3C7"/>
          <KpiCard idx={3} title="Выполнено" value={stats?.completionRate!=null?stats.completionRate+'%':null} sub="задач завершено" subColor="#16A34A" icon="ti-circle-check" accent="#16A34A" accBg="#DCFCE7" badge="✓" badgeC="#16A34A" badgeBg="#DCFCE7"/>
          <KpiCard idx={4} title="Событий" value={totalEvents?totalEvents.toLocaleString('ru'):null} sub="за период" subColor="#7F77DD" icon="ti-activity" accent="#7F77DD" accBg="#EDE9FE" badge="+12%" badgeC="#16A34A" badgeBg="#DCFCE7"/>
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', gap:'4px', background:'#F8F7FF', borderRadius:'24px', padding:'4px' }}>
            {tabBtn('tasks','✓ Задачи')}
            {tabBtn('activity','⏱ Активность')}
            {tabBtn('feed','🔴 Живой фид')}
          </div>
          <a href="/dashboard/analytics/sections" style={{ fontSize:'12px', color:'#7F77DD', textDecoration:'none', padding:'7px 16px', borderRadius:'20px', background:'#EDE9FE', fontWeight:700 }}>
            📊 По разделам →
          </a>
        </div>

        {/* TASKS TAB */}
        {activeTab==='tasks' && (
          <>
            <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'14px' }}>
              <div style={card}>
                <p style={{ fontSize:'14px', fontWeight:700, color:'#1a1040', margin:'0 0 16px' }}>По статусам</p>
                {byStatus.length===0 ? <p style={{ color:'#9B97CC', fontSize:'13px', textAlign:'center', padding:'20px' }}>Нет данных</p> : (
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={byStatus.map(d=>({ name:STATUS_LABELS[d.status]??d.status, count:d.count, status:d.status }))} margin={{ top:0, right:10, left:-20, bottom:0 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F0FF"/>
                      <XAxis dataKey="name" tick={{ fontSize:11, fill:'#9B97CC' }}/>
                      <YAxis tick={{ fontSize:11, fill:'#9B97CC' }} allowDecimals={false}/>
                      <Tooltip contentStyle={tooltipStyle}/>
                      <Bar dataKey="count" radius={[6,6,0,0]}>
                        {byStatus.map((e:any,i:number)=><Cell key={i} fill={STATUS_COLORS[e.status]??'#EDE9FE'}/>)}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                )}
              </div>
              <div style={card}>
                <p style={{ fontSize:'14px', fontWeight:700, color:'#1a1040', margin:'0 0 16px' }}>По приоритетам</p>
                {byPriority.length===0 ? <p style={{ color:'#9B97CC', fontSize:'13px', textAlign:'center', padding:'20px' }}>Нет данных</p> : (
                  <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
                    <ResponsiveContainer width="55%" height={180}>
                      <PieChart>
                        <Pie data={byPriority.map(d=>({ name:PRIORITY_LABELS[d.priority], value:d.count, priority:d.priority }))} innerRadius={45} outerRadius={75} paddingAngle={3} dataKey="value">
                          {byPriority.map((e:any,i:number)=><Cell key={i} fill={PRIORITY_COLORS[e.priority]??'#EDE9FE'}/>)}
                        </Pie>
                        <Tooltip contentStyle={tooltipStyle}/>
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
                      {byPriority.map((d:any,i:number)=>(
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px' }}>
                          <span style={{ width:'10px', height:'10px', borderRadius:'3px', background:PRIORITY_COLORS[d.priority]??'#EDE9FE', flexShrink:0 }}/>
                          <span style={{ color:'#6B7280' }}>{PRIORITY_LABELS[d.priority]}</span>
                          <span style={{ fontWeight:700, color:'#1a1040', marginLeft:'auto' }}>{d.count}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div style={card}>
              <p style={{ fontSize:'14px', fontWeight:700, color:'#1a1040', margin:'0 0 16px' }}>Задачи за {PERIODS.find(p=>p.v===period)?.l??period+' дней'}</p>
              <ResponsiveContainer width="100%" height={180}>
                <LineChart data={byDay} margin={{ top:0, right:10, left:-20, bottom:0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F0FF"/>
                  <XAxis dataKey="date" tick={{ fontSize:10, fill:'#9B97CC' }} tickFormatter={d=>d.slice(5)} interval="preserveStartEnd"/>
                  <YAxis tick={{ fontSize:11, fill:'#9B97CC' }} allowDecimals={false}/>
                  <Tooltip contentStyle={tooltipStyle}/>
                  <Legend iconSize={8} wrapperStyle={{ fontSize:12 }}/>
                  <Line type="monotone" dataKey="created" name="Создано" stroke="#7F77DD" strokeWidth={2.5} dot={false}/>
                  <Line type="monotone" dataKey="done" name="Выполнено" stroke="#16A34A" strokeWidth={2.5} dot={false}/>
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div style={{ ...card, padding:0, overflow:'hidden' }}>
              <div style={{ padding:'14px 20px', borderBottom:'1px solid #F3F0FF', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <p style={{ fontSize:'14px', fontWeight:700, color:'#1a1040', margin:0 }}>Задачи по сотрудникам</p>
                <span style={{ fontSize:'11px', color:'#9B97CC' }}>{PERIODS.find(p=>p.v===period)?.l}</span>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#F8F7FF' }}>
                    {['Сотрудник','Создано','В работе','Выполнено','Прогресс'].map(h=>(
                      <th key={h} style={{ padding:'10px 16px', fontSize:'10px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px', textAlign:h==='Сотрудник'?'left':'center', borderBottom:'1px solid #F3F0FF' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {employees.filter(e=>!selectedEmployee||e.id===selectedEmployee).map(emp=>{
                    const total=emp.created||1; const pct=Math.round(emp.completed/total*100);
                    return (
                      <tr key={emp.id} onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#F8F7FF'} onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                        <td style={{ padding:'12px 16px', borderBottom:'1px solid #F9F8FF' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            <div style={{ width:'30px', height:'30px', borderRadius:'50%', background:avatarColor(emp.name), display:'flex', alignItems:'center', justifyContent:'center' }}>
                              <span style={{ color:'white', fontSize:'11px', fontWeight:700 }}>{emp.name?.charAt(0)}</span>
                            </div>
                            <div>
                              <p style={{ fontSize:'13px', fontWeight:600, color:'#1a1040', margin:0 }}>{emp.name}</p>
                              <p style={{ fontSize:'10px', color:'#9B97CC', margin:0 }}>{emp.role}</p>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding:'12px 16px', borderBottom:'1px solid #F9F8FF', textAlign:'center', fontSize:'13px', color:'#6B7280' }}>{emp.created}</td>
                        <td style={{ padding:'12px 16px', borderBottom:'1px solid #F9F8FF', textAlign:'center', fontSize:'13px', fontWeight:700, color:'#2563EB' }}>{emp.inProgress}</td>
                        <td style={{ padding:'12px 16px', borderBottom:'1px solid #F9F8FF', textAlign:'center', fontSize:'13px', fontWeight:700, color:'#16A34A' }}>{emp.completed}</td>
                        <td style={{ padding:'12px 16px', borderBottom:'1px solid #F9F8FF' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            <div style={{ flex:1, height:'6px', background:'#F3F0FF', borderRadius:'3px', overflow:'hidden' }}>
                              <div style={{ height:'6px', width:pct+'%', background:'linear-gradient(90deg,#7F77DD,#5248C5)', borderRadius:'3px' }}/>
                            </div>
                            <span style={{ fontSize:'11px', color:'#9B97CC', width:'28px', textAlign:'right', fontWeight:600 }}>{pct}%</span>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {/* ACTIVITY TAB */}
        {activeTab==='activity' && (
          totalEvents===0 ? (
            <div style={{ ...card, padding:'60px', textAlign:'center' }}>
              <p style={{ fontSize:'40px', marginBottom:'12px' }}>🔌</p>
              <p style={{ fontSize:'15px', fontWeight:700, color:'#1a1040', margin:'0 0 6px' }}>Нет данных активности</p>
              <p style={{ fontSize:'13px', color:'#9B97CC' }}>Установи Chrome расширение и открой WB или Ozon</p>
            </div>
          ) : (
            <>
              <div style={{ display:'grid', gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr', gap:'14px' }}>
                <div style={card}>
                  <p style={{ fontSize:'14px', fontWeight:700, color:'#1a1040', margin:'0 0 16px' }}>По платформам</p>
                  {platforms.filter(p=>!selectedPlatform||p.platform===selectedPlatform).map((p:any,i:number)=>(
                    <div key={i} style={{ marginBottom:'14px' }}>
                      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'6px' }}>
                        <span style={{ fontSize:'13px', fontWeight:600, color:PLATFORM_COLORS[p.platform]??'#9B97CC' }}>{p.platform==='WILDBERRIES'?'Wildberries':'Ozon'}</span>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <span style={{ fontSize:'12px', color:'#9B97CC' }}>{p.estimatedMins}м</span>
                          <span style={{ fontSize:'11px', fontWeight:700, color:PLATFORM_COLORS[p.platform], background:PLATFORM_COLORS[p.platform]+'18', padding:'2px 8px', borderRadius:'10px' }}>{p.percent}%</span>
                        </div>
                      </div>
                      <div style={{ height:'8px', background:'#F3F0FF', borderRadius:'4px', overflow:'hidden' }}>
                        <div style={{ height:'8px', width:p.percent+'%', background:PLATFORM_COLORS[p.platform], borderRadius:'4px', transition:'width 0.5s ease' }}/>
                      </div>
                    </div>
                  ))}
                </div>
                <div style={card}>
                  <p style={{ fontSize:'14px', fontWeight:700, color:'#1a1040', margin:'0 0 16px' }}>Активность по часам</p>
                  <ResponsiveContainer width="100%" height={160}>
                    <BarChart data={hourly.filter((_:any,i:number)=>i>=7&&i<=22)} margin={{ top:0, right:5, left:-25, bottom:0 }} barSize={16}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F3F0FF"/>
                      <XAxis dataKey="label" tick={{ fontSize:9, fill:'#9B97CC' }} interval={2}/>
                      <YAxis tick={{ fontSize:10, fill:'#9B97CC' }} allowDecimals={false}/>
                      <Tooltip contentStyle={tooltipStyle}/>
                      <Bar dataKey="events" fill="#7F77DD" radius={[4,4,0,0]}/>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div style={{ ...card, padding:0, overflow:'hidden' }}>
                <div style={{ padding:'14px 20px', borderBottom:'1px solid #F3F0FF', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <p style={{ fontSize:'14px', fontWeight:700, color:'#1a1040', margin:0 }}>Активность сотрудников</p>
                  <span style={{ fontSize:'11px', color:'#9B97CC' }}>{PERIODS.find(p=>p.v===period)?.l}</span>
                </div>
                <table style={{ width:'100%', borderCollapse:'collapse' }}>
                  <thead>
                    <tr style={{ background:'#F8F7FF' }}>
                      {['Сотрудник','Событий','~Время','Активность'].map(h=>(
                        <th key={h} style={{ padding:'10px 16px', fontSize:'10px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px', textAlign:h==='Сотрудник'?'left':'center', borderBottom:'1px solid #F3F0FF' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredActivity.map((emp:any)=>{
                      const max=Math.max(...filteredActivity.map((e:any)=>e.totalEvents),1);
                      const pct=Math.round(emp.totalEvents/max*100);
                      return (
                        <tr key={emp.userId} style={{ cursor:'pointer' }}
                          onClick={()=>{ setSelectedEmployee(emp.userId); applyFilters(period,emp.userId); }}
                          onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#F8F7FF'}
                          onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                          <td style={{ padding:'12px 16px', borderBottom:'1px solid #F9F8FF' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                              <div style={{ width:'30px', height:'30px', borderRadius:'50%', background:avatarColor(emp.name), display:'flex', alignItems:'center', justifyContent:'center' }}>
                                <span style={{ color:'white', fontSize:'11px', fontWeight:700 }}>{emp.name?.charAt(0)}</span>
                              </div>
                              <span style={{ fontSize:'13px', fontWeight:600, color:'#1a1040' }}>{emp.name}</span>
                            </div>
                          </td>
                          <td style={{ padding:'12px 16px', borderBottom:'1px solid #F9F8FF', textAlign:'center', fontSize:'13px', fontWeight:700, color:'#7F77DD' }}>{emp.totalEvents.toLocaleString('ru')}</td>
                          <td style={{ padding:'12px 16px', borderBottom:'1px solid #F9F8FF', textAlign:'center', fontSize:'13px', color:'#6B7280' }}>
                            {emp.totalEstimatedMins>=60?Math.floor(emp.totalEstimatedMins/60)+'ч '+(emp.totalEstimatedMins%60)+'м':emp.totalEstimatedMins+'м'}
                          </td>
                          <td style={{ padding:'12px 16px', borderBottom:'1px solid #F9F8FF' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                              <div style={{ flex:1, height:'6px', background:'#F3F0FF', borderRadius:'3px', overflow:'hidden' }}>
                                <div style={{ height:'6px', width:pct+'%', background:'linear-gradient(90deg,#7F77DD,#5248C5)', borderRadius:'3px' }}/>
                              </div>
                              <span style={{ fontSize:'11px', color:'#9B97CC', width:'28px', fontWeight:600 }}>{pct}%</span>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </>
          )
        )}

        {/* FEED TAB */}
        {activeTab==='feed' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
              <p style={{ fontSize:'13px', color:'#9B97CC', margin:0 }}>{feedLoading?'Загрузка...':feed.length+' последних событий'}</p>
              <button onClick={()=>loadFeed(token)} style={{ fontSize:'12px', color:'#7F77DD', background:'#EDE9FE', border:'none', borderRadius:'20px', padding:'6px 14px', cursor:'pointer', fontWeight:700 }}>↻ Обновить</button>
            </div>
            {feed.length===0&&!feedLoading ? (
              <div style={{ ...card, padding:'48px', textAlign:'center' }}>
                <p style={{ fontSize:'36px', marginBottom:'12px' }}>📡</p>
                <p style={{ fontSize:'15px', fontWeight:700, color:'#1a1040', margin:'0 0 6px' }}>Нет событий</p>
                <p style={{ fontSize:'13px', color:'#9B97CC' }}>Откройте WB или Ozon с установленным расширением</p>
              </div>
            ) : (
              <div style={{ ...card, padding:0, overflow:'hidden' }}>
                {feed.map((event:any,i:number)=>{
                  const isWB=event.platform==='WILDBERRIES';
                  const pd=event.platformData as any;
                  const section=pd?.section&&pd.section!=='other'?pd.section:null;
                  const evtType=event.eventType as string;
                  const isPing=evtType.includes('ping');
                  const isEnter=evtType.includes('enter');
                  const isLeave=evtType.includes('leave');
                  const color=isPing?'#9B97CC':isEnter?'#16A34A':isLeave?'#D97706':'#7F77DD';
                  const icon=isPing?'⏱':isEnter?'▶':isLeave?'⏸':'⚡';
                  const ago=Math.floor((Date.now()-new Date(event.createdAt).getTime())/60000);
                  const agoStr=ago<1?'только что':ago<60?ago+'м назад':Math.floor(ago/60)+'ч назад';
                  const actionLabels: Record<string,string>={ wb_review_reply:'Ответил на отзыв', ozon_review_reply:'Ответил на отзыв', wb_price_save:'Сохранил цены', wb_price_edit:'Изменил цену', ozon_price_save:'Сохранил цены', wb_stock_update:'Обновил остатки', ozon_stock_update:'Обновил остатки' };
                  const sectionLabels: Record<string,string>={ feedbacks:'Отзывы', reviews:'Отзывы', products:'Товары', prices:'Цены', advertising:'Реклама', analytics:'Аналитика', stocks:'Остатки', orders:'Заказы', finance:'Финансы', dashboard:'Дашборд' };
                  const label=actionLabels[evtType]??(isEnter?'Зашёл в раздел':isLeave?'Вышел из раздела':isPing?'Активен':evtType.replace(/^(wb_|ozon_)/,'').replace(/_/g,' '));
                  return (
                    <div key={event.id} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 18px', borderBottom:i<feed.length-1?'1px solid #F9F8FF':'none', opacity:isPing?0.4:1, transition:'background 0.1s' }}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#F8F7FF'}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                      <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:avatarColor(event.userName), display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <span style={{ color:'white', fontSize:'11px', fontWeight:700 }}>{event.userName?.charAt(0)}</span>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                          <span style={{ fontSize:'13px', fontWeight:600, color:'#1a1040' }}>{event.userName}</span>
                          <span style={{ fontSize:'9px', fontWeight:700, color:isWB?'#7F77DD':'#2563EB', background:isWB?'#EDE9FE':'#DBEAFE', padding:'1px 6px', borderRadius:'6px' }}>{isWB?'WB':'OZ'}</span>
                          {section&&<span style={{ fontSize:'11px', color:'#9B97CC' }}>{sectionLabels[section]??section}</span>}
                        </div>
                        <p style={{ fontSize:'12px', color, margin:'1px 0 0', fontWeight:500 }}>{icon} {label}</p>
                      </div>
                      <span style={{ fontSize:'11px', color:'#C4C0E8', flexShrink:0, fontWeight:500 }}>{agoStr}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
