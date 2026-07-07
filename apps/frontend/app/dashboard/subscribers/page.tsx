'use client';
import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { SubscriberCard } from '@/components/subscribers/SubscriberCard';
import { AutomationBuilder } from '@/components/subscribers/AutomationBuilder';
import { RemindersCenter } from '@/components/subscribers/RemindersCenter';

const API = 'https://employee-tracker.ru/api/v1';

const PLAN_LABELS: Record<string, string> = { TRIAL: 'Пробный', PRO: 'Профи', BUSINESS: 'Бизнес', NONE: 'Нет подписки' };
const PLAN_COLORS: Record<string, { bg: string; c: string }> = {
  TRIAL: { bg: '#FEF3C7', c: '#D97706' }, PRO: { bg: '#DBEAFE', c: '#2563EB' },
  BUSINESS: { bg: '#DCFCE7', c: '#16A34A' }, NONE: { bg: '#F3F4F6', c: '#6B7280' },
};
const STATUS_LABELS: Record<string, string> = { NEW: 'Новый', IN_PROGRESS: 'В работе', CONTACTED: 'Связались', RENEWED: 'Продлил', LOST: 'Потерян', ARCHIVED: 'В архиве' };
const STATUS_COLORS: Record<string, { bg: string; c: string }> = {
  NEW: { bg: '#EDE9FE', c: '#7F77DD' }, IN_PROGRESS: { bg: '#DBEAFE', c: '#2563EB' }, CONTACTED: { bg: '#FEF3C7', c: '#D97706' },
  RENEWED: { bg: '#DCFCE7', c: '#16A34A' }, LOST: { bg: '#FEE2E2', c: '#DC2626' }, ARCHIVED: { bg: '#F3F4F6', c: '#6B7280' },
};

const ALL_COLUMNS = [
  { key: 'name', label: 'Имя', pinned: true },
  { key: 'contacts', label: 'Контакты' },
  { key: 'plan', label: 'Тариф' },
  { key: 'crmStatus', label: 'CRM статус' },
  { key: 'manager', label: 'Менеджер' },
  { key: 'tags', label: 'Теги' },
  { key: 'trialEndsAt', label: 'Срок' },
  { key: 'lastLoginAt', label: 'Последний вход' },
];

function daysLabel(dateStr: string | null): { label: string; overdue: boolean } | null {
  if (!dateStr) return null;
  const diff = new Date(dateStr).getTime() - Date.now();
  const overdue = diff < 0;
  const days = Math.abs(Math.round(diff / 86400000));
  return { label: overdue ? `−${days} дн.` : `${days} дн.`, overdue };
}

export default function SubscribersPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState('');
  const [subscribers, setSubscribers] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [stats, setStats] = useState<any>(null);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [filterPlan, setFilterPlan] = useState<string[]>([]);
  const [filterStatus, setFilterStatus] = useState<string[]>([]);
  const [filterManager, setFilterManager] = useState('');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc');
  const [groupBy, setGroupBy] = useState<'none' | 'plan' | 'crmStatus' | 'managerId'>('none');

  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);
  const [showPlanMenu, setShowPlanMenu] = useState(false);
  const planMenuRef = useRef<HTMLDivElement>(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const statusMenuRef = useRef<HTMLDivElement>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeSubscriber, setActiveSubscriber] = useState<any>(null);
  const [showIntegration, setShowIntegration] = useState(false);
  const [showAutomation, setShowAutomation] = useState(false);
  const [showReminders, setShowReminders] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
  }, []);

  const h = useCallback(() => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || localStorage.getItem('access_token')) }), [token]);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    filterPlan.forEach(p => params.append('plan', p));
    filterStatus.forEach(s => params.append('crmStatus', s));
    if (filterManager) params.set('managerId', filterManager);
    params.set('sortBy', sortBy);
    params.set('sortDir', sortDir);
    params.set('limit', '100');

    const [sRes, statsRes, eRes] = await Promise.all([
      fetch(`${API}/subscribers?${params}`, { headers: h() }),
      fetch(`${API}/subscribers/stats`, { headers: h() }),
      fetch(`${API}/employees?limit=200`, { headers: h() }),
    ]);
    const sData = await sRes.json().catch(() => ({ data: [], total: 0 }));
    setSubscribers(sData.data ?? []);
    setTotal(sData.total ?? 0);
    setStats(await statsRes.json().catch(() => null));
    const eData = await eRes.json().catch(() => ({}));
    setEmployees(eData.employees ?? (Array.isArray(eData) ? eData : []));
    setLoading(false);
    setSelected(new Set());
  }, [token, search, filterPlan, filterStatus, filterManager, sortBy, sortDir, h]);

  useEffect(() => { load(); }, [load]);

  // Close dropdowns on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setShowColMenu(false);
      if (planMenuRef.current && !planMenuRef.current.contains(e.target as Node)) setShowPlanMenu(false);
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target as Node)) setShowStatusMenu(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, []);

  const toggleSort = (field: string) => {
    if (sortBy === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortBy(field); setSortDir('desc'); }
  };

  const toggleSelectAll = () => {
    setSelected(prev => prev.size === subscribers.length ? new Set() : new Set(subscribers.map(s => s.id)));
  };
  const toggleSelectOne = (id: string) => setSelected(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });

  const updateSubscriber = async (id: string, patch: any) => {
    await fetch(`${API}/subscribers/${id}`, { method: 'PATCH', headers: h(), body: JSON.stringify(patch) });
    load();
  };

  // Group subscribers client-side for display
  const groups: { key: string; label: string; items: any[] }[] = groupBy === 'none'
    ? [{ key: '_all', label: '', items: subscribers }]
    : (() => {
        const map = new Map<string, { label: string; items: any[] }>();
        for (const s of subscribers) {
          let key: string, label: string;
          if (groupBy === 'plan') { key = s.plan ?? 'NONE'; label = PLAN_LABELS[key] ?? key; }
          else if (groupBy === 'crmStatus') { key = s.crmStatus; label = STATUS_LABELS[key] ?? key; }
          else { key = s.managerId ?? 'unassigned'; label = s.manager?.name ?? 'Без менеджера'; }
          if (!map.has(key)) map.set(key, { label, items: [] });
          map.get(key)!.items.push(s);
        }
        return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
      })();

  const visibleCols = ALL_COLUMNS.filter(c => !hiddenCols.has(c.key));
  const cardStyle: React.CSSProperties = { background: 'white', borderRadius: '16px', boxShadow: '0 4px 16px rgba(127,119,221,0.08)' };

  if (!mounted) return <div style={{ minHeight: '100vh', background: '#ECEAF8' }} />;

  return (
    <div style={{ minHeight: '100vh', background: '#ECEAF8' }}>
      <div style={{ background: 'white', padding: '16px 28px', position: 'sticky', top: 0, zIndex: 20, boxShadow: '0 4px 16px rgba(127,119,221,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10 }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#1a1040', margin: 0 }}>CRM · Подписчики</h1>
          <p style={{ fontSize: '11px', color: '#9B97CC', margin: '2px 0 0' }}>{total} подписчиков</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={() => setShowReminders(true)}
            style={{ background: '#F8F7FF', color: '#7F77DD', border: '1px solid #EDE9FE', borderRadius: '20px', padding: '8px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
            🔔 Напоминания
          </button>
          <button onClick={() => setShowAutomation(true)}
            style={{ background: '#F8F7FF', color: '#7F77DD', border: '1px solid #EDE9FE', borderRadius: '20px', padding: '8px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
            ⚡ Автоматизация
          </button>
          <button onClick={() => setShowIntegration(true)}
            style={{ background: '#F8F7FF', color: '#7F77DD', border: '1px solid #EDE9FE', borderRadius: '20px', padding: '8px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
            🔌 Интеграция KingStats
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 28px' }}>
        {stats && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 10, marginBottom: 16 }}>
            <div style={{ ...cardStyle, padding: '14px' }}><p style={{ fontSize: 22, fontWeight: 800, color: '#1a1040', margin: 0 }}>{stats.total}</p><p style={{ fontSize: 10.5, color: '#9B97CC', margin: '3px 0 0', fontWeight: 600 }}>Всего</p></div>
            {stats.byPlan.map((p: any) => (
              <div key={p.plan} style={{ ...cardStyle, padding: '14px' }}>
                <p style={{ fontSize: 22, fontWeight: 800, color: PLAN_COLORS[p.plan]?.c ?? '#1a1040', margin: 0 }}>{p.count}</p>
                <p style={{ fontSize: 10.5, color: '#9B97CC', margin: '3px 0 0', fontWeight: 600 }}>{PLAN_LABELS[p.plan] ?? p.plan}</p>
              </div>
            ))}
            <div style={{ ...cardStyle, padding: '14px', background: '#FFFBEB' }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#D97706', margin: 0 }}>{stats.trialEndingSoon}</p>
              <p style={{ fontSize: 9.5, color: '#92400E', margin: '3px 0 0', fontWeight: 700 }}>Триал ≤3 дн.</p>
            </div>
            <div style={{ ...cardStyle, padding: '14px', background: '#FEF2F2' }}>
              <p style={{ fontSize: 22, fontWeight: 800, color: '#DC2626', margin: 0 }}>{stats.expiredRecently}</p>
              <p style={{ fontSize: 9.5, color: '#991B1B', margin: '3px 0 0', fontWeight: 700 }}>Истекло за 14 дн.</p>
            </div>
          </div>
        )}

        {/* Toolbar: search, filters, group, columns */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по имени, email, телефону..."
            style={{ background: 'white', border: '1px solid #EDE9FE', borderRadius: '20px', padding: '8px 16px', fontSize: '12.5px', outline: 'none', width: 260 }} />

          {/* Plan filter */}
          <div ref={planMenuRef} style={{ position: 'relative' }}>
            <button onClick={() => setShowPlanMenu(v => !v)} style={{ padding: '8px 14px', borderRadius: 20, border: '1px solid #EDE9FE', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: filterPlan.length ? '#EDE9FE' : 'white', color: filterPlan.length ? '#7F77DD' : '#6B7280' }}>
              Тариф {filterPlan.length > 0 && `(${filterPlan.length})`}
            </button>
            {showPlanMenu && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100, background: 'white', border: '1px solid #EDE9FE', borderRadius: 14, boxShadow: '0 8px 24px rgba(127,119,221,0.18)', width: 200, padding: 8 }}>
                {Object.entries(PLAN_LABELS).map(([v, l]) => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={filterPlan.includes(v)} onChange={() => setFilterPlan(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])} style={{ accentColor: '#7F77DD' }} />
                    {l}
                  </label>
                ))}
              </div>
            )}
          </div>

          {/* Status filter */}
          <div ref={statusMenuRef} style={{ position: 'relative' }}>
            <button onClick={() => setShowStatusMenu(v => !v)} style={{ padding: '8px 14px', borderRadius: 20, border: '1px solid #EDE9FE', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: filterStatus.length ? '#EDE9FE' : 'white', color: filterStatus.length ? '#7F77DD' : '#6B7280' }}>
              CRM статус {filterStatus.length > 0 && `(${filterStatus.length})`}
            </button>
            {showStatusMenu && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100, background: 'white', border: '1px solid #EDE9FE', borderRadius: 14, boxShadow: '0 8px 24px rgba(127,119,221,0.18)', width: 200, padding: 8 }}>
                {Object.entries(STATUS_LABELS).map(([v, l]) => (
                  <label key={v} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8, cursor: 'pointer', fontSize: 13 }}>
                    <input type="checkbox" checked={filterStatus.includes(v)} onChange={() => setFilterStatus(p => p.includes(v) ? p.filter(x => x !== v) : [...p, v])} style={{ accentColor: '#7F77DD' }} />
                    {l}
                  </label>
                ))}
              </div>
            )}
          </div>

          <select value={filterManager} onChange={e => setFilterManager(e.target.value)}
            style={{ background: 'white', border: '1px solid #EDE9FE', borderRadius: 20, padding: '8px 14px', fontSize: 12, outline: 'none', color: filterManager ? '#7F77DD' : '#6B7280', fontWeight: 700 }}>
            <option value="">Все менеджеры</option>
            <option value="unassigned">Без менеджера</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>

          {/* Group by */}
          <select value={groupBy} onChange={e => setGroupBy(e.target.value as any)}
            style={{ background: groupBy !== 'none' ? '#EDE9FE' : 'white', border: '1px solid #EDE9FE', borderRadius: 20, padding: '8px 14px', fontSize: 12, outline: 'none', color: groupBy !== 'none' ? '#7F77DD' : '#6B7280', fontWeight: 700 }}>
            <option value="none">Без группировки</option>
            <option value="plan">По тарифу</option>
            <option value="crmStatus">По статусу</option>
            <option value="managerId">По менеджеру</option>
          </select>

          {/* Columns */}
          <div ref={colMenuRef} style={{ position: 'relative', marginLeft: 'auto' }}>
            <button onClick={() => setShowColMenu(v => !v)} style={{ padding: '8px 14px', borderRadius: 20, border: '1px solid #EDE9FE', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'white', color: '#6B7280' }}>
              ⚙️ Столбцы
            </button>
            {showColMenu && (
              <div style={{ position: 'absolute', top: 'calc(100% + 6px)', right: 0, zIndex: 100, background: 'white', border: '1px solid #EDE9FE', borderRadius: 14, boxShadow: '0 8px 24px rgba(127,119,221,0.18)', width: 220, padding: 8 }}>
                {ALL_COLUMNS.map(c => (
                  <label key={c.key} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', borderRadius: 8, cursor: c.pinned ? 'default' : 'pointer', fontSize: 13, opacity: c.pinned ? 0.5 : 1 }}>
                    <input type="checkbox" disabled={c.pinned} checked={!hiddenCols.has(c.key)} onChange={() => setHiddenCols(prev => { const n = new Set(prev); n.has(c.key) ? n.delete(c.key) : n.add(c.key); return n; })} style={{ accentColor: '#7F77DD' }} />
                    {c.label}{c.pinned && ' 📌'}
                  </label>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Bulk action bar */}
        {selected.size > 0 && (
          <div style={{ ...cardStyle, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 12, background: '#F0EDFF' }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#7F77DD' }}>Выбрано: {selected.size}</span>
            <select onChange={e => { if (e.target.value) { Array.from(selected).forEach(id => updateSubscriber(id, { crmStatus: e.target.value })); e.target.value = ''; } }}
              style={{ fontSize: 12, border: '1px solid #EDE9FE', borderRadius: 8, padding: '5px 10px', outline: 'none' }}>
              <option value="">Изменить статус...</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select onChange={e => { if (e.target.value) { Array.from(selected).forEach(id => updateSubscriber(id, { managerId: e.target.value })); e.target.value = ''; } }}
              style={{ fontSize: 12, border: '1px solid #EDE9FE', borderRadius: 8, padding: '5px 10px', outline: 'none' }}>
              <option value="">Назначить менеджера...</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <button onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#7F77DD', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>Снять выделение</button>
          </div>
        )}

        {/* Table */}
        <div style={{ ...cardStyle, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: 40, textAlign: 'center' }}><p style={{ color: '#9B97CC', margin: 0 }}>Загрузка...</p></div>
          ) : subscribers.length === 0 ? (
            <div style={{ padding: 50, textAlign: 'center' }}>
              <p style={{ fontSize: 30, margin: '0 0 10px' }}>📊</p>
              <p style={{ color: '#9B97CC', margin: 0 }}>Подписчиков пока нет</p>
              <p style={{ color: '#C4C0E8', fontSize: 12, margin: '4px 0 0' }}>Подключите интеграцию KingStats и запустите синхронизацию</p>
            </div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr style={{ background: '#F8F7FF' }}>
                    <th style={{ padding: '10px 14px', width: 36 }}>
                      <input type="checkbox" checked={selected.size === subscribers.length && subscribers.length > 0} onChange={toggleSelectAll} style={{ accentColor: '#7F77DD' }} />
                    </th>
                    {visibleCols.map(c => (
                      <th key={c.key} onClick={() => ['name', 'plan', 'trialEndsAt', 'lastLoginAt'].includes(c.key) && toggleSort(c.key === 'name' ? 'firstName' : c.key)}
                        style={{ padding: '10px 14px', textAlign: 'left', fontSize: 10.5, fontWeight: 700, color: '#9B97CC', textTransform: 'uppercase', cursor: ['name', 'plan', 'trialEndsAt', 'lastLoginAt'].includes(c.key) ? 'pointer' : 'default', whiteSpace: 'nowrap' }}>
                        {c.label} {sortBy === (c.key === 'name' ? 'firstName' : c.key) && (sortDir === 'asc' ? '↑' : '↓')}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {groups.map(g => (
                    <Fragment key={g.key}>
                      {groupBy !== 'none' && (
                        <tr style={{ background: '#F0EDFF' }}>
                          <td colSpan={visibleCols.length + 1} style={{ padding: '8px 14px', fontSize: 12, fontWeight: 800, color: '#1a1040' }}>{g.label} <span style={{ color: '#7F77DD', fontWeight: 700 }}>({g.items.length})</span></td>
                        </tr>
                      )}
                      {g.items.map((s: any) => {
                        const pc = PLAN_COLORS[s.plan] ?? PLAN_COLORS.NONE;
                        const sc = STATUS_COLORS[s.crmStatus] ?? STATUS_COLORS.NEW;
                        const dl = daysLabel(s.trialEndsAt ?? s.subscriptionEndsAt);
                        return (
                          <tr key={s.id} style={{ borderTop: '1px solid #F3F0FF', cursor: 'pointer' }}
                            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#FAFAFE'}
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}>
                            <td style={{ padding: '10px 14px' }} onClick={e => e.stopPropagation()}>
                              <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelectOne(s.id)} style={{ accentColor: '#7F77DD' }} />
                            </td>
                            {visibleCols.map(c => (
                              <td key={c.key} onClick={() => c.key !== 'tags' && setActiveSubscriber(s)} style={{ padding: '10px 14px', fontSize: 12.5 }}>
                                {c.key === 'name' && <span style={{ fontWeight: 700, color: '#1a1040' }}>{s.firstName} {s.lastName}</span>}
                                {c.key === 'contacts' && <span style={{ color: '#9B97CC' }}>{s.email}{s.phone && <><br />{s.phone}</>}</span>}
                                {c.key === 'plan' && <span style={{ fontSize: 10.5, fontWeight: 700, color: pc.c, background: pc.bg, padding: '2px 10px', borderRadius: 20 }}>{PLAN_LABELS[s.plan] ?? '—'}</span>}
                                {c.key === 'crmStatus' && (
                                  <select value={s.crmStatus} onChange={e => { e.stopPropagation(); updateSubscriber(s.id, { crmStatus: e.target.value }); }} onClick={e => e.stopPropagation()}
                                    style={{ fontSize: 10.5, fontWeight: 700, color: sc.c, background: sc.bg, border: 'none', borderRadius: 20, padding: '3px 10px', cursor: 'pointer', outline: 'none' }}>
                                    {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                                  </select>
                                )}
                                {c.key === 'manager' && (s.manager?.name ?? <span style={{ color: '#C4C0E8' }}>—</span>)}
                                {c.key === 'tags' && (
                                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }} onClick={e => e.stopPropagation()}>
                                    {(s.tags ?? []).map((t: string) => <span key={t} style={{ fontSize: 10, background: '#F3F0FF', color: '#7F77DD', padding: '1px 8px', borderRadius: 10 }}>{t}</span>)}
                                    {(!s.tags || s.tags.length === 0) && <span style={{ color: '#C4C0E8' }}>—</span>}
                                  </div>
                                )}
                                {c.key === 'trialEndsAt' && (dl ? <span style={{ fontWeight: 700, color: dl.overdue ? '#DC2626' : '#16A34A' }}>{dl.label}</span> : <span style={{ color: '#C4C0E8' }}>—</span>)}
                                {c.key === 'lastLoginAt' && (s.lastLoginAt ? new Date(s.lastLoginAt).toLocaleDateString('ru') : <span style={{ color: '#C4C0E8' }}>—</span>)}
                              </td>
                            ))}
                          </tr>
                        );
                      })}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {activeSubscriber && (
        <SubscriberCard subscriberId={activeSubscriber.id} employees={employees} h={h}
          onClose={() => setActiveSubscriber(null)} onUpdate={load} />
      )}

      {showIntegration && (
        <IntegrationModal h={h} onClose={() => setShowIntegration(false)} />
      )}

      {showAutomation && (
        <AutomationBuilder h={h} employees={employees} onClose={() => setShowAutomation(false)} />
      )}

      {showReminders && (
        <RemindersCenter h={h} onClose={() => setShowReminders(false)}
          onSelectSubscriber={(s: any) => { setActiveSubscriber(s); setShowReminders(false); }} />
      )}
    </div>
  );
}

function IntegrationModal({ h, onClose }: any) {
  const [config, setConfig] = useState<any>({ apiUrl: '', apiKey: '', isActive: false });
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API}/subscribers/integrations/kingstats`, { headers: h() }).then(r => r.json()).then(d => { if (d) setConfig(d); }).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    await fetch(`${API}/subscribers/integrations/kingstats`, { method: 'POST', headers: h(), body: JSON.stringify({ ...config, displayName: 'KingStats' }) });
    setSaving(false);
  };

  const sync = async () => {
    setSyncing(true); setMsg(null);
    try {
      const r = await fetch(`${API}/subscribers/integrations/kingstats/sync`, { method: 'POST', headers: h() });
      const data = await r.json();
      setMsg(r.ok ? `✅ Создано ${data.created}, обновлено ${data.updated}` : `⚠️ ${data.message ?? 'Ошибка'}`);
    } catch { setMsg('⚠️ Не удалось связаться с сервером'); }
    setSyncing(false);
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,16,64,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 24, width: 400, boxShadow: '0 24px 64px rgba(127,119,221,0.2)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1a1040', margin: '0 0 4px' }}>👑 Интеграция KingStats</h3>
        <p style={{ fontSize: 11.5, color: '#9B97CC', margin: '0 0 16px' }}>Синхронизация подписчиков</p>

        <p style={{ fontSize: 11, color: '#9B97CC', margin: '0 0 4px' }}>URL API</p>
        <input value={config.apiUrl ?? ''} onChange={e => setConfig({ ...config, apiUrl: e.target.value })} placeholder="https://www.kingstats.ru/api/admin/subscribers"
          style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 10, outline: 'none', boxSizing: 'border-box' }} />

        <p style={{ fontSize: 11, color: '#9B97CC', margin: '0 0 4px' }}>API-ключ</p>
        <input type="password" value={config.apiKey ?? ''} onChange={e => setConfig({ ...config, apiKey: e.target.value })} placeholder="••••••••"
          style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 14, outline: 'none', boxSizing: 'border-box' }} />

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!config.isActive} onChange={e => setConfig({ ...config, isActive: e.target.checked })} style={{ accentColor: '#7F77DD' }} />
          <span style={{ fontSize: 12.5, color: '#1a1040' }}>Интеграция активна</span>
        </label>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={save} disabled={saving} style={{ flex: 1, background: 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white', border: 'none', borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Сохраняю...' : 'Сохранить'}</button>
          <button onClick={sync} disabled={syncing || !config.apiUrl} style={{ flex: 1, background: '#F8F7FF', color: '#7F77DD', border: '1px solid #EDE9FE', borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 700, cursor: config.apiUrl ? 'pointer' : 'not-allowed' }}>{syncing ? 'Синхронизирую...' : '🔄 Синхронизировать'}</button>
        </div>
        {msg && <p style={{ fontSize: 12, color: msg.startsWith('✅') ? '#16A34A' : '#D97706', background: msg.startsWith('✅') ? '#DCFCE7' : '#FFFBEB', padding: '8px 12px', borderRadius: 8, margin: '0 0 10px' }}>{msg}</p>}
        <button onClick={onClose} style={{ width: '100%', background: 'none', border: 'none', color: '#9B97CC', fontSize: 12, cursor: 'pointer', padding: 6 }}>Закрыть</button>
      </div>
    </div>
  );
}
