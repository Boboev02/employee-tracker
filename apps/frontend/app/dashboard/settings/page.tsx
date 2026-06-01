'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/usePermissions';

const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const HOURS = Array.from({length:24},(_,i)=>i.toString().padStart(2,'0')+':00');
const TIMEZONES = ['Europe/Moscow','Europe/Kaliningrad','Asia/Yekaterinburg','Asia/Omsk','Asia/Krasnoyarsk','Asia/Irkutsk','Asia/Yakutsk','Asia/Vladivostok'];

export default function SettingsPage() {
  const router = useRouter();
  const perms = usePermissions();
  const [settings, setSettings] = useState<any>({ workDays:[1,2,3,4,5], startTime:'09:00', endTime:'18:00', timezone:'Europe/Moscow', lunchEnabled:true, lunchStart:'13:00', lunchEnd:'14:00' });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    fetch('https://employee-tracker.ru/api/v1/settings/work-hours', { headers:{ Authorization:'Bearer '+t } })
      .then(r=>r.json()).then(d=>{ if (d && !d.error) setSettings({...settings,...d}); });
  }, []);

  const save = async () => {
    const t = localStorage.getItem('access_token');
    if (!t) return;
    setSaving(true);
    await fetch('https://employee-tracker.ru/api/v1/settings/work-hours', {
      method:'PUT', headers:{ Authorization:'Bearer '+t, 'Content-Type':'application/json' },
      body: JSON.stringify(settings),
    });
    setSaving(false); setSaved(true);
    setTimeout(()=>setSaved(false), 2000);
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
    setSettings({ ...settings, workDays: days.includes(d) ? days.filter((x:number)=>x!==d) : [...days,d].sort() });
  };

  const inp: React.CSSProperties = { background:'#F5F3FC', border:'1.5px solid #E0DDF0', borderRadius:'9px', padding:'9px 14px', fontSize:'13px', color:'#1a1a2e', outline:'none' };
  const card: React.CSSProperties = { background:'#fff', borderRadius:'14px', padding:'22px 24px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', border:'1px solid #eee', marginBottom:'16px' };

  return (
    <div style={{ minHeight:'100vh', background:'#EBE8F6' }}>
      <div style={{ background:'#fff', borderBottom:'1px solid #eee', padding:'16px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10, boxShadow:'0 2px 8px rgba(108,92,231,0.06)' }}>
        <div>
          <h1 style={{ fontSize:'18px', fontWeight:700, color:'#1a1a2e', margin:0 }}>Настройки</h1>
          <p style={{ fontSize:'12px', color:'#aaa', margin:'2px 0 0' }}>Параметры рабочего времени и системы</p>
        </div>
        {perms.isAdmin && (
          <button onClick={save} disabled={saving}
            style={{ background:saved?'#43A047':'#6C5CE7', color:'white', border:'none', borderRadius:'9px', padding:'9px 20px', fontSize:'13px', fontWeight:600, cursor:'pointer', transition:'background 0.3s', boxShadow:'0 4px 12px rgba(108,92,231,0.3)' }}>
            {saved ? '✓ Сохранено' : saving ? 'Сохранение...' : 'Сохранить'}
          </button>
        )}
      </div>

      <div style={{ padding:'24px 28px', maxWidth:'700px' }}>
        {/* Timezone */}
        <div style={card}>
          <h3 style={{ fontSize:'14px', fontWeight:700, color:'#1a1a2e', margin:'0 0 16px', display:'flex', alignItems:'center', gap:'8px' }}>
            <span style={{ width:'28px', height:'28px', background:'#EDE9FF', borderRadius:'7px', display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
              <i className="ti ti-world" style={{ fontSize:'14px', color:'#6C5CE7' }} aria-hidden="true" />
            </span>
            Часовой пояс
          </h3>
          <select value={settings.timezone} onChange={e=>setSettings({...settings,timezone:e.target.value})} disabled={!perms.isAdmin} style={{ ...inp, width:'100%' }}>
            {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz.replace('_',' ')}</option>)}
          </select>
        </div>

        {/* Work days */}
        <div style={card}>
          <h3 style={{ fontSize:'14px', fontWeight:700, color:'#1a1a2e', margin:'0 0 16px', display:'flex', alignItems:'center', gap:'8px' }}>
            <span style={{ width:'28px', height:'28px', background:'#EDE9FF', borderRadius:'7px', display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
              <i className="ti ti-calendar" style={{ fontSize:'14px', color:'#6C5CE7' }} aria-hidden="true" />
            </span>
            Рабочие дни
          </h3>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
            {DAYS.map((d,i) => {
              const n = i+1;
              const active = (settings.workDays??[]).includes(n);
              return (
                <button key={n} onClick={()=>perms.isAdmin&&toggleDay(n)}
                  style={{ width:'44px', height:'44px', borderRadius:'10px', border:'none', cursor:perms.isAdmin?'pointer':'default', fontWeight:600, fontSize:'13px', background:active?'#6C5CE7':'#F5F3FC', color:active?'white':'#888', transition:'all 0.15s', boxShadow:active?'0 4px 10px rgba(108,92,231,0.3)':'none' }}>
                  {d}
                </button>
              );
            })}
          </div>
        </div>

        {/* Work hours */}
        <div style={card}>
          <h3 style={{ fontSize:'14px', fontWeight:700, color:'#1a1a2e', margin:'0 0 16px', display:'flex', alignItems:'center', gap:'8px' }}>
            <span style={{ width:'28px', height:'28px', background:'#EDE9FF', borderRadius:'7px', display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
              <i className="ti ti-clock" style={{ fontSize:'14px', color:'#6C5CE7' }} aria-hidden="true" />
            </span>
            Рабочие часы
          </h3>
          <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:'10px', alignItems:'center' }}>
            <div>
              <label style={{ fontSize:'11px', color:'#aaa', display:'block', marginBottom:'6px', fontWeight:600, letterSpacing:'0.3px' }}>НАЧАЛО</label>
              <select value={settings.startTime} onChange={e=>setSettings({...settings,startTime:e.target.value})} disabled={!perms.isAdmin} style={{ ...inp, width:'100%' }}>
                {HOURS.map(h=><option key={h} value={h}>{h}</option>)}
              </select>
            </div>
            <div style={{ color:'#aaa', fontWeight:600, marginTop:'20px' }}>—</div>
            <div>
              <label style={{ fontSize:'11px', color:'#aaa', display:'block', marginBottom:'6px', fontWeight:600, letterSpacing:'0.3px' }}>КОНЕЦ</label>
              <select value={settings.endTime} onChange={e=>setSettings({...settings,endTime:e.target.value})} disabled={!perms.isAdmin} style={{ ...inp, width:'100%' }}>
                {HOURS.map(h=><option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          </div>
        </div>

        {/* Lunch */}
        <div style={card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom: settings.lunchEnabled?'16px':'0' }}>
            <h3 style={{ fontSize:'14px', fontWeight:700, color:'#1a1a2e', margin:0, display:'flex', alignItems:'center', gap:'8px' }}>
              <span style={{ width:'28px', height:'28px', background:'#EDE9FF', borderRadius:'7px', display:'inline-flex', alignItems:'center', justifyContent:'center' }}>
                <i className="ti ti-coffee" style={{ fontSize:'14px', color:'#6C5CE7' }} aria-hidden="true" />
              </span>
              Обеденный перерыв
            </h3>
            <div onClick={()=>perms.isAdmin&&setSettings({...settings,lunchEnabled:!settings.lunchEnabled})}
              style={{ width:'44px', height:'24px', borderRadius:'12px', background:settings.lunchEnabled?'#6C5CE7':'#E0E0E0', position:'relative', cursor:perms.isAdmin?'pointer':'default', transition:'background 0.2s' }}>
              <div style={{ position:'absolute', top:'3px', left:settings.lunchEnabled?'23px':'3px', width:'18px', height:'18px', borderRadius:'50%', background:'white', transition:'left 0.2s', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }} />
            </div>
          </div>
          {settings.lunchEnabled && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr auto 1fr', gap:'10px', alignItems:'center' }}>
              <select value={settings.lunchStart} onChange={e=>setSettings({...settings,lunchStart:e.target.value})} disabled={!perms.isAdmin} style={{ ...inp, width:'100%' }}>
                {HOURS.map(h=><option key={h} value={h}>{h}</option>)}
              </select>
              <span style={{ color:'#aaa', fontWeight:600 }}>—</span>
              <select value={settings.lunchEnd} onChange={e=>setSettings({...settings,lunchEnd:e.target.value})} disabled={!perms.isAdmin} style={{ ...inp, width:'100%' }}>
                {HOURS.map(h=><option key={h} value={h}>{h}</option>)}
              </select>
            </div>
          )}
        </div>

        {/* Summary */}
        <div style={{ ...card, background:'#F5F3FC', border:'1px solid #E0DDF0' }}>
          <p style={{ fontSize:'12px', color:'#888', margin:0, fontWeight:500 }}>
            <i className="ti ti-info-circle" style={{ marginRight:'6px', color:'#6C5CE7' }} aria-hidden="true" />
            {(settings.workDays??[]).map((d:number)=>DAYS[d-1]).join(', ')} · {settings.startTime} — {settings.endTime} {settings.lunchEnabled?`· Обед ${settings.lunchStart}–${settings.lunchEnd}`:''}
          </p>
        </div>

        {/* Danger zone */}
        {perms.isAdmin && (
          <div style={{ ...card, border:'1px solid rgba(229,57,53,0.2)', background:'#FFEBEE' }}>
            <h3 style={{ fontSize:'14px', fontWeight:700, color:'#C62828', margin:'0 0 8px', display:'flex', alignItems:'center', gap:'8px' }}>
              <i className="ti ti-alert-triangle" style={{ fontSize:'16px' }} aria-hidden="true" /> Опасная зона
            </h3>
            <p style={{ fontSize:'12px', color:'#E57373', margin:'0 0 14px' }}>Удаляет все данные активности. Используется только для тестирования.</p>
            <button onClick={reset} style={{ background:'#E53935', color:'white', border:'none', borderRadius:'9px', padding:'9px 18px', fontSize:'13px', fontWeight:600, cursor:'pointer' }}>
              🗑 Очистить все данные
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
