'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = 'https://employee-tracker.ru/api/v1';

const CATEGORY_LABELS: Record<string, { label: string; icon: string; color: string }> = {
  auth: { label: 'Авторизация', icon: 'ti-login', color: '#7F77DD' },
  employees: { label: 'Сотрудники', icon: 'ti-users', color: '#16A34A' },
  tasks: { label: 'Задачи', icon: 'ti-checklist', color: '#D97706' },
  calls: { label: 'Видеозвонки', icon: 'ti-video', color: '#DC2626' },
  reviews: { label: 'Отзывы WB', icon: 'ti-star', color: '#F59E0B' },
  settings: { label: 'Настройки', icon: 'ti-settings', color: '#5248C5' },
};

const ACTION_LABELS: Record<string, string> = {
  'login': 'Вход в систему',
  'logout': 'Выход из системы',
  'employee.invite': 'Добавлен сотрудник',
  'employee.delete': 'Удалён сотрудник',
  'call.create': 'Создан видеозвонок',
  'call.kick_participant': 'Удалён участник звонка',
  'call.end_for_all': 'Звонок завершён для всех',
};

export default function AuditLogPage() {
  const router = useRouter();
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [category, setCategory] = useState('');
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [summary, setSummary] = useState<any>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [tab, setTab] = useState<'actions' | 'errors'>('actions');
  const [errors, setErrors] = useState<any[]>([]);
  const [errorsTotal, setErrorsTotal] = useState(0);
  const [errorsPage, setErrorsPage] = useState(1);
  const [errorsPages, setErrorsPages] = useState(1);
  const [errorsSummary, setErrorsSummary] = useState<any>(null);
  const [errorSearch, setErrorSearch] = useState('');
  const [expandedErrorId, setExpandedErrorId] = useState<string | null>(null);

  const h = () => ({ Authorization: 'Bearer ' + localStorage.getItem('access_token') });

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const params = new URLSearchParams({
        page: String(page), limit: '50',
        dateFrom: dateFrom + 'T00:00:00Z', dateTo: dateTo + 'T23:59:59Z',
      });
      if (category) params.set('category', category);
      if (search) params.set('search', search);

      const res = await fetch(`${API}/audit?${params}`, { headers: h() });
      if (res.status === 403) { setError('Доступ к логам только для администраторов'); setLoading(false); return; }
      const data = await res.json();
      setLogs(data.logs ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } catch (e: any) {
      setError('Ошибка загрузки логов: ' + e.message);
    }
    setLoading(false);
  }, [page, category, search, dateFrom, dateTo]);

  useEffect(() => {
    if (!localStorage.getItem('access_token')) { router.push('/login'); return; }
    load();
  }, [load]);

  useEffect(() => {
    fetch(`${API}/audit/categories`, { headers: h() }).then(r => r.json()).then(setCategories).catch(() => {});
    fetch(`${API}/audit/summary`, { headers: h() }).then(r => r.json()).then(setSummary).catch(() => {});
    fetch(`${API}/audit/errors/summary`, { headers: h() }).then(r => r.json()).then(setErrorsSummary).catch(() => {});
  }, []);

  const loadErrors = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(errorsPage), limit: '50' });
      if (errorSearch) params.set('search', errorSearch);
      const res = await fetch(`${API}/audit/errors?${params}`, { headers: h() });
      const data = await res.json();
      setErrors(data.errors ?? []);
      setErrorsTotal(data.total ?? 0);
      setErrorsPages(data.pages ?? 1);
    } catch {}
    setLoading(false);
  }, [errorsPage, errorSearch]);

  useEffect(() => {
    if (tab === 'errors') loadErrors();
  }, [tab, loadErrors]);

  const card: React.CSSProperties = { background: 'white', borderRadius: '20px', padding: '18px 22px', boxShadow: '0 4px 16px rgba(127,119,221,0.08)' };

  const formatDate = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString('ru', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const getActionLabel = (action: string) => ACTION_LABELS[action] ?? action;
  const getCategoryInfo = (cat: string) => CATEGORY_LABELS[cat] ?? { label: cat, icon: 'ti-file', color: '#9B97CC' };

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#ECEAF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ ...card, textAlign: 'center', maxWidth: '400px' }}>
          <div style={{ fontSize: '40px', marginBottom: '10px' }}>🔒</div>
          <p style={{ color: '#DC2626', fontSize: '14px', margin: 0 }}>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: '#ECEAF8' }}>
      <div style={{ background: 'white', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 4px 16px rgba(127,119,221,0.06)' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#1a1040', margin: 0 }}>Журнал действий</h1>
          <p style={{ fontSize: '11px', color: '#9B97CC', margin: '2px 0 0' }}>Аудит всех действий сотрудников в системе</p>
        </div>
        <button onClick={load} disabled={loading}
          style={{ background: 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white', border: 'none', borderRadius: '20px', padding: '9px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
          {loading ? 'Загрузка...' : 'Обновить'}
        </button>
      </div>

      <div style={{ padding: '20px 28px', maxWidth: '1100px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        <div style={{ display: 'flex', gap: '6px' }}>
          <button onClick={() => setTab('actions')}
            style={{ background: tab === 'actions' ? 'linear-gradient(135deg,#7F77DD,#5248C5)' : 'white', color: tab === 'actions' ? 'white' : '#7F77DD', border: '1px solid #EDE9FE', borderRadius: '12px', padding: '8px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
            📋 Действия сотрудников
          </button>
          <button onClick={() => setTab('errors')}
            style={{ background: tab === 'errors' ? 'linear-gradient(135deg,#DC2626,#991B1B)' : 'white', color: tab === 'errors' ? 'white' : '#DC2626', border: '1px solid #FEE2E2', borderRadius: '12px', padding: '8px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', position: 'relative' }}>
            🐞 Ошибки системы
            {errorsSummary?.last24hCount > 0 && (
              <span style={{ position: 'absolute', top: '-6px', right: '-6px', background: '#DC2626', color: 'white', borderRadius: '10px', fontSize: '10px', fontWeight: 700, minWidth: '18px', height: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px' }}>
                {errorsSummary.last24hCount}
              </span>
            )}
          </button>
        </div>

        {tab === 'actions' && summary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ti ti-calendar-event" style={{ fontSize: '22px', color: '#7F77DD' }} />
              </div>
              <div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#1a1040' }}>{summary.totalToday}</div>
                <div style={{ fontSize: '11px', color: '#9B97CC' }}>Действий сегодня</div>
              </div>
            </div>
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: '#DCFCE7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ti ti-database" style={{ fontSize: '22px', color: '#16A34A' }} />
              </div>
              <div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#1a1040' }}>{summary.totalAll}</div>
                <div style={{ fontSize: '11px', color: '#9B97CC' }}>Всего записей</div>
              </div>
            </div>
            <div style={{ ...card }}>
              <div style={{ fontSize: '11px', color: '#9B97CC', marginBottom: '6px' }}>Активнее всего сегодня</div>
              {summary.topUsersToday?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {summary.topUsersToday.slice(0, 2).map((u: any) => (
                    <div key={u.userId} style={{ fontSize: '12px', color: '#4B4878' }}>{u.userName ?? 'Неизвестно'} — {u.count}</div>
                  ))}
                </div>
              ) : <span style={{ fontSize: '12px', color: '#9B97CC' }}>Нет данных</span>}
            </div>
          </div>
        )}

        {tab === 'actions' && (
        <>
        <div style={card}>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: '12px' }}>
            <input placeholder="Поиск по действию или сотруднику..." value={search} onChange={e => setSearch(e.target.value)}
              style={{ flex: 1, minWidth: '200px', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: '12px', padding: '9px 14px', fontSize: '13px', outline: 'none' }} />
            <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
              style={{ background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '8px 12px', fontSize: '13px' }} />
            <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
              style={{ background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '8px 12px', fontSize: '13px' }} />
          </div>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            <button onClick={() => setCategory('')}
              style={{ background: category === '' ? 'linear-gradient(135deg,#7F77DD,#5248C5)' : 'white', color: category === '' ? 'white' : '#7F77DD', border: '1px solid #EDE9FE', borderRadius: '12px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
              Все
            </button>
            {categories.map(c => {
              const info = getCategoryInfo(c.category);
              return (
                <button key={c.category} onClick={() => setCategory(c.category)}
                  style={{ background: category === c.category ? info.color : 'white', color: category === c.category ? 'white' : info.color, border: `1px solid ${info.color}30`, borderRadius: '12px', padding: '7px 14px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                  {info.label} ({c.count})
                </button>
              );
            })}
          </div>
        </div>

        <div style={card}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a1040', margin: '0 0 12px' }}>
            Записи ({total.toLocaleString('ru')})
          </p>
          {logs.length === 0 ? (
            <p style={{ color: '#9B97CC', fontSize: '13px', textAlign: 'center', padding: '30px 0' }}>
              {loading ? 'Загрузка...' : 'Записей не найдено'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {logs.map(log => {
                const info = getCategoryInfo(log.category);
                const isExpanded = expandedId === log.id;
                return (
                  <div key={log.id} onClick={() => setExpandedId(isExpanded ? null : log.id)}
                    style={{ background: '#F8F7FF', borderRadius: '12px', padding: '10px 14px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: info.color, flexShrink: 0 }} />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#1a1040', flexShrink: 0 }}>{getActionLabel(log.action)}</span>
                      <span style={{ fontSize: '12px', color: '#9B97CC' }}>{log.userName ?? 'Система'}</span>
                      <span style={{ fontSize: '11px', color: '#9B97CC', marginLeft: 'auto', flexShrink: 0 }}>{formatDate(log.createdAt)}</span>
                    </div>
                    {isExpanded && (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #EDE9FE', fontSize: '11px', color: '#4B4878', fontFamily: 'monospace' }}>
                        {log.details && <div style={{ marginBottom: '4px' }}>Детали: {JSON.stringify(log.details)}</div>}
                        {log.ipAddress && <div>IP: {log.ipAddress}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {pages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                style={{ background: 'white', border: '1px solid #EDE9FE', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>
                ← Назад
              </button>
              <span style={{ fontSize: '12px', color: '#9B97CC', alignSelf: 'center' }}>{page} / {pages}</span>
              <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
                style={{ background: 'white', border: '1px solid #EDE9FE', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: page >= pages ? 'default' : 'pointer', opacity: page >= pages ? 0.5 : 1 }}>
                Вперёд →
              </button>
            </div>
          )}
        </div>
        </>
        )}

        {tab === 'errors' && (
        <>
        {errorsSummary && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '12px' }}>
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: '#FEE2E2', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ti ti-alert-triangle" style={{ fontSize: '22px', color: '#DC2626' }} />
              </div>
              <div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#1a1040' }}>{errorsSummary.todayCount}</div>
                <div style={{ fontSize: '11px', color: '#9B97CC' }}>Ошибок сегодня</div>
              </div>
            </div>
            <div style={{ ...card, display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: '#FEF3C7', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ti ti-clock" style={{ fontSize: '22px', color: '#D97706' }} />
              </div>
              <div>
                <div style={{ fontSize: '22px', fontWeight: 800, color: '#1a1040' }}>{errorsSummary.last24hCount}</div>
                <div style={{ fontSize: '11px', color: '#9B97CC' }}>За последние 24ч</div>
              </div>
            </div>
            <div style={{ ...card }}>
              <div style={{ fontSize: '11px', color: '#9B97CC', marginBottom: '6px' }}>Проблемные эндпоинты (24ч)</div>
              {errorsSummary.topEndpoints?.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {errorsSummary.topEndpoints.slice(0, 2).map((e: any) => (
                    <div key={e.endpoint} style={{ fontSize: '11px', color: '#4B4878', fontFamily: 'monospace' }}>{e.endpoint} — {e.count}</div>
                  ))}
                </div>
              ) : <span style={{ fontSize: '12px', color: '#16A34A' }}>✓ Ошибок не было</span>}
            </div>
          </div>
        )}

        <div style={card}>
          <input placeholder="Поиск по сообщению об ошибке или эндпоинту..." value={errorSearch} onChange={e => setErrorSearch(e.target.value)}
            style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: '12px', padding: '9px 14px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }} />
        </div>

        <div style={card}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a1040', margin: '0 0 12px' }}>
            Ошибки ({errorsTotal.toLocaleString('ru')})
          </p>
          {errors.length === 0 ? (
            <p style={{ color: '#16A34A', fontSize: '13px', textAlign: 'center', padding: '30px 0' }}>
              {loading ? 'Загрузка...' : '✓ Ошибок не зафиксировано'}
            </p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {errors.map(err => {
                const isExpanded = expandedErrorId === err.id;
                return (
                  <div key={err.id} onClick={() => setExpandedErrorId(isExpanded ? null : err.id)}
                    style={{ background: '#FEF2F2', borderRadius: '12px', padding: '10px 14px', cursor: 'pointer', border: '1px solid #FEE2E2' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                      <span style={{ background: '#DC2626', color: 'white', borderRadius: '6px', padding: '1px 6px', fontSize: '10px', fontWeight: 700, flexShrink: 0 }}>{err.statusCode}</span>
                      <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#9B97CC', flexShrink: 0 }}>{err.method}</span>
                      <span style={{ fontSize: '12px', color: '#1a1040', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{err.message}</span>
                      <span style={{ fontSize: '11px', color: '#9B97CC', marginLeft: 'auto', flexShrink: 0 }}>{formatDate(err.createdAt)}</span>
                    </div>
                    {isExpanded && (
                      <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid #FECACA', fontSize: '11px', color: '#7F1D1D', fontFamily: 'monospace', whiteSpace: 'pre-wrap', maxHeight: '300px', overflowY: 'auto' }}>
                        <div style={{ marginBottom: '4px' }}>Эндпоинт: {err.endpoint}</div>
                        {err.body && <div style={{ marginBottom: '4px' }}>Тело запроса: {err.body}</div>}
                        {err.stack && <div>Stack trace:\n{err.stack}</div>}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {errorsPages > 1 && (
            <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '16px' }}>
              <button onClick={() => setErrorsPage(p => Math.max(1, p - 1))} disabled={errorsPage <= 1}
                style={{ background: 'white', border: '1px solid #EDE9FE', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: errorsPage <= 1 ? 'default' : 'pointer', opacity: errorsPage <= 1 ? 0.5 : 1 }}>
                ← Назад
              </button>
              <span style={{ fontSize: '12px', color: '#9B97CC', alignSelf: 'center' }}>{errorsPage} / {errorsPages}</span>
              <button onClick={() => setErrorsPage(p => Math.min(errorsPages, p + 1))} disabled={errorsPage >= errorsPages}
                style={{ background: 'white', border: '1px solid #EDE9FE', borderRadius: '8px', padding: '6px 12px', fontSize: '12px', cursor: errorsPage >= errorsPages ? 'default' : 'pointer', opacity: errorsPage >= errorsPages ? 0.5 : 1 }}>
                Вперёд →
              </button>
            </div>
          )}
        </div>
        </>
        )}
      </div>
    </div>
  );
}
