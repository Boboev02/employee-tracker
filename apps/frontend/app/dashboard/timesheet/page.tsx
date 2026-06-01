'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

function fmtSec(s: number) {
  if (!s || s <= 0) return '—';
  if (s < 60) return s + 'с';
  if (s < 3600) return Math.floor(s / 60) + 'м';
  return Math.floor(s / 3600) + 'ч ' + Math.floor((s % 3600) / 60) + 'м';
}

const AVATAR_COLORS = ['#6C5CE7','#4A90E2','#43A047','#FB8C00','#E53935','#00ACC1','#8E24AA'];
const avatarColor = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0)??0) % AVATAR_COLORS.length];
const DAYS_RU = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

export default function TimesheetPage() {
  const router = useRouter();
  const [data, setData]           = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [selectedUser, setSelectedUser] = useState('ALL');
  const [days, setDays]           = useState(7);
  const [loading, setLoading]     = useState(true);

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

  const filtered = selectedUser === 'ALL' ? data : data.filter(d => d.userId === selectedUser);

  const card: React.CSSProperties = { background:'#fff', borderRadius:'12px', padding:'16px 18px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', border:'1px solid #eee' };
  const selStyle: React.CSSProperties = { background:'#F5F3FC', border:'1.5px solid #E0DDF0', borderRadius:'9px', padding:'7px 12px', fontSize:'13px', color:'#1a1a2e', outline:'none' };

  return (
    <div style={{ minHeight:'100vh', background:'#EBE8F6' }}>
      <div style={{ background:'#fff', borderBottom:'1px solid #eee', padding:'16px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10, boxShadow:'0 2px 8px rgba(108,92,231,0.06)' }}>
        <div>
          <h1 style={{ fontSize:'18px', fontWeight:700, color:'#1a1a2e', margin:0 }}>Табель</h1>
          <p style={{ fontSize:'12px', color:'#aaa', margin:'2px 0 0' }}>Учёт рабочего времени сотрудников</p>
        </div>
        <div style={{ display:'flex', gap:'8px' }}>
          {[{v:1,l:'Сегодня'},{v:7,l:'7 дней'},{v:14,l:'14 дней'},{v:30,l:'30 дней'}].map(d => (
            <button key={d.v} onClick={()=>setDays(d.v)}
              style={{ padding:'6px 14px', borderRadius:'8px', border:'none', fontSize:'12px', fontWeight:500, cursor:'pointer', background:days===d.v?'#6C5CE7':'#F5F3FC', color:days===d.v?'white':'#666', transition:'all 0.15s' }}>
              {d.l}
            </button>
          ))}
          <select value={selectedUser} onChange={e=>setSelectedUser(e.target.value)} style={selStyle}>
            <option value="ALL">Все сотрудники</option>
            {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ padding:'24px 28px', display:'flex', flexDirection:'column', gap:'16px' }}>
        {loading ? (
          <div style={{ ...card, padding:'60px', textAlign:'center', color:'#aaa' }}>Загрузка данных...</div>
        ) : filtered.length === 0 ? (
          <div style={{ ...card, padding:'60px', textAlign:'center' }}>
            <div style={{ fontSize:'40px', marginBottom:'12px' }}>📅</div>
            <p style={{ color:'#aaa', fontSize:'13px' }}>Нет данных за выбранный период</p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'14px' }}>
              {[
                { label:'Всего сотрудников', value:filtered.length, icon:'ti-users', color:'#6C5CE7', bg:'#EDE9FF' },
                { label:'Активных дней', value:Math.max(...filtered.map(d=>d.activeDays??0)), icon:'ti-calendar', color:'#4A90E2', bg:'#E3F2FD' },
                { label:'Всего кликов', value:filtered.reduce((s,d)=>s+(d.totalEvents??0),0).toLocaleString('ru'), icon:'ti-mouse', color:'#43A047', bg:'#E8F5E9' },
              ].map((k,i) => (
                <div key={i} style={{ ...card, display:'flex', alignItems:'center', gap:'12px' }}>
                  <div style={{ width:'42px', height:'42px', borderRadius:'10px', background:k.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <i className={'ti '+k.icon} style={{ fontSize:'20px', color:k.color }} aria-hidden="true" />
                  </div>
                  <div>
                    <p style={{ fontSize:'22px', fontWeight:700, color:'#1a1a2e', margin:0, lineHeight:1 }}>{k.value}</p>
                    <p style={{ fontSize:'12px', color:'#aaa', margin:'4px 0 0' }}>{k.label}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Table */}
            <div style={card}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid #f0f0f0' }}>
                    {['Сотрудник','Активных дней','Кликов','Активное время','WB','Ozon','Активность по дням'].map(h => (
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', fontSize:'10px', fontWeight:600, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.5px', whiteSpace:'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((emp:any) => {
                    const totalEv = emp.totalEvents ?? 0;
                    const wb = emp.platforms?.WILDBERRIES ?? 0;
                    const oz = emp.platforms?.OZON ?? 0;
                    const totalTime = Object.values(emp.sections??{} as Record<string,any>).reduce((s:number,v:any)=>s+(v.timeSeconds??0),0);
                    const recentDays = (emp.days??[]).slice(-7);
                    const maxDay = Math.max(...recentDays.map((d:any)=>d.eventCount??0), 1);
                    return (
                      <tr key={emp.userId} style={{ borderBottom:'1px solid #f9f9f9', transition:'background 0.1s' }}
                        onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#F5F3FC'}
                        onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                        <td style={{ padding:'12px 14px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                            <div style={{ width:'34px', height:'34px', borderRadius:'50%', background:avatarColor(emp.name), display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              <span style={{ color:'white', fontSize:'12px', fontWeight:600 }}>{emp.name?.charAt(0)}</span>
                            </div>
                            <span style={{ fontSize:'13px', fontWeight:500, color:'#1a1a2e' }}>{emp.name}</span>
                          </div>
                        </td>
                        <td style={{ padding:'12px 14px' }}>
                          <span style={{ fontSize:'13px', fontWeight:600, color:'#1a1a2e' }}>{emp.activeDays ?? 0}</span>
                          <span style={{ fontSize:'11px', color:'#aaa', marginLeft:'4px' }}>дн.</span>
                        </td>
                        <td style={{ padding:'12px 14px' }}>
                          <span style={{ fontSize:'13px', fontWeight:600, color:'#6C5CE7' }}>{totalEv.toLocaleString('ru')}</span>
                        </td>
                        <td style={{ padding:'12px 14px' }}>
                          <span style={{ fontSize:'13px', fontWeight:600, color:'#1a1a2e' }}>{fmtSec(totalTime)}</span>
                        </td>
                        <td style={{ padding:'12px 14px' }}>
                          <span style={{ fontSize:'12px', fontWeight:600, color:'#6C5CE7', background:'#EDE9FF', padding:'2px 8px', borderRadius:'6px' }}>{wb}</span>
                        </td>
                        <td style={{ padding:'12px 14px' }}>
                          <span style={{ fontSize:'12px', fontWeight:600, color:'#4A90E2', background:'#E3F2FD', padding:'2px 8px', borderRadius:'6px' }}>{oz}</span>
                        </td>
                        <td style={{ padding:'12px 14px' }}>
                          <div style={{ display:'flex', gap:'3px', alignItems:'flex-end', height:'28px' }}>
                            {recentDays.map((d:any,i:number) => {
                              const h = Math.max(4, Math.round((d.eventCount??0)/maxDay*24));
                              const dt = new Date(d.date);
                              const isToday = new Date().toDateString() === dt.toDateString();
                              return (
                                <div key={i} title={`${d.date}: ${d.eventCount} кликов`}
                                  style={{ width:'10px', height:h+'px', borderRadius:'3px', background:isToday?'#6C5CE7':d.eventCount>0?'#EDE9FF':'#f0f0f0', transition:'height 0.3s', flexShrink:0 }} />
                              );
                            })}
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
      </div>
    </div>
  );
}
