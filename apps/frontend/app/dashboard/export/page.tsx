'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/usePermissions';

const REPORTS = [
  { id:'activity',     title:'Активность',     desc:'События, платформы, разделы', icon:'ti-activity',    permission:'canViewOrgAnalytics', hasPeriod:true },
  { id:'employees',    title:'Сотрудники',      desc:'Роли, статусы, задачи',       icon:'ti-users',       permission:'canViewAllEmployees', hasPeriod:false },
  { id:'tasks',        title:'Задачи',          desc:'Все задачи с исполнителями',   icon:'ti-checkbox',    permission:'canViewOrgAnalytics', hasPeriod:false },
  { id:'productivity', title:'Продуктивность',  desc:'Рейтинг и факторы команды',   icon:'ti-chart-radar', permission:'canViewOrgAnalytics', hasPeriod:true },
];

const PERIODS = [{ l:'Сегодня',v:'1' },{ l:'7 дней',v:'7' },{ l:'14 дней',v:'14' },{ l:'30 дней',v:'30' },{ l:'90 дней',v:'90' }];

const ICON_COLORS: Record<string,{c:string;bg:string}> = {
  'ti-activity':    { c:'#7F77DD', bg:'#EDE9FE' },
  'ti-users':       { c:'#2563EB', bg:'#DBEAFE' },
  'ti-checkbox':    { c:'#16A34A', bg:'#DCFCE7' },
  'ti-chart-radar': { c:'#D97706', bg:'#FEF3C7' },
};

export default function ExportPage() {
  const router = useRouter();
  const perms  = usePermissions();
  const [token, setToken]     = useState('');
  const [period, setPeriod]   = useState('7');
  const [loading, setLoading] = useState<string|null>(null);
  const [success, setSuccess] = useState<string|null>(null);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
  }, []);

  const download = async (id: string) => {
    setLoading(id); setSuccess(null);
    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/export/'+id+'?days='+period, { headers:{ Authorization:'Bearer '+token } });
      if (!res.ok) { alert('Ошибка '+res.status); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href=url; a.download=id+'-report.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      setSuccess(id); setTimeout(()=>setSuccess(null), 3000);
    } finally { setLoading(null); }
  };

  const card: React.CSSProperties = { background:'white', borderRadius:'20px', padding:'20px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' };

  return (
    <div style={{ minHeight:'100vh', background:'#ECEAF8' }}>
      <div style={{ background:'white', padding:'16px 28px', position:'sticky', top:0, zIndex:10, boxShadow:'0 4px 16px rgba(127,119,221,0.06)' }}>
        <h1 style={{ fontSize:'18px', fontWeight:800, color:'#1a1040', margin:0 }}>Экспорт</h1>
        <p style={{ fontSize:'11px', color:'#9B97CC', margin:'2px 0 0' }}>CSV для Excel или Google Sheets</p>
      </div>

      <div style={{ padding:'20px 28px', maxWidth:'720px', display:'flex', flexDirection:'column', gap:'16px' }}>
        {/* Period */}
        <div style={card}>
          <p style={{ fontSize:'14px', fontWeight:700, color:'#1a1040', margin:'0 0 14px' }}>Период отчёта</p>
          <div style={{ display:'flex', gap:'6px', flexWrap:'wrap' }}>
            {PERIODS.map(p=>(
              <button key={p.v} onClick={()=>setPeriod(p.v)}
                style={{ padding:'8px 18px', borderRadius:'20px', fontSize:'12px', fontWeight:700, cursor:'pointer', border:'none', background:period===p.v?'linear-gradient(135deg,#7F77DD,#5248C5)':'#F8F7FF', color:period===p.v?'white':'#6B7280', transition:'all 0.2s', boxShadow:period===p.v?'0 4px 10px rgba(127,119,221,0.3)':'none' }}>
                {p.l}
              </button>
            ))}
          </div>
        </div>

        {/* Reports grid */}
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
          {REPORTS.filter(r=>(perms as any)[r.permission]).map(report=>{
            const ic = ICON_COLORS[report.icon] ?? { c:'#7F77DD', bg:'#EDE9FE' };
            const isLoading = loading===report.id;
            const isSuccess = success===report.id;
            return (
              <div key={report.id} style={{ ...card, display:'flex', flexDirection:'column', gap:'14px', position:'relative', overflow:'hidden' }}>
                {/* Top accent */}
                <div style={{ position:'absolute', top:0, left:0, right:0, height:'3px', background:ic.c+'60' }}/>
                <div style={{ display:'flex', gap:'12px', alignItems:'flex-start', marginTop:'4px' }}>
                  <div style={{ width:'44px', height:'44px', borderRadius:'14px', background:ic.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <i className={'ti '+report.icon} style={{ fontSize:'22px', color:ic.c }} aria-hidden="true"/>
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:'14px', fontWeight:700, color:'#1a1040', margin:'0 0 3px' }}>{report.title}</p>
                    <p style={{ fontSize:'11px', color:'#9B97CC', margin:0, lineHeight:1.4 }}>{report.desc}</p>
                    {report.hasPeriod && (
                      <p style={{ fontSize:'10px', color:ic.c, margin:'4px 0 0', fontWeight:600 }}>
                        Период: {PERIODS.find(p=>p.v===period)?.l}
                      </p>
                    )}
                  </div>
                </div>
                <button onClick={()=>download(report.id)} disabled={isLoading}
                  style={{ width:'100%', padding:'10px', borderRadius:'12px', fontSize:'13px', fontWeight:700, cursor:isLoading?'not-allowed':'pointer', border:'none', background:isSuccess?'#DCFCE7':isLoading?'#F8F7FF':ic.bg, color:isSuccess?'#16A34A':isLoading?'#9B97CC':ic.c, transition:'all 0.2s', display:'flex', alignItems:'center', justifyContent:'center', gap:'6px' }}>
                  {isSuccess ? (
                    <><i className="ti ti-check" style={{ fontSize:'15px' }} aria-hidden="true"/> Скачано</>
                  ) : isLoading ? (
                    <><i className="ti ti-loader" style={{ fontSize:'15px' }} aria-hidden="true"/> Формирую...</>
                  ) : (
                    <><i className="ti ti-download" style={{ fontSize:'15px' }} aria-hidden="true"/> Скачать CSV</>
                  )}
                </button>
              </div>
            );
          })}
        </div>

        {/* Info */}
        <div style={{ background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'16px', padding:'16px 18px', display:'flex', gap:'12px', alignItems:'flex-start' }}>
          <div style={{ width:'36px', height:'36px', borderRadius:'10px', background:'#EDE9FE', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <i className="ti ti-info-circle" style={{ fontSize:'18px', color:'#7F77DD' }} aria-hidden="true"/>
          </div>
          <div>
            <p style={{ fontSize:'13px', fontWeight:700, color:'#1a1040', margin:'0 0 3px' }}>Как открыть в Excel</p>
            <p style={{ fontSize:'12px', color:'#9B97CC', margin:0, lineHeight:1.5 }}>
              Файл в кодировке UTF-8 с BOM — кириллица откроется корректно. При проблемах: Данные → Из текста/CSV → UTF-8.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
