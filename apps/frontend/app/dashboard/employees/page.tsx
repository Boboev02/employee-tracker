'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSocket } from '@/lib/useSocket';
import { usePermissions } from '@/lib/usePermissions';

const ROLES = ['EMPLOYEE','MANAGER','VIEWER','HR','ADMIN'];
import { ROLE_STYLE } from '@/lib/ds';

export default function EmployeesPage() {
  const router = useRouter();
  const [token, setToken]       = useState<string | null>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [search, setSearch]     = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm]         = useState({ name: '', email: '', role: 'EMPLOYEE', password: '' });
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
      const res = await fetch('https://employee-tracker.ru/api/v1/employees', { headers: { Authorization: 'Bearer ' + t } });
      const data = await res.json();
      setEmployees(Array.isArray(data) ? data : []);
      setLastUpdated(new Date());
    } finally { setLoading(false); }
  };

  const invite = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    try {
      // Register user with password
      await fetch('https://employee-tracker.ru/api/v1/auth/register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: form.name, email: form.email, password: form.password }),
      });
      // Then invite as employee with role
      await fetch('https://employee-tracker.ru/api/v1/employees/invite', {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ name: form.name, email: form.email, role: form.role }),
      });
      setShowForm(false); setForm({ name: '', email: '', role: 'EMPLOYEE', password: '' });
      if (token) load(token);
    } finally { setSaving(false); }
  };

  const updateRole = async (id: string, role: string) => {
    await fetch('https://employee-tracker.ru/api/v1/employees/' + id + '/role', {
      method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ role }),
    });
    if (token) load(token);
  };

  const toggleStatus = async (emp: any) => {
    const endpoint = emp.status === 'ACTIVE' ? 'suspend' : 'activate';
    await fetch('https://employee-tracker.ru/api/v1/employees/' + emp.id + '/' + endpoint, {
      method: 'PATCH', headers: { Authorization: 'Bearer ' + token },
    });
    if (token) load(token);
  };

  const deleteEmployee = async (emp: any) => {
    if (!confirm('Удалить сотрудника ' + emp.name + '?')) return;
    await fetch('https://employee-tracker.ru/api/v1/employees/' + emp.id, {
      method: 'DELETE', headers: { Authorization: 'Bearer ' + token },
    });
    if (token) load(token);
  };

  const filtered = employees.filter(e =>
    e.name?.toLowerCase().includes(search.toLowerCase()) ||
    e.email?.toLowerCase().includes(search.toLowerCase())
  );
  const onlineCount = employees.filter(e => ['ONLINE','online','active'].includes(getStatus(e.id) as string)).length;

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
                  const isOnline = ['ONLINE','online','active'].includes(status as string);
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
                        {(presence[emp.id] as any)?.lastSeen ? new Date((presence[emp.id] as any).lastSeen).toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' }) + ' назад' : '—'}
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
              {[{ label: 'Имя', key: 'name', type: 'text', placeholder: 'Иван Петров' }, { label: 'Email', key: 'email', type: 'email', placeholder: 'ivan@company.ru' }, { label: 'Пароль', key: 'password', type: 'password', placeholder: 'Минимум 8 символов' }].map(f => (
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
