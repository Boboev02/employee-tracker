'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

function fmtTime(sec: number) {
  if (!sec||sec<=0) return '—';
  if (sec<60) return sec+'с';
  if (sec<3600) return Math.floor(sec/60)+'м';
  return Math.floor(sec/3600)+'ч '+Math.floor((sec%3600)/60)+'м';
}

const AVATAR_COLORS = ['#7F77DD','#2563EB','#16A34A','#D97706','#DC2626','#0891B2'];
const avatarColor = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0)??0) % AVATAR_COLORS.length];

export default function ReportsPage() {
  const router = useRouter();
  const [token, setToken]     = useState('');
  const [report, setReport]   = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod]   = useState('7');

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
  }, []);

  const generate = async (days: string) => {
    setLoading(true); setPeriod(days);
    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/analytics/full-report?days='+days, { headers:{ Authorization:'Bearer '+token } });
      setReport(await res.json());
    } finally { setLoading(false); }
  };

  const downloadCSV = () => {
    if (!report) return;
    const BOM = '\uFEFF';
    const rows: any[][] = [
      ['ОТЧЁТ ПО СОТРУДНИКАМ'],
      ['Период:', report.period.days+' дней', 'Сформирован:', new Date(report.generatedAt).toLocaleString('ru')],
      [],
      ['СВОДКА'],
      ['Сотрудников', report.summary.totalEmployees, 'Кликов', report.summary.totalClicks],
      ['Задач', report.summary.totalTasks, 'Выполнено', report.summary.completedTasks],
      [],
      ['СОТРУДНИКИ'],
      ['Имя','Email','Роль','Кликов','В работе','Выполнено','Топ раздел','Время'],
      ...report.employees.map((e:any)=>{ const top=e.sectionsFormatted?.[0]; return [e.name,e.email,e.role,e.totalClicks,e.tasks.inProgress,e.tasks.done,top?(top.platform==='WILDBERRIES'?'WB ':'OZ ')+top.label:'—',top?fmtTime(top.timeSeconds):'—']; }),
      [],
      ['АКТИВНОСТЬ ПО РАЗДЕЛАМ'],
      ['Сотрудник','Платформа','Раздел','Кликов','Время'],
      ...report.employees.flatMap((e:any)=>(e.sectionsFormatted||[]).map((s:any)=>[e.name,s.platform==='WILDBERRIES'?'Wildberries':'Ozon',s.label,s.clicks,fmtTime(s.timeSeconds)])),
      [],
      ['ЗАДАЧИ'],
      ['Название','Статус','Приоритет','Исполнитель','Дедлайн'],
      ...report.tasks.map((t:any)=>[t.title,t.status,t.priority,t.assigneeName,t.dueDate?new Date(t.dueDate).toLocaleDateString('ru'):'—']),
    ];
    const csv = BOM+rows.map(r=>r.map(c=>'"'+String(c??'').replace(/"/g,'""')+'"').join(';')).join('\n');
    const blob = new Blob([csv],{type:'text/csv;charset=utf-8;'});
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href=url; a.download='report-'+report.period.days+'d-'+new Date().toISOString().slice(0,10)+'.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const printPDF = () => {
    if (!report) return;
    const STATUS: Record<string,string> = { NEW:'Новая', IN_PROGRESS:'В работе', REVIEW:'Проверка', DONE:'Готово', BLOCKED:'Заблок.' };
    const PRIO: Record<string,string>   = { LOW:'Низкий', MEDIUM:'Средний', HIGH:'Высокий', CRITICAL:'Критич.' };
    const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
<style>body{font-family:Arial,sans-serif;font-size:12px;padding:24px;color:#1a1040}h1{font-size:20px;font-weight:800;margin:0 0 4px;letter-spacing:-0.5px}h2{font-size:13px;font-weight:700;margin:20px 0 8px;padding-bottom:6px;border-bottom:2px solid #EDE9FE;color:#7F77DD}.meta{font-size:11px;color:#9B97CC;margin-bottom:18px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:8px}.kpi{background:#F8F7FF;border-radius:12px;padding:12px;border:1px solid #EDE9FE}.kpi-v{font-size:22px;font-weight:800;letter-spacing:-0.5px}.kpi-l{font-size:10px;color:#9B97CC;text-transform:uppercase;letter-spacing:0.4px}table{width:100%;border-collapse:collapse;margin-bottom:8px}th{background:#F8F7FF;padding:8px 12px;text-align:left;font-size:10px;font-weight:700;color:#9B97CC;text-transform:uppercase;letter-spacing:0.4px;border-bottom:1px solid #EDE9FE}td{padding:8px 12px;border-bottom:1px solid #FAF9FF;font-size:11px}.wb{background:#EDE9FE;color:#7F77DD;padding:2px 6px;border-radius:6px;font-size:9px;font-weight:700}.oz{background:#DBEAFE;color:#2563EB;padding:2px 6px;border-radius:6px;font-size:9px;font-weight:700}</style>
</head><body>
<h1>Отчёт по сотрудникам</h1>
<div class="meta">Период: ${report.period.days} дней &nbsp;·&nbsp; ${new Date(report.generatedAt).toLocaleString('ru')}</div>
<div class="grid">
  <div class="kpi"><div class="kpi-v">${report.summary.totalEmployees}</div><div class="kpi-l">Сотрудников</div></div>
  <div class="kpi"><div class="kpi-v" style="color:#7F77DD">${report.summary.totalClicks}</div><div class="kpi-l">Кликов</div></div>
  <div class="kpi"><div class="kpi-v" style="color:#2563EB">${report.summary.totalTasks}</div><div class="kpi-l">Задач</div></div>
  <div class="kpi"><div class="kpi-v" style="color:#16A34A">${report.summary.completedTasks}</div><div class="kpi-l">Выполнено</div></div>
</div>
<h2>Сотрудники</h2>
<table><thead><tr><th>Имя</th><th>Роль</th><th>Кликов</th><th>В работе</th><th>Выполнено</th><th>Топ раздел</th></tr></thead><tbody>
${report.employees.map((e:any)=>{ const top=e.sectionsFormatted?.[0]; return `<tr><td><b>${e.name}</b><br><span style="color:#9B97CC;font-size:10px">${e.email}</span></td><td>${e.role}</td><td style="color:#7F77DD;font-weight:700">${e.totalClicks}</td><td style="color:#2563EB;font-weight:700">${e.tasks.inProgress}</td><td style="color:#16A34A;font-weight:700">${e.tasks.done}</td><td>${top?`<span class="${top.platform==='WILDBERRIES'?'wb':'oz'}">${top.platform==='WILDBERRIES'?'WB':'OZ'}</span> ${top.label}`:'—'}</td></tr>`; }).join('')}
</tbody></table>
<h2>Задачи</h2>
<table><thead><tr><th>Название</th><th>Статус</th><th>Приоритет</th><th>Исполнитель</th><th>Дедлайн</th></tr></thead><tbody>
${report.tasks.map((t:any)=>`<tr><td>${t.title}</td><td>${STATUS[t.status]??t.status}</td><td>${PRIO[t.priority]??t.priority}</td><td>${t.assigneeName}</td><td>${t.dueDate?new Date(t.dueDate).toLocaleDateString('ru'):'—'}</td></tr>`).join('')}
</tbody></table></body></html>`;
    const win = window.open('','_blank');
    if (!win) return;
    win.document.write(html); win.document.close(); setTimeout(()=>win.print(),500);
  };

  const card: React.CSSProperties = { background:'white', borderRadius:'20px', padding:'20px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' };

  return (
    <div style={{ minHeight:'100vh', background:'#ECEAF8' }}>
      <div style={{ background:'white', padding:'16px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10, boxShadow:'0 4px 16px rgba(127,119,221,0.06)' }}>
        <div>
          <h1 style={{ fontSize:'18px', fontWeight:800, color:'#1a1040', margin:0 }}>Отчёты</h1>
          <p style={{ fontSize:'11px', color:'#9B97CC', margin:'2px 0 0' }}>Полный отчёт по сотрудникам и активности</p>
        </div>
        {report?.summary && (
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={downloadCSV} style={{ background:'#DCFCE7', color:'#16A34A', border:'none', borderRadius:'20px', padding:'9px 18px', fontSize:'13px', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}>
              <i className="ti ti-file-spreadsheet" style={{ fontSize:'15px' }} aria-hidden="true"/> Excel (CSV)
            </button>
            <button onClick={printPDF} style={{ background:'#EDE9FE', color:'#7F77DD', border:'none', borderRadius:'20px', padding:'9px 18px', fontSize:'13px', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}>
              <i className="ti ti-printer" style={{ fontSize:'15px' }} aria-hidden="true"/> PDF
            </button>
          </div>
        )}
      </div>

      <div style={{ padding:'20px 28px', maxWidth:'1000px', display:'flex', flexDirection:'column', gap:'16px' }}>
        {/* Period selector */}
        <div style={card}>
          <p style={{ fontSize:'14px', fontWeight:700, color:'#1a1040', margin:'0 0 14px' }}>Выберите период</p>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
            {[{l:'Сегодня',d:'1'},{l:'7 дней',d:'7'},{l:'14 дней',d:'14'},{l:'30 дней',d:'30'}].map(opt=>(
              <button key={opt.d} onClick={()=>generate(opt.d)} disabled={loading}
                style={{ padding:'10px 22px', borderRadius:'20px', border:'none', background:period===opt.d&&report?'linear-gradient(135deg,#7F77DD,#5248C5)':'#F8F7FF', color:period===opt.d&&report?'white':'#6B7280', fontSize:'13px', fontWeight:700, cursor:loading?'not-allowed':'pointer', opacity:loading?0.7:1, transition:'all 0.2s', boxShadow:period===opt.d&&report?'0 4px 12px rgba(127,119,221,0.3)':'none' }}>
                {loading&&period===opt.d?'Формирую...':opt.l}
              </button>
            ))}
          </div>
        </div>

        {!report&&!loading && (
          <div style={{ ...card, textAlign:'center', padding:'60px' }}>
            <div style={{ fontSize:'48px', marginBottom:'16px' }}>📋</div>
            <p style={{ fontSize:'16px', fontWeight:700, color:'#1a1040', margin:'0 0 6px' }}>Выберите период выше</p>
            <p style={{ fontSize:'13px', color:'#9B97CC' }}>Отчёт включает активность, задачи и разделы</p>
          </div>
        )}

        {report && (
          <>
            {/* KPI */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px' }}>
              {[
                { l:'Сотрудников', v:report.summary.totalEmployees, icon:'ti-users',  accent:'#7F77DD', accBg:'#EDE9FE', badge:'всего', badgeC:'#7F77DD', badgeBg:'#EDE9FE' },
                { l:'Кликов',      v:report.summary.totalClicks,    icon:'ti-mouse',  accent:'#2563EB', accBg:'#DBEAFE', badge:'+', badgeC:'#16A34A', badgeBg:'#DCFCE7' },
                { l:'Задач',       v:report.summary.totalTasks,     icon:'ti-checkbox',accent:'#D97706', accBg:'#FEF3C7', badge:'всего', badgeC:'#D97706', badgeBg:'#FEF3C7' },
                { l:'Выполнено',   v:report.summary.completedTasks, icon:'ti-circle-check', accent:'#16A34A', accBg:'#DCFCE7', badge:'✓', badgeC:'#16A34A', badgeBg:'#DCFCE7' },
              ].map((k,i)=>(
                <div key={i} style={{ ...card, position:'relative', overflow:'hidden' }}>
                  <div style={{ position:'absolute', top:'12px', right:'12px', fontSize:'10px', fontWeight:700, color:k.badgeC, background:k.badgeBg, padding:'2px 8px', borderRadius:'10px' }}>{k.badge}</div>
                  <div style={{ width:'36px', height:'36px', borderRadius:'12px', background:k.accBg, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'10px' }}>
                    <i className={'ti '+k.icon} style={{ fontSize:'18px', color:k.accent }} aria-hidden="true"/>
                  </div>
                  <p style={{ fontSize:'10px', color:'#9B97CC', margin:'0 0 3px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>{k.l}</p>
                  <p style={{ fontSize:'26px', fontWeight:800, color:'#1a1040', margin:0, letterSpacing:'-1px' }}>{k.v}</p>
                </div>
              ))}
            </div>

            {/* Employees table */}
            <div style={{ ...card, padding:0, overflow:'hidden' }}>
              <div style={{ padding:'14px 20px', borderBottom:'1px solid #F3F0FF', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                <p style={{ fontSize:'14px', fontWeight:700, color:'#1a1040', margin:0 }}>Сотрудники</p>
                <span style={{ fontSize:'11px', color:'#9B97CC' }}>{report.employees.length} записей</span>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#F8F7FF' }}>
                    {['Сотрудник','Роль','Кликов','В работе','Выполнено','Топ раздел','Время'].map(h=>(
                      <th key={h} style={{ padding:'10px 16px', fontSize:'10px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px', textAlign:h==='Сотрудник'?'left':'center', borderBottom:'1px solid #F3F0FF' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.employees.map((emp:any)=>{
                    const top = emp.sectionsFormatted?.[0];
                    return (
                      <tr key={emp.id}
                        onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#F8F7FF'}
                        onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                        <td style={{ padding:'12px 16px', borderBottom:'1px solid #F9F8FF' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                            <div style={{ width:'30px', height:'30px', borderRadius:'50%', background:avatarColor(emp.name), display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                              <span style={{ color:'white', fontSize:'11px', fontWeight:700 }}>{emp.name?.charAt(0)}</span>
                            </div>
                            <div>
                              <p style={{ fontSize:'13px', fontWeight:600, color:'#1a1040', margin:0 }}>{emp.name}</p>
                              <p style={{ fontSize:'10px', color:'#9B97CC', margin:0 }}>{emp.email}</p>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding:'12px 16px', borderBottom:'1px solid #F9F8FF', textAlign:'center' }}>
                          <span style={{ fontSize:'10px', fontWeight:700, color:'#7F77DD', background:'#EDE9FE', padding:'3px 9px', borderRadius:'20px' }}>{emp.role}</span>
                        </td>
                        <td style={{ padding:'12px 16px', borderBottom:'1px solid #F9F8FF', textAlign:'center', fontSize:'13px', fontWeight:700, color:'#7F77DD' }}>{emp.totalClicks}</td>
                        <td style={{ padding:'12px 16px', borderBottom:'1px solid #F9F8FF', textAlign:'center', fontSize:'13px', fontWeight:700, color:'#2563EB' }}>{emp.tasks.inProgress}</td>
                        <td style={{ padding:'12px 16px', borderBottom:'1px solid #F9F8FF', textAlign:'center', fontSize:'13px', fontWeight:700, color:'#16A34A' }}>{emp.tasks.done}</td>
                        <td style={{ padding:'12px 16px', borderBottom:'1px solid #F9F8FF', textAlign:'center' }}>
                          {top ? (
                            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'4px' }}>
                              <span style={{ fontSize:'9px', fontWeight:700, color:top.platform==='WILDBERRIES'?'#7F77DD':'#2563EB', background:top.platform==='WILDBERRIES'?'#EDE9FE':'#DBEAFE', padding:'1px 6px', borderRadius:'5px' }}>{top.platform==='WILDBERRIES'?'WB':'OZ'}</span>
                              <span style={{ fontSize:'12px', color:'#1a1040' }}>{top.label}</span>
                            </div>
                          ) : <span style={{ color:'#C4C0E8' }}>—</span>}
                        </td>
                        <td style={{ padding:'12px 16px', borderBottom:'1px solid #F9F8FF', textAlign:'center', fontSize:'12px', color:'#6B7280' }}>{top?fmtTime(top.timeSeconds):'—'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Sections table */}
            <div style={{ ...card, padding:0, overflow:'hidden' }}>
              <div style={{ padding:'14px 20px', borderBottom:'1px solid #F3F0FF' }}>
                <p style={{ fontSize:'14px', fontWeight:700, color:'#1a1040', margin:0 }}>Активность по разделам</p>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#F8F7FF' }}>
                    {['Сотрудник','Платформа','Раздел','Кликов','Время'].map(h=>(
                      <th key={h} style={{ padding:'10px 16px', fontSize:'10px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px', textAlign:h==='Сотрудник'?'left':'center', borderBottom:'1px solid #F3F0FF' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {report.employees.flatMap((emp:any)=>(emp.sectionsFormatted||[]).map((sec:any,i:number)=>(
                    <tr key={emp.id+i}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#F8F7FF'}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                      <td style={{ padding:'10px 16px', borderBottom:'1px solid #F9F8FF', fontSize:'13px', fontWeight:500, color:'#1a1040' }}>{emp.name}</td>
                      <td style={{ padding:'10px 16px', borderBottom:'1px solid #F9F8FF', textAlign:'center' }}>
                        <span style={{ fontSize:'9px', fontWeight:700, color:sec.platform==='WILDBERRIES'?'#7F77DD':'#2563EB', background:sec.platform==='WILDBERRIES'?'#EDE9FE':'#DBEAFE', padding:'2px 7px', borderRadius:'6px' }}>{sec.platform==='WILDBERRIES'?'WB':'OZ'}</span>
                      </td>
                      <td style={{ padding:'10px 16px', borderBottom:'1px solid #F9F8FF', textAlign:'center', fontSize:'12px', color:'#6B7280' }}>{sec.label}</td>
                      <td style={{ padding:'10px 16px', borderBottom:'1px solid #F9F8FF', textAlign:'center', fontSize:'13px', fontWeight:700, color:'#7F77DD' }}>{sec.clicks}</td>
                      <td style={{ padding:'10px 16px', borderBottom:'1px solid #F9F8FF', textAlign:'center', fontSize:'12px', color:'#6B7280' }}>{fmtTime(sec.timeSeconds)}</td>
                    </tr>
                  )))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
