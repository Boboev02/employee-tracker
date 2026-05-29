'use client';
import { useEffect, useState, useRef } from 'react';

interface Notification {
  id: string;
  type: string;
  title: string;
  body: string;
  isRead: boolean;
  taskId?: string;
  createdAt: string;
}

export function NotificationBell() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const load = async () => {
    const t = localStorage.getItem('access_token');
    if (!t) return;
    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/notifications', {
        headers: { Authorization: 'Bearer ' + t }
      });
      const data = await res.json();
      if (Array.isArray(data)) {
        setNotifications(data);
        setUnreadCount(data.filter((n: Notification) => !n.isRead).length);
      }
    } catch {}
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const markAllRead = async () => {
    const t = localStorage.getItem('access_token');
    if (!t) return;
    await fetch('https://employee-tracker.ru/api/v1/notifications/read-all', {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + t }
    });
    setUnreadCount(0);
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
  };

  const markRead = async (id: string) => {
    const t = localStorage.getItem('access_token');
    if (!t) return;
    await fetch(`https://employee-tracker.ru/api/v1/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + t }
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
  };

  const timeAgo = (date: string) => {
    const diff = Date.now() - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return 'только что';
    if (mins < 60) return `${mins}м назад`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}ч назад`;
    return `${Math.floor(hours / 24)}д назад`;
  };

  return (
    <div ref={ref} style={{ position: 'relative' }}>
      <button
        onClick={() => { setOpen(!open); if (!open) load(); }}
        style={{ background: 'none', border: 'none', cursor: 'pointer', position: 'relative', padding: '4px', borderRadius: '8px', color: 'var(--text-secondary)' }}
      >
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '0', right: '0',
            background: '#ef4444', color: 'white',
            borderRadius: '50%', width: '16px', height: '16px',
            fontSize: '10px', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center'
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div style={{
          position: 'absolute', right: 0, top: '36px', width: '320px',
          background: 'var(--bg-primary)', border: '1px solid var(--border)',
          borderRadius: '12px', boxShadow: '0 8px 24px rgba(0,0,0,0.12)',
          zIndex: 1000, overflow: 'hidden'
        }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 600, fontSize: '14px' }}>Уведомления</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '12px', color: 'var(--accent)' }}>
                Прочитать все
              </button>
            )}
          </div>
          <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
                Нет уведомлений
              </div>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  style={{
                    padding: '12px 16px', borderBottom: '1px solid var(--border)',
                    background: n.isRead ? 'transparent' : 'var(--bg-secondary)',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontWeight: 600, fontSize: '13px', marginBottom: '2px' }}>{n.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px' }}>{n.body}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{timeAgo(n.createdAt)}</div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
