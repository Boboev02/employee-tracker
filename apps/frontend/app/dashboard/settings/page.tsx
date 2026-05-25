'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/usePermissions';

const DAYS = [{ label: 'Пн', value: 1 },{ label: 'Вт', value: 2 },{ label: 'Ср', value: 3 },{ label: 'Чт', value: 4 },{ label: 'Пт', value: 5 },{ label: 'Сб', value: 6 },{ label: 'Вс', value: 0 }];
const TIMEZONES = [
  { label: 'Москва (UTC+3)', value: 'Europe/Moscow' },
  { label: 'Екатеринбург (UTC+5)', value: 'Asia/Yekaterinburg' },
  { label: 'Новосибирск (UTC+7)', value: 'Asia/Novosibirsk' },
  { label: 'Владивосток (UTC+10)', value: 'Asia/Vladivostok' },
  { label: 'UTC', value: 'UTC' },
];
const HOURS = Array.from({ length: 24 }, (_, i) => ({ value: i, label: i.toString().padStart(2,'0') + ':00' }));

export default function SettingsPage() {
  const router = useRouter();
  const perms  = usePermissions();
  const [token, setToken]   = useState('');
  const [settings, setSettings] = useState<any>({ enabled: true, startHour: 9, endHour: 18, timezone: 'Europe/Moscow', workDays: [1,2,3,4,5], lunchStart: 13, lunchEnd: 14 });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);
  const [status, setStatus]   = useState('');

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    fetch('http://localhost:3001/api/v1/settings/work-hours', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(d => { setSettings(d); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!settings.enabled) { setStatus('Рабочее время не ограничено'); return; }
    const now = new Date();
    const local = new Date(now.toLocaleString('en-US', { timeZone: settings.timezone }));
    const day = local.getDay(); const hour = local.getHours() + local.getMinutes() / 60;
    if (!settings.workDays.includes(day)) { setStatus('Сейчас нерабочий день'); return; }
    if (hour < settings.startHour || hour >= settings.endHour) { setStatus('Сейчас нерабочее время'); return; }
    if (settings.lunchStart != null && hour >= settings.lunchStart && hour < settings.lunchEnd) { setStatus('Обеденный перерыв'); return; }
    setStatus('Сейчас рабочее время ✓');
  }, [settings]);

  const save = async () => {
    setSaving(true);
    await fetch('http://localhost:3001/api/v1/settings/work-hours', {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify(settings),
    });
    setSaved(true); setSaving(false);
    setTimeout(() => setSaved(false), 2000);
  };

  const canEdit = perms.isAdmin;

  if (loading) return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-muted)', fontSize: '13px' }}>Загрузка...</div>;

  const selectStyle: React.CSSProperties = { width:'100%', background:'var(--bg-secondary)', border:'0.5px solid var(--border-strong)', borderRadius:'8px', padding:'8px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none' };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-tertiary)' }}>
      <div style={{ background: 'var(--bg-primary)', borderBottom: '0.5px solid var(--border)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div>
          <h1 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Настройки</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Рабочее время организации</p>
        </div>
        {canEdit && (
          <button onClick={save} disabled={saving}
            style={{ background: saved ? '#22c55e' : 'var(--accent)', color: 'white', border: 'none', padding: '8px 20px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', transition: 'background 0.3s' }}>
            {saved ? '✓ Сохранено' : saving ? 'Сохраняю...' : 'Сохранить'}
          </button>
        )}
      </div>

      <div style={{ padding: '24px', maxWidth: '640px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Toggle */}
        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>Учёт рабочего времени</p>
              <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0' }}>Аналитика считает только рабочие часы</p>
            </div>
            <div onClick={() => canEdit && setSettings({ ...settings, enabled: !settings.enabled })}
              style={{ width: '44px', height: '24px', borderRadius: '12px', background: settings.enabled ? 'var(--accent)' : 'var(--border-strong)', cursor: canEdit ? 'pointer' : 'default', position: 'relative', transition: 'background 0.2s' }}>
              <span style={{ position: 'absolute', top: '3px', left: settings.enabled ? '22px' : '3px', width: '18px', height: '18px', borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
            </div>
          </div>
          <div style={{ background: status.includes('✓') ? '#f0fdf4' : 'var(--bg-secondary)', borderRadius: '8px', padding: '8px 12px', fontSize: '12px', color: status.includes('✓') ? '#22c55e' : 'var(--text-muted)' }}>
            {status}
          </div>
        </div>

        {settings.enabled && (
          <>
            {/* Timezone */}
            <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px' }}>
              <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '10px' }}>Часовой пояс</p>
              <select value={settings.timezone} disabled={!canEdit}
                onChange={e => setSettings({ ...settings, timezone: e.target.value })}
                style={selectStyle}>
                {TIMEZONES.map(tz => <option key={tz.value} value={tz.value}>{tz.label}</option>)}
              </select>
            </div>

            {/* Work days */}
            <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px' }}>
              <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '12px' }}>Рабочие дни</p>
              <div style={{ display: 'flex', gap: '6px' }}>
                {DAYS.map(day => {
                  const active = settings.workDays.includes(day.value);
                  return (
                    <button key={day.value} disabled={!canEdit}
                      onClick={() => {
                        const days = active ? settings.workDays.filter((d: number) => d !== day.value) : [...settings.workDays, day.value];
                        setSettings({ ...settings, workDays: days });
                      }}
                      style={{ width: '40px', height: '40px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, border: 'none', cursor: canEdit ? 'pointer' : 'default', background: active ? 'var(--accent)' : 'var(--bg-secondary)', color: active ? 'white' : 'var(--text-secondary)', transition: 'background 0.15s' }}>
                      {day.label}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Hours */}
            <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px' }}>
              <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '14px' }}>Рабочие часы</p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '8px', marginBottom: '16px' }}>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Начало</label>
                  <select value={settings.startHour} disabled={!canEdit} onChange={e => setSettings({ ...settings, startHour: parseInt(e.target.value) })} style={selectStyle}>
                    {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                  </select>
                </div>
                <span style={{ color: 'var(--text-muted)', marginTop: '16px' }}>—</span>
                <div>
                  <label style={{ fontSize: '11px', color: 'var(--text-muted)', display: 'block', marginBottom: '4px' }}>Конец</label>
                  <select value={settings.endHour} disabled={!canEdit} onChange={e => setSettings({ ...settings, endHour: parseInt(e.target.value) })} style={selectStyle}>
                    {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Lunch */}
              <div style={{ borderTop: '0.5px solid var(--border)', paddingTop: '14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
                  <span style={{ fontSize: '13px', color: 'var(--text-primary)' }}>Обеденный перерыв</span>
                  <div onClick={() => canEdit && setSettings({ ...settings, lunchStart: settings.lunchStart != null ? null : 13, lunchEnd: settings.lunchEnd != null ? null : 14 })}
                    style={{ width: '36px', height: '20px', borderRadius: '10px', background: settings.lunchStart != null ? 'var(--accent)' : 'var(--border-strong)', cursor: canEdit ? 'pointer' : 'default', position: 'relative', transition: 'background 0.2s' }}>
                    <span style={{ position: 'absolute', top: '2px', left: settings.lunchStart != null ? '18px' : '2px', width: '16px', height: '16px', borderRadius: '50%', background: 'white', transition: 'left 0.2s' }} />
                  </div>
                </div>
                {settings.lunchStart != null && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: '8px' }}>
                    <select value={settings.lunchStart} disabled={!canEdit} onChange={e => setSettings({ ...settings, lunchStart: parseInt(e.target.value) })} style={selectStyle}>
                      {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                    </select>
                    <span style={{ color: 'var(--text-muted)' }}>—</span>
                    <select value={settings.lunchEnd} disabled={!canEdit} onChange={e => setSettings({ ...settings, lunchEnd: parseInt(e.target.value) })} style={selectStyle}>
                      {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                    </select>
                  </div>
                )}
              </div>
            </div>

            {/* Summary */}
            <div style={{ background: 'rgba(167,139,250,0.08)', border: '0.5px solid rgba(167,139,250,0.2)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
              <p style={{ fontSize: '12px', color: '#a78bfa', fontWeight: 500, marginBottom: '4px' }}>Текущие настройки</p>
              <p style={{ fontSize: '12px', color: 'var(--text-secondary)', margin: 0 }}>
                {DAYS.filter(d => settings.workDays.includes(d.value)).map(d => d.label).join(', ')} · {String(settings.startHour).padStart(2,'0')}:00 — {String(settings.endHour).padStart(2,'0')}:00
                {settings.lunchStart != null && ' · Обед ' + String(settings.lunchStart).padStart(2,'0') + ':00—' + String(settings.lunchEnd).padStart(2,'0') + ':00'}
              </p>
            </div>
          </>
        )}
        {!canEdit && <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center' }}>Только администратор может изменять настройки</p>}
      </div>
    </div>
  );
}
