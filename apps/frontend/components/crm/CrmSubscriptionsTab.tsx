'use client';
import { useState, useEffect } from 'react';

const API = 'https://employee-tracker.ru/api/v1';

const PLAN_LABELS: Record<string, string> = { TRIAL: 'Пробный', PRO: 'Профи', BUSINESS: 'Бизнес', NONE: 'Нет подписки' };
const PLAN_COLORS: Record<string, { bg: string; c: string }> = {
  TRIAL: { bg: '#FEF3C7', c: '#D97706' }, PRO: { bg: '#DBEAFE', c: '#2563EB' },
  BUSINESS: { bg: '#DCFCE7', c: '#16A34A' }, NONE: { bg: '#F3F4F6', c: '#6B7280' },
};

function daysLabel(dateStr: string | null): { label: string; overdue: boolean } | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  const overdue = diff < 0;
  const days = Math.abs(Math.round(diff / 86400000));
  return { label: overdue ? `Истекло ${days} дн. назад` : `Осталось ${days} дн.`, overdue };
}

export function CrmSubscriptionsTab({ card }: { card: React.CSSProperties }) {
  const [stats, setStats] = useState<any>(null);
  const [contacts, setContacts] = useState<any[]>([]);
  const [filterPlan, setFilterPlan] = useState('');
  const [loading, setLoading] = useState(true);

  const h = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('access_token') });

  const load = async () => {
    setLoading(true);
    const [sRes, cRes] = await Promise.all([
      fetch(`${API}/crm/contacts/subscription-stats`, { headers: h() }),
      fetch(`${API}/crm/contacts?limit=100${filterPlan ? '&subscriptionPlan=' + filterPlan : ''}`, { headers: h() }),
    ]);
    setStats(await sRes.json().catch(() => null));
    const cData = await cRes.json().catch(() => ({ data: [] }));
    setContacts(cData.data ?? []);
    setLoading(false);
  };

  useEffect(() => { load(); }, [filterPlan]);

  return (
    <div>
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 18 }}>
          {stats.byPlan.map((p: any) => (
            <div key={p.plan} onClick={() => setFilterPlan(filterPlan === p.plan ? '' : p.plan)}
              style={{ ...card, padding: '14px', cursor: 'pointer', border: filterPlan === p.plan ? '2px solid #7F77DD' : '1px solid transparent' }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: PLAN_COLORS[p.plan]?.c ?? '#1a1040', margin: 0 }}>{p.count}</p>
              <p style={{ fontSize: 10.5, color: '#9B97CC', margin: '3px 0 0', fontWeight: 600 }}>{PLAN_LABELS[p.plan]}</p>
            </div>
          ))}
          <div style={{ ...card, padding: '14px', background: '#FFFBEB' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#D97706', margin: 0 }}>{stats.trialEndingSoon}</p>
            <p style={{ fontSize: 10, color: '#92400E', margin: '3px 0 0', fontWeight: 700 }}>Триал истекает ≤3 дн.</p>
          </div>
          <div style={{ ...card, padding: '14px', background: '#FEF2F2' }}>
            <p style={{ fontSize: 22, fontWeight: 800, color: '#DC2626', margin: 0 }}>{stats.expiredRecently}</p>
            <p style={{ fontSize: 10, color: '#991B1B', margin: '3px 0 0', fontWeight: 700 }}>Истекло за 14 дн.</p>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
        <span style={{ fontSize: 12, color: '#9B97CC' }}>Фильтр по тарифу:</span>
        {['', 'TRIAL', 'PRO', 'BUSINESS', 'NONE'].map(p => (
          <button key={p} onClick={() => setFilterPlan(p)} style={{ padding: '5px 14px', borderRadius: 20, border: 'none', fontSize: 11.5, fontWeight: 700, cursor: 'pointer', background: filterPlan === p ? '#EDE9FE' : '#F8F7FF', color: filterPlan === p ? '#7F77DD' : '#9B97CC' }}>
            {p === '' ? 'Все' : PLAN_LABELS[p]}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ ...card, padding: 40, textAlign: 'center' }}><p style={{ color: '#9B97CC', margin: 0 }}>Загрузка...</p></div>
      ) : contacts.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: 'center' }}>
          <p style={{ fontSize: 28, margin: '0 0 10px' }}>📊</p>
          <p style={{ color: '#9B97CC', margin: 0 }}>Подписчиков пока нет</p>
          <p style={{ color: '#C4C0E8', fontSize: 12, margin: '4px 0 0' }}>Подключите интеграцию с KingStats во вкладке Настройки → Интеграции</p>
        </div>
      ) : (
        <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ background: '#F8F7FF' }}>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#9B97CC', textTransform: 'uppercase' }}>Имя</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#9B97CC', textTransform: 'uppercase' }}>Контакты</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#9B97CC', textTransform: 'uppercase' }}>Тариф</th>
                <th style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#9B97CC', textTransform: 'uppercase' }}>Срок</th>
              </tr>
            </thead>
            <tbody>
              {contacts.map((c: any) => {
                const pc = PLAN_COLORS[c.subscriptionPlan] ?? PLAN_COLORS.NONE;
                const dl = daysLabel(c.trialEndsAt ?? c.subscriptionEndsAt);
                return (
                  <tr key={c.id} style={{ borderTop: '1px solid #F3F0FF' }}>
                    <td style={{ padding: '10px 14px', fontSize: 13, fontWeight: 600, color: '#1a1040' }}>{c.firstName} {c.lastName}</td>
                    <td style={{ padding: '10px 14px', fontSize: 12, color: '#9B97CC' }}>{c.email}{c.phone && ` · ${c.phone}`}</td>
                    <td style={{ padding: '10px 14px' }}>
                      <span style={{ fontSize: 10.5, fontWeight: 700, color: pc.c, background: pc.bg, padding: '2px 10px', borderRadius: 20 }}>{PLAN_LABELS[c.subscriptionPlan] ?? '—'}</span>
                    </td>
                    <td style={{ padding: '10px 14px', fontSize: 11.5, fontWeight: 600, color: dl?.overdue ? '#DC2626' : '#16A34A' }}>{dl?.label ?? '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
