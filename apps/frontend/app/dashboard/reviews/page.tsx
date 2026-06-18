'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = 'https://employee-tracker.ru/api/v1';

const star = (n: number, rating: number) => {
  const full = '#F59E0B', empty = '#E5E7EB';
  return <span key={n} style={{ color: n <= rating ? full : empty, fontSize: '14px' }}>★</span>;
};

export default function ReviewsPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [hasToken, setHasToken] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [savingToken, setSavingToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 7);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [filter, setFilter] = useState<'all' | 'negative' | 'positive'>('all');
  const [search, setSearch] = useState('');

  const h = () => ({ Authorization: 'Bearer ' + localStorage.getItem('access_token') });

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    // Проверяем есть ли токен WB
    fetch(API + '/settings/wb-token', { headers: h() })
      .then(r => r.json())
      .then(d => { if (d.hasToken) setHasToken(true); })
      .catch(() => {});
  }, []);

  const saveToken = async () => {
    if (!tokenInput.trim()) return;
    setSavingToken(true);
    const res = await fetch(API + '/settings/wb-token', {
      method: 'POST',
      headers: { ...h(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ token: tokenInput.trim() }),
    });
    const d = await res.json();
    if (d.success) { setHasToken(true); setTokenInput(''); }
    setSavingToken(false);
  };

  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const res = await fetch(
        `${API}/wb-reviews?dateFrom=${dateFrom}T00:00:00Z&dateTo=${dateTo}T23:59:59Z`,
        { headers: h() }
      );
      const d = await res.json();
      if (d.error) { setError(d.error); setData(null); }
      else setData(d);
    } catch (e: any) {
      setError('Ошибка загрузки: ' + e.message);
    }
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { if (hasToken) load(); }, [hasToken, load]);

  const card: React.CSSProperties = { background: 'white', borderRadius: '20px', padding: '20px 22px', boxShadow: '0 4px 16px rgba(127,119,221,0.08)' };

  const products = (data?.products ?? []).filter((p: any) => {
    const matchSearch = !search || p.sku.toLowerCase().includes(search.toLowerCase()) || p.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'negative' && p.negative > 0) || (filter === 'positive' && p.positive > 0);
    return matchSearch && matchFilter;
  });

  const totalPos = data?.products?.reduce((s: number, p: any) => s + p.positive, 0) ?? 0;
  const totalNeg = data?.products?.reduce((s: number, p: any) => s + p.negative, 0) ?? 0;
  const totalNeu = data?.products?.reduce((s: number, p: any) => s + p.neutral, 0) ?? 0;

  return (
    <div style={{ minHeight: '100vh', background: '#ECEAF8' }}>
      {/* Header */}
      <div style={{ background: 'white', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 4px 16px rgba(127,119,221,0.06)' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#1a1040', margin: 0 }}>Отзывы WB</h1>
          <p style={{ fontSize: '11px', color: '#9B97CC', margin: '2px 0 0' }}>Аналитика отзывов по товарам</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
            style={{ background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '8px 12px', fontSize: '13px', color: '#1a1040' }} />
          <span style={{ color: '#9B97CC', fontSize: '13px' }}>—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
            style={{ background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '8px 12px', fontSize: '13px', color: '#1a1040' }} />
          <button onClick={load} disabled={loading || !hasToken}
            style={{ background: 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white', border: 'none', borderRadius: '20px', padding: '9px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
            {loading ? 'Загрузка...' : 'Обновить'}
          </button>
        </div>
      </div>

      <div style={{ padding: '20px 28px', maxWidth: '1100px', display: 'flex', flexDirection: 'column', gap: '14px' }}>

        {/* Настройка токена */}
        {!hasToken && (
          <div style={{ ...card, border: '2px dashed #EDE9FE' }}>
            <div style={{ display: 'flex', gap: '12px', alignItems: 'center', marginBottom: '12px' }}>
              <div style={{ width: '40px', height: '40px', borderRadius: '12px', background: '#EDE9FE', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <i className="ti ti-key" style={{ fontSize: '20px', color: '#7F77DD' }} />
              </div>
              <div>
                <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1a1040', margin: 0 }}>Подключите WB API</h3>
                <p style={{ fontSize: '12px', color: '#9B97CC', margin: 0 }}>Вставьте токен из кабинета WB с доступом "Отзывы и вопросы"</p>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input
                type="password"
                placeholder="Вставьте WB API токен..."
                value={tokenInput}
                onChange={e => setTokenInput(e.target.value)}
                style={{ flex: 1, background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', outline: 'none' }}
              />
              <button onClick={saveToken} disabled={savingToken || !tokenInput}
                style={{ background: 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white', border: 'none', borderRadius: '12px', padding: '10px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                {savingToken ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
            <p style={{ fontSize: '11px', color: '#9B97CC', margin: '8px 0 0' }}>
              Получить токен: личный кабинет WB → Настройки → Доступ к API → Создать новый токен → категория "Отзывы и вопросы"
            </p>
          </div>
        )}

        {hasToken && (
          <div style={{ ...card, padding: '12px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: '#16A34A', display: 'inline-block' }} />
              <span style={{ fontSize: '13px', color: '#16A34A', fontWeight: 600 }}>WB API подключён</span>
            </div>
            <button onClick={() => { setHasToken(false); }} style={{ fontSize: '11px', color: '#9B97CC', background: 'none', border: 'none', cursor: 'pointer' }}>
              Сменить токен
            </button>
          </div>
        )}

        {error && (
          <div style={{ ...card, background: '#FEF2F2', border: '1px solid #FCA5A5' }}>
            <p style={{ color: '#DC2626', fontSize: '13px', margin: 0 }}>⚠️ {error}</p>
          </div>
        )}

        {/* Сводка */}
        {data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px' }}>
              {[
                { label: 'Всего отзывов', value: data.total, color: '#7F77DD', bg: '#EDE9FE', icon: 'ti-message' },
                { label: 'Положительных', value: totalPos, color: '#16A34A', bg: '#DCFCE7', icon: 'ti-thumb-up' },
                { label: 'Негативных', value: totalNeg, color: '#DC2626', bg: '#FEE2E2', icon: 'ti-thumb-down' },
                { label: 'Нейтральных', value: totalNeu, color: '#D97706', bg: '#FEF3C7', icon: 'ti-minus' },
              ].map(s => (
                <div key={s.label} style={{ ...card, display: 'flex', alignItems: 'center', gap: '14px' }}>
                  <div style={{ width: '44px', height: '44px', borderRadius: '14px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`ti ${s.icon}`} style={{ fontSize: '22px', color: s.color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#1a1040' }}>{s.value.toLocaleString('ru')}</div>
                    <div style={{ fontSize: '11px', color: '#9B97CC' }}>{s.label}</div>
                  </div>
                </div>
              ))}
            </div>

            {/* Фильтры */}
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <input
                placeholder="Поиск по артикулу или названию..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                style={{ flex: 1, background: 'white', border: '1px solid #EDE9FE', borderRadius: '12px', padding: '9px 14px', fontSize: '13px', outline: 'none' }}
              />
              {(['all', 'negative', 'positive'] as const).map(f => (
                <button key={f} onClick={() => setFilter(f)}
                  style={{ background: filter === f ? 'linear-gradient(135deg,#7F77DD,#5248C5)' : 'white', color: filter === f ? 'white' : '#7F77DD', border: '1px solid #EDE9FE', borderRadius: '12px', padding: '9px 16px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  {f === 'all' ? 'Все' : f === 'negative' ? '👎 Негатив' : '👍 Позитив'}
                </button>
              ))}
            </div>

            {/* Таблица по товарам */}
            <div style={card}>
              <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#1a1040', margin: '0 0 14px' }}>
                По товарам ({products.length})
              </h3>
              {products.length === 0 ? (
                <p style={{ color: '#9B97CC', fontSize: '13px', textAlign: 'center', padding: '20px 0' }}>Отзывов за период не найдено</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {products.map((p: any) => {
                    const posPercent = p.total > 0 ? Math.round(p.positive / p.total * 100) : 0;
                    const negPercent = p.total > 0 ? Math.round(p.negative / p.total * 100) : 0;
                    return (
                      <div key={p.sku} style={{ background: '#F8F7FF', borderRadius: '14px', padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                              <span style={{ fontSize: '13px', fontWeight: 700, color: '#1a1040' }}>{p.sku}</span>
                              <span style={{ fontSize: '11px', color: '#9B97CC' }}>{p.name}</span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '8px' }}>
                              {[1,2,3,4,5].map(n => star(n, Math.round(p.avgRating)))}
                              <span style={{ fontSize: '12px', color: '#9B97CC', marginLeft: '4px' }}>{p.avgRating} / {p.total} отзывов</span>
                            </div>
                            {/* Прогресс-бар */}
                            <div style={{ display: 'flex', gap: '2px', height: '6px', borderRadius: '3px', overflow: 'hidden', background: '#EDE9FE' }}>
                              {posPercent > 0 && <div style={{ width: posPercent + '%', background: '#16A34A' }} />}
                              {(100 - posPercent - negPercent) > 0 && <div style={{ width: (100 - posPercent - negPercent) + '%', background: '#D97706' }} />}
                              {negPercent > 0 && <div style={{ width: negPercent + '%', background: '#DC2626' }} />}
                            </div>
                          </div>
                          <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                            <span style={{ background: '#DCFCE7', color: '#16A34A', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', fontWeight: 700 }}>+{p.positive}</span>
                            <span style={{ background: '#FEF3C7', color: '#D97706', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', fontWeight: 700 }}>{p.neutral}</span>
                            <span style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: '8px', padding: '4px 10px', fontSize: '12px', fontWeight: 700 }}>-{p.negative}</span>
                          </div>
                        </div>
                        {/* Последние отзывы */}
                        {p.recent.length > 0 && (
                          <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                            {p.recent.filter((r: any) => r.text).slice(0, 2).map((r: any) => (
                              <div key={r.id} style={{ background: 'white', borderRadius: '8px', padding: '8px 12px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                                <span style={{ fontSize: '12px', color: r.rating >= 4 ? '#16A34A' : r.rating <= 2 ? '#DC2626' : '#D97706', fontWeight: 700, flexShrink: 0 }}>
                                  {'★'.repeat(r.rating)}{'☆'.repeat(5 - r.rating)}
                                </span>
                                <span style={{ fontSize: '12px', color: '#4B4878', lineHeight: '1.4' }}>{r.text.slice(0, 120)}{r.text.length > 120 ? '...' : ''}</span>
                                {!r.answered && <span style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: '6px', padding: '2px 6px', fontSize: '10px', flexShrink: 0 }}>Без ответа</span>}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}

        {loading && (
          <div style={{ textAlign: 'center', padding: '40px', color: '#9B97CC', fontSize: '14px' }}>
            Загрузка отзывов из WB...
          </div>
        )}
      </div>
    </div>
  );
}
