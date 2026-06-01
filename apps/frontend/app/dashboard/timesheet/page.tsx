'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const AVATAR_COLORS = ['#7F77DD','#2563EB','#16A34A','#D97706','#DC2626','#0891B2','#7C3AED'];
const avatarColor = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0)??0) % AVATAR_COLORS.length];

const STATUS_STYLE: Record<string,{bg:string;c:string;label:string}> = {
  present:     { bg:'#DCFCE7', c:'#16A34A', label:'✓' },
  late:        { bg:'#FEF3C7', c:'#D97706', label:'⏰ опозд.' },
  early_leave: { bg:'#FEF3C7', c:'#D97706', label:'↩ ранний' },
  absent:      { bg:'#FEE2E2', c:'#DC2626', label:'Нет' },
  weekend:     { bg:'#F3F4F6', c:'#9B97CC', label:'—' },
  no_data:     { bg:'#F3F4F6', c:'#C4C0E8', label:'—' },
};

function fmtMin(m: number) {
  if (!m || m <= 0) return '—';
  if (m < 60) return m + 'м';
  return Math.floor(m/60) + 'ч ' + (m%60) + 'м';
}

export default function TimesheetPage() {
  const router = useRouter();
  const [data, setData]         = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [days, setDays]         = useState(14);
  const [userId, setUserId]     = useState('');
  const [employees, setEmployees] = useState<any[]>([]);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    fetch('https://employee-tracker.ru/api/v1/employees', { headers:{ Authorization:'Bearer '+t } })
      .then(r=>r.json()).then(d=>{ if(Array.isArray(d)) setEmployees(d); });
    load(t, 14, '');
  }, []);

  const load = async (token: string, d: number, uid: string) => {
    setLoading(true);
    try {
      let url = `https://employee-tracker.ru/api/v1/analytics/timesheet?days=${d}`;
      if (uid) url += `&userId=${uid}`;
      const res = await fetch(url, { headers:{ Authorization:'Bearer '+token } });
      const json = await res.json();
      if (Array.isArray(json)) setData(json);
    } catch(e) {} finally { setLoading(false); }
  };

  const reload = (d: number, uid: string) => {
    const t = localStorage.getItem('access_token');
    if (t) { setDays(d); setUserId(uid); load(t, d, uid); }
  };

  // Get date columns from first employee
  const dateColumns: string[] = data[0]?.days?.map((d:any)=>d.date) ?? [];

  return (
    <div style={{ minHeight:'100vh', background:'#ECEAF8' }}>
      {/* Header */}
      <div style={{ background:'white', padding:'16px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10, boxShadow:'0 4px 16px rgba(127,119,221,0.06)' }}>
        <div>
          <h1 style={{ fontSize:'18px', fontWeight:800, color:'#1a1040', margin:0 }}>Табель</h1>
          <p style={{ fontSize:'11px', color:'#9B97CC', margin:'2px 0 0' }}>Учёт рабочего времени сотрудников</p>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          {/* Period pills */}
          <div style={{ display:'flex', gap:'3px', background:'#F8F7FF', borderRadius:'20px', padding:'3px' }}>
            {[{v:7,l:'7 дней'},{v:14,l:'14 дней'},{v:30,l:'30 дней'}].map(opt=>(
              <button key={opt.v} onClick={()=>reload(opt.v, userId)}
                style={{ padding:'5px 12px', borderRadius:'16px', fontSize:'11px', fontWeight:days===opt.v?700:500, border:'none', cursor:'pointer', background:days===opt.v?'linear-gradient(135deg,#7F77DD,#5248C5)':'transparent', color:days===opt.v?'white':'#9B97CC', transition:'all 0.2s', boxShadow:days===opt.v?'0 2px 8px rgba(127,119,221,0.3)':'none' }}>
                {opt.l}
              </button>
            ))}
          </div>
          <select value={userId} onChange={e=>reload(days,e.target.value)}
            style={{ background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'20px', padding:'6px 14px', fontSize:'12px', color:'#1a1040', outline:'none' }}>
            <option value="">Все сотрудники</option>
            {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>

      <div style={{ padding:'20px 28px', display:'flex', flexDirection:'column', gap:'16px' }}>
        {/* KPI row */}
        {data.length>0 && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px' }}>
            {[
              { l:'Сотрудников', v:data.length, icon:'ti-users', accent:'#7F77DD', accBg:'#EDE9FE', badge:data.length+'чел', badgeC:'#7F77DD', badgeBg:'#EDE9FE' },
              { l:'Присутствовало', v:data.reduce((s:number,r:any)=>s+(r.presentDays??0),0), icon:'ti-calendar', accent:'#16A34A', accBg:'#DCFCE7', badge:'дней', badgeC:'#16A34A', badgeBg:'#DCFCE7' },
              { l:'Опозданий', v:data.reduce((s:number,r:any)=>s+(r.lateDays??0),0), icon:'ti-clock', accent:'#D97706', accBg:'#FEF3C7', badge:'всего', badgeC:'#D97706', badgeBg:'#FEF3C7' },
              { l:'Отсутствий', v:data.reduce((s:number,r:any)=>s+(r.absentDays??0),0), icon:'ti-user-x', accent:'#DC2626', accBg:'#FEE2E2', badge:'дней', badgeC:'#DC2626', badgeBg:'#FEE2E2' },
            ].map((k,i)=>(
              <div key={i} style={{ background:'white', borderRadius:'20px', padding:'16px 18px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)', position:'relative', overflow:'hidden' }}>
                <div style={{ position:'absolute', top:'12px', right:'12px', fontSize:'10px', fontWeight:700, color:k.badgeC, background:k.badgeBg, padding:'2px 8px', borderRadius:'10px' }}>{k.badge}</div>
                <div style={{ width:'36px', height:'36px', borderRadius:'12px', background:k.accBg, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'10px' }}>
                  <i className={'ti '+k.icon} style={{ fontSize:'18px', color:k.accent }} aria-hidden="true"/>
                </div>
                <p style={{ fontSize:'10px', color:'#9B97CC', margin:'0 0 3px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>{k.l}</p>
                <p style={{ fontSize:'26px', fontWeight:800, color:'#1a1040', margin:0, letterSpacing:'-1px' }}>{k.v}</p>
              </div>
            ))}
          </div>
        )}

        {/* Legend */}
        <div style={{ display:'flex', gap:'12px', alignItems:'center', flexWrap:'wrap' }}>
          {[
            { c:'#16A34A', bg:'#DCFCE7', l:'Присутствовал' },
            { c:'#D97706', bg:'#FEF3C7', l:'Опоздание' },
            { c:'#D97706', bg:'#FEF3C7', l:'Ранний уход' },
            { c:'#DC2626', bg:'#FEE2E2', l:'Отсутствовал' },
            { c:'#9B97CC', bg:'#F3F4F6', l:'Выходной' },
          ].map((s,i)=>(
            <div key={i} style={{ display:'flex', alignItems:'center', gap:'5px' }}>
              <span style={{ width:'10px', height:'10px', borderRadius:'3px', background:s.bg, border:`1px solid ${s.c}40`, display:'inline-block' }}/>
              <span style={{ fontSize:'11px', color:'#9B97CC' }}>{s.l}</span>
            </div>
          ))}
        </div>

        {/* Calendar Grid */}
        {loading ? (
          <div style={{ background:'white', borderRadius:'20px', padding:'60px', textAlign:'center', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' }}>
            <p style={{ color:'#9B97CC', fontSize:'13px' }}>Загрузка...</p>
          </div>
        ) : data.length===0 ? (
          <div style={{ background:'white', borderRadius:'20px', padding:'60px', textAlign:'center', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' }}>
            <div style={{ fontSize:'40px', marginBottom:'12px' }}>📅</div>
            <p style={{ fontSize:'15px', fontWeight:700, color:'#1a1040', margin:'0 0 6px' }}>Нет данных</p>
            <p style={{ fontSize:'13px', color:'#9B97CC' }}>Данные активности появятся после установки расширения</p>
          </div>
        ) : (
          <div style={{ background:'white', borderRadius:'20px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)', overflow:'auto' }}>
            <table style={{ width:'100%', borderCollapse:'collapse', minWidth: dateColumns.length*90 + 300 + 'px' }}>
              <thead>
                <tr style={{ background:'#F8F7FF', borderBottom:'1px solid #F3F0FF' }}>
                  <th style={{ padding:'12px 16px', textAlign:'left', fontSize:'10px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px', position:'sticky', left:0, background:'#F8F7FF', zIndex:2, minWidth:'180px' }}>Сотрудник</th>
                  <th style={{ padding:'12px 16px', textAlign:'center', fontSize:'10px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px', minWidth:'100px' }}>Среднее</th>
                  {dateColumns.map(date => {
                    const d = new Date(date + 'T12:00:00');
                    const dayName = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'][d.getDay()];
                    const month = date.slice(5).replace('-','.');
                    const isToday = new Date().toISOString().slice(0,10)===date;
                    const isWeekend = d.getDay()===0||d.getDay()===6;
                    return (
                      <th key={date} style={{ padding:'8px 6px', textAlign:'center', fontSize:'10px', fontWeight:700, color:isToday?'#7F77DD':isWeekend?'#C4C0E8':'#9B97CC', textTransform:'uppercase', letterSpacing:'0.3px', minWidth:'85px', background:isToday?'#F0EEFF':'#F8F7FF' }}>
                        <div style={{ fontWeight:700 }}>{dayName}</div>
                        <div style={{ fontSize:'9px', fontWeight:500, marginTop:'1px' }}>{month}</div>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {data.map((row:any, ri:number) => (
                  <tr key={row.userId} style={{ borderBottom:'1px solid #F9F8FF', transition:'background 0.1s' }}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#F8F7FF'}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                    {/* Employee */}
                    <td style={{ padding:'10px 16px', position:'sticky', left:0, background:'inherit', zIndex:1, borderRight:'1px solid #F3F0FF' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                        <div style={{ width:'34px', height:'34px', borderRadius:'50%', background:avatarColor(row.name), display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                          <span style={{ color:'white', fontSize:'12px', fontWeight:700 }}>{row.name?.charAt(0)}</span>
                        </div>
                        <div>
                          <div style={{ fontSize:'13px', fontWeight:700, color:'#1a1040' }}>{row.name}</div>
                          <div style={{ fontSize:'10px', color:'#9B97CC', marginTop:'1px' }}>{row.avgStartTime&&row.avgEndTime?`${row.avgStartTime} — ${row.avgEndTime}`:row.email??''}</div>
                        </div>
                      </div>
                    </td>
                    {/* Average */}
                    <td style={{ padding:'10px 16px', textAlign:'center', borderRight:'1px solid #F3F0FF' }}>
                      <div style={{ fontSize:'14px', fontWeight:800, color:'#1a1040', letterSpacing:'-0.5px' }}>
                        {fmtMin(row.totalWorkMinutes ? Math.round(row.totalWorkMinutes/(row.presentDays||1)) : 0)}
                      </div>
                      <div style={{ fontSize:'10px', color:'#9B97CC', marginTop:'1px' }}>{row.presentDays??0}д / {row.totalDays??0}д</div>
                    </td>
                    {/* Days */}
                    {(row.days??[]).map((day:any, di:number) => {
                      const ss = STATUS_STYLE[day.status] ?? STATUS_STYLE.no_data;
                      const isToday = new Date().toISOString().slice(0,10)===day.date;
                      return (
                        <td key={di} style={{ padding:'6px 4px', textAlign:'center', background:isToday?'#F0EEFF':'transparent', minWidth:'85px' }}>
                          {day.status==='weekend'||day.status==='no_data' ? (
                            <span style={{ fontSize:'12px', color:ss.c }}>—</span>
                          ) : (
                            <div style={{ display:'inline-flex', flexDirection:'column', alignItems:'center', gap:'2px', background:ss.bg, borderRadius:'10px', padding:'4px 8px', minWidth:'70px' }}>
                              {day.firstEvent && (
                                <span style={{ fontSize:'12px', fontWeight:700, color:ss.c, lineHeight:1 }}>{day.firstEvent}</span>
                              )}
                              {day.lastEvent && (
                                <span style={{ fontSize:'10px', color:ss.c, opacity:0.8, lineHeight:1 }}>{day.lastEvent}</span>
                              )}
                              {(day.lateMinutes>0||day.earlyLeaveMinutes>0) && (
                                <div style={{ display:'flex', alignItems:'center', gap:'2px', marginTop:'1px' }}>
                                  <span style={{ fontSize:'9px' }}>⏰</span>
                                  <span style={{ fontSize:'9px', fontWeight:700, color:ss.c }}>
                                    {day.lateMinutes>0?'опозд. '+fmtMin(day.lateMinutes):day.earlyLeaveMinutes>0?fmtMin(day.earlyLeaveMinutes):null}
                                  </span>
                                </div>
                              )}
                              {day.workDuration>0 && (
                                <span style={{ fontSize:'10px', fontWeight:700, color:ss.c }}>{fmtMin(day.workDuration)}</span>
                              )}
                              {day.status==='absent' && <span style={{ fontSize:'11px', fontWeight:700, color:'#DC2626' }}>Нет</span>}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
