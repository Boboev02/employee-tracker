'use client';
import { useState, useEffect } from 'react';

const API = 'https://employee-tracker.ru/api/v1';

const TRIGGER_LABELS: Record<string, string> = {
  ON_CREATE: 'При создании',
  ON_STAGE_ENTER: 'При переходе на стадию',
  ON_FIELD_CHANGE: 'При изменении поля',
  ON_TIME_ELAPSED: 'Прошло время без действий',
  ON_DATE_APPROACHING: 'Приближается дата (подписка)',
};
const STAGE_OPTIONS: Record<string, { v: string; l: string }[]> = {
  DEAL: [
    { v: 'NEW', l: 'Новая' }, { v: 'QUALIFIED', l: 'Квалифицирована' }, { v: 'PROPOSAL', l: 'Предложение' },
    { v: 'NEGOTIATION', l: 'Переговоры' }, { v: 'WON', l: 'Выиграна' }, { v: 'LOST', l: 'Проиграна' },
  ],
  LEAD: [
    { v: 'NEW', l: 'Новый' }, { v: 'IN_PROGRESS', l: 'В работе' }, { v: 'CONVERTED', l: 'Конвертирован' }, { v: 'LOST', l: 'Потерян' },
  ],
  CONTACT: [],
};
const DATE_FIELD_OPTIONS = [
  { v: 'trialEndsAt', l: 'Окончание триала' },
  { v: 'subscriptionEndsAt', l: 'Окончание подписки' },
];
const ACTION_LABELS: Record<string, string> = {
  CREATE_TASK: '📋 Поставить задачу',
  NOTIFY_USER: '🔔 Уведомить сотрудника',
  UPDATE_FIELD: '✏️ Изменить поле',
  CHANGE_OWNER: '👤 Сменить ответственного',
  SEND_CHAT_MESSAGE: '💬 Написать в чат',
};

export function CrmAutomationTab({ card }: { card: React.CSSProperties }) {
  const [rules, setRules] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [entityType, setEntityType] = useState<'DEAL' | 'LEAD' | 'CONTACT'>('DEAL');
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState<any>({
    name: '', triggerType: 'ON_STAGE_ENTER', triggerStage: 'NEW', triggerDelayMinutes: 60,
    actions: [{ type: 'CREATE_TASK', params: {} }],
  });

  const h = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('access_token') });

  const load = async () => {
    setLoading(true);
    const [rRes, eRes] = await Promise.all([
      fetch(`${API}/crm/automation/rules?entityType=${entityType}`, { headers: h() }),
      fetch(`${API}/employees?limit=200`, { headers: h() }),
    ]);
    setRules(await rRes.json().catch(() => []));
    const eData = await eRes.json().catch(() => ({}));
    setEmployees(eData.employees ?? (Array.isArray(eData) ? eData : []));
    setLoading(false);
  };

  useEffect(() => { load(); }, [entityType]);

  const createRule = async () => {
    if (!form.name.trim()) return;
    await fetch(`${API}/crm/automation/rules`, { method: 'POST', headers: h(), body: JSON.stringify({ ...form, entityType }) });
    setShowForm(false);
    setForm({ name: '', triggerType: 'ON_STAGE_ENTER', triggerStage: 'NEW', triggerDelayMinutes: 60, actions: [{ type: 'CREATE_TASK', params: {} }] });
    load();
  };

  const toggleActive = async (rule: any) => {
    await fetch(`${API}/crm/automation/rules/${rule.id}`, { method: 'PATCH', headers: h(), body: JSON.stringify({ isActive: !rule.isActive }) });
    load();
  };

  const deleteRule = async (id: string) => {
    if (!confirm('Удалить правило автоматизации?')) return;
    await fetch(`${API}/crm/automation/rules/${id}`, { method: 'DELETE', headers: h() });
    load();
  };

  const updateAction = (idx: number, patch: any) => {
    setForm((f: any) => ({ ...f, actions: f.actions.map((a: any, i: number) => i === idx ? { ...a, ...patch } : a) }));
  };
  const updateActionParam = (idx: number, key: string, value: any) => {
    setForm((f: any) => ({ ...f, actions: f.actions.map((a: any, i: number) => i === idx ? { ...a, params: { ...a.params, [key]: value } } : a) }));
  };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 4, background: '#F8F7FF', borderRadius: 12, padding: 4 }}>
          <button onClick={() => setEntityType('DEAL')} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: entityType === 'DEAL' ? 'white' : 'transparent', color: entityType === 'DEAL' ? '#7F77DD' : '#9B97CC', boxShadow: entityType === 'DEAL' ? '0 2px 6px rgba(127,119,221,0.15)' : 'none' }}>Сделки</button>
          <button onClick={() => setEntityType('LEAD')} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: entityType === 'LEAD' ? 'white' : 'transparent', color: entityType === 'LEAD' ? '#7F77DD' : '#9B97CC', boxShadow: entityType === 'LEAD' ? '0 2px 6px rgba(127,119,221,0.15)' : 'none' }}>Лиды</button>
          <button onClick={() => setEntityType('CONTACT')} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: entityType === 'CONTACT' ? 'white' : 'transparent', color: entityType === 'CONTACT' ? '#7F77DD' : '#9B97CC', boxShadow: entityType === 'CONTACT' ? '0 2px 6px rgba(127,119,221,0.15)' : 'none' }}>Подписчики</button>
        </div>
        <button onClick={() => setShowForm(true)} style={{ marginLeft: 'auto', background: 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Новое правило</button>
      </div>

      {loading ? (
        <div style={{ ...card, padding: 40, textAlign: 'center' }}><p style={{ color: '#9B97CC', margin: 0 }}>Загрузка...</p></div>
      ) : rules.length === 0 ? (
        <div style={{ ...card, padding: 40, textAlign: 'center' }}>
          <p style={{ fontSize: 28, margin: '0 0 10px' }}>⚡</p>
          <p style={{ color: '#9B97CC', margin: 0 }}>Правил автоматизации пока нет</p>
          <p style={{ color: '#C4C0E8', fontSize: 12, margin: '4px 0 0' }}>Настройте роботов и триггеры чтобы автоматизировать рутину</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {rules.map(rule => (
            <div key={rule.id} style={{ ...card, padding: '14px 18px', opacity: rule.isActive ? 1 : 0.55 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 800, color: '#1a1040', margin: 0 }}>{rule.name}</p>
                  <p style={{ fontSize: 11.5, color: '#9B97CC', margin: '3px 0 0' }}>
                    {TRIGGER_LABELS[rule.triggerType]}
                    {rule.triggerType === 'ON_STAGE_ENTER' && rule.triggerStage && ` → «${STAGE_OPTIONS[entityType]?.find(s => s.v === rule.triggerStage)?.l ?? rule.triggerStage}»`}
                    {rule.triggerType === 'ON_TIME_ELAPSED' && ` (${rule.triggerDelayMinutes} мин)`}
                    {rule.triggerType === 'ON_DATE_APPROACHING' && ` — ${DATE_FIELD_OPTIONS.find(d => d.v === rule.triggerField)?.l ?? rule.triggerField}, за ${rule.triggerDelayMinutes} дн.`}
                    {' · '}{(rule.actions as any[]).map(a => ACTION_LABELS[a.type] ?? a.type).join(', ')}
                  </p>
                </div>
                <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer' }}>
                  <input type="checkbox" checked={rule.isActive} onChange={() => toggleActive(rule)} style={{ width: 16, height: 16, accentColor: '#7F77DD', cursor: 'pointer' }} />
                </label>
                <button onClick={() => deleteRule(rule.id)} style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: 'none', borderRadius: 8, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,16,64,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 24, width: 460, maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(127,119,221,0.2)' }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1a1040', margin: '0 0 18px' }}>Новое правило автоматизации</h3>

            <p style={{ fontSize: 11, color: '#9B97CC', margin: '0 0 6px', fontWeight: 700 }}>НАЗВАНИЕ</p>
            <input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="Например: Уведомить логиста"
              style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 14, outline: 'none', boxSizing: 'border-box' }} />

            <p style={{ fontSize: 11, color: '#9B97CC', margin: '0 0 6px', fontWeight: 700 }}>ТРИГГЕР (КОГДА СРАБАТЫВАЕТ)</p>
            <select value={form.triggerType} onChange={e => setForm({ ...form, triggerType: e.target.value })}
              style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 10, outline: 'none' }}>
              {Object.entries(TRIGGER_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>

            {(form.triggerType === 'ON_STAGE_ENTER' || form.triggerType === 'ON_TIME_ELAPSED') && (
              <select value={form.triggerStage} onChange={e => setForm({ ...form, triggerStage: e.target.value })}
                style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 10, outline: 'none' }}>
                {STAGE_OPTIONS[entityType].map(s => <option key={s.v} value={s.v}>{s.l}</option>)}
              </select>
            )}

            {form.triggerType === 'ON_FIELD_CHANGE' && (
              <input value={form.triggerField ?? ''} onChange={e => setForm({ ...form, triggerField: e.target.value })} placeholder="Название поля (например amount)"
                style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 10, outline: 'none', boxSizing: 'border-box' }} />
            )}

            {form.triggerType === 'ON_TIME_ELAPSED' && (
              <div style={{ marginBottom: 14 }}>
                <p style={{ fontSize: 11, color: '#9B97CC', margin: '0 0 6px' }}>Через сколько минут без изменений (например 1440 = сутки)</p>
                <input type="number" value={form.triggerDelayMinutes} onChange={e => setForm({ ...form, triggerDelayMinutes: parseInt(e.target.value) || 0 })}
                  style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
              </div>
            )}

            {form.triggerType === 'ON_DATE_APPROACHING' && (
              <>
                <select value={form.triggerField ?? 'trialEndsAt'} onChange={e => setForm({ ...form, triggerField: e.target.value })}
                  style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 10, outline: 'none' }}>
                  {DATE_FIELD_OPTIONS.map(d => <option key={d.v} value={d.v}>{d.l}</option>)}
                </select>
                <p style={{ fontSize: 11, color: '#9B97CC', margin: '0 0 6px' }}>За сколько дней ДО этой даты сработать</p>
                <input type="number" value={form.triggerDelayMinutes} onChange={e => setForm({ ...form, triggerDelayMinutes: parseInt(e.target.value) || 0 })} placeholder="3"
                  style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 14, outline: 'none', boxSizing: 'border-box' }} />
              </>
            )}

            <p style={{ fontSize: 11, color: '#9B97CC', margin: '14px 0 6px', fontWeight: 700 }}>ДЕЙСТВИЕ (ЧТО СДЕЛАТЬ)</p>
            <select value={form.actions[0]?.type} onChange={e => updateAction(0, { type: e.target.value, params: {} })}
              style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 10, outline: 'none' }}>
              {Object.entries(ACTION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>

            {form.actions[0]?.type === 'CREATE_TASK' && (
              <>
                <input value={form.actions[0].params.title ?? ''} onChange={e => updateActionParam(0, 'title', e.target.value)} placeholder="Название задачи (можно {title})"
                  style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 10, outline: 'none', boxSizing: 'border-box' }} />
                <select value={form.actions[0].params.assigneeId ?? ''} onChange={e => updateActionParam(0, 'assigneeId', e.target.value)}
                  style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 10, outline: 'none' }}>
                  <option value="">— исполнитель —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <p style={{ fontSize: 11, color: '#D97706', margin: '0 0 10px', background: '#FFFBEB', padding: '8px 10px', borderRadius: 8 }}>⚠ Задачу нужно привязать к проекту вручную после создания правила (обязательное поле системы)</p>
              </>
            )}

            {form.actions[0]?.type === 'NOTIFY_USER' && (
              <>
                <select value={form.actions[0].params.userId ?? ''} onChange={e => updateActionParam(0, 'userId', e.target.value)}
                  style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 10, outline: 'none' }}>
                  <option value="">— или ответственный по умолчанию —</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <textarea value={form.actions[0].params.message ?? ''} onChange={e => updateActionParam(0, 'message', e.target.value)} placeholder="Текст уведомления" rows={2}
                  style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 10, outline: 'none', boxSizing: 'border-box', resize: 'none' }} />
              </>
            )}

            {form.actions[0]?.type === 'CHANGE_OWNER' && (
              <>
                <select value={form.actions[0].params.strategy ?? 'ROUND_ROBIN'} onChange={e => updateActionParam(0, 'strategy', e.target.value)}
                  style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 10, outline: 'none' }}>
                  <option value="ROUND_ROBIN">По очереди (Round-robin)</option>
                  <option value="LEAST_BUSY">Наименее загруженному</option>
                  <option value="SPECIFIC">Конкретному сотруднику</option>
                </select>
                {form.actions[0].params.strategy === 'SPECIFIC' ? (
                  <select value={form.actions[0].params.userId ?? ''} onChange={e => updateActionParam(0, 'userId', e.target.value)}
                    style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 10, outline: 'none' }}>
                    <option value="">— выбрать —</option>
                    {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                ) : (
                  <div style={{ marginBottom: 10 }}>
                    <p style={{ fontSize: 11, color: '#9B97CC', margin: '0 0 6px' }}>Кандидаты для распределения:</p>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {employees.map(emp => {
                        const ids: string[] = form.actions[0].params.candidateIds ?? [];
                        const sel = ids.includes(emp.id);
                        return (
                          <button key={emp.id} type="button" onClick={() => updateActionParam(0, 'candidateIds', sel ? ids.filter(i => i !== emp.id) : [...ids, emp.id])}
                            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '1px solid', borderColor: sel ? '#7F77DD' : '#EDE9FE', background: sel ? '#EDE9FE' : 'white', color: sel ? '#7F77DD' : '#6B7280', cursor: 'pointer', fontWeight: 600 }}>
                            {emp.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 18 }}>
              <button onClick={createRule} disabled={!form.name.trim()} style={{ flex: 1, background: form.name.trim() ? 'linear-gradient(135deg,#7F77DD,#5248C5)' : '#EDE9FE', color: form.name.trim() ? 'white' : '#C4C0E8', border: 'none', borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 700, cursor: form.name.trim() ? 'pointer' : 'not-allowed' }}>Создать правило</button>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, background: '#F8F7FF', color: '#6B7280', border: '1px solid #EDE9FE', borderRadius: 10, padding: 10, fontSize: 13, cursor: 'pointer' }}>Отмена</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
