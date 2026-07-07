'use client';
import { useState, useEffect } from 'react';

const API = 'https://employee-tracker.ru/api/v1';

const TRIGGER_LABELS: Record<string, string> = {
  ON_REGISTER: 'Пользователь зарегистрировался',
  DAYS_REMAINING: 'Осталось X дней',
  SUBSCRIPTION_EXPIRED: 'Подписка закончилась',
  PLAN_PURCHASED: 'Купил тариф',
  PLAN_CHANGED: 'Изменил тариф',
  INACTIVE_DAYS: 'Не заходил X дней',
  TAG_ADDED: 'Добавлен тег',
  STATUS_CHANGED: 'Изменился статус',
  MANAGER_ASSIGNED: 'Добавлен менеджер',
};
const ACTION_LABELS: Record<string, string> = {
  CREATE_TASK: '📋 Создать задачу',
  UPDATE_STATUS: '🔄 Изменить статус',
  ASSIGN_MANAGER: '👤 Назначить менеджера',
  ADD_TAG: '🏷 Добавить тег',
  SEND_EMAIL: '📧 Отправить Email',
  SEND_WHATSAPP: '💬 Отправить WhatsApp',
  SEND_TELEGRAM: '✈️ Отправить Telegram',
  NOTIFY_USER: '🔔 Создать уведомление',
  ADD_COMMENT: '💭 Добавить комментарий',
};
const STATUS_LABELS: Record<string, string> = { NEW: 'Новый', IN_PROGRESS: 'В работе', CONTACTED: 'Связались', RENEWED: 'Продлил', LOST: 'Потерян', ARCHIVED: 'В архиве' };
const DATE_FIELD_OPTIONS = [{ v: 'trialEndsAt', l: 'Окончание триала' }, { v: 'subscriptionEndsAt', l: 'Окончание подписки' }];

export function AutomationBuilder({ h, employees, onClose }: any) {
  const [rules, setRules] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<any>({ name: '', triggerType: 'DAYS_REMAINING', triggerDateField: 'trialEndsAt', triggerDays: 3, actions: [{ type: 'NOTIFY_USER', params: {} }] });

  const load = async () => {
    setLoading(true);
    const r = await fetch(`${API}/subscriber-automation/rules`, { headers: h() });
    setRules(await r.json().catch(() => []));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const createRule = async () => {
    if (!form.name.trim()) return;
    await fetch(`${API}/subscriber-automation/rules`, { method: 'POST', headers: h(), body: JSON.stringify(form) });
    setShowForm(false);
    setForm({ name: '', triggerType: 'DAYS_REMAINING', triggerDateField: 'trialEndsAt', triggerDays: 3, actions: [{ type: 'NOTIFY_USER', params: {} }] });
    load();
  };
  const toggleActive = async (rule: any) => {
    await fetch(`${API}/subscriber-automation/rules/${rule.id}`, { method: 'PATCH', headers: h(), body: JSON.stringify({ isActive: !rule.isActive }) });
    load();
  };
  const deleteRule = async (id: string) => {
    if (!confirm('Удалить правило?')) return;
    await fetch(`${API}/subscriber-automation/rules/${id}`, { method: 'DELETE', headers: h() });
    load();
  };
  const updateAction = (patch: any) => setForm((f: any) => ({ ...f, actions: [{ ...f.actions[0], ...patch }] }));
  const updateActionParam = (key: string, value: any) => setForm((f: any) => ({ ...f, actions: [{ ...f.actions[0], params: { ...f.actions[0].params, [key]: value } }] }));

  const ruleSummary = (rule: any) => {
    let trigger = TRIGGER_LABELS[rule.triggerType];
    if (rule.triggerType === 'DAYS_REMAINING') trigger += ` (${DATE_FIELD_OPTIONS.find(d => d.v === rule.triggerDateField)?.l ?? ''}, ${rule.triggerDays} дн.)`;
    if (rule.triggerType === 'INACTIVE_DAYS') trigger += ` (${rule.triggerDays} дн.)`;
    if (rule.triggerType === 'TAG_ADDED' && rule.triggerTag) trigger += ` («${rule.triggerTag}»)`;
    if (rule.triggerType === 'STATUS_CHANGED' && rule.triggerStatus) trigger += ` (→ ${STATUS_LABELS[rule.triggerStatus] ?? rule.triggerStatus})`;
    return `${trigger} · ${(rule.actions as any[]).map(a => ACTION_LABELS[a.type] ?? a.type).join(', ')}`;
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,16,64,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 20, width: 620, maxHeight: '88vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(127,119,221,0.25)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F3F0FF', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1a1040', margin: 0 }}>⚡ Автоматизация</h3>
            <p style={{ fontSize: 11.5, color: '#9B97CC', margin: '2px 0 0' }}>Если [условие] → тогда [действие]</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9B97CC', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          <button onClick={() => setShowForm(true)} style={{ marginBottom: 14, background: 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Новое правило</button>

          {loading ? (
            <p style={{ color: '#9B97CC', textAlign: 'center', padding: 30 }}>Загрузка...</p>
          ) : rules.length === 0 ? (
            <div style={{ textAlign: 'center', padding: 30 }}>
              <p style={{ fontSize: 26, margin: '0 0 8px' }}>⚡</p>
              <p style={{ color: '#9B97CC', margin: 0 }}>Правил пока нет</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {rules.map(rule => (
                <div key={rule.id} style={{ background: '#F8F7FF', borderRadius: 12, padding: '12px 16px', opacity: rule.isActive ? 1 : 0.5, display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, fontWeight: 800, color: '#1a1040', margin: 0 }}>{rule.name}</p>
                    <p style={{ fontSize: 11, color: '#9B97CC', margin: '3px 0 0' }}>{ruleSummary(rule)}</p>
                  </div>
                  <input type="checkbox" checked={rule.isActive} onChange={() => toggleActive(rule)} style={{ width: 16, height: 16, accentColor: '#7F77DD', cursor: 'pointer' }} />
                  <button onClick={() => deleteRule(rule.id)} style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: 'none', borderRadius: 8, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>✕</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,16,64,0.5)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 24, width: 460, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(127,119,221,0.25)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1a1040', margin: '0 0 16px' }}>Новое правило</h3>

            <p style={{ fontSize: 11, color: '#9B97CC', fontWeight: 700, margin: '0 0 6px' }}>НАЗВАНИЕ</p>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Например: Напомнить за 3 дня до конца триала"
              style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 14, outline: 'none', boxSizing: 'border-box' }} />

            <p style={{ fontSize: 11, color: '#9B97CC', fontWeight: 700, margin: '0 0 6px' }}>ЕСЛИ</p>
            <select value={form.triggerType} onChange={e => setForm({ ...form, triggerType: e.target.value })}
              style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 10, outline: 'none' }}>
              {Object.entries(TRIGGER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>

            {form.triggerType === 'DAYS_REMAINING' && (
              <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 8, marginBottom: 14 }}>
                <select value={form.triggerDateField} onChange={e => setForm({ ...form, triggerDateField: e.target.value })}
                  style={{ background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none' }}>
                  {DATE_FIELD_OPTIONS.map(d => <option key={d.v} value={d.v}>{d.l}</option>)}
                </select>
                <input type="number" value={form.triggerDays} onChange={e => setForm({ ...form, triggerDays: parseInt(e.target.value) || 0 })} placeholder="Дней"
                  style={{ background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none' }} />
              </div>
            )}
            {form.triggerType === 'INACTIVE_DAYS' && (
              <input type="number" value={form.triggerDays} onChange={e => setForm({ ...form, triggerDays: parseInt(e.target.value) || 0 })} placeholder="Дней без входа"
                style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 14, outline: 'none', boxSizing: 'border-box' }} />
            )}
            {form.triggerType === 'TAG_ADDED' && (
              <input value={form.triggerTag ?? ''} onChange={e => setForm({ ...form, triggerTag: e.target.value })} placeholder="Тег (необязательно — иначе любой тег)"
                style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 14, outline: 'none', boxSizing: 'border-box' }} />
            )}
            {form.triggerType === 'STATUS_CHANGED' && (
              <select value={form.triggerStatus ?? ''} onChange={e => setForm({ ...form, triggerStatus: e.target.value || undefined })}
                style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 14, outline: 'none' }}>
                <option value="">Любой статус</option>
                {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            )}

            <p style={{ fontSize: 11, color: '#9B97CC', fontWeight: 700, margin: '14px 0 6px' }}>ТО ВЫПОЛНИТЬ</p>
            <select value={form.actions[0]?.type} onChange={e => updateAction({ type: e.target.value, params: {} })}
              style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 10, outline: 'none' }}>
              {Object.entries(ACTION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>

            {form.actions[0]?.type === 'UPDATE_STATUS' && (
              <select value={form.actions[0].params.status ?? ''} onChange={e => updateActionParam('status', e.target.value)}
                style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 14, outline: 'none' }}>
                <option value="">— выбрать статус —</option>
                {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            )}
            {form.actions[0]?.type === 'ASSIGN_MANAGER' && (
              <select value={form.actions[0].params.managerId ?? ''} onChange={e => updateActionParam('managerId', e.target.value)}
                style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 14, outline: 'none' }}>
                <option value="">— выбрать менеджера —</option>
                {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
            )}
            {form.actions[0]?.type === 'ADD_TAG' && (
              <input value={form.actions[0].params.tag ?? ''} onChange={e => updateActionParam('tag', e.target.value)} placeholder="Название тега"
                style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 14, outline: 'none', boxSizing: 'border-box' }} />
            )}
            {(form.actions[0]?.type === 'SEND_EMAIL' || form.actions[0]?.type === 'SEND_WHATSAPP' || form.actions[0]?.type === 'SEND_TELEGRAM') && (
              <textarea value={form.actions[0].params.content ?? ''} onChange={e => updateActionParam('content', e.target.value)} placeholder="Текст (доступны {firstName}, {plan}, {trialEndsAt})" rows={3}
                style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 14, outline: 'none', boxSizing: 'border-box', resize: 'none' }} />
            )}
            {form.actions[0]?.type === 'NOTIFY_USER' && (
              <>
                <select value={form.actions[0].params.userId ?? ''} onChange={e => updateActionParam('userId', e.target.value)}
                  style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 10, outline: 'none' }}>
                  <option value="">— или ответственный менеджер по умолчанию —</option>
                  {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <textarea value={form.actions[0].params.message ?? ''} onChange={e => updateActionParam('message', e.target.value)} placeholder="Текст уведомления" rows={2}
                  style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 14, outline: 'none', boxSizing: 'border-box', resize: 'none' }} />
              </>
            )}
            {form.actions[0]?.type === 'ADD_COMMENT' && (
              <textarea value={form.actions[0].params.content ?? ''} onChange={e => updateActionParam('content', e.target.value)} placeholder="Текст комментария" rows={2}
                style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 14, outline: 'none', boxSizing: 'border-box', resize: 'none' }} />
            )}
            {form.actions[0]?.type === 'CREATE_TASK' && (
              <p style={{ fontSize: 11, color: '#D97706', background: '#FFFBEB', padding: '8px 10px', borderRadius: 8, marginBottom: 14 }}>⚠ Для создания задачи нужен Проект и Исполнитель — настройте вручную после создания правила</p>
            )}

            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={createRule} disabled={!form.name.trim()} style={{ flex: 1, background: form.name.trim() ? 'linear-gradient(135deg,#7F77DD,#5248C5)' : '#EDE9FE', color: form.name.trim() ? 'white' : '#C4C0E8', border: 'none', borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 700, cursor: form.name.trim() ? 'pointer' : 'not-allowed' }}>Создать правило</button>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, background: '#F8F7FF', color: '#6B7280', border: '1px solid #EDE9FE', borderRadius: 10, padding: 10, fontSize: 13, cursor: 'pointer' }}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
