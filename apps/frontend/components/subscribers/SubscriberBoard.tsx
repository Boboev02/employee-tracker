'use client';
import { PLAN_LABELS, PLAN_COLORS, STATUS_LABELS } from '@/lib/subscriberConstants';

function daysLabel(dateStr: string | null): { label: string; overdue: boolean } | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  const overdue = diff < 0;
  const days = Math.abs(Math.round(diff / 86400000));
  return { label: overdue ? `−${days} дн` : `${days} дн`, overdue };
}

function timeAgo(dateStr: string | null): string {
  if (!dateStr) return '—';
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Сегодня';
  if (days === 1) return 'Вчера';
  if (days < 7) return `${days} дн назад`;
  return new Date(dateStr).toLocaleDateString('ru');
}

const STATUS_ORDER = ['NEW', 'IN_PROGRESS', 'CONTACTED', 'RENEWED', 'LOST'];

export function SubscriberBoard({ subscribers, loading, onSelect }: { subscribers: any[]; loading: boolean; onSelect: (s: any) => void }) {
  if (loading) {
    return (
      <div style={{ display: 'flex', gap: 14, overflowX: 'auto' }}>
        {[1, 2, 3].map(i => (
          <div key={i} style={{ flex: '0 0 240px' }}>
            <div className="skeleton-pulse" style={{ width: '60%', height: 14, borderRadius: 6, background: '#EDE9FE', marginBottom: 12 }} />
            {[1, 2].map(j => (
              <div key={j} className="skeleton-pulse" style={{ height: 140, borderRadius: 12, background: '#F3F0FF', marginBottom: 10 }} />
            ))}
          </div>
        ))}
      </div>
    );
  }

  const columns = STATUS_ORDER.map(status => ({
    status, label: STATUS_LABELS[status], items: subscribers.filter(s => s.crmStatus === status),
  }));

  return (
    <div style={{ display: 'flex', gap: 14, overflowX: 'auto', paddingBottom: 8 }}>
      {columns.map(col => (
        <div key={col.status} style={{ flex: '0 0 250px' }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#1a1040', margin: '0 0 12px' }}>{col.label} · {col.items.length}</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {col.items.length === 0 && (
              <p style={{ fontSize: 12, color: '#C4C0E8', textAlign: 'center', padding: '20px 0' }}>Пусто</p>
            )}
            {col.items.map(s => {
              const pc = PLAN_COLORS[s.plan] ?? PLAN_COLORS.NONE;
              const dl = daysLabel(s.trialEndsAt ?? s.subscriptionEndsAt);
              return (
                <div key={s.id} onClick={() => onSelect(s)}
                  style={{ background: 'white', border: '1px solid #F3F0FF', borderRadius: 12, padding: 14, cursor: 'pointer', boxShadow: '0 2px 8px rgba(127,119,221,0.06)' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 4px 16px rgba(127,119,221,0.14)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(127,119,221,0.06)'}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
                    <span style={{ fontSize: 11, fontWeight: 700, background: pc.bg, color: pc.c, padding: '3px 10px', borderRadius: 20 }}>{PLAN_LABELS[s.plan] ?? '—'}</span>
                    {dl && <span style={{ fontSize: 11, fontWeight: 600, color: dl.overdue ? '#DC2626' : '#16A34A' }}>{dl.label}</span>}
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                    <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#7F77DD,#5248C5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 12, flexShrink: 0 }}>
                      {s.firstName?.charAt(0) ?? '?'}
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 700, color: '#1a1040', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.firstName} {s.lastName}</p>
                      <p style={{ fontSize: 11, color: '#9B97CC', margin: 0 }}>{timeAgo(s.lastLoginAt)}</p>
                    </div>
                  </div>

                  <div style={{ borderTop: '1px solid #F8F7FF', paddingTop: 8, marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {s.phone && <p style={{ fontSize: 11.5, color: '#6B7280', margin: 0 }}>📞 {s.phone}</p>}
                    {s.email && <p style={{ fontSize: 11.5, color: '#6B7280', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>✉️ {s.email}</p>}
                  </div>

                  {s.tags && s.tags.length > 0 ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 10 }}>
                      {s.tags.map((t: string) => (
                        <span key={t} style={{ fontSize: 10, background: '#F3F0FF', color: '#7F77DD', padding: '2px 8px', borderRadius: 12 }}>{t}</span>
                      ))}
                    </div>
                  ) : (
                    <p style={{ fontSize: 10.5, color: '#C4C0E8', margin: '0 0 10px' }}>Без тегов</p>
                  )}

                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, borderTop: '1px solid #F8F7FF', paddingTop: 8 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 12 }}>💬</span>
                      <span style={{ fontSize: 11, color: '#9B97CC' }}>{s._count?.comments ?? 0}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                      <span style={{ fontSize: 12 }}>🕐</span>
                      <span style={{ fontSize: 11, color: '#9B97CC' }}>{s._count?.history ?? 0} событ.</span>
                    </div>
                    <div style={{ marginLeft: 'auto', fontSize: 11, color: '#9B97CC' }}>{s.manager?.name ?? 'Не назначен'}</div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
