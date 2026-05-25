'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

function fmtTime(sec: number) {
  if (!sec || sec <= 0) return '—';
  if (sec < 60) return sec + 'с';
  if (sec < 3600) return Math.floor(sec/60) + 'м';
  return Math.floor(sec/3600) + 'ч ' + Math.floor((sec%3600)/60) + 'м';
}

export default function ReportsPage() {
  const router = useRouter();
  const [token, setToken]   = useState('');
  const [report, setReport] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [period, setPeriod] = useState('7');

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
  }, []);

  const generate = async (days: string) => {
    setLoading(true); setPeriod(days);
    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/analytics/full-report?days=' + days, {
        headers: { Authorization: 'Bearer ' + token },
      });
      setReport(await res.json());
    } finally { setLoading(false); }
  };

  const downloadCSV = () => {
    if (!report) return;
    const BOM = '\uFEFF';
    const rows: any[][] = [
      ['ОТЧЁТ ПО СОТРУДНИКАМ'],
      ['Период:', report.period.days + ' дней', 'Сформирован:', new Date(report.generatedAt).toLocaleString('ru')],
      [],
      ['СВОДКА'],
      ['Сотрудников', report.summary.totalEmployees, 'Кликов', report.summary.totalClicks],
      ['Задач', report.summary.totalTasks, 'Выполнено', report.summary.completedTasks],
      [],
      ['СОТРУДНИКИ'],
      ['Имя', 'Email', 'Роль', 'Кликов', 'В работе', 'Выполнено', 'Топ раздел', 'Время'],
      ...report.employees.map((e: any) => {
        const top = e.sectionsFormatted?.[0];
        return [e.name, e.email, e.role, e.totalClicks, e.tasks.inProgress, e.tasks.done,
          top ? (top.platform==='WILDBERRIES'?'WB ':'OZ ') + top.label : '—',
          top ? fmtTime(top.timeSeconds) : '—'];
      }),
      [],
      ['АКТИВНОСТЬ ПО РАЗДЕЛАМ'],
      ['Сотрудник', 'Платформа', 'Раздел', 'Кликов', 'Время'],
      ...report.employees.flatMap((e: any) =>
        (e.sectionsFormatted||[]).map((s: any) => [e.name, s.platform==='WILDBERRIES'?'Wildberries':'Ozon', s.label, s.clicks, fmtTime(s.timeSeconds)])
      ),
      [],
      ['ЗАДАЧИ'],
      ['Название', 'Статус', 'Приоритет', 'Исполнитель', 'Дедлайн'],
      ...report.tasks.map((t: any) => [t.title, t.status, t.priority, t.assigneeName, t.dueDate ? new Date(t.dueDate).toLocaleDateString('ru') : '—']),
    ];
    const csv = BOM + rows.map(r => r.map(c => '"' + String(c??'').replace(/"/g,'""') + '"').join(';')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url;
    a.download = 'report-' + report.period.days + 'd-' + new Date().toISOString().slice(0,10) + '.csv';
    document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
  };

  const printPDF = () => {
    if (!report) return;
    const STATUS: Record<string,string> = { NEW:'Новая', IN_PROGRESS:'В работе', REVIEW:'Проверка', DONE:'Готово', BLOCKED:'Заблок.' };
    const PRIO: Record<string,string>   = { LOW:'Низкий', MEDIUM:'Средний', HIGH:'Высокий', CRITICAL:'Критич.' };
    const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="UTF-8">
<style>body{font-family:Arial,sans-serif;font-size:12px;padding:20px}h1{font-size:18px;margin:0 0 4px}h2{font-size:13px;margin:20px 0 8px;border-bottom:1px solid #e4e4e7;padding-bottom:4px}.meta{font-size:11px;color:#71717a;margin-bottom:16px}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:8px}.kpi{background:#f4f4f5;border-radius:6px;padding:10px}.kpi-v{font-size:20px;font-weight:700}.kpi-l{font-size:10px;color:#71717a;text-transform:uppercase}table{width:100%;border-collapse:collapse;margin-bottom:8px}th{background:#f4f4f5;padding:7px 10px;text-align:left;font-size:10px;font-weight:600;color:#71717a;text-transform:uppercase;border-bottom:1px solid #e4e4e7}td{padding:7px 10px;border-bottom:1px solid #f4f4f5;font-size:11px}.badge{display:inline-block;padding:2px 6px;border-radius:8px;font-size:10px;font-weight:600}.wb{background:rgba(139,124,246,.12);color:#8b7cf6}.oz{background:rgba(77,157,224,.12);color:#4d9de0}</style>
</head><body>
<h1>Отчёт по сотрудникам</h1>
<div class="meta">Период: ${report.period.days} дней &nbsp;|&nbsp; ${new Date(report.generatedAt).toLocaleString('ru')}</div>
<div class="grid">
  <div class="kpi"><div class="kpi-v">${report.summary.totalEmployees}</div><div class="kpi-l">Сотрудников</div></div>
  <div class="kpi"><div class="kpi-v" style="color:#8b7cf6">${report.summary.totalClicks}</div><div class="kpi-l">Кликов</div></div>
  <div class="kpi"><div class="kpi-v">${report.summary.totalTasks}</div><div class="kpi-l">Задач</div></div>
  <div class="kpi"><div class="kpi-v" style="color:#22c55e">${report.summary.completedTasks}</div><div class="kpi-l">Выполнено</div></div>
</div>
<h2>Сотрудники</h2>
<table><thead><tr><th>Имя</th><th>Роль</th><th>Кликов</th><th>В работе</th><th>Выполнено</th><th>Топ раздел</th></tr></thead><tbody>
${report.employees.map((e: any) => { const top = e.sectionsFormatted?.[0]; return `<tr><td><b>${e.name}</b><br><span style="color:#71717a;font-size:10px">${e.email}</span></td><td>${e.role}</td><td style="color:#8b7cf6;font-weight:600">${e.totalClicks}</td><td style="color:#378add">${e.tasks.inProgress}</td><td style="color:#22c55e">${e.tasks.done}</td><td>${top?`<span class="badge ${top.platform==='WILDBERRIES'?'wb':'oz'}">${top.platform==='WILDBERRIES'?'WB':'OZ'}</span> ${top.label}`:'—'}</td></tr>`; }).join('')}
</tbody></table>
<h2>Активность по разделам</h2>
<table><thead><tr><th>Сотрудник</th><th>Платформа</th><th>Раздел</th><th>Кликов</th><th>Время</th></tr></thead><tbody>
${report.employees.flatMap((e: any) => (e.sectionsFormatted||[]).map((s: any) => `<tr><td>${e.name}</td><td><span class="badge ${s.platform==='WILDBERRIES'?'wb':'oz'}">${s.platform==='WILDBERRIES'?'Wildberries':'Ozon'}</span></td><td>${s.label}</td><td style="color:#8b7cf6;font-weight:600">${s.clicks}</td><td>${fmtTime(s.timeSeconds)}</td></tr>`)).join('')}
</tbody></table>
<h2>Задачи</h2>
<table><thead><tr><th>Название</th><th>Статус</th><th>Приоритет</th><th>Исполнитель</th><th>Дедлайн</th></tr></thead><tbody>
${report.tasks.map((t: any) => `<tr><td>${t.title}</td><td>${STATUS[t.status]??t.status}</td><td>${PRIO[t.priority]??t.priority}</td><td>${t.assigneeName}</td><td>${t.dueDate?new Date(t.dueDate).toLocaleDateString('ru'):'—'}</td></tr>`).join('')}
</tbody></table>
</body></html>`;
    const win = window.open('','_blank');
    if (!win) return;
    win.document.write(html); win.document.close();
    setTimeout(() => win.print(), 500);
  };

  const card: React.CSSProperties = { background:'var(--bg-primary)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', padding:'20px' };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-tertiary)' }}>
      <div style={{ background:'var(--bg-primary)', borderBottom:'0.5px solid var(--border)', padding:'14px 24px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10 }}>
        <div>
          <h1 style={{ fontSize:'16px', fontWeight:600, color:'var(--text-primary)', margin:0 }}>Отчёты</h1>
          <p style={{ fontSize:'12px', color:'var(--text-muted)', margin:'2px 0 0' }}>Полный отчёт по сотрудникам и активности</p>
        </div>
        {report && report.summary && (
          <div style={{ display:'flex', gap:'8px' }}>
            <button onClick={downloadCSV} style={{ background:'var(--green-bg)', color:'var(--green)', border:'none', padding:'8px 16px', borderRadius:'8px', fontSize:'13px', fontWeight:500, cursor:'pointer' }}>↓ Excel (CSV)</button>
            <button onClick={printPDF}   style={{ background:'var(--accent-bg)', color:'var(--accent)', border:'none', padding:'8px 16px', borderRadius:'8px', fontSize:'13px', fontWeight:500, cursor:'pointer' }}>🖨 PDF</button>
          </div>
        )}
      </div>

      <div style={{ padding:'24px', maxWidth:'1000px', display:'flex', flexDirection:'column', gap:'16px' }}>
        <div style={card}>
          <p style={{ fontSize:'13px', fontWeight:500, color:'var(--text-primary)', margin:'0 0 14px' }}>Выберите период</p>
          <div style={{ display:'flex', gap:'10px', flexWrap:'wrap' }}>
            {[{l:'За сегодня',d:'1'},{l:'За 7 дней',d:'7'},{l:'За 14 дней',d:'14'},{l:'За 30 дней',d:'30'}].map(opt => (
              <button key={opt.d} onClick={() => generate(opt.d)} disabled={loading}
                style={{ padding:'10px 20px', borderRadius:'10px', border:'0.5px solid var(--border)', background: period===opt.d&&report?'var(--accent-bg)':'var(--bg-secondary)', color: period===opt.d&&report?'var(--accent)':'var(--text-primary)', fontSize:'13px', fontWeight:500, cursor:loading?'not-allowed':'pointer', opacity:loading?0.7:1 }}>
                {loading&&period===opt.d?'Формирую...':opt.l}
              </button>
            ))}
          </div>
        </div>

        {!report && !loading && (
          <div style={{ ...card, textAlign:'center', padding:'48px' }}>
            <p style={{ fontSize:'36px', marginBottom:'12px' }}>📋</p>
            <p style={{ fontSize:'15px', fontWeight:500, color:'var(--text-primary)', marginBottom:'6px' }}>Выберите период выше</p>
            <p style={{ fontSize:'13px', color:'var(--text-muted)' }}>Отчёт включает активность по разделам, задачи и время</p>
          </div>
        )}

        {report && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px' }}>
              {[{l:'Сотрудников',v:report.summary.totalEmployees,c:'var(--text-primary)'},{l:'Кликов',v:report.summary.totalClicks,c:'var(--accent)'},{l:'Задач',v:report.summary.totalTasks,c:'var(--blue)'},{l:'Выполнено',v:report.summary.completedTasks,c:'var(--green)'}].map(k => (
                <div key={k.l} style={card}>
                  <p style={{ fontSize:'11px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', margin:'0 0 6px' }}>{k.l}</p>
                  <p style={{ fontSize:'24px', fontWeight:600, color:k.c, margin:0 }}>{k.v}</p>
                </div>
              ))}
            </div>

            <div style={{ ...card, padding:0, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)', background:'var(--bg-secondary)' }}>
                <p style={{ fontSize:'12px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', margin:0 }}>Сотрудники</p>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['Сотрудник','Роль','Кликов','В работе','Выполнено','Топ раздел','Время'].map(h => <th key={h} style={{ padding:'10px 16px', fontSize:'11px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', background:'var(--bg-secondary)', borderBottom:'0.5px solid var(--border)', textAlign:h==='Сотрудник'?'left':'center' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {report.employees.map((emp: any) => {
                    const top = emp.sectionsFormatted?.[0];
                    return <tr key={emp.id} onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--bg-secondary)'} onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                      <td style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)' }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                          <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center' }}><span style={{ color:'white', fontSize:'11px', fontWeight:600 }}>{emp.name.charAt(0)}</span></div>
                          <div><p style={{ fontSize:'13px', fontWeight:500, color:'var(--text-primary)', margin:0 }}>{emp.name}</p><p style={{ fontSize:'11px', color:'var(--text-muted)', margin:0 }}>{emp.email}</p></div>
                        </div>
                      </td>
                      <td style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center' }}><span style={{ fontSize:'11px', padding:'3px 8px', borderRadius:'12px', background:'var(--accent-bg)', color:'var(--accent)' }}>{emp.role}</span></td>
                      <td style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center', fontSize:'13px', fontWeight:600, color:'var(--accent)' }}>{emp.totalClicks}</td>
                      <td style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center', fontSize:'13px', color:'var(--blue)' }}>{emp.tasks.inProgress}</td>
                      <td style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center', fontSize:'13px', color:'var(--green)' }}>{emp.tasks.done}</td>
                      <td style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center', fontSize:'12px' }}>
                        {top ? <span style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:'4px' }}><span style={{ fontSize:'10px', fontWeight:600, padding:'2px 5px', borderRadius:'4px', background:top.platform==='WILDBERRIES'?'rgba(139,124,246,0.12)':'rgba(77,157,224,0.12)', color:top.platform==='WILDBERRIES'?'#8b7cf6':'#4d9de0' }}>{top.platform==='WILDBERRIES'?'WB':'OZ'}</span>{top.label}</span> : <span style={{ color:'var(--text-muted)' }}>—</span>}
                      </td>
                      <td style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center', fontSize:'13px', color:'var(--text-secondary)' }}>{top?fmtTime(top.timeSeconds):'—'}</td>
                    </tr>;
                  })}
                </tbody>
              </table>
            </div>

            <div style={{ ...card, padding:0, overflow:'hidden' }}>
              <div style={{ padding:'12px 16px', borderBottom:'0.5px solid var(--border)', background:'var(--bg-secondary)' }}>
                <p style={{ fontSize:'12px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', margin:0 }}>Активность по разделам</p>
              </div>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead><tr>{['Сотрудник','Платформа','Раздел','Кликов','Время'].map(h => <th key={h} style={{ padding:'10px 16px', fontSize:'11px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', background:'var(--bg-secondary)', borderBottom:'0.5px solid var(--border)', textAlign:h==='Сотрудник'?'left':'center' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {report.employees.flatMap((emp: any) => (emp.sectionsFormatted||[]).map((sec: any, i: number) => (
                    <tr key={emp.id+i} onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--bg-secondary)'} onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                      <td style={{ padding:'10px 16px', borderBottom:'0.5px solid var(--border)', fontSize:'13px', fontWeight:500, color:'var(--text-primary)' }}>{emp.name}</td>
                      <td style={{ padding:'10px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center' }}><span style={{ fontSize:'10px', fontWeight:600, padding:'2px 6px', borderRadius:'4px', background:sec.platform==='WILDBERRIES'?'rgba(139,124,246,0.12)':'rgba(77,157,224,0.12)', color:sec.platform==='WILDBERRIES'?'#8b7cf6':'#4d9de0' }}>{sec.platform==='WILDBERRIES'?'Wildberries':'Ozon'}</span></td>
                      <td style={{ padding:'10px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center', fontSize:'13px', color:'var(--text-secondary)' }}>{sec.label}</td>
                      <td style={{ padding:'10px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center', fontSize:'13px', fontWeight:600, color:'var(--accent)' }}>{sec.clicks}</td>
                      <td style={{ padding:'10px 16px', borderBottom:'0.5px solid var(--border)', textAlign:'center', fontSize:'13px', color:'var(--text-secondary)' }}>{fmtTime(sec.timeSeconds)}</td>
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
