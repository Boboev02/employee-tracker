'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/usePermissions';

const MONTHS_RU = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
const AVATAR_COLORS = ['#7F77DD','#2563EB','#16A34A','#D97706','#DC2626','#0891B2'];
const avatarColor = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0)??0) % AVATAR_COLORS.length];

function ProgressBar({ value, target, color }: { value: number; target: number; color: string }) {
  if (!target) return <span style={{ fontSize:'11px', color:'#C4C0E8' }}>не задан</span>;
  const pct = Math.min(100, Math.round(value / target * 100));
  const bg  = pct >= 100 ? '#16A34A' : pct >= 70 ? '#D97706' : '#DC2626';
  return (
    <div>
      <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'3px' }}>
        <span style={{ fontSize:'11px', fontWeight:700, color:bg }}>{pct}%</span>
        <span style={{ fontSize:'11px', color:'#9B97CC' }}>{value.toLocaleString('ru')} / {target.toLocaleString('ru')}</span>
      </div>
      <div style={{ height:'5px', background:'#F3F0FF', borderRadius:'3px', overflow:'hidden' }}>
        <div style={{ height:'5px', width:pct+'%', background:bg, borderRadius:'3px', transition:'width 0.5s' }}/>
      </div>
    </div>
  );
}

export default function KpiPage() {
  const router = useRouter();
  const perms  = usePermissions();
  const [kpis, setKpis]         = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [token, setToken]       = useState('');
  const [period, setPeriod]     = useState('');
  const [editing, setEditing]   = useState<string|null>(null);
  const [form, setForm]         = useState({ tasksTarget:0, clicksTarget:0, activeDaysTarget:0, notes:'' });
  const [saving, setSaving]     = useState(false);
  const [mounted, setMounted]   = useState(false);
  useEffect(()=>setMounted(true),[]);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    const now = new Date();
    const p = now.toISOString().slice(0,7);
    setPeriod(p);
    load(t, p);
  }, []);

  const load = async (t: string, p: string) => {
    setLoading(true);
    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/kpi?period='+p, { headers:{ Authorization:'Bearer '+t } });
      const data = await res.json();
      if (Array.isArray(data)) setKpis(data);
    } finally { setLoading(false); }
  };

  const openEdit = (kpi: any) => {
    setForm({ tasksTarget:kpi.tasksTarget, clicksTarget:kpi.clicksTarget, activeDaysTarget:kpi.activeDaysTarget, notes:kpi.notes||'' });
    setEditing(kpi.userId);
  };

  const saveKpi = async (userId: string) => {
    setSaving(true);
    try {
      await fetch('https://employee-tracker.ru/api/v1/kpi', {
        method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+token },
        body: JSON.stringify({ userId, period, ...form }),
      });
      setEditing(null); load(token, period);
    } finally { setSaving(false); }
  };

  const clearKpi = async (kpiId: string) => {
    if (!confirm('Очистить KPI цели?')) return;
    await fetch('https://employee-tracker.ru/api/v1/kpi/'+kpiId, { method:'DELETE', headers:{ Authorization:'Bearer '+token } });
    load(token, period);
  };

  const getPeriodLabel = (p: string) => {
    const [y, m] = p.split('-');
    return MONTHS_RU[parseInt(m)-1] + ' ' + y;
  };

  const prevPeriod = () => {
    const d = new Date(period+'-01'); d.setMonth(d.getMonth()-1);
    const p = d.toISOString().slice(0,7);
    setPeriod(p); load(token, p);
  };
  const nextPeriod = () => {
    const d = new Date(period+'-01'); d.setMonth(d.getMonth()+1);
    const now = new Date().toISOString().slice(0,7);
    if (d.toISOString().slice(0,7) > now) return;
    const p = d.toISOString().slice(0,7);
    setPeriod(p); load(token, p);
  };

  const totalTasks  = kpis.reduce((s,k)=>s+k.tasksDone,0);
  const totalClicks = kpis.reduce((s,k)=>s+k.clicksActual,0);
  const withKpi     = kpis.filter(k=>k.tasksTarget>0||k.clicksTarget>0).length;

  const card: React.CSSProperties = { background:'white', borderRadius:'20px', padding:'18px 20px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' };
  const inp:  React.CSSProperties = { width:'100%', background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'10px', padding:'8px 12px', fontSize:'13px', color:'#1a1040', outline:'none', boxSizing:'border-box' };

  return (
    <div style={{ minHeight:'100vh', background:'#ECEAF8' }}>
      {/* Header */}
      <div style={{ background:'white', padding:'16px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10, boxShadow:'0 4px 16px rgba(127,119,221,0.06)' }}>
        <div>
          <h1 style={{ fontSize:'18px', fontWeight:800, color:'#1a1040', margin:0 }}>KPI сотрудников</h1>
          <p style={{ fontSize:'11px', color:'#9B97CC', margin:'2px 0 0' }}>Цели и фактические результаты</p>
        </div>
        {/* Period switcher */}
        <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
          <button onClick={prevPeriod}
            style={{ width:'32px', height:'32px', borderRadius:'10px', background:'#F8F7FF', border:'1px solid #EDE9FE', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#7F77DD', fontSize:'16px' }}>
            ‹
          </button>
          <span style={{ fontSize:'14px', fontWeight:700, color:'#1a1040', minWidth:'140px', textAlign:'center' }}>{period ? getPeriodLabel(period) : ''}</span>
          <button onClick={nextPeriod}
            style={{ width:'32px', height:'32px', borderRadius:'10px', background:'#F8F7FF', border:'1px solid #EDE9FE', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', color:'#7F77DD', fontSize:'16px', opacity:period >= new Date().toISOString().slice(0,7)?0.3:1 }}>
            ›
          </button>
        </div>
      </div>

      <div style={{ padding:'20px 28px', display:'flex', flexDirection:'column', gap:'16px' }}>
        {/* KPI summary */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px' }}>
          {[
            { l:'Сотрудников', v:kpis.length, icon:'ti-users', accent:'#7F77DD', accBg:'#EDE9FE' },
            { l:'С целями',    v:withKpi,      icon:'ti-target', accent:'#2563EB', accBg:'#DBEAFE' },
            { l:'Задач выполнено', v:totalTasks.toLocaleString('ru'), icon:'ti-checkbox', accent:'#16A34A', accBg:'#DCFCE7' },
            { l:'Кликов',     v:totalClicks.toLocaleString('ru'), icon:'ti-mouse', accent:'#D97706', accBg:'#FEF3C7' },
          ].map((k,i)=>(
            <div key={i} style={{ ...card, display:'flex', alignItems:'center', gap:'12px' }}>
              <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:k.accBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className={'ti '+k.icon} style={{ fontSize:'20px', color:k.accent }} aria-hidden="true"/>
              </div>
              <div>
                <p style={{ fontSize:'20px', fontWeight:800, color:'#1a1040', margin:0, letterSpacing:'-0.5px' }}>{k.v}</p>
                <p style={{ fontSize:'10px', color:'#9B97CC', margin:0 }}>{k.l}</p>
              </div>
            </div>
          ))}
        </div>

        {/* KPI table */}
        <div style={{ ...card, padding:0, overflow:'hidden' }}>
          <div style={{ padding:'14px 20px', borderBottom:'1px solid #F3F0FF', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
            <p style={{ fontSize:'14px', fontWeight:700, color:'#1a1040', margin:0 }}>Показатели сотрудников</p>
            <span style={{ fontSize:'11px', color:'#9B97CC' }}>{kpis.length} сотрудников</span>
          </div>
          {loading ? (
            <div style={{ padding:'40px', textAlign:'center', color:'#9B97CC' }}>Загрузка...</div>
          ) : (
            <div>
              {kpis.map((kpi,i) => (
                <div key={kpi.userId}>
                  {/* Employee row */}
                  <div style={{ display:'grid', gridTemplateColumns:'220px 1fr 1fr 120px', gap:'16px', padding:'14px 20px', borderBottom:'1px solid #F9F8FF', alignItems:'center', transition:'background 0.1s' }}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#F8F7FF'}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                    {/* Name */}
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:avatarColor(kpi.name), display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <span style={{ color:'white', fontSize:'13px', fontWeight:700 }}>{kpi.name?.charAt(0)}</span>
                      </div>
                      <div>
                        <p style={{ fontSize:'13px', fontWeight:600, color:'#1a1040', margin:0 }}>{kpi.name}</p>
                        <p style={{ fontSize:'10px', color:'#9B97CC', margin:0 }}>{kpi.email}</p>
                      </div>
                    </div>
                    {/* Tasks KPI */}
                    <div>
                      <p style={{ fontSize:'10px', color:'#9B97CC', margin:'0 0 5px', fontWeight:600 }}>Задачи выполнено</p>
                      <ProgressBar value={kpi.tasksDone} target={kpi.tasksTarget} color="#16A34A"/>
                    </div>
                    {/* Clicks KPI */}
                    <div>
                      <p style={{ fontSize:'10px', color:'#9B97CC', margin:'0 0 5px', fontWeight:600 }}>Кликов (активность)</p>
                      <ProgressBar value={kpi.clicksActual} target={kpi.clicksTarget} color="#7F77DD"/>
                    </div>
                    {/* Actions */}
                    {mounted && perms.isAdmin && (
                      <div style={{ display:'flex', gap:'6px', justifyContent:'flex-end' }}>
                        <button onClick={()=>openEdit(kpi)}
                          style={{ padding:'6px 12px', borderRadius:'10px', background:'#EDE9FE', color:'#7F77DD', border:'none', fontSize:'11px', fontWeight:700, cursor:'pointer' }}>
                          {kpi.kpiId ? 'Изменить' : '+ Цели'}
                        </button>
                        {kpi.kpiId && (
                          <button onClick={()=>clearKpi(kpi.kpiId)}
                            style={{ width:'28px', height:'28px', borderRadius:'8px', background:'#FEE2E2', color:'#DC2626', border:'none', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <i className="ti ti-trash" style={{ fontSize:'13px' }} aria-hidden="true"/>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Edit form */}
                  {editing === kpi.userId && (
                    <div style={{ background:'#F8F7FF', borderBottom:'1px solid #EDE9FE', padding:'16px 20px' }}>
                      <p style={{ fontSize:'12px', fontWeight:700, color:'#7F77DD', margin:'0 0 12px' }}>
                        Цели для {kpi.name} — {getPeriodLabel(period)}
                      </p>
                      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr 1fr', gap:'10px', marginBottom:'10px' }}>
                        <div>
                          <label style={{ fontSize:'10px', color:'#9B97CC', display:'block', marginBottom:'5px', fontWeight:600, textTransform:'uppercase' }}>Задач (план)</label>
                          <input type="number" min="0" value={form.tasksTarget} onChange={e=>setForm({...form,tasksTarget:parseInt(e.target.value)||0})} style={inp}/>
                        </div>
                        <div>
                          <label style={{ fontSize:'10px', color:'#9B97CC', display:'block', marginBottom:'5px', fontWeight:600, textTransform:'uppercase' }}>Кликов (план)</label>
                          <input type="number" min="0" value={form.clicksTarget} onChange={e=>setForm({...form,clicksTarget:parseInt(e.target.value)||0})} style={inp}/>
                        </div>
                        <div>
                          <label style={{ fontSize:'10px', color:'#9B97CC', display:'block', marginBottom:'5px', fontWeight:600, textTransform:'uppercase' }}>Активных дней</label>
                          <input type="number" min="0" max="31" value={form.activeDaysTarget} onChange={e=>setForm({...form,activeDaysTarget:parseInt(e.target.value)||0})} style={inp}/>
                        </div>
                        <div>
                          <label style={{ fontSize:'10px', color:'#9B97CC', display:'block', marginBottom:'5px', fontWeight:600, textTransform:'uppercase' }}>Заметки</label>
                          <input value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})} placeholder="Необязательно" style={inp}/>
                        </div>
                      </div>
                      <div style={{ display:'flex', gap:'8px' }}>
                        <button onClick={()=>saveKpi(kpi.userId)} disabled={saving}
                          style={{ padding:'8px 20px', borderRadius:'10px', background:'linear-gradient(135deg,#7F77DD,#5248C5)', color:'white', border:'none', fontSize:'12px', fontWeight:700, cursor:'pointer' }}>
                          {saving?'Сохраняю...':'Сохранить →'}
                        </button>
                        <button onClick={()=>setEditing(null)}
                          style={{ padding:'8px 16px', borderRadius:'10px', background:'white', color:'#6B7280', border:'1px solid #EDE9FE', fontSize:'12px', cursor:'pointer' }}>
                          Отмена
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Help card */}
        {mounted && perms.isAdmin && (
          <div style={{ background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'16px', padding:'16px 18px', display:'flex', gap:'12px', alignItems:'flex-start' }}>
            <i className="ti ti-info-circle" style={{ fontSize:'18px', color:'#7F77DD', flexShrink:0, marginTop:'1px' }} aria-hidden="true"/>
            <div>
              <p style={{ fontSize:'13px', fontWeight:700, color:'#1a1040', margin:'0 0 4px' }}>Как работает KPI</p>
              <p style={{ fontSize:'12px', color:'#9B97CC', margin:0, lineHeight:1.6 }}>
                Нажмите <b style={{ color:'#7F77DD' }}>+ Цели</b> рядом с сотрудником чтобы задать плановые показатели на месяц.
                Фактические данные подтягиваются автоматически — задачи из канбана и клики из трекера.
                Используйте переключатель месяцев для просмотра истории.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
