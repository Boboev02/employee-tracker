'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';

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
  const router = useRouter();

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

  const markRead = async (id: string, taskId?: string) => {
    const t = localStorage.getItem('access_token');
    if (!t) return;
    await fetch(`https://employee-tracker.ru/api/v1/notifications/${id}/read`, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + t }
    });
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    setUnreadCount(prev => Math.max(0, prev - 1));
    if (taskId) {
      setOpen(false);
      router.push('/dashboard/tasks/' + taskId);
    }
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

  const typeIcon: Record<string, string> = {
    task_assigned: '📋',
    task_comment: '💬',
    task_status: '🔄',
  };

  return (
    <div ref={ref} style={{ position: 'fixed', bottom: '24px', right: '24px', zIndex: 9999 }}>
      {/* FAB кнопка */}
      <button
        onClick={() => { setOpen(!open); if (!open) load(); }}
        style={{
          width: '52px', height: '52px', borderRadius: '50%',
          background: '#8b7cf6', border: 'none', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '0 4px 16px rgba(139,124,246,0.5)',
          transition: 'transform 0.15s, box-shadow 0.15s',
          position: 'relative',
        }}
        onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.08)')}
        onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/>
          <path d="M13.73 21a2 2 0 0 1-3.46 0"/>
        </svg>
        {unreadCount > 0 && (
          <span style={{
            position: 'absolute', top: '2px', right: '2px',
            background: '#ef4444', color: 'white',
            borderRadius: '50%', width: '18px', height: '18px',
            fontSize: '10px', fontWeight: 700,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            border: '2px solid #8b7cf6',
          }}>
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Панель уведомлений */}
      {open && (
        <div style={{
          position: 'absolute', bottom: '64px', right: '0',
          width: '340px', maxHeight: '480px',
          background: 'var(--bg-primary)', border: '1px solid var(--border)',
          borderRadius: '16px', boxShadow: '0 8px 32px rgba(0,0,0,0.15)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
        }}>
          {/* Заголовок */}
          <div style={{
            padding: '14px 16px', borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            background: 'var(--bg-primary)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>Уведомления</span>
              {unreadCount > 0 && (
                <span style={{
                  background: '#8b7cf6', color: 'white',
                  borderRadius: '10px', padding: '1px 7px', fontSize: '11px', fontWeight: 600
                }}>{unreadCount}</span>
              )}
            </div>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '12px', color: '#8b7cf6', fontWeight: 500
              }}>
                Прочитать все
              </button>
            )}
          </div>

          {/* Список */}
          <div style={{ overflowY: 'auto', flex: 1 }}>
            {notifications.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', marginBottom: '8px' }}>🔔</div>
                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Нет уведомлений</div>
              </div>
            ) : notifications.map(n => (
              <div
                key={n.id}
                onClick={() => markRead(n.id, n.taskId)}
                style={{
                  padding: '12px 16px',
                  borderBottom: '1px solid var(--border)',
                  background: n.isRead ? 'transparent' : 'rgba(139,124,246,0.06)',
                  cursor: 'pointer',
                  display: 'flex', gap: '10px', alignItems: 'flex-start',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
                onMouseLeave={e => (e.currentTarget.style.background = n.isRead ? 'transparent' : 'rgba(139,124,246,0.06)')}
              >
                <span style={{ fontSize: '18px', flexShrink: 0 }}>{typeIcon[n.type] ?? '📌'}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)', marginBottom: '2px' }}>{n.title}</div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{n.body}</div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{timeAgo(n.createdAt)}</div>
                </div>
                {!n.isRead && (
                  <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#8b7cf6', flexShrink: 0, marginTop: '4px' }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
