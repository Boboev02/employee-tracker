'use client';
import { useState, useEffect } from 'react';

const API = 'https://employee-tracker.ru/api/v1';

export function CrmSettingsTab({ card }: { card: React.CSSProperties }) {
  const [sub, setSub] = useState<'email' | 'forms'>('email');
  const [emailSettings, setEmailSettings] = useState<any>({ smtpHost: '', smtpPort: 587, smtpUser: '', smtpPass: '', fromName: '', fromEmail: '', isActive: false });
  const [forms, setForms] = useState<any[]>([]);
  const [showFormBuilder, setShowFormBuilder] = useState(false);
  const [newFormName, setNewFormName] = useState('');
  const [saving, setSaving] = useState(false);
  const [testResult, setTestResult] = useState<string | null>(null);

  const h = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('access_token') });

  const load = async () => {
    const [eRes, fRes] = await Promise.all([
      fetch(`${API}/crm/email/settings`, { headers: h() }),
      fetch(`${API}/crm/webforms`, { headers: h() }),
    ]);
    const eData = await eRes.json().catch(() => null);
    if (eData) setEmailSettings(eData);
    setForms(await fRes.json().catch(() => []));
  };

  useEffect(() => { load(); }, []);

  const saveEmailSettings = async () => {
    setSaving(true);
    await fetch(`${API}/crm/email/settings`, { method: 'POST', headers: h(), body: JSON.stringify(emailSettings) });
    setSaving(false);
  };

  const createForm = async () => {
    if (!newFormName.trim()) return;
    await fetch(`${API}/crm/webforms`, { method: 'POST', headers: h(), body: JSON.stringify({ name: newFormName }) });
    setNewFormName(''); setShowFormBuilder(false);
    load();
  };

  const deleteForm = async (id: string) => {
    if (!confirm('Удалить форму?')) return;
    await fetch(`${API}/crm/webforms/${id}`, { method: 'DELETE', headers: h() });
    load();
  };

  const embedSnippet = (formId: string) => `<script src="https://employee-tracker.ru/embed.js" data-form-id="${formId}"></script>`;
  const directUrl = (formId: string) => `https://employee-tracker.ru/api/v1/crm/webforms/${formId}/submit`;

  return (
    <div>
      <div style={{ display: 'flex', gap: 4, background: '#F8F7FF', borderRadius: 12, padding: 4, marginBottom: 16, width: 'fit-content' }}>
        <button onClick={() => setSub('email')} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: sub === 'email' ? 'white' : 'transparent', color: sub === 'email' ? '#7F77DD' : '#9B97CC', boxShadow: sub === 'email' ? '0 2px 6px rgba(127,119,221,0.15)' : 'none' }}>📧 Email</button>
        <button onClick={() => setSub('forms')} style={{ padding: '7px 16px', borderRadius: 8, border: 'none', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', background: sub === 'forms' ? 'white' : 'transparent', color: sub === 'forms' ? '#7F77DD' : '#9B97CC', boxShadow: sub === 'forms' ? '0 2px 6px rgba(127,119,221,0.15)' : 'none' }}>🌐 Веб-формы</button>
      </div>

      {sub === 'email' && (
        <div style={{ ...card, padding: 20, maxWidth: 480 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#1a1040', margin: '0 0 4px' }}>Настройки SMTP</p>
          <p style={{ fontSize: 11.5, color: '#9B97CC', margin: '0 0 16px' }}>Для отправки писем прямо из карточки сделки</p>

          <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 10, marginBottom: 10 }}>
            <div>
              <p style={{ fontSize: 11, color: '#9B97CC', margin: '0 0 4px' }}>SMTP хост</p>
              <input value={emailSettings.smtpHost ?? ''} onChange={e => setEmailSettings({ ...emailSettings, smtpHost: e.target.value })} placeholder="smtp.yandex.ru"
                style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <p style={{ fontSize: 11, color: '#9B97CC', margin: '0 0 4px' }}>Порт</p>
              <input type="number" value={emailSettings.smtpPort ?? 587} onChange={e => setEmailSettings({ ...emailSettings, smtpPort: parseInt(e.target.value) || 587 })}
                style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <p style={{ fontSize: 11, color: '#9B97CC', margin: '0 0 4px' }}>Логин</p>
          <input value={emailSettings.smtpUser ?? ''} onChange={e => setEmailSettings({ ...emailSettings, smtpUser: e.target.value })} placeholder="info@company.ru"
            style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 10, outline: 'none', boxSizing: 'border-box' }} />

          <p style={{ fontSize: 11, color: '#9B97CC', margin: '0 0 4px' }}>Пароль</p>
          <input type="password" value={emailSettings.smtpPass ?? ''} onChange={e => setEmailSettings({ ...emailSettings, smtpPass: e.target.value })} placeholder="••••••••"
            style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 10, outline: 'none', boxSizing: 'border-box' }} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
            <div>
              <p style={{ fontSize: 11, color: '#9B97CC', margin: '0 0 4px' }}>Имя отправителя</p>
              <input value={emailSettings.fromName ?? ''} onChange={e => setEmailSettings({ ...emailSettings, fromName: e.target.value })} placeholder="К-Трейд"
                style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <p style={{ fontSize: 11, color: '#9B97CC', margin: '0 0 4px' }}>Email отправителя</p>
              <input value={emailSettings.fromEmail ?? ''} onChange={e => setEmailSettings({ ...emailSettings, fromEmail: e.target.value })} placeholder="info@company.ru"
                style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' }} />
            </div>
          </div>

          <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer' }}>
            <input type="checkbox" checked={!!emailSettings.isActive} onChange={e => setEmailSettings({ ...emailSettings, isActive: e.target.checked })} style={{ width: 16, height: 16, accentColor: '#7F77DD' }} />
            <span style={{ fontSize: 12.5, color: '#1a1040' }}>Включить отправку email</span>
          </label>

          <button onClick={saveEmailSettings} disabled={saving} style={{ background: 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white', border: 'none', borderRadius: 10, padding: '10px 20px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>
            {saving ? 'Сохраняю...' : 'Сохранить настройки'}
          </button>
        </div>
      )}

      {sub === 'forms' && (
        <div>
          <button onClick={() => setShowFormBuilder(true)} style={{ marginBottom: 14, background: 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white', border: 'none', borderRadius: 10, padding: '9px 18px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+ Новая форма</button>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {forms.length === 0 && <div style={{ ...card, padding: 40, textAlign: 'center' }}><p style={{ color: '#9B97CC', margin: 0 }}>Веб-форм пока нет</p></div>}
            {forms.map(f => (
              <div key={f.id} style={{ ...card, padding: '14px 18px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                  <p style={{ fontSize: 13.5, fontWeight: 700, color: '#1a1040', margin: 0, flex: 1 }}>{f.name}</p>
                  <span style={{ fontSize: 11, color: '#9B97CC' }}>{f.submitCount} заявок</span>
                  <button onClick={() => deleteForm(f.id)} style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: 'none', borderRadius: 8, padding: '5px 10px', fontSize: 12, cursor: 'pointer' }}>✕</button>
                </div>
                <p style={{ fontSize: 11, color: '#9B97CC', margin: '0 0 4px' }}>URL для отправки (POST):</p>
                <code style={{ display: 'block', background: '#F8F7FF', borderRadius: 8, padding: '8px 10px', fontSize: 11, color: '#7F77DD', overflowX: 'auto', whiteSpace: 'nowrap' }}>{directUrl(f.id)}</code>
              </div>
            ))}
          </div>

          {showFormBuilder && (
            <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,16,64,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ background: 'white', borderRadius: 20, padding: 24, width: 360, boxShadow: '0 24px 64px rgba(127,119,221,0.2)' }}>
                <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1a1040', margin: '0 0 16px' }}>Новая веб-форма</h3>
                <input value={newFormName} onChange={e => setNewFormName(e.target.value)} placeholder="Например: Форма с лендинга"
                  style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 16, outline: 'none', boxSizing: 'border-box' }} />
                <p style={{ fontSize: 11, color: '#9B97CC', margin: '0 0 16px' }}>Поля по умолчанию: Имя, Телефон, Email. Заявки автоматически создают Лид в CRM.</p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={createForm} disabled={!newFormName.trim()} style={{ flex: 1, background: newFormName.trim() ? 'linear-gradient(135deg,#7F77DD,#5248C5)' : '#EDE9FE', color: newFormName.trim() ? 'white' : '#C4C0E8', border: 'none', borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 700, cursor: newFormName.trim() ? 'pointer' : 'not-allowed' }}>Создать</button>
                  <button onClick={() => setShowFormBuilder(false)} style={{ flex: 1, background: '#F8F7FF', color: '#6B7280', border: '1px solid #EDE9FE', borderRadius: 10, padding: 10, fontSize: 13, cursor: 'pointer' }}>Отмена</button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
