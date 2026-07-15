'use client';
import { useState, useEffect, useRef, useCallback, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { SubscriberCard } from '@/components/subscribers/SubscriberCard';
import { AutomationBuilder } from '@/components/subscribers/AutomationBuilder';
import { RemindersCenter } from '@/components/subscribers/RemindersCenter';
import { TrashModal } from '@/components/subscribers/TrashModal';
import { ArchiveModal } from '@/components/subscribers/ArchiveModal';
import { SubscriberBoard } from '@/components/subscribers/SubscriberBoard';
import { CrmSettingsModal } from '@/components/subscribers/CrmSettingsModal';
import { PLAN_LABELS, PLAN_COLORS, STATUS_LABELS, STATUS_COLORS } from '@/lib/subscriberConstants';

const API = 'https://employee-tracker.ru/api/v1';

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
  const [page, setPage] = useState(1);
  const [pageSize] = useState(50);
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
  const [view, setView] = useState<'table' | 'board'>('table');

  const [hiddenCols, setHiddenColsState] = useState<Set<string>>(new Set());
  const setHiddenCols = (updater: Set<string> | ((prev: Set<string>) => Set<string>)) => {
    setHiddenColsState(prev => {
      const next = typeof updater === 'function' ? (updater as any)(prev) : updater;
      try { localStorage.setItem('subscribers_hidden_cols', JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  };
  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);
  const [showPlanMenu, setShowPlanMenu] = useState(false);
  const planMenuRef = useRef<HTMLDivElement>(null);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [activeSubscriber, setActiveSubscriber] = useState<any>(null);
  const [showIntegration, setShowIntegration] = useState(false);
  const [showAutomation, setShowAutomation] = useState(false);
  const [showReminders, setShowReminders] = useState(false);
  const [bulkDeleteConfirm, setBulkDeleteConfirm] = useState(false);
  const [showTrash, setShowTrash] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [statusCounts, setStatusCounts] = useState<any>(null);
  const [showCrmSettings, setShowCrmSettings] = useState(false);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; subscriber: any } | null>(null);

  useEffect(() => {
    setMounted(true);
    try {
      const saved = localStorage.getItem('subscribers_hidden_cols');
      if (saved) setHiddenColsState(new Set(JSON.parse(saved)));
    } catch {}
  }, []);

  // Этап 13: горячая клавиша Escape закрывает открытые модальные окна/панели
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchInputRef.current?.focus();
        return;
      }
      if (e.key !== 'Escape') return;
      if (contextMenu) setContextMenu(null);
      if (activeSubscriber) setActiveSubscriber(null);
      else if (showIntegration) setShowIntegration(false);
      else if (showAutomation) setShowAutomation(false);
      else if (showReminders) setShowReminders(false);
      else if (showTrash) setShowTrash(false);
      else if (showArchive) setShowArchive(false);
      else if (showCrmSettings) setShowCrmSettings(false);
      else if (bulkDeleteConfirm) setBulkDeleteConfirm(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [activeSubscriber, showIntegration, showAutomation, showReminders, showTrash, showArchive, showCrmSettings, bulkDeleteConfirm, contextMenu]);

  useEffect(() => {
    if (!contextMenu) return;
    const closeMenu = () => setContextMenu(null);
    document.addEventListener('click', closeMenu);
    return () => document.removeEventListener('click', closeMenu);
  }, [contextMenu]);

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
    params.set('limit', view === 'board' ? '500' : String(pageSize));
    params.set('offset', view === 'board' ? '0' : String((page - 1) * pageSize));

    const [sRes, statsRes, eRes, scRes] = await Promise.all([
      fetch(`${API}/subscribers?${params}`, { headers: h() }),
      fetch(`${API}/subscribers/stats`, { headers: h() }),
      fetch(`${API}/employees?limit=200`, { headers: h() }),
      fetch(`${API}/subscribers/status-counts`, { headers: h() }),
    ]);
    const sData = await sRes.json().catch(() => ({ data: [], total: 0 }));
    setSubscribers(sData.data ?? []);
    setTotal(sData.total ?? 0);
    setStats(await statsRes.json().catch(() => null));
    const eData = await eRes.json().catch(() => ({}));
    setEmployees(eData.employees ?? (Array.isArray(eData) ? eData : []));
    setStatusCounts(await scRes.json().catch(() => null));
    setLoading(false);
    setSelected(new Set());
  }, [token, search, filterPlan, filterStatus, filterManager, sortBy, sortDir, page, pageSize, view, h]);

  useEffect(() => { load(); }, [load]);

  // Автооткрытие карточки подписчика по ссылке из уведомления (?open=<id>)
  useEffect(() => {
    if (subscribers.length === 0) return;
    const openId = new URLSearchParams(window.location.search).get('open');
    if (!openId) return;
    const target = subscribers.find(s => s.id === openId);
    if (target) {
      setActiveSubscriber(target);
      window.history.replaceState({}, '', '/dashboard/subscribers');
    } else {
      // Может быть не в текущем фильтре/странице — подтягиваем карточку напрямую по ID
      fetch(`${API}/subscribers/${openId}`, { headers: h() }).then(r => r.ok ? r.json() : null).then(full => {
        if (full) { setActiveSubscriber(full); window.history.replaceState({}, '', '/dashboard/subscribers'); }
      }).catch(() => {});
    }
  }, [subscribers]);
  useEffect(() => { setPage(1); }, [search, filterPlan, filterStatus, filterManager]);

  // Close dropdowns on outside click
  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setShowColMenu(false);
      if (planMenuRef.current && !planMenuRef.current.contains(e.target as Node)) setShowPlanMenu(false);
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
          <button onClick={() => setShowTrash(true)}
            style={{ background: '#F8F7FF', color: '#7F77DD', border: '1px solid #EDE9FE', borderRadius: '20px', padding: '8px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
            🗑 Корзина
          </button>
          <button onClick={() => setShowCrmSettings(true)}
            style={{ background: '#F8F7FF', color: '#7F77DD', border: '1px solid #EDE9FE', borderRadius: '20px', padding: '8px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
            ⚙️ Настройки CRM
          </button>
          <button onClick={() => router.push('/dashboard/subscribers/dashboard')}
            style={{ background: '#F8F7FF', color: '#7F77DD', border: '1px solid #EDE9FE', borderRadius: '20px', padding: '8px 16px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
            📊 Dashboard
          </button>
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
          <input ref={searchInputRef} value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по имени, email, телефону... (Ctrl+K)"
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

          {/* Status tabs — «Все» исключает архивных по умолчанию (это делает backend) */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <button onClick={() => setFilterStatus([])}
              style={{ padding: '8px 14px', borderRadius: 20, border: filterStatus.length === 0 ? '2px solid #7F77DD' : '1px solid #EDE9FE', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: filterStatus.length === 0 ? '#EDE9FE' : 'white', color: filterStatus.length === 0 ? '#7F77DD' : '#6B7280' }}>
              Все {statusCounts?.total !== undefined && `(${statusCounts.total})`}
            </button>
            {Object.entries(STATUS_LABELS).filter(([v]) => v !== 'ARCHIVED').map(([v, l]) => {
              const active = filterStatus.length === 1 && filterStatus[0] === v;
              const count = statusCounts?.byStatus?.find((s: any) => s.status === v)?.count;
              return (
                <button key={v} onClick={() => setFilterStatus(active ? [] : [v])}
                  style={{ padding: '8px 14px', borderRadius: 20, border: active ? '2px solid #7F77DD' : '1px solid #EDE9FE', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: active ? '#EDE9FE' : 'white', color: active ? '#7F77DD' : '#6B7280' }}>
                  {l} {count !== undefined && `(${count})`}
                </button>
              );
            })}
          </div>

          <button onClick={() => setShowArchive(true)}
            style={{ padding: '8px 14px', borderRadius: 20, border: '1px solid #EDE9FE', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'white', color: '#D97706', display: 'flex', alignItems: 'center', gap: 6 }}>
            📥 Архив {statusCounts?.archived !== undefined && <span style={{ background: '#FEF3C7', color: '#D97706', padding: '1px 8px', borderRadius: 20, fontSize: 11 }}>{statusCounts.archived}</span>}
          </button>

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

          {/* View switcher */}
          <div style={{ display: 'flex', gap: 4, background: '#F8F7FF', borderRadius: 20, padding: 3 }}>
            <button onClick={() => setView('table')} style={{ padding: '6px 12px', borderRadius: 16, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: view === 'table' ? 'white' : 'transparent', color: view === 'table' ? '#7F77DD' : '#9B97CC', boxShadow: view === 'table' ? '0 2px 6px rgba(127,119,221,0.15)' : 'none' }}>📋 Таблица</button>
            <button onClick={() => setView('board')} style={{ padding: '6px 12px', borderRadius: 16, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: view === 'board' ? 'white' : 'transparent', color: view === 'board' ? '#7F77DD' : '#9B97CC', boxShadow: view === 'board' ? '0 2px 6px rgba(127,119,221,0.15)' : 'none' }}>🗂 Доска</button>
          </div>

          {/* Columns */}
          <div ref={colMenuRef} style={{ position: 'relative', marginLeft: view === 'table' ? 'auto' : 0 }}>
            <button onClick={() => setShowColMenu(v => !v)} style={{ padding: '8px 14px', borderRadius: 20, border: '1px solid #EDE9FE', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: 'white', color: '#6B7280', display: view === 'table' ? 'inline-flex' : 'none' }}>
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
          <div style={{ ...cardStyle, padding: '10px 16px', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 10, background: '#F0EDFF', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12.5, fontWeight: 700, color: '#7F77DD' }}>Выбрано: {selected.size}</span>
            <select onChange={async e => { if (e.target.value) { await fetch(`${API}/subscribers/bulk/status`, { method: 'POST', headers: h(), body: JSON.stringify({ ids: Array.from(selected), crmStatus: e.target.value }) }); e.target.value = ''; load(); } }}
              style={{ fontSize: 12, border: '1px solid #EDE9FE', borderRadius: 8, padding: '5px 10px', outline: 'none' }}>
              <option value="">Изменить статус...</option>
              {Object.entries(STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <select onChange={async e => { if (e.target.value) { await fetch(`${API}/subscribers/bulk/manager`, { method: 'POST', headers: h(), body: JSON.stringify({ ids: Array.from(selected), managerId: e.target.value }) }); e.target.value = ''; load(); } }}
              style={{ fontSize: 12, border: '1px solid #EDE9FE', borderRadius: 8, padding: '5px 10px', outline: 'none' }}>
              <option value="">Назначить менеджера...</option>
              {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
            <button onClick={async () => { const tag = prompt('Название тега:'); if (!tag) return; await fetch(`${API}/subscribers/bulk/tag/add`, { method: 'POST', headers: h(), body: JSON.stringify({ ids: Array.from(selected), tag }) }); load(); }}
              style={{ fontSize: 11.5, background: 'white', border: '1px solid #EDE9FE', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: '#7F77DD', fontWeight: 600 }}>+ Тег</button>
            <button onClick={async () => { if (!confirm(`Архивировать ${selected.size} подписчиков?`)) return; await fetch(`${API}/subscribers/bulk/archive`, { method: 'POST', headers: h(), body: JSON.stringify({ ids: Array.from(selected) }) }); load(); }}
              style={{ fontSize: 11.5, background: 'white', border: '1px solid #EDE9FE', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: '#6B7280', fontWeight: 600 }}>📥 Архивировать</button>
            <button onClick={async () => { const r = await fetch(`${API}/subscribers/export/csv`, { method: 'POST', headers: h(), body: JSON.stringify({ ids: Array.from(selected) }) }); const blob = await r.blob(); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'subscribers.csv'; a.click(); }}
              style={{ fontSize: 11.5, background: 'white', border: '1px solid #EDE9FE', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: '#16A34A', fontWeight: 600 }}>📄 Экспорт CSV</button>
            <button onClick={() => setBulkDeleteConfirm(true)}
              style={{ fontSize: 11.5, background: 'white', border: '1px solid #FCA5A5', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', color: '#DC2626', fontWeight: 600 }}>🗑 Удалить</button>
            <button onClick={() => setSelected(new Set())} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#7F77DD', fontSize: 12, cursor: 'pointer', fontWeight: 700 }}>Снять выделение</button>
          </div>
        )}

        {/* Table */}
        {view === 'table' ? (
        <div style={{ ...cardStyle, overflow: 'hidden' }}>
          {loading ? (
            <div style={{ padding: '16px 20px' }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '12px 0', borderBottom: i < 5 ? '1px solid #F8F7FF' : 'none' }}>
                  <div className="skeleton-pulse" style={{ width: 36, height: 36, borderRadius: '50%', background: '#EDE9FE' }} />
                  <div style={{ flex: 1 }}>
                    <div className="skeleton-pulse" style={{ width: '30%', height: 12, borderRadius: 6, background: '#EDE9FE', marginBottom: 8 }} />
                    <div className="skeleton-pulse" style={{ width: '50%', height: 10, borderRadius: 6, background: '#F3F0FF' }} />
                  </div>
                  <div className="skeleton-pulse" style={{ width: 70, height: 20, borderRadius: 20, background: '#EDE9FE' }} />
                </div>
              ))}
            </div>
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
                            onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'white'}
                            onContextMenu={e => { e.preventDefault(); setContextMenu({ x: e.clientX, y: e.clientY, subscriber: s }); }}>
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
        ) : (
          <SubscriberBoard subscribers={subscribers} loading={loading} onSelect={(s: any) => setActiveSubscriber(s)} />
        )}

        {view === 'table' && total > pageSize && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 16 }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}
              style={{ padding: '7px 14px', borderRadius: 10, border: '1px solid #EDE9FE', background: 'white', color: page === 1 ? '#C4C0E8' : '#7F77DD', fontSize: 12.5, fontWeight: 700, cursor: page === 1 ? 'not-allowed' : 'pointer' }}>← Назад</button>
            <span style={{ fontSize: 12.5, color: '#9B97CC', padding: '0 8px' }}>
              Стр. {page} из {Math.ceil(total / pageSize)} · показано {Math.min((page - 1) * pageSize + 1, total)}–{Math.min(page * pageSize, total)} из {total}
            </span>
            <button onClick={() => setPage(p => (p * pageSize < total ? p + 1 : p))} disabled={page * pageSize >= total}
              style={{ padding: '7px 14px', borderRadius: 10, border: '1px solid #EDE9FE', background: 'white', color: page * pageSize >= total ? '#C4C0E8' : '#7F77DD', fontSize: 12.5, fontWeight: 700, cursor: page * pageSize >= total ? 'not-allowed' : 'pointer' }}>Вперёд →</button>
          </div>
        )}
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

      {showTrash && (
        <TrashModal h={h} onClose={() => setShowTrash(false)} onRestored={load} />
      )}

      {showArchive && (
        <ArchiveModal h={h} onClose={() => setShowArchive(false)} onRestored={load}
          onSelectSubscriber={(s: any) => { setActiveSubscriber(s); setShowArchive(false); }} />
      )}

      {showCrmSettings && (
        <CrmSettingsModal h={h} onClose={() => setShowCrmSettings(false)} />
      )}

      {bulkDeleteConfirm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,16,64,0.4)', zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.15s ease-out' }}>
          <div style={{ background: 'white', borderRadius: 20, padding: 24, width: 340, boxShadow: '0 24px 64px rgba(127,119,221,0.25)' }}>
            <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1a1040', margin: '0 0 8px' }}>Удалить {selected.size} подписчиков?</h3>
            <p style={{ fontSize: 12.5, color: '#9B97CC', margin: '0 0 18px' }}>Они переместятся в корзину, откуда их можно восстановить.</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={async () => {
                for (const id of Array.from(selected)) await fetch(`${API}/subscribers/${id}`, { method: 'DELETE', headers: h() });
                setBulkDeleteConfirm(false); setSelected(new Set()); load();
              }} style={{ flex: 1, background: '#DC2626', color: 'white', border: 'none', borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Удалить</button>
              <button onClick={() => setBulkDeleteConfirm(false)} style={{ flex: 1, background: '#F8F7FF', color: '#6B7280', border: '1px solid #EDE9FE', borderRadius: 10, padding: 10, fontSize: 13, cursor: 'pointer' }}>Отмена</button>
            </div>
          </div>
        </div>
      )}

      {contextMenu && (
        <div onClick={e => e.stopPropagation()}
          style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 1200, background: 'white', borderRadius: 12, boxShadow: '0 8px 24px rgba(127,119,221,0.25)', border: '1px solid #EDE9FE', padding: 6, minWidth: 180, animation: 'fadeIn 0.1s ease-out' }}>
          <button onClick={() => { setActiveSubscriber(contextMenu.subscriber); setContextMenu(null); }}
            style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: 'none', background: 'none', fontSize: 12.5, color: '#1a1040', cursor: 'pointer', textAlign: 'left' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F8F7FF'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}>👤 Открыть карточку</button>
          <button onClick={async () => { await fetch(`${API}/subscribers/bulk/archive`, { method: 'POST', headers: h(), body: JSON.stringify({ ids: [contextMenu.subscriber.id] }) }); setContextMenu(null); load(); }}
            style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: 'none', background: 'none', fontSize: 12.5, color: '#1a1040', cursor: 'pointer', textAlign: 'left' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F8F7FF'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}>📥 Архивировать</button>
          <button onClick={async () => { const text = [contextMenu.subscriber.firstName, contextMenu.subscriber.lastName, contextMenu.subscriber.email, contextMenu.subscriber.phone].filter(Boolean).join(' · '); navigator.clipboard?.writeText(text); setContextMenu(null); }}
            style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: 'none', background: 'none', fontSize: 12.5, color: '#1a1040', cursor: 'pointer', textAlign: 'left' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F8F7FF'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}>📋 Копировать контакты</button>
          <div style={{ height: 1, background: '#F3F0FF', margin: '4px 0' }} />
          <button onClick={async () => { await fetch(`${API}/subscribers/${contextMenu.subscriber.id}`, { method: 'DELETE', headers: h() }); setContextMenu(null); load(); }}
            style={{ display: 'flex', width: '100%', alignItems: 'center', gap: 8, padding: '8px 10px', borderRadius: 8, border: 'none', background: 'none', fontSize: 12.5, color: '#DC2626', cursor: 'pointer', textAlign: 'left' }}
            onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#FEF2F2'} onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'none'}>🗑 Удалить</button>
        </div>
      )}
    </div>
  );
}

function IntegrationModal({ h, onClose }: any) {
  const [config, setConfig] = useState<any>({ connectionType: 'DATABASE', apiUrl: '', apiKey: '', dbConnectionString: '', isActive: false });
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

  const canSync = config.connectionType === 'DATABASE' ? !!config.dbConnectionString : !!config.apiUrl;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,16,64,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.15s ease-out' }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 24, width: 440, boxShadow: '0 24px 64px rgba(127,119,221,0.2)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1a1040', margin: '0 0 4px' }}>👑 Интеграция KingStats</h3>
        <p style={{ fontSize: 11.5, color: '#9B97CC', margin: '0 0 16px' }}>Синхронизация подписчиков</p>

        <div style={{ display: 'flex', gap: 4, background: '#F8F7FF', borderRadius: 10, padding: 4, marginBottom: 14 }}>
          <button onClick={() => setConfig({ ...config, connectionType: 'DATABASE' })}
            style={{ flex: 1, padding: '7px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: config.connectionType === 'DATABASE' ? 'white' : 'transparent', color: config.connectionType === 'DATABASE' ? '#7F77DD' : '#9B97CC', boxShadow: config.connectionType === 'DATABASE' ? '0 2px 6px rgba(127,119,221,0.15)' : 'none' }}>🗄 База данных</button>
          <button onClick={() => setConfig({ ...config, connectionType: 'API' })}
            style={{ flex: 1, padding: '7px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: config.connectionType === 'API' ? 'white' : 'transparent', color: config.connectionType === 'API' ? '#7F77DD' : '#9B97CC', boxShadow: config.connectionType === 'API' ? '0 2px 6px rgba(127,119,221,0.15)' : 'none' }}>🔌 HTTP API</button>
        </div>

        {config.connectionType === 'DATABASE' ? (
          <>
            <p style={{ fontSize: 11, color: '#9B97CC', margin: '0 0 4px' }}>Строка подключения PostgreSQL</p>
            <input type="password" value={config.dbConnectionString ?? ''} onChange={e => setConfig({ ...config, dbConnectionString: e.target.value })} placeholder="postgresql://user:pass@host.docker.internal:5433/kingstats?sslmode=disable"
              style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 12.5, marginBottom: 14, outline: 'none', boxSizing: 'border-box' }} />
            <p style={{ fontSize: 10.5, color: '#9B97CC', margin: '-8px 0 14px', lineHeight: 1.5 }}>Читает только <code>reporting.users_overview</code>, доступ на чтение. Хост должен быть <code>host.docker.internal</code> (не 127.0.0.1) — backend работает в Docker-контейнере.</p>
          </>
        ) : (
          <>
            <p style={{ fontSize: 11, color: '#9B97CC', margin: '0 0 4px' }}>URL API</p>
            <input value={config.apiUrl ?? ''} onChange={e => setConfig({ ...config, apiUrl: e.target.value })} placeholder="https://www.kingstats.ru/api/admin/subscribers"
              style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 10, outline: 'none', boxSizing: 'border-box' }} />

            <p style={{ fontSize: 11, color: '#9B97CC', margin: '0 0 4px' }}>API-ключ</p>
            <input type="password" value={config.apiKey ?? ''} onChange={e => setConfig({ ...config, apiKey: e.target.value })} placeholder="••••••••"
              style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 14, outline: 'none', boxSizing: 'border-box' }} />
          </>
        )}

        <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16, cursor: 'pointer' }}>
          <input type="checkbox" checked={!!config.isActive} onChange={e => setConfig({ ...config, isActive: e.target.checked })} style={{ accentColor: '#7F77DD' }} />
          <span style={{ fontSize: 12.5, color: '#1a1040' }}>Интеграция активна</span>
        </label>

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={save} disabled={saving} style={{ flex: 1, background: 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white', border: 'none', borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Сохраняю...' : 'Сохранить'}</button>
          <button onClick={sync} disabled={syncing || !canSync} style={{ flex: 1, background: '#F8F7FF', color: '#7F77DD', border: '1px solid #EDE9FE', borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 700, cursor: canSync ? 'pointer' : 'not-allowed' }}>{syncing ? 'Синхронизирую...' : '🔄 Синхронизировать'}</button>
        </div>
        {msg && <p style={{ fontSize: 12, color: msg.startsWith('✅') ? '#16A34A' : '#D97706', background: msg.startsWith('✅') ? '#DCFCE7' : '#FFFBEB', padding: '8px 12px', borderRadius: 8, margin: '0 0 10px' }}>{msg}</p>}
        <button onClick={onClose} style={{ width: '100%', background: 'none', border: 'none', color: '#9B97CC', fontSize: 12, cursor: 'pointer', padding: 6 }}>Закрыть</button>
      </div>
    </div>
  );
}
