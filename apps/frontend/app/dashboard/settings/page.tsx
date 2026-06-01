'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/usePermissions';

const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const HOURS = Array.from({length:24},(_,i)=>i.toString().padStart(2,'0')+':00');
const TIMEZONES = ['Europe/Moscow','Europe/Kaliningrad','Asia/Yekaterinburg','Asia/Omsk','Asia/Krasnoyarsk','Asia/Irkutsk','Asia/Yakutsk','Asia/Vladivostok'];

export default function SettingsPage() {
  const router = useRouter();
  const perms  = usePermissions();
  const [settings, setSettings] = useState<any>({ workDays:[1,2,3,4,5], startTime:'09:00', endTime:'18:00', timezone:'Europe/Moscow', lunchEnabled:true, lunchStart:'13:00', lunchEnd:'14:00' });
  const [saving, setSaving] = useState(false);
  const [saved,  setSaved]  = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    fetch('https://employee-tracker.ru/api/v1/settings/work-hours', { headers:{ Authorization:'Bearer '+t } })
      .then(r=>r.json()).then(d=>{ if(d&&!d.error) setSettings((prev:any)=>({...prev,...d})); });
  }, []);

  const save = async () => {
    const t = localStorage.getItem('access_token');
    if (!t) return;
    setSaving(true);
    await fetch('https://employee-tracker.ru/api/v1/settings/work-hours', {
      method:'PUT', headers:{ Authorization:'Bearer '+t, 'Content-Type':'application/json' },
      body: JSON.stringify(settings),
    });
    setSaving(false); setSaved(true); setTimeout(()=>setSaved(false), 2000);
  };

  const reset = async () => {
    if (!confirm('Удалить все данные активности? Это необратимо!')) return;
    const t = localStorage.getItem('access_token');
    if (!t) return;
    await fetch('https://employee-tracker.ru/api/v1/analytics/reset', { method:'POST', headers:{ Authorization:'Bearer '+t } });
    alert('Данные очищены');
  };

  const toggleDay = (d: number) => {
    const days = settings.workDays ?? [];
    setSettings({ ...settings, workDays: days.includes(d)?days.filter((x:number)=>x!==d):[...days,d].sort() });
  };

  const card: React.CSSProperties = { background:'white', borderRadius:'20px', padding:'20px 22px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' };
  const inp: React.CSSProperties = { background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'10px', padding:'9px 14px', fontSize:'13px', color:'#1a1040', outline:'none', transition:'border-color 0.15s' };
  const sel: React.CSSProperties = { ...inp, width:'100%' };

  return (
    <div style={{ minHeight:'100vh', background:'#ECEAF8' }}>
      {/* Header */}
      <div style={{ background:'white', padding:'16px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10, boxShadow:'0 4px 16px rgba(127,119,221,0.06)' }}>
        <div>
          <h1 style={{ fontSize:'18px', fontWeight:800, color:'#1a1040', margin:0 }}>Настройки</h1>
          <p style={{ fontSize:'11px', color:'#9B97CC', margin:'2px 0 0' }}>Параметры рабочего времени и системы</p>
        </div>
        {perms.isAdmin && (
          <button onClick={save} disabled={saving}
            style={{ background:saved?'linear-gradient(135deg,#16A34A,#15803D)':'linear-gradient(135deg,#7F77DD,#5248C5)', color:'white', border:'none', borderRadius:'20px', padding:'9px 22px', fontSize:'13px', fontWeight:700, cursor:'pointer', boxShadow:'0 4px 12px rgba(127,119,221,0.3)', transition:'all 0.3s' }}>
            {saved?'✓ Сохранено':saving?'Сохранение...':'Сохранить'}
          </button>
        )}
      </div>

      <div style={{ padding:'20px 28px', maxWidth:'720px', display:'flex', flexDirection:'column', gap:'14px' }}>
        {/* Timezone */}
        <div style={card}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
            <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:'#EDE9FE', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <i className="ti ti-world" style={{ fontSize:'20px', color:'#7F77DD' }} aria-hidden="true" />
            </div>
            <div>
              <h3 style={{ fontSize:'14px', fontWeight:700, color:'#1a1040', margin:0 }}>Часовой пояс</h3>
              <p style={{ fontSize:'11px', color:'#9B97CC', margin:0 }}>Влияет на расчёт рабочего времени</p>
            </div>
          </div>
          <select value={settings.timezone} onChange={e=>setSettings({...settings,timezone:e.target.value})} disabled={!perms.isAdmin} style={sel}>
            {TIMEZONES.map(tz=><option key={tz} value={tz}>{tz.replace('_',' ')}</option>)}
          </select>
        </div>

        {/* Work days */}
        <div style={card}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
            <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:'#EDE9FE', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <i className="ti ti-calendar" style={{ fontSize:'20px', color:'#7F77DD' }} aria-hidden="true" />
            </div>
            <div>
              <h3 style={{ fontSize:'14px', fontWeight:700, color:'#1a1040', margin:0 }}>Рабочие дни</h3>
              <p style={{ fontSize:'11px', color:'#9B97CC', margin:0 }}>Нажмите на день чтобы включить/выключить</p>
            </div>
          </div>
          <div style={{ display:'flex', gap:'8px' }}>
            {DAYS.map((d,i)=>{
              const n = i+1;
              const active = (settings.workDays??[]).includes(n);
              return (
                <button key={n} onClick={()=>perms.isAdmin&&toggleDay(n)}
                  style={{ flex:1, padding:'10px 0', borderRadius:'12px', border:'none', fontWeight:700, fontSize:'13px', cursor:perms.isAdmin?'pointer':'default', background:active?'linear-gradient(135deg,#7F77DD,#5248C5)':'#F8F7FF', color:active?'white':'#9B97CC', boxShadow:active?'0 4px 10px rgba(127,119,221,0.3)':'none', transition:'all 0.2s' }}>
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        {/* Work hours */}
        <div style={card}>
          <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'16px' }}>
            <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:'#EDE9FE', display:'flex', alignItems:'center', justifyContent:'center' }}>
              <i className="ti ti-clock" style={{ fontSize:'20px', color:'#7F77DD' }} aria-hidden="true" />
            </div>
            <div>
              <h3 style={{ fontSize:'14px', fontWeight:700, color:'#1a1040', margin:0 }}>Рабочие часы</h3>
              <p style={{ fontSize:'11px', color:'#9B97CC', margin:0 }}>Начало и конец рабочего дня</p>
            </div>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:'10px', alignItems:'center' }}>
            <div>
              <label style={{ fontSize:'10px', color:'#9B97CC', display:'block', marginBottom:'6px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px' }}>Начало</label>
              <select value={settings.startTime} onChange={e=>setSettings({...settings,startTime:e.target.value})} disabled={!perms.isAdmin} style={sel}>
                {HOURS.map(h=><option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div style={{ color:'#9B97CC', fontWeight:700, marginTop:'20px', fontSize:'16px' }}>—</div>
            <div>
              <label style={{ fontSize:'10px', color:'#9B97CC', display:'block', marginBottom:'6px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px' }}>Конец</label>
              <select value={settings.endTime} onChange={e=>setSettings({...settings,endTime:e.target.value})} disabled={!perms.isAdmin} style={sel}>
                {HOURS.map(h=><option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Lunch */}
        <div style={card}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:settings.lunchEnabled?'16px':'0' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
              <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:'#DCFCE7', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <i className="ti ti-coffee" style={{ fontSize:'20px', color:'#16A34A' }} aria-hidden="true" />
              </div>
              <div>
                <h3 style={{ fontSize:'14px', fontWeight:700, color:'#1a1040', margin:0 }}>Обеденный перерыв</h3>
                <p style={{ fontSize:'11px', color:'#9B97CC', margin:0 }}>Не учитывается в рабочем времени</p>
              </div>
            </div>
            <div onClick={()=>perms.isAdmin&&setSettings({...settings,lunchEnabled:!settings.lunchEnabled})}
              style={{ width:'48px', height:'26px', borderRadius:'13px', background:settings.lunchEnabled?'#7F77DD':'#E5E7EB', position:'relative', cursor:perms.isAdmin?'pointer':'default', transition:'background 0.2s', flexShrink:0 }}>
              <div style={{ position:'absolute', top:'3px', left:settings.lunchEnabled?'25px':'3px', width:'20px', height:'20px', borderRadius:'50%', background:'white', transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }} />
            </div>
          </div>
          {settings.lunchEnabled && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:'10px', alignItems:'center' }}>
              <select value={settings.lunchStart} onChange={e=>setSettings({...settings,lunchStart:e.target.value})} disabled={!perms.isAdmin} style={sel}>
                {HOURS.map(h=><option key={h} value={h}>{h}</option>)}
              </select>
              <span style={{ color:'#9B97CC', fontWeight:700, fontSize:'16px' }}>—</span>
              <select value={settings.lunchEnd} onChange={e=>setSettings({...settings,lunchEnd:e.target.value})} disabled={!perms.isAdmin} style={sel}>
                {HOURS.map(h=><option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Summary */}
        <div style={{ ...card, background:'#F8F7FF', border:'1px solid #EDE9FE' }}>
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <i className="ti ti-info-circle" style={{ fontSize:'16px', color:'#7F77DD' }} aria-hidden="true" />
            <p style={{ fontSize:'12px', color:'#6B7280', margin:0 }}>
              <strong style={{ color:'#1a1040' }}>{(settings.workDays??[]).map((d:number)=>DAYS[d-1]).join(', ')}</strong>
              {' · '}{settings.startTime} — {settings.endTime}
              {settings.lunchEnabled && ` · Обед ${settings.lunchStart}–${settings.lunchEnd}`}
            </p>
          </div>
        </div>

        {/* Danger */}
        {perms.isAdmin && (
          <div style={{ ...card, background:'#FFF5F5', border:'1px solid #FED7D7' }}>
            <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'10px' }}>
              <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:'#FEE2E2', display:'flex', alignItems:'center', justifyContent:'center' }}>
                <i className="ti ti-alert-triangle" style={{ fontSize:'20px', color:'#DC2626' }} aria-hidden="true" />
              </div>
              <div>
                <h3 style={{ fontSize:'14px', fontWeight:700, color:'#991B1B', margin:0 }}>Опасная зона</h3>
                <p style={{ fontSize:'11px', color:'#EF4444', margin:0 }}>Необратимые действия</p>
              </div>
            </div>
            <p style={{ fontSize:'12px', color:'#EF4444', margin:'0 0 14px' }}>Удаляет все данные активности, аналитику и статистику. Используется только для тестирования.</p>
            <button onClick={reset} style={{ background:'#DC2626', color:'white', border:'none', borderRadius:'12px', padding:'10px 20px', fontSize:'13px', fontWeight:700, cursor:'pointer' }}>
              🗑 Очистить все данные
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
