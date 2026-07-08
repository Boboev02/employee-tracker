'use client';
import { useState, useEffect } from 'react';
import { PLAN_LABELS, PLAN_COLORS, STATUS_LABELS } from '@/lib/subscriberConstants';

const API = 'https://employee-tracker.ru/api/v1';

const FIELD_LABELS: Record<string, string> = { crmStatus: 'CRM статус', tags: 'Теги', managerId: 'Менеджер', plan: 'Тариф', planStatus: 'Статус подписки' };

const TABS = [
  { key: 'info', label: 'Основная информация', icon: '👤' },
  { key: 'subscription', label: 'Подписка', icon: '💳' },
  { key: 'crm', label: 'CRM', icon: '⚙️' },
  { key: 'tasks', label: 'Задачи', icon: '📋' },
  { key: 'history', label: 'История', icon: '🕐' },
  { key: 'comments', label: 'Комментарии', icon: '💬' },
] as const;

function fmtVal(field: string, raw: string | null): string {
  if (raw === null || raw === undefined) return '—';
  try {
    const v = JSON.parse(raw);
    if (v === null) return '—';
    if (field === 'crmStatus') return STATUS_LABELS[v] ?? v;
    if (field === 'plan') return PLAN_LABELS[v] ?? v;
    if (field === 'tags') return Array.isArray(v) ? v.join(', ') || '—' : String(v);
    return String(v);
  } catch { return raw; }
}

export function SubscriberCard({ subscriberId, employees, h, onClose, onUpdate }: any) {
  const [tab, setTab] = useState<typeof TABS[number]['key']>('info');
  const [full, setFull] = useState<any>(null);
  const [timeline, setTimeline] = useState<any[]>([]);
  const [comments, setComments] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [newComment, setNewComment] = useState('');
  const [newTag, setNewTag] = useState('');
  const [loading, setLoading] = useState(true);
  const [quickChannel, setQuickChannel] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = async () => {
    setLoading(true);
    const r = await fetch(`${API}/subscribers/${subscriberId}`, { headers: h() });
    setFull(await r.json().catch(() => null));
    setLoading(false);
  };
  const loadTimeline = async () => {
    const r = await fetch(`${API}/subscribers/${subscriberId}/timeline`, { headers: h() });
    setTimeline(await r.json().catch(() => []));
  };
  const loadComments = async () => {
    const r = await fetch(`${API}/subscribers/${subscriberId}/comments`, { headers: h() });
    setComments(await r.json().catch(() => []));
  };
  const loadTasks = async () => {
    const r = await fetch(`${API}/subscribers/${subscriberId}/tasks`, { headers: h() });
    setTasks(await r.json().catch(() => []));
  };

  useEffect(() => { load(); }, [subscriberId]);
  useEffect(() => { if (tab === 'history') loadTimeline(); if (tab === 'comments') loadComments(); if (tab === 'tasks') loadTasks(); }, [tab]);

  const patch = async (data: any) => {
    await fetch(`${API}/subscribers/${subscriberId}`, { method: 'PATCH', headers: h(), body: JSON.stringify(data) });
    await load();
    onUpdate?.();
  };

  const addTag = () => { if (!newTag.trim()) return; patch({ tags: [...(full.tags ?? []), newTag.trim()] }); setNewTag(''); };
  const removeTag = (t: string) => patch({ tags: (full.tags ?? []).filter((x: string) => x !== t) });

  const copyContact = () => {
    const text = [full.firstName, full.lastName, full.email, full.phone].filter(Boolean).join(' · ');
    navigator.clipboard?.writeText(text).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); });
  };

  const logComm = async (channel: string, content?: string) => {
    await fetch(`${API}/subscribers/${subscriberId}/communications`, { method: 'POST', headers: h(), body: JSON.stringify({ channel, content }) }).catch(() => {});
    if (tab === 'history') loadTimeline();
  };

  const submitComment = async () => {
    if (!newComment.trim()) return;
    await fetch(`${API}/subscribers/${subscriberId}/comments`, { method: 'POST', headers: h(), body: JSON.stringify({ content: newComment }) });
    setNewComment('');
    loadComments();
  };
  const deleteComment = async (id: string) => {
    await fetch(`${API}/subscribers/comments/${id}`, { method: 'DELETE', headers: h() });
    loadComments();
  };

  if (loading || !full) {
    return (
      <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,16,64,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.15s ease-out' }}>
        <div style={{ background: 'white', borderRadius: 20, padding: 40, color: '#9B97CC' }}>Загрузка...</div>
      </div>
    );
  }

  const pc = PLAN_COLORS[full.plan] ?? PLAN_COLORS.NONE;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,16,64,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.15s ease-out' }}>
      <div style={{ background: 'white', borderRadius: 20, width: 560, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(127,119,221,0.25)' }}>
        {/* Header */}
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F3F0FF', display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
          <div style={{ width: 44, height: 44, borderRadius: '50%', background: 'linear-gradient(135deg,#7F77DD,#5248C5)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontWeight: 700, fontSize: 16, flexShrink: 0 }}>
            {full.firstName?.charAt(0) ?? '?'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h3 style={{ fontSize: 15.5, fontWeight: 800, color: '#1a1040', margin: 0 }}>{full.firstName} {full.lastName}</h3>
            <p style={{ fontSize: 11.5, color: '#9B97CC', margin: '2px 0 0' }}>{full.email} {full.phone && '· ' + full.phone}</p>
          </div>
          <span style={{ fontSize: 11, fontWeight: 700, color: pc.c, background: pc.bg, padding: '4px 12px', borderRadius: 20, flexShrink: 0 }}>{PLAN_LABELS[full.plan] ?? '—'}</span>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9B97CC', fontSize: 20, cursor: 'pointer', flexShrink: 0 }}>✕</button>
        </div>

        {/* Quick actions: Email / WhatsApp / Telegram / Phone / Copy */}
        <div style={{ padding: '10px 24px', borderBottom: '1px solid #F3F0FF', display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap' }}>
          <QuickAction icon="📧" label="Email" disabled={!full.email} onClick={() => setQuickChannel('EMAIL')} />
          <QuickAction icon="💬" label="WhatsApp" disabled={!full.phone} onClick={() => setQuickChannel('WHATSAPP')} />
          <QuickAction icon="✈️" label="Telegram" disabled={!full.username && !full.phone} onClick={() => setQuickChannel('TELEGRAM')} />
          <QuickAction icon="📞" label="Позвонить" disabled={!full.phone} onClick={() => { window.open(`tel:${full.phone}`, '_self'); logComm('PHONE'); }} />
          <button onClick={copyContact} title="Скопировать контакты"
            style={{ marginLeft: 'auto', background: copied ? '#DCFCE7' : '#F8F7FF', color: copied ? '#16A34A' : '#9B97CC', border: '1px solid #EDE9FE', borderRadius: 10, padding: '7px 12px', fontSize: 11.5, fontWeight: 700, cursor: 'pointer' }}>
            {copied ? '✓ Скопировано' : '📋 Копировать'}
          </button>
        </div>

        {quickChannel && (
          <QuickActionPanel channel={quickChannel} subscriber={full} h={h}
            onClose={() => setQuickChannel(null)}
            onSent={(content: string) => { logComm(quickChannel, content); setQuickChannel(null); }} />
        )}

        {/* Tabs */}
        <div style={{ display: 'flex', gap: 2, padding: '10px 16px 0', borderBottom: '1px solid #F3F0FF', flexShrink: 0, overflowX: 'auto' }}>
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ padding: '8px 14px', borderRadius: '10px 10px 0 0', border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap',
                background: tab === t.key ? '#F0EDFF' : 'transparent', color: tab === t.key ? '#7F77DD' : '#9B97CC',
                borderBottom: tab === t.key ? '2px solid #7F77DD' : '2px solid transparent' }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {tab === 'info' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <InfoRow label="Имя" value={`${full.firstName ?? ''} ${full.lastName ?? ''}`.trim() || '—'} />
              <InfoRow label="Username" value={full.username ?? '—'} />
              <InfoRow label="Email" value={full.email ?? '—'} />
              <InfoRow label="Телефон" value={full.phone ?? '—'} />
              <InfoRow label="Роль во внешней системе" value={full.externalRole ?? '—'} />
              <InfoRow label="Источник" value={full.externalSource ?? '—'} />
              <InfoRow label="Внешний ID" value={full.externalId ?? '—'} />
              <InfoRow label="Дата регистрации" value={full.registeredAt ? new Date(full.registeredAt).toLocaleDateString('ru') : '—'} />
              <InfoRow label="Последний вход" value={full.lastLoginAt ? new Date(full.lastLoginAt).toLocaleString('ru') : '—'} />
              <InfoRow label="Последняя синхронизация" value={full.lastSyncAt ? new Date(full.lastSyncAt).toLocaleString('ru') : '—'} />
            </div>
          )}

          {tab === 'subscription' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <InfoRow label="Тариф" value={<span style={{ fontSize: 12, fontWeight: 700, color: pc.c, background: pc.bg, padding: '3px 10px', borderRadius: 20 }}>{PLAN_LABELS[full.plan] ?? '—'}</span>} />
              <InfoRow label="Статус подписки" value={full.planStatus ?? '—'} />
              <InfoRow label="Окончание триала" value={full.trialEndsAt ? new Date(full.trialEndsAt).toLocaleDateString('ru') : '—'} />
              <InfoRow label="Окончание подписки" value={full.subscriptionEndsAt ? new Date(full.subscriptionEndsAt).toLocaleDateString('ru') : '—'} />
            </div>
          )}

          {tab === 'crm' && (
            <div>
              <p style={{ fontSize: 10.5, color: '#9B97CC', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 8px' }}>CRM статус</p>
              <select value={full.crmStatus} onChange={e => patch({ crmStatus: e.target.value })}
                style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', marginBottom: 18 }}>
                {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>

              <p style={{ fontSize: 10.5, color: '#9B97CC', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 8px' }}>Ответственный менеджер</p>
              <select value={full.managerId ?? ''} onChange={e => patch({ managerId: e.target.value || null })}
                style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', marginBottom: 18 }}>
                <option value="">— не назначен —</option>
                {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>

              <p style={{ fontSize: 10.5, color: '#9B97CC', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 8px' }}>Теги</p>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 8 }}>
                {(full.tags ?? []).map((t: string) => (
                  <span key={t} style={{ fontSize: 11, background: '#F3F0FF', color: '#7F77DD', padding: '3px 10px', borderRadius: 20, display: 'flex', alignItems: 'center', gap: 5 }}>
                    {t} <button onClick={() => removeTag(t)} style={{ background: 'none', border: 'none', color: '#7F77DD', cursor: 'pointer', fontSize: 10 }}>✕</button>
                  </span>
                ))}
                {(!full.tags || full.tags.length === 0) && <span style={{ fontSize: 12, color: '#C4C0E8' }}>Тегов нет</span>}
              </div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
                <input value={newTag} onChange={e => setNewTag(e.target.value)} onKeyDown={e => e.key === 'Enter' && addTag()} placeholder="Новый тег..."
                  style={{ flex: 1, background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '7px 10px', fontSize: 12.5, outline: 'none' }} />
                <button onClick={addTag} style={{ background: '#EDE9FE', color: '#7F77DD', border: 'none', borderRadius: 10, padding: '7px 14px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>+</button>
              </div>

              <p style={{ fontSize: 10.5, color: '#9B97CC', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 8px' }}>Заметки</p>
              <textarea defaultValue={full.notes ?? ''} onBlur={e => patch({ notes: e.target.value })} rows={4} placeholder="Внутренние заметки о подписчике..."
                style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, outline: 'none', boxSizing: 'border-box', resize: 'none' }} />
            </div>
          )}

          {tab === 'tasks' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {tasks.length === 0 && (
                <p style={{ fontSize: 12.5, color: '#C4C0E8', textAlign: 'center', padding: '20px 0' }}>Связанных задач пока нет</p>
              )}
              {tasks.map((t: any) => {
                const STATUS_C: Record<string, { bg: string; c: string; l: string }> = {
                  NEW: { bg: '#EDE9FE', c: '#7F77DD', l: 'Новая' }, IN_PROGRESS: { bg: '#DBEAFE', c: '#2563EB', l: 'В работе' },
                  REVIEW: { bg: '#FEF3C7', c: '#D97706', l: 'На проверке' }, DONE: { bg: '#DCFCE7', c: '#16A34A', l: 'Готово' },
                };
                const sc = STATUS_C[t.status] ?? { bg: '#F3F4F6', c: '#6B7280', l: t.status };
                return (
                  <a key={t.id} href={`/dashboard/tasks/${t.id}`} target="_blank" rel="noopener noreferrer"
                    style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F8F7FF', borderRadius: 12, padding: '10px 14px', textDecoration: 'none' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: 12.5, fontWeight: 700, color: '#1a1040', margin: 0 }}>{t.title}</p>
                      <p style={{ fontSize: 11, color: '#9B97CC', margin: '2px 0 0' }}>{t.assignee?.name ?? 'Не назначен'} {t.dueDate && `· до ${new Date(t.dueDate).toLocaleDateString('ru')}`}</p>
                    </div>
                    <span style={{ fontSize: 10.5, fontWeight: 700, color: sc.c, background: sc.bg, padding: '3px 10px', borderRadius: 20, flexShrink: 0 }}>{sc.l}</span>
                  </a>
                );
              })}
            </div>
          )}

          {tab === 'history' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {timeline.length === 0 && <p style={{ fontSize: 12.5, color: '#C4C0E8', textAlign: 'center', padding: '20px 0' }}>Событий пока нет</p>}
              {timeline.map(ev => (
                <div key={ev.id} style={{ display: 'flex', gap: 10, paddingBottom: 10, borderBottom: '1px solid #F8F7FF' }}>
                  <div style={{ width: 28, height: 28, borderRadius: '50%', background: ev.type === 'comment' ? '#EDE9FE' : ev.type === 'communication' ? '#DBEAFE' : '#F0EDFF', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: 13 }}>
                    {ev.type === 'comment' ? '💬' : ev.type === 'communication' ? ev.channelIcon : '🔄'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    {ev.type === 'history' && (
                      <p style={{ fontSize: 12.5, color: '#1a1040', margin: 0 }}>
                        <b>{ev.fieldLabel}</b>: {fmtVal(ev.field, ev.oldValue)} → <b>{fmtVal(ev.field, ev.newValue)}</b>
                      </p>
                    )}
                    {ev.type === 'comment' && <p style={{ fontSize: 12.5, color: '#1a1040', margin: 0 }}>{ev.content}</p>}
                    {ev.type === 'communication' && (
                      <p style={{ fontSize: 12.5, color: '#1a1040', margin: 0 }}>
                        Связь через <b>{ev.channel}</b>{ev.content && <>: «{ev.content.slice(0, 80)}{ev.content.length > 80 ? '…' : ''}»</>}
                      </p>
                    )}
                    <p style={{ fontSize: 10.5, color: '#9B97CC', margin: '3px 0 0' }}>
                      {ev.isSystem ? 'Автоматически (синхронизация)' : (ev.user?.name ?? 'Система')} · {new Date(ev.createdAt).toLocaleString('ru')}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'comments' && (
            <div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <textarea value={newComment} onChange={e => setNewComment(e.target.value)} placeholder="Написать комментарий..." rows={2}
                  style={{ flex: 1, background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, outline: 'none', resize: 'none' }} />
              </div>
              <button onClick={submitComment} disabled={!newComment.trim()}
                style={{ background: newComment.trim() ? 'linear-gradient(135deg,#7F77DD,#5248C5)' : '#EDE9FE', color: newComment.trim() ? 'white' : '#C4C0E8', border: 'none', borderRadius: 10, padding: '8px 18px', fontSize: 12.5, fontWeight: 700, cursor: newComment.trim() ? 'pointer' : 'not-allowed', marginBottom: 18 }}>
                Добавить комментарий
              </button>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {comments.length === 0 && <p style={{ fontSize: 12.5, color: '#C4C0E8', textAlign: 'center', padding: '10px 0' }}>Комментариев пока нет</p>}
                {comments.map(c => (
                  <div key={c.id} style={{ background: '#F8F7FF', borderRadius: 12, padding: '10px 14px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontSize: 12, fontWeight: 700, color: '#1a1040' }}>{c.author?.name ?? 'Пользователь'}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{ fontSize: 10.5, color: '#9B97CC' }}>{new Date(c.createdAt).toLocaleString('ru')}</span>
                        <button onClick={() => deleteComment(c.id)} style={{ background: 'none', border: 'none', color: '#C4C0E8', cursor: 'pointer', fontSize: 12 }}>✕</button>
                      </div>
                    </div>
                    <p style={{ fontSize: 12.5, color: '#1a1040', margin: 0 }}>{c.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: any }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F8F7FF' }}>
      <span style={{ fontSize: 12, color: '#9B97CC' }}>{label}</span>
      <span style={{ fontSize: 12.5, fontWeight: 600, color: '#1a1040' }}>{value}</span>
    </div>
  );
}

function QuickAction({ icon, label, onClick, disabled }: { icon: string; label: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button onClick={onClick} disabled={disabled} title={disabled ? 'Нет данных для контакта' : label}
      style={{ display: 'flex', alignItems: 'center', gap: 6, background: disabled ? '#F8F7FF' : '#F0EDFF', color: disabled ? '#C4C0E8' : '#7F77DD', border: 'none', borderRadius: 10, padding: '7px 12px', fontSize: 11.5, fontWeight: 700, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      {icon} {label}
    </button>
  );
}

/** Панель выбора шаблона + предпросмотр перед открытием внешнего канала */
function QuickActionPanel({ channel, subscriber, h, onClose, onSent }: any) {
  const [templates, setTemplates] = useState<any[]>([]);
  const [selectedTemplate, setSelectedTemplate] = useState<any>(null);
  const [message, setMessage] = useState('');
  const [showTemplateManager, setShowTemplateManager] = useState(false);

  const CHANNEL_LABELS: Record<string, string> = { EMAIL: 'Email', WHATSAPP: 'WhatsApp', TELEGRAM: 'Telegram' };

  const interpolate = (content: string) => content.replace(/\{(\w+)\}/g, (_: string, key: string) => {
    if (key === 'plan') return PLAN_LABELS[subscriber.plan] ?? subscriber.plan ?? '';
    return subscriber[key] ?? '';
  });

  useEffect(() => {
    fetch(`${API}/subscribers/templates?channel=${channel}`, { headers: h() }).then(r => r.json()).then(setTemplates).catch(() => setTemplates([]));
  }, [channel]);

  const applyTemplate = (t: any) => { setSelectedTemplate(t); setMessage(interpolate(t.content)); };

  const openChannel = () => {
    if (channel === 'EMAIL') {
      const subject = encodeURIComponent(selectedTemplate?.subject ? interpolate(selectedTemplate.subject) : '');
      window.open(`mailto:${subscriber.email}?subject=${subject}&body=${encodeURIComponent(message)}`, '_self');
    } else if (channel === 'WHATSAPP') {
      const phone = (subscriber.phone ?? '').replace(/[^\d]/g, '');
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    } else if (channel === 'TELEGRAM') {
      const target = subscriber.username ? subscriber.username.replace('@', '') : (subscriber.phone ?? '').replace(/[^\d]/g, '');
      window.open(`https://t.me/${target}`, '_blank');
    }
    onSent(message);
  };

  return (
    <div style={{ padding: '14px 24px', borderBottom: '1px solid #F3F0FF', background: '#FAFAFE', flexShrink: 0 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
        <p style={{ fontSize: 12, fontWeight: 800, color: '#1a1040', margin: 0 }}>{CHANNEL_LABELS[channel]}</p>
        <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9B97CC', cursor: 'pointer', fontSize: 14 }}>✕</button>
      </div>

      {templates.length > 0 && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
          {templates.map(t => (
            <button key={t.id} onClick={() => applyTemplate(t)}
              style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '1px solid', borderColor: selectedTemplate?.id === t.id ? '#7F77DD' : '#EDE9FE', background: selectedTemplate?.id === t.id ? '#EDE9FE' : 'white', color: selectedTemplate?.id === t.id ? '#7F77DD' : '#6B7280', cursor: 'pointer', fontWeight: 600 }}>
              {t.name}
            </button>
          ))}
        </div>
      )}

      <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder={`Текст сообщения для ${subscriber.firstName}...`} rows={3}
        style={{ width: '100%', background: 'white', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, outline: 'none', boxSizing: 'border-box', resize: 'none', marginBottom: 8 }} />

      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button onClick={openChannel} style={{ background: 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
          Открыть {CHANNEL_LABELS[channel]} →
        </button>
        <button onClick={() => setShowTemplateManager(true)} style={{ background: 'none', border: '1px solid #EDE9FE', color: '#9B97CC', borderRadius: 10, padding: '8px 12px', fontSize: 11.5, cursor: 'pointer' }}>
          + Новый шаблон
        </button>
      </div>

      {showTemplateManager && (
        <NewTemplateModal channel={channel} h={h} onClose={() => setShowTemplateManager(false)}
          onCreated={(t: any) => { setTemplates(p => [t, ...p]); setShowTemplateManager(false); }} />
      )}
    </div>
  );
}

function NewTemplateModal({ channel, h, onClose, onCreated }: any) {
  const [name, setName] = useState('');
  const [subject, setSubject] = useState('');
  const [content, setContent] = useState('');

  const create = async () => {
    if (!name.trim() || !content.trim()) return;
    const r = await fetch(`${API}/subscribers/templates`, { method: 'POST', headers: h(), body: JSON.stringify({ name, channel, subject, content }) });
    onCreated(await r.json());
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,16,64,0.4)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.15s ease-out' }}>
      <div style={{ background: 'white', borderRadius: 16, padding: 20, width: 340, boxShadow: '0 24px 64px rgba(127,119,221,0.25)' }}>
        <p style={{ fontSize: 14, fontWeight: 800, color: '#1a1040', margin: '0 0 12px' }}>Новый шаблон</p>
        <input value={name} onChange={e => setName(e.target.value)} placeholder="Название шаблона"
          style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, marginBottom: 8, outline: 'none', boxSizing: 'border-box' }} />
        {channel === 'EMAIL' && (
          <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Тема письма"
            style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, marginBottom: 8, outline: 'none', boxSizing: 'border-box' }} />
        )}
        <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Текст (доступны {firstName}, {plan}, {trialEndsAt})" rows={4}
          style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '8px 12px', fontSize: 12.5, marginBottom: 12, outline: 'none', boxSizing: 'border-box', resize: 'none' }} />
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={create} style={{ flex: 1, background: 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white', border: 'none', borderRadius: 10, padding: 9, fontSize: 12.5, fontWeight: 700, cursor: 'pointer' }}>Создать</button>
          <button onClick={onClose} style={{ flex: 1, background: '#F8F7FF', color: '#6B7280', border: '1px solid #EDE9FE', borderRadius: 10, padding: 9, fontSize: 12.5, cursor: 'pointer' }}>Отмена</button>
        </div>
      </div>
    </div>
  );
}
