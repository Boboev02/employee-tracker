'use client';
import { useState, useEffect } from 'react';
import { PLAN_LABELS } from '@/lib/subscriberConstants';

const API = 'https://employee-tracker.ru/api/v1';


const BUCKETS = [
  { key: 'overdue', label: 'Просрочено', icon: '🔴', color: '#DC2626', bg: '#FEE2E2' },
  { key: 'today', label: 'Сегодня заканчивается', icon: '⏰', color: '#DC2626', bg: '#FEE2E2' },
  { key: 'tomorrow', label: 'Завтра заканчивается', icon: '⚠️', color: '#D97706', bg: '#FEF3C7' },
  { key: 'in3Days', label: 'Через 3 дня', icon: '📅', color: '#D97706', bg: '#FEF3C7' },
  { key: 'inWeek', label: 'Через неделю', icon: '🗓', color: '#2563EB', bg: '#DBEAFE' },
  { key: 'inMonth', label: 'Через месяц', icon: '📆', color: '#6B7280', bg: '#F3F4F6' },
] as const;

export function RemindersCenter({ h, onClose, onSelectSubscriber }: any) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeBucket, setActiveBucket] = useState<string>('today');
  const [notifPermission, setNotifPermission] = useState<string>('default');

  useEffect(() => {
    fetch(`${API}/subscribers/reminders`, { headers: h() }).then(r => r.json()).then(d => { setData(d); setLoading(false); }).catch(() => setLoading(false));

    if (typeof Notification !== 'undefined') {
      setNotifPermission(Notification.permission);
    }
  }, []);

  // Показать браузерное уведомление один раз в день, если есть срочные напоминания
  useEffect(() => {
    if (!data) return;
    const urgentCount = (data.today?.length ?? 0) + (data.overdue?.length ?? 0);
    if (urgentCount === 0) return;

    const lastShownKey = 'subscriber_reminder_notif_date';
    const today = new Date().toDateString();
    if (localStorage.getItem(lastShownKey) === today) return;

    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('🔔 Напоминания по подписчикам', { body: `${urgentCount} подписчик(ов) требуют внимания сегодня`, icon: '/favicon.ico' });
      localStorage.setItem(lastShownKey, today);
    }
  }, [data]);

  const requestNotifPermission = () => {
    if (typeof Notification === 'undefined') return;
    Notification.requestPermission().then(setNotifPermission);
  };

  const items = data?.[activeBucket] ?? [];

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,16,64,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.15s ease-out' }}>
      <div style={{ background: 'white', borderRadius: 20, width: 600, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(127,119,221,0.25)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F3F0FF', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1a1040', margin: 0 }}>🔔 Центр напоминаний</h3>
            <p style={{ fontSize: 11.5, color: '#9B97CC', margin: '2px 0 0' }}>Подписчики, требующие внимания по срокам</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9B97CC', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        {notifPermission !== 'granted' && (
          <div style={{ padding: '10px 24px', background: '#FFFBEB', borderBottom: '1px solid #FEF3C7', display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
            <span style={{ fontSize: 12, color: '#92400E', flex: 1 }}>Включите браузерные уведомления, чтобы не пропустить срочные напоминания</span>
            <button onClick={requestNotifPermission} style={{ background: '#D97706', color: 'white', border: 'none', borderRadius: 8, padding: '5px 12px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>Включить</button>
          </div>
        )}

        {/* Buckets */}
        <div style={{ display: 'flex', gap: 6, padding: '14px 24px 0', flexWrap: 'wrap', flexShrink: 0 }}>
          {BUCKETS.map(b => {
            const count = data?.[b.key]?.length ?? 0;
            return (
              <button key={b.key} onClick={() => setActiveBucket(b.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 12px', borderRadius: 20, border: 'none', fontSize: 11.5, fontWeight: 700, cursor: 'pointer',
                  background: activeBucket === b.key ? b.bg : '#F8F7FF', color: activeBucket === b.key ? b.color : '#9B97CC' }}>
                {b.icon} {b.label} {count > 0 && <span style={{ background: activeBucket === b.key ? b.color : '#C4C0E8', color: 'white', borderRadius: 20, padding: '1px 7px', fontSize: 10 }}>{count}</span>}
              </button>
            );
          })}
        </div>

        {/* List */}
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <p style={{ color: '#9B97CC', textAlign: 'center', padding: 30 }}>Загрузка...</p>
          ) : items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30 }}>
              <p style={{ fontSize: 26, margin: '0 0 8px' }}>✅</p>
              <p style={{ color: '#9B97CC', margin: 0 }}>В этой категории никого нет</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map((s: any) => (
                <div key={s.id} onClick={() => onSelectSubscriber(s)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F8F7FF', borderRadius: 12, padding: '10px 14px', cursor: 'pointer' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F0EDFF'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = '#F8F7FF'}>
                  <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'linear-gradient(135deg,#7F77DD,#5248C5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 13, flexShrink: 0 }}>
                    {s.firstName?.charAt(0) ?? '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: '#1a1040', margin: 0 }}>{s.firstName} {s.lastName}</p>
                    <p style={{ fontSize: 11, color: '#9B97CC', margin: '2px 0 0' }}>
                      {PLAN_LABELS[s.plan] ?? s.plan} · {s.manager?.name ?? 'Без менеджера'}
                    </p>
                  </div>
                  <span style={{ fontSize: 10.5, color: '#9B97CC' }}>
                    {s.trialEndsAt ? new Date(s.trialEndsAt).toLocaleDateString('ru') : s.subscriptionEndsAt ? new Date(s.subscriptionEndsAt).toLocaleDateString('ru') : ''}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
