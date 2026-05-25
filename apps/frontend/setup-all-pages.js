const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

const S = {
  page: `padding: '24px', display: 'flex', flexDirection: 'column' as const, gap: '20px'`,
  card: `background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px'`,
  header: `background: 'var(--bg-primary)', borderBottom: '0.5px solid var(--border)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky' as const, top: 0, zIndex: 10`,
  btnPrimary: `background: 'var(--accent)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer'`,
  btnSecondary: `background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '0.5px solid var(--border)', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer'`,
  btnDanger: `background: '#fef2f2', color: '#ef4444', border: '0.5px solid #fecaca', padding: '6px 12px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, cursor: 'pointer'`,
  input: `width: '100%', background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none'`,
  th: `padding: '10px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' as const, letterSpacing: '0.05em', background: 'var(--bg-secondary)', borderBottom: '0.5px solid var(--border)', textAlign: 'left' as const`,
  td: `padding: '12px', fontSize: '13px', color: 'var(--text-primary)', borderBottom: '0.5px solid var(--border)'`,
};

// ─── EMPLOYEES PAGE ───────────────────────────────────────────
write('app/dashboard/employees/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/lib/useSocket';
import { usePermissions } from '@/lib/usePermissions';

const ROLES = ['EMPLOYEE','MANAGER','VIEWER','HR','ADMIN'];
const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  ADMIN:    { bg: 'rgba(167,139,250,0.12)', color: '#a78bfa' },
  MANAGER:  { bg: '#eff6ff', color: '#378add' },
  EMPLOYEE: { bg: '#f0fdf4', color: '#22c55e' },
  VIEWER:   { bg: '#f4f4f5', color: '#71717a' },
  HR:       { bg: '#fff7ed', color: '#f97316' },
};

export default function EmployeesPage() {
  const router = useRouter();
  const [token, setToken]       = useState<string | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ name: '', email: '', role: 'EMPLOYEE' });
  const [saving, setSaving]     = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const { connected, presence, getStatus } = useSocket(token);
  const perms = usePermissions();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    load(t);
    const interval = setInterval(() => {
      const t2 = localStorage.getItem('access_token');
      if (t2) load(t2);
    }, 15_000);
    return () => clearInterval(interval);
  }, []);

  const load = async (t: string) => {
    try {
      const res = await fetch('http://localhost:3001/api/v1/employees', { headers: { Authorization: 'Bearer ' + t } });
      const data = await res.json();
      setEmployees(Array.isArray(data) ? data : []);
      setLastUpdated(new Date());
    } finally { setLoading(false); }
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      await fetch('http://localhost:3001/api/v1/employees/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(form),
      });
      setShowForm(false); setForm({ name: '', email: '', role: 'EMPLOYEE' });
      if (token) load(token);
    } finally { setSaving(false); }
  };

  const updateRole = async (id: string, role: string) => {
    await fetch('http://localhost:3001/api/v1/employees/' + id + '/role', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ role }),
    });
    if (token) load(token);
  };

  const toggleStatus = async (emp: any) => {
    const endpoint = emp.status === 'ACTIVE' ? 'suspend' : 'activate';
    await fetch('http://localhost:3001/api/v1/employees/' + emp.id + '/' + endpoint, {
      method: 'PATCH', headers: { Authorization: 'Bearer ' + token },
    });
    if (token) load(token);
  };

  const deleteEmployee = async (emp: any) => {
    if (!confirm('Удалить сотрудника ' + emp.name + '?')) return;
    await fetch('http://localhost:3001/api/v1/employees/' + emp.id, {
      method: 'DELETE', headers: { Authorization: 'Bearer ' + token },
    });
    if (token) load(token);
  };

  const filtered = employees.filter(e =>
    e.name?.toLowerCase().includes(search.toLowerCase()) ||
    e.email?.toLowerCase().includes(search.toLowerCase())
  );
  const onlineCount = employees.filter(e => getStatus(e.id) === 'online').length;

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-tertiary)' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-primary)', borderBottom: '0.5px solid var(--border)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <h1 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Сотрудники</h1>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{employees.length} чел.</span>
          {connected && (
            <span style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#22c55e' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
              {onlineCount} онлайн
            </span>
          )}
          {lastUpdated && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>обновлено {lastUpdated.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}</span>}
        </div>
        {mounted && perms.canInviteUsers && (
          <button onClick={() => setShowForm(true)}
            style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
            + Добавить
          </button>
        )}
      </div>

      <div style={{ padding: '20px 24px' }}>
        {/* Search */}
        <div style={{ marginBottom: '16px' }}>
          <input placeholder="Поиск по имени или email..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: '320px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }} />
        </div>

        {/* Table */}
        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>Загрузка...</div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  {['Сотрудник', 'Статус', 'Активность', 'Роль', 'Действия'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--bg-secondary)', borderBottom: '0.5px solid var(--border)', textAlign: 'left' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((emp, idx) => {
                  const status = getStatus(emp.id);
                  const isOnline = status === 'online';
                  const role = emp.roles?.[0] ?? 'EMPLOYEE';
                  const rs = ROLE_STYLE[role] ?? { bg: '#f4f4f5', color: '#71717a' };
                  return (
                    <tr key={emp.id} style={{ cursor: 'pointer', transition: 'background 0.15s' }}
                      onClick={() => router.push('/dashboard/employees/' + emp.id)}
                      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'}
                      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                      <td style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ position: 'relative' }}>
                            <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                              <span style={{ color: 'white', fontSize: '12px', fontWeight: 600 }}>{emp.name?.charAt(0)}</span>
                            </div>
                            <span style={{ position: 'absolute', bottom: 0, right: 0, width: '8px', height: '8px', borderRadius: '50%', background: isOnline ? '#22c55e' : '#d4d4d8', border: '2px solid var(--bg-primary)' }} />
                          </div>
                          <div>
                            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{emp.name}</p>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>{emp.email}</p>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)' }}>
                        <span style={{ fontSize: '12px', color: isOnline ? '#22c55e' : 'var(--text-muted)' }}>
                          {isOnline ? 'Онлайн' : 'Офлайн'}
                        </span>
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', fontSize: '12px', color: 'var(--text-muted)' }}>
                        {presence[emp.id]?.lastSeen ? new Date(presence[emp.id].lastSeen).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) + ' назад' : '—'}
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                        {mounted && perms.canChangeRoles ? (
                          <select value={role} onChange={e => updateRole(emp.id, e.target.value)}
                            style={{ fontSize: '11px', fontWeight: 500, padding: '3px 8px', borderRadius: '20px', background: rs.bg, color: rs.color, border: 'none', cursor: 'pointer', outline: 'none' }}>
                            {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                          </select>
                        ) : (
                          <span style={{ fontSize: '11px', fontWeight: 500, padding: '3px 8px', borderRadius: '20px', background: rs.bg, color: rs.color }}>{role}</span>
                        )}
                      </td>
                      <td style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)' }} onClick={e => e.stopPropagation()}>
                        <div style={{ display: 'flex', gap: '6px' }}>
                          {mounted && perms.canSuspendUsers && (
                            <button onClick={() => toggleStatus(emp)}
                              style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '7px', fontWeight: 500, cursor: 'pointer', background: emp.status === 'ACTIVE' ? '#fef2f2' : '#f0fdf4', color: emp.status === 'ACTIVE' ? '#ef4444' : '#22c55e', border: 'none' }}>
                              {emp.status === 'ACTIVE' ? 'Заблок.' : 'Активир.'}
                            </button>
                          )}
                          {mounted && perms.canInviteUsers && (
                            <button onClick={() => deleteEmployee(emp)}
                              style={{ fontSize: '11px', padding: '4px 10px', borderRadius: '7px', fontWeight: 500, cursor: 'pointer', background: 'var(--bg-secondary)', color: 'var(--text-muted)', border: 'none' }}>
                              Удалить
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Invite modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius)', padding: '24px', width: '400px', border: '0.5px solid var(--border)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>Добавить сотрудника</h2>
            <form onSubmit={invite} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {[{ label: 'Имя', key: 'name', type: 'text', placeholder: 'Иван Петров' }, { label: 'Email', key: 'email', type: 'email', placeholder: 'ivan@company.ru' }].map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>{f.label}</label>
                  <input type={f.type} value={(form as any)[f.key]} onChange={e => setForm({ ...form, [f.key]: e.target.value })} placeholder={f.placeholder} required
                    style={{ width: '100%', background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }} />
                </div>
              ))}
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Роль</label>
                <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })}
                  style={{ width: '100%', background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button type="button" onClick={() => setShowForm(false)}
                  style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '0.5px solid var(--border)', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>
                  Отмена
                </button>
                <button type="submit" disabled={saving}
                  style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Добавляю...' : 'Добавить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
`);

console.log('✓ employees page done');

// ─── SETTINGS PAGE ────────────────────────────────────────────
write('app/dashboard/settings/page.tsx', `'use client';
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

  const selectStyle = { width: '100%', background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none', opacity: !canEdit ? 0.6 : 1 };

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
`);
console.log('✓ settings page done');

// ─── EXPORT PAGE ──────────────────────────────────────────────
write('app/dashboard/export/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/usePermissions';

const REPORTS = [
  { id: 'activity',    title: 'Активность', desc: 'События трекинга, платформы, разделы', icon: '⏱', permission: 'canViewOrgAnalytics', hasPeriod: true },
  { id: 'employees',   title: 'Сотрудники', desc: 'Роли, статусы, события и задачи',      icon: '👥', permission: 'canViewAllEmployees', hasPeriod: false },
  { id: 'tasks',       title: 'Задачи',     desc: 'Все задачи с датами и исполнителями',   icon: '✓',  permission: 'canViewOrgAnalytics', hasPeriod: false },
  { id: 'productivity',title: 'Продуктивность', desc: 'Рейтинг и факторы команды',         icon: '⭐', permission: 'canViewOrgAnalytics', hasPeriod: true },
];

const PERIODS = [{ l: 'Сегодня', v: '1' },{ l: '7 дней', v: '7' },{ l: '14 дней', v: '14' },{ l: '30 дней', v: '30' },{ l: '90 дней', v: '90' }];

export default function ExportPage() {
  const router = useRouter();
  const [token, setToken]   = useState('');
  const [period, setPeriod] = useState('7');
  const [loading, setLoading] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const perms = usePermissions();

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
  }, []);

  const download = async (id: string) => {
    setLoading(id); setSuccess(null);
    try {
      const res = await fetch('http://localhost:3001/api/v1/export/' + id + '?days=' + period, { headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) { alert('Ошибка ' + res.status); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = id + '-report.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      setSuccess(id); setTimeout(() => setSuccess(null), 3000);
    } finally { setLoading(null); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-tertiary)' }}>
      <div style={{ background: 'var(--bg-primary)', borderBottom: '0.5px solid var(--border)', padding: '14px 24px' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Экспорт отчётов</h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0' }}>CSV для Excel или Google Sheets</p>
      </div>

      <div style={{ padding: '24px', maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Period */}
        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '12px' }}>Период</p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {PERIODS.map(p => (
              <button key={p.v} onClick={() => setPeriod(p.v)}
                style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', border: 'none', background: period === p.v ? 'var(--accent)' : 'var(--bg-secondary)', color: period === p.v ? 'white' : 'var(--text-secondary)', transition: 'background 0.15s' }}>
                {p.l}
              </button>
            ))}
          </div>
        </div>

        {/* Reports grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {REPORTS.filter(r => (perms as any)[r.permission]).map(report => (
            <div key={report.id} style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(167,139,250,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                  {report.icon}
                </div>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{report.title}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '3px 0 0' }}>{report.desc}</p>
                  {report.hasPeriod && <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Период: {PERIODS.find(p => p.v === period)?.l}</p>}
                </div>
              </div>
              <button onClick={() => download(report.id)} disabled={loading === report.id}
                style={{ width: '100%', padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', border: '0.5px solid var(--border)', background: success === report.id ? '#f0fdf4' : loading === report.id ? 'var(--bg-secondary)' : 'var(--bg-primary)', color: success === report.id ? '#22c55e' : 'var(--text-secondary)', transition: 'all 0.15s' }}>
                {success === report.id ? '✓ Скачано' : loading === report.id ? 'Формирую...' : '↓ Скачать CSV'}
              </button>
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(167,139,250,0.06)', border: '0.5px solid rgba(167,139,250,0.2)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
          <p style={{ fontSize: '12px', color: '#a78bfa', fontWeight: 500, marginBottom: '4px' }}>Открытие в Excel</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Файл сохраняется в UTF-8 с BOM — кириллица откроется корректно. При проблемах: Данные → Из текста/CSV → UTF-8.</p>
        </div>
      </div>
    </div>
  );
}
`);
console.log('✓ export page done');

console.log('\n✅ All pages updated');
