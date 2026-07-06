'use client';
import { useState, useEffect } from 'react';

const API = 'https://employee-tracker.ru/api/v1';

const STATUS_LABELS: Record<string, string> = { OPEN: 'Открыто', IN_PROGRESS: 'В работе', RESOLVED: 'Решено', CLOSED: 'Закрыто' };
const STATUS_COLORS: Record<string, { bg: string; c: string }> = {
  OPEN: { bg: '#FEE2E2', c: '#DC2626' }, IN_PROGRESS: { bg: '#DBEAFE', c: '#2563EB' },
  RESOLVED: { bg: '#DCFCE7', c: '#16A34A' }, CLOSED: { bg: '#F3F4F6', c: '#6B7280' },
};
const PRIORITY_LABELS: Record<string, string> = { LOW: 'Низкий', MEDIUM: 'Средний', HIGH: 'Высокий', URGENT: 'Срочно' };
const PRIORITY_COLORS: Record<string, string> = { LOW: '#9B97CC', MEDIUM: '#2563EB', HIGH: '#D97706', URGENT: '#DC2626' };

function timeUntil(dateStr: string): { label: string; overdue: boolean } {
  const diff = new Date(dateStr).getTime() - Date.now();
  const overdue = diff < 0;
  const abs = Math.abs(diff);
  const h = Math.floor(abs / 3600000);
  const m = Math.floor((abs % 3600000) / 60000);
  const label = h > 0 ? `${h}ч ${m}м` : `${m}м`;
  return { label: overdue ? `Просрочено на ${label}` : `Осталось ${label}`, overdue };
}

export function CrmCasesTab({ card }: { card: React.CSSProperties }) {
  const [cases, setCases] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [filterStatus, setFilterStatus] = useState('');
  const [form, setForm] = useState({ subject: '', description: '', priority: 'MEDIUM', assignedToId: '' });

  const h = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('access_token') });

  const load = async () => {
    const [cRes, sRes, eRes] = await Promise.all([
      fetch(`${API}/crm/cases${filterStatus ? '?status=' + filterStatus : ''}`, { headers: h() }),
      fetch(`${API}/crm/cases/stats`, { headers: h() }),
      fetch(`${API}/employees?limit=200`, { headers: h() }),
    ]);
    setCases(await cRes.json().catch(() => []));
    setStats(await sRes.json().catch(() => null));
    const eData = await eRes.json().catch(() => ({}));
    setEmployees(eData.employees ?? (Array.isArray(eData) ? eData : []));
  };

  useEffect(() => { load(); }, [filterStatus]);

  const createCase = async () => {
    if (!form.subject.trim()) return;
    await fetch(`${API}/crm/cases`, { method: 'POST', headers: h(), body: JSON.stringify(form) });
    setShowForm(false);
    setForm({ subject: '', description: '', priority: 'MEDIUM', assignedToId: '' });
    load();
  };

  const updateStatus = async (id: string, status: string) => {
    await fetch(`${API}/crm/cases/${id}`, { method: 'PATCH', headers: h(), body: JSON.stringify({ status }) });
    load();
  };

  return (
    <div>
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, marginBottom: 16 }}>
          <div style={{ ...card, padding: '14px 18px' }}><p style={{ fontSize: 24, fontWeight: 800, color: '#1a1040', margin: 0 }}>{stats.open}</p><p style={{ fontSize: 11, color: '#9B97CC', margin: '3px 0 0' }}>Открытых обращений</p></div>
          <div style={{ ...card, padding: '14px 18px' }}><p style={{ fontSize: 24, fontWeight: 800, color: '#DC2626', margin: 0 }}>{stats.overdue}</p><p style={{ fontSize: 11, color: '#9B97CC', margin: '3px 0 0' }}>Просрочено по SLA</p></div>
          <div style={{ ...card, padding: '14px 18px' }}><p style={{ fontSize: 24, fontWeight: 800, color: '#16A34A', margin: 0 }}>{stats.resolvedToday}</p><p style={{ fontSize: 11, color: '#9B97CC', margin: '3px 0 0' }}>Решено сегодня</p></div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        {['', 'OPEN', 'IN_PROGRESS', 'RESOLVED', 'CLOSED'].map(s => (
          <button key={s} onClick={() => setFilterStatus(s)} style={{ padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: filterStatus === s ? '#EDE9FE' : '#F8F7FF', color: filterStatus === s ? '#7F77DD' : '#9B97CC' }}>
            {s === '' ? 'Все' : STATUS_LABELS[s]}
          </button>
        ))}
        <button onClick={() => setShowForm(true)} style={{ marginLeft: 'auto', background: 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Новое обращение</button>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {cases.length === 0 && <div style={{ ...card, padding: 40, textAlign: 'center' }}><p style={{ color: '#9B97CC', margin: 0 }}>Обращений нет</p></div>}
        {cases.map(c => {
          const sc = STATUS_COLORS[c.status];
          const t = c.dueBy && c.status !== 'RESOLVED' && c.status !== 'CLOSED' ? timeUntil(c.dueBy) : null;
          return (
            <div key={c.id} style={{ ...card, padding: '14px 18px', border: c.isOverdue ? '1px solid #FCA5A5' : undefined }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, color: '#9B97CC' }}>#{c.number}</span>
                    <p style={{ fontSize: 13.5, fontWeight: 700, color: '#1a1040', margin: 0 }}>{c.subject}</p>
                  </div>
                  {c.description && <p style={{ fontSize: 12, color: '#9B97CC', margin: '4px 0 0' }}>{c.description}</p>}
                  <div style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: PRIORITY_COLORS[c.priority], background: PRIORITY_COLORS[c.priority] + '18', padding: '2px 9px', borderRadius: 20 }}>{PRIORITY_LABELS[c.priority]}</span>
                    {t && <span style={{ fontSize: 10.5, fontWeight: 700, color: t.overdue ? '#DC2626' : '#16A34A', background: t.overdue ? '#FEE2E2' : '#DCFCE7', padding: '2px 9px', borderRadius: 20 }}>⏱ {t.label}</span>}
                    {c.company && <span style={{ fontSize: 10.5, color: '#9B97CC' }}>🏢 {c.company.name}</span>}
                    {c.contact && <span style={{ fontSize: 10.5, color: '#9B97CC' }}>👤 {c.contact.firstName} {c.contact.lastName}</span>}
                  </div>
                </div>
                <select value={c.status} onChange={e => updateStatus(c.id, e.target.value)}
                  style={{ fontSize: 11, fontWeight: 700, color: sc.c, background: sc.bg, border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', outline: 'none' }}>
                  {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
            </div>
          );
        })}
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,16,64,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 24, width: 400, boxShadow: '0 24px 64px rgba(127,119,221,0.2)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1a1040', margin: '0 0 16px' }}>Новое обращение</h3>
            <input value={form.subject} onChange={e => setForm({ ...form, subject: e.target.value })} placeholder="Тема обращения"
              style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 10, outline: 'none', boxSizing: 'border-box' }} />
            <textarea value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} placeholder="Описание" rows={3}
              style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 10, outline: 'none', boxSizing: 'border-box', resize: 'none' }} />
            <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
              style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 10, outline: 'none' }}>
              {Object.entries(PRIORITY_LABELS).map(([v, l]) => <option key={v} value={v}>{l} приоритет</option>)}
            </select>
            <select value={form.assignedToId} onChange={e => setForm({ ...form, assignedToId: e.target.value })}
              style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 16, outline: 'none' }}>
              <option value="">— назначить исполнителя —</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createCase} disabled={!form.subject.trim()} style={{ flex: 1, background: form.subject.trim() ? 'linear-gradient(135deg,#7F77DD,#5248C5)' : '#EDE9FE', color: form.subject.trim() ? 'white' : '#C4C0E8', border: 'none', borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 700, cursor: form.subject.trim() ? 'pointer' : 'not-allowed' }}>Создать</button>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, background: '#F8F7FF', color: '#6B7280', border: '1px solid #EDE9FE', borderRadius: 10, padding: 10, fontSize: 13, cursor: 'pointer' }}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
