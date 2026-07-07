'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { CrmAutomationTab } from '@/components/crm/CrmAutomationTab';
import { CrmCasesTab } from '@/components/crm/CrmCasesTab';
import { CrmSettingsTab } from '@/components/crm/CrmSettingsTab';
import { CrmSubscriptionsTab } from '@/components/crm/CrmSubscriptionsTab';

const API = 'https://employee-tracker.ru/api/v1';
const STAGES = ['NEW','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST'];
const STAGE_LABELS: Record<string,string> = { NEW:'Новая', QUALIFIED:'Квалифицирована', PROPOSAL:'Предложение', NEGOTIATION:'Переговоры', WON:'Выиграна', LOST:'Проиграна' };
const STAGE_COLORS: Record<string,string> = { NEW:'#9B97CC', QUALIFIED:'#3B82F6', PROPOSAL:'#F59E0B', NEGOTIATION:'#8B5CF6', WON:'#10B981', LOST:'#EF4444' };
const LEAD_STATUS: Record<string,string> = { NEW:'Новый', IN_PROGRESS:'В работе', CONVERTED:'Конвертирован', LOST:'Потерян' };

export default function CrmPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'deals'|'leads'|'contacts'|'companies'|'cases'|'automation'|'settings'|'subscriptions'>('deals');
  const [kanban, setKanban] = useState<any[]>([]);
  const [leads, setLeads] = useState<any[]>([]);
  const [contacts, setContacts] = useState<any[]>([]);
  const [companies, setCompanies] = useState<any[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({});
  const [token, setToken] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('access_token') || '';
    if (!t) { router.push('/login'); return; }
    setToken(t);
    loadKanban(t);
    loadLeads(t);
    loadContacts(t);
    loadCompanies(t);
  }, []);

  const hdr = (t: string) => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + t });

  const loadKanban = (t: string) => {
    fetch(API + '/crm/deals/kanban', { headers: hdr(t) })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setKanban(d); })
      .catch(e => console.error('kanban error:', e));
  };

  const loadLeads = (t: string) => {
    fetch(API + '/crm/leads', { headers: hdr(t) })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setLeads(d); })
      .catch(() => {});
  };

  const loadContacts = (t: string) => {
    fetch(API + '/crm/contacts', { headers: hdr(t) })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setContacts(d); })
      .catch(() => {});
  };

  const loadCompanies = (t: string) => {
    fetch(API + '/crm/companies', { headers: hdr(t) })
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setCompanies(d); })
      .catch(() => {});
  };

  const reload = () => {
    loadKanban(token);
    loadLeads(token);
    loadContacts(token);
    loadCompanies(token);
  };

  const createItem = async () => {
    if (tab === 'deals' && !form.title?.trim()) return;
    if (tab === 'leads' && !form.name?.trim()) return;
    if (tab === 'contacts' && !form.firstName?.trim()) return;
    if (tab === 'companies' && !form.name?.trim()) return;
    setSaving(true);
    const endpoints: Record<string, string> = { deals: '/crm/deals', leads: '/crm/leads', contacts: '/crm/contacts', companies: '/crm/companies' };
    try {
      await fetch(API + endpoints[tab], { method: 'POST', headers: hdr(token), body: JSON.stringify(form) });
      setForm({}); setShowForm(false); reload();
    } catch {}
    setSaving(false);
  };

  const totalDeals = kanban.reduce((s, c) => s + (c.deals?.length ?? 0), 0);
  const totalAmount = kanban.reduce((s, c) => s + (c.total ?? 0), 0);

  const card: React.CSSProperties = { background: 'white', borderRadius: '16px', padding: '16px', boxShadow: '0 4px 16px rgba(127,119,221,0.08)' };
  const inp: React.CSSProperties = { width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '8px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ minHeight: '100vh', background: '#ECEAF8' }}>
      <div style={{ background: 'white', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 4px 16px rgba(127,119,221,0.06)' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#1a1040', margin: 0 }}>CRM</h1>
          <p style={{ fontSize: '11px', color: '#9B97CC', margin: '2px 0 0' }}>{totalDeals} сделок · {totalAmount.toLocaleString('ru')} ₽</p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ background: 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white', border: 'none', borderRadius: '14px', padding: '9px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
          + {tab === 'deals' ? 'Сделка' : tab === 'leads' ? 'Лид' : tab === 'contacts' ? 'Контакт' : 'Компания'}
        </button>
      </div>

      <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {([['deals','🎯 Сделки'],['leads','📋 Лиды'],['contacts','👤 Контакты'],['companies','🏢 Компании'],['subscriptions','📊 Подписки'],['cases','🎫 Обращения'],['automation','⚡ Автоматизация'],['settings','⚙️ Настройки']] as const).map(([t, label]) => (
            <button key={t} onClick={() => setTab(t)}
              style={{ background: tab === t ? 'linear-gradient(135deg,#7F77DD,#5248C5)' : 'white', color: tab === t ? 'white' : '#7F77DD', border: '1px solid #EDE9FE', borderRadius: '12px', padding: '9px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              {label}
            </button>
          ))}
        </div>

        {showForm && (
          <div style={card}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#1a1040', margin: '0 0 14px' }}>
              {tab === 'deals' ? 'Новая сделка' : tab === 'leads' ? 'Новый лид' : tab === 'contacts' ? 'Новый контакт' : 'Новая компания'}
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {tab === 'deals' && (
                <>
                  <input placeholder="Название сделки *" value={form.title ?? ''} onChange={e => setForm((f: any) => ({ ...f, title: e.target.value }))} style={inp} autoFocus />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <input placeholder="Сумма (₽)" type="number" value={form.amount ?? ''} onChange={e => setForm((f: any) => ({ ...f, amount: parseFloat(e.target.value) || undefined }))} style={inp} />
                    <select value={form.stage ?? 'NEW'} onChange={e => setForm((f: any) => ({ ...f, stage: e.target.value }))} style={inp}>
                      {STAGES.map(s => <option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
                    </select>
                  </div>
                </>
              )}
              {tab === 'leads' && (
                <>
                  <input placeholder="Имя *" value={form.name ?? ''} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} style={inp} autoFocus />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <input placeholder="Email" value={form.email ?? ''} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} style={inp} />
                    <input placeholder="Телефон" value={form.phone ?? ''} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} style={inp} />
                  </div>
                </>
              )}
              {tab === 'contacts' && (
                <>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <input placeholder="Имя *" value={form.firstName ?? ''} onChange={e => setForm((f: any) => ({ ...f, firstName: e.target.value }))} style={inp} autoFocus />
                    <input placeholder="Фамилия" value={form.lastName ?? ''} onChange={e => setForm((f: any) => ({ ...f, lastName: e.target.value }))} style={inp} />
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <input placeholder="Email" value={form.email ?? ''} onChange={e => setForm((f: any) => ({ ...f, email: e.target.value }))} style={inp} />
                    <input placeholder="Телефон" value={form.phone ?? ''} onChange={e => setForm((f: any) => ({ ...f, phone: e.target.value }))} style={inp} />
                  </div>
                </>
              )}
              {tab === 'companies' && (
                <>
                  <input placeholder="Название компании *" value={form.name ?? ''} onChange={e => setForm((f: any) => ({ ...f, name: e.target.value }))} style={inp} autoFocus />
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                    <input placeholder="Отрасль" value={form.industry ?? ''} onChange={e => setForm((f: any) => ({ ...f, industry: e.target.value }))} style={inp} />
                    <input placeholder="Сайт" value={form.website ?? ''} onChange={e => setForm((f: any) => ({ ...f, website: e.target.value }))} style={inp} />
                  </div>
                </>
              )}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button onClick={createItem} disabled={saving}
                  style={{ background: 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white', border: 'none', borderRadius: '10px', padding: '9px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                  {saving ? 'Создание...' : 'Создать'}
                </button>
                <button onClick={() => { setShowForm(false); setForm({}); }}
                  style={{ background: 'white', color: '#9B97CC', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '9px 16px', fontSize: '13px', cursor: 'pointer' }}>
                  Отмена
                </button>
              </div>
            </div>
          </div>
        )}

        {tab === 'deals' && (
          <div style={{ overflowX: 'auto' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 220px)', gap: '12px', minWidth: '1400px' }}>
              {kanban.length === 0 ? (
                <div style={{ gridColumn: '1/-1', ...card, textAlign: 'center', padding: '40px' }}>
                  <p style={{ color: '#9B97CC', margin: 0 }}>Загрузка сделок...</p>
                </div>
              ) : kanban.map((col: any) => (
                <div key={col.stage}>
                  <div style={{ marginBottom: '10px', padding: '8px 12px', background: 'white', borderRadius: '12px', borderTop: '3px solid ' + (STAGE_COLORS[col.stage] ?? '#9B97CC') }}>
                    <p style={{ fontSize: '12px', fontWeight: 700, color: '#1a1040', margin: '0 0 2px' }}>{STAGE_LABELS[col.stage] ?? col.stage}</p>
                    <p style={{ fontSize: '11px', color: '#9B97CC', margin: 0 }}>{col.deals?.length ?? 0} · {(col.total ?? 0).toLocaleString('ru')} ₽</p>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {(col.deals ?? []).map((deal: any, dIdx: number) => (
                      <Link key={deal.id} href={'/dashboard/crm/deals/' + deal.id} style={{ textDecoration: 'none' }}>
                        <div className="row-in hover-lift" style={{ ...card, padding: '12px', cursor: 'pointer', animationDelay:Math.min(dIdx*0.05,0.35)+'s' }}>
                          <p style={{ fontSize: '12px', fontWeight: 700, color: '#1a1040', margin: '0 0 6px' }}>{deal.title}</p>
                          {deal.amount && <p style={{ fontSize: '13px', fontWeight: 800, color: '#7F77DD', margin: '0 0 4px' }}>{deal.amount.toLocaleString('ru')} ₽</p>}
                          {deal.company && <p style={{ fontSize: '11px', color: '#9B97CC', margin: '0 0 2px' }}>🏢 {deal.company.name}</p>}
                          {deal.contact && <p style={{ fontSize: '11px', color: '#9B97CC', margin: 0 }}>👤 {deal.contact.firstName} {deal.contact.lastName ?? ''}</p>}
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {tab === 'leads' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {leads.length === 0 ? (
              <div style={{ ...card, padding: '40px', textAlign: 'center' }}><p style={{ color: '#9B97CC', margin: 0 }}>Лидов пока нет</p></div>
            ) : leads.map((lead: any) => (
              <div key={lead.id} style={{ ...card, padding: '14px 18px', display: 'flex', alignItems: 'center', gap: '14px' }}>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a1040', margin: '0 0 4px' }}>{lead.name}</p>
                  <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#9B97CC' }}>
                    {lead.email && <span>✉️ {lead.email}</span>}
                    {lead.phone && <span>📞 {lead.phone}</span>}
                  </div>
                </div>
                <span style={{ background: (lead.status === 'CONVERTED' ? '#10B981' : lead.status === 'LOST' ? '#EF4444' : '#7F77DD') + '20', color: lead.status === 'CONVERTED' ? '#10B981' : lead.status === 'LOST' ? '#EF4444' : '#7F77DD', borderRadius: '8px', padding: '3px 10px', fontSize: '11px', fontWeight: 700 }}>
                  {LEAD_STATUS[lead.status] ?? lead.status}
                </span>
              </div>
            ))}
          </div>
        )}

        {tab === 'contacts' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '12px' }}>
            {contacts.length === 0 ? (
              <div style={{ ...card, padding: '40px', textAlign: 'center', gridColumn: '1/-1' }}><p style={{ color: '#9B97CC', margin: 0 }}>Контактов пока нет</p></div>
            ) : contacts.map((c: any) => (
              <div key={c.id} style={{ ...card, padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                  <div style={{ width: '36px', height: '36px', borderRadius: '50%', background: 'linear-gradient(135deg,#7F77DD,#5248C5)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', color: 'white', fontWeight: 700 }}>
                    {c.firstName?.[0]?.toUpperCase()}
                  </div>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a1040', margin: 0 }}>{c.firstName} {c.lastName ?? ''}</p>
                    {c.position && <p style={{ fontSize: '11px', color: '#9B97CC', margin: '2px 0 0' }}>{c.position}</p>}
                  </div>
                </div>
                {c.email && <p style={{ fontSize: '11px', color: '#9B97CC', margin: '0 0 2px' }}>✉️ {c.email}</p>}
                {c.phone && <p style={{ fontSize: '11px', color: '#9B97CC', margin: 0 }}>📞 {c.phone}</p>}
              </div>
            ))}
          </div>
        )}

        {tab === 'companies' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(280px,1fr))', gap: '12px' }}>
            {companies.length === 0 ? (
              <div style={{ ...card, padding: '40px', textAlign: 'center', gridColumn: '1/-1' }}><p style={{ color: '#9B97CC', margin: 0 }}>Компаний пока нет</p></div>
            ) : companies.map((c: any) => (
              <div key={c.id} style={{ ...card, padding: '16px' }}>
                <p style={{ fontSize: '14px', fontWeight: 800, color: '#1a1040', margin: '0 0 6px' }}>{c.name}</p>
                {c.industry && <p style={{ fontSize: '11px', color: '#7F77DD', margin: '0 0 8px', fontWeight: 600 }}>{c.industry}</p>}
                {c.website && <a href={c.website} target="_blank" rel="noopener noreferrer" style={{ fontSize: '11px', color: '#7F77DD' }}>{c.website}</a>}
              </div>
            ))}
          </div>
        )}
        {tab === 'cases' && <CrmCasesTab card={card} />}
        {tab === 'subscriptions' && <CrmSubscriptionsTab card={card} />}
        {tab === 'automation' && <CrmAutomationTab card={card} />}
        {tab === 'settings' && <CrmSettingsTab card={card} />}
      </div>
    </div>
  );
}
