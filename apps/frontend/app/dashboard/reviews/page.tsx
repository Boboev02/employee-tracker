'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = 'https://employee-tracker.ru/api/v1';

export default function ReviewsPage() {
  const router = useRouter();
  const [hasToken, setHasToken] = useState(false);
  const [tokenInput, setTokenInput] = useState('');
  const [savingToken, setSavingToken] = useState(false);
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState('');
  const [dateFrom, setDateFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 30);
    return d.toISOString().slice(0, 10);
  });
  const [dateTo, setDateTo] = useState(() => new Date().toISOString().slice(0, 10));
  const [filter, setFilter] = useState<'all' | 'negative' | 'positive' | 'unanswered'>('all');
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);
  // Калькулятор
  const [calcSelectedSku, setCalcSelectedSku] = useState('');
  const [calcCurrentRating, setCalcCurrentRating] = useState('4.2');
  const [calcCurrentCount, setCalcCurrentCount] = useState('50');
  const [calcTargetRating, setCalcTargetRating] = useState('4.5');
  const [calcNewRating, setCalcNewRating] = useState('5');
  const [calcDaysOld, setCalcDaysOld] = useState('180');
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'products' | 'tops' | 'calc'>('products');

  const h = () => ({ Authorization: 'Bearer ' + localStorage.getItem('access_token') });

  useEffect(() => {
    if (!localStorage.getItem('access_token')) { router.push('/login'); return; }
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
      const res = await fetch(`${API}/wb-reviews?dateFrom=${dateFrom}T00:00:00Z&dateTo=${dateTo}T23:59:59Z`, { headers: h() });
      const d = await res.json();
      if (d.error) { setError(d.error); setData(null); }
      else setData(d);
    } catch (e: any) { setError('Ошибка: ' + e.message); }
    setLoading(false);
  }, [dateFrom, dateTo]);

  useEffect(() => { if (hasToken) load(); }, [hasToken, load]);

  const card: React.CSSProperties = { background: 'white', borderRadius: '20px', padding: '18px 22px', boxShadow: '0 4px 16px rgba(127,119,221,0.08)' };

  const products = (data?.products ?? []).filter((p: any) => {
    const matchSearch = !search || p.sku.toLowerCase().includes(search.toLowerCase()) || p.name.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || (filter === 'negative' && p.negative > 0) || (filter === 'positive' && p.positive > 0) || (filter === 'unanswered' && p.unansweredCount > 0);
    const matchRating = ratingFilter === null || Math.round(p.avgRating) === ratingFilter;
    return matchSearch && matchFilter && matchRating;
  });

  const trendIcon = (trend: string, diff: number) => {
    if (trend === 'up') return <span style={{ color: '#16A34A', fontSize: '12px', fontWeight: 700 }}>↑ +{diff}</span>;
    if (trend === 'down') return <span style={{ color: '#DC2626', fontSize: '12px', fontWeight: 700 }}>↓ {diff}</span>;
    return <span style={{ color: '#9B97CC', fontSize: '12px' }}>→ стабильно</span>;
  };

  const stars = (rating: number) => '★'.repeat(Math.max(0,Math.min(5,rating))) + '☆'.repeat(Math.max(0,5-Math.min(5,rating)));

  return (
    <div style={{ minHeight: '100vh', background: '#ECEAF8' }}>
      <div style={{ background: 'white', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 2px 12px rgba(127,119,221,0.08)' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#1a1040', margin: 0 }}>Отзывы WB</h1>
          <p style={{ fontSize: '11px', color: '#9B97CC', margin: '2px 0 0' }}>Аналитика отзывов по товарам</p>
        </div>
        <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
          <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)} style={{ background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '7px 12px', fontSize: '13px', color: '#1a1040' }} />
          <span style={{ color: '#9B97CC' }}>—</span>
          <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)} style={{ background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '7px 12px', fontSize: '13px', color: '#1a1040' }} />
          <button onClick={load} disabled={loading || !hasToken} style={{ background: 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white', border: 'none', borderRadius: '20px', padding: '8px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>
            {loading ? 'Загрузка...' : 'Обновить'}
          </button>
        </div>
      </div>

      <div style={{ padding: '16px 28px', maxWidth: '1200px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {!hasToken && (
          <div style={{ ...card, border: '2px dashed #EDE9FE' }}>
            <p style={{ fontSize: '14px', fontWeight: 700, color: '#1a1040', margin: '0 0 10px' }}>🔑 Подключите WB API</p>
            <div style={{ display: 'flex', gap: '10px' }}>
              <input type="password" placeholder="Вставьте WB API токен (Отзывы и вопросы)..." value={tokenInput} onChange={e => setTokenInput(e.target.value)}
                style={{ flex: 1, background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', outline: 'none' }} />
              <button onClick={saveToken} disabled={savingToken || !tokenInput}
                style={{ background: '#7F77DD', color: 'white', border: 'none', borderRadius: '12px', padding: '10px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
                {savingToken ? 'Сохранение...' : 'Сохранить'}
              </button>
            </div>
            <p style={{ fontSize: '11px', color: '#9B97CC', margin: '8px 0 0' }}>Личный кабинет WB → Настройки → Доступ к API → категория "Отзывы и вопросы"</p>
          </div>
        )}

        {hasToken && (
          <div style={{ ...card, padding: '10px 18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '13px', color: '#16A34A', fontWeight: 600 }}>● WB API подключён</span>
            <button onClick={() => setHasToken(false)} style={{ fontSize: '11px', color: '#9B97CC', background: 'none', border: 'none', cursor: 'pointer' }}>Сменить токен</button>
          </div>
        )}

        {error && <div style={{ ...card, background: '#FEF2F2', border: '1px solid #FCA5A5' }}><p style={{ color: '#DC2626', fontSize: '13px', margin: 0 }}>⚠️ {error}</p></div>}

        {data && (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
              {[
                { label: 'Всего за период', value: data.total, sub: `сегодня +${data.todayTotal}`, color: '#7F77DD', bg: '#EDE9FE', icon: 'ti-message' },
                { label: 'Без ответа', value: data.unansweredTotal, sub: 'требуют ответа', color: '#DC2626', bg: '#FEE2E2', icon: 'ti-message-exclamation' },
                { label: 'Ответили сегодня', value: data.answeredToday, sub: 'обработано', color: '#16A34A', bg: '#DCFCE7', icon: 'ti-message-check' },
                { label: 'Товаров с отзывами', value: data.products?.length ?? 0, sub: 'уникальных артикулов', color: '#D97706', bg: '#FEF3C7', icon: 'ti-package' },
              ].map(s => (
                <div key={s.label} style={{ ...card, display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <div style={{ width: '42px', height: '42px', borderRadius: '14px', background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <i className={`ti ${s.icon}`} style={{ fontSize: '20px', color: s.color }} />
                  </div>
                  <div>
                    <div style={{ fontSize: '22px', fontWeight: 800, color: '#1a1040' }}>{s.value}</div>
                    <div style={{ fontSize: '11px', color: '#9B97CC' }}>{s.label}</div>
                    <div style={{ fontSize: '10px', color: s.color, fontWeight: 600 }}>{s.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '6px' }}>
              {[{ id: 'products', label: '📦 По товарам' }, { id: 'tops', label: '🏆 Топ и тренды' }, { id: 'calc', label: '🧮 Калькулятор' }].map(t => (
                <button key={t.id} onClick={() => setTab(t.id as any)}
                  style={{ background: tab === t.id ? 'linear-gradient(135deg,#7F77DD,#5248C5)' : 'white', color: tab === t.id ? 'white' : '#7F77DD', border: '1px solid #EDE9FE', borderRadius: '12px', padding: '8px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                  {t.label}
                </button>
              ))}
            </div>

            {tab === 'products' && (
              <>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input placeholder="Поиск по артикулу..." value={search} onChange={e => setSearch(e.target.value)}
                    style={{ flex: 1, background: 'white', border: '1px solid #EDE9FE', borderRadius: '12px', padding: '8px 14px', fontSize: '13px', outline: 'none' }} />
                  {([['all','Все'], ['negative','👎 Негатив'], ['positive','👍 Позитив'], ['unanswered','💬 Без ответа']] as const).map(([f, label]) => (
                    <button key={f} onClick={() => setFilter(f as any)}
                      style={{ background: filter === f ? 'linear-gradient(135deg,#7F77DD,#5248C5)' : 'white', color: filter === f ? 'white' : '#7F77DD', border: '1px solid #EDE9FE', borderRadius: '12px', padding: '8px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}>
                      {label}
                    </button>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                  <span style={{ fontSize: '12px', color: '#9B97CC', whiteSpace: 'nowrap' }}>По рейтингу:</span>
                  <button onClick={() => setRatingFilter(null)}
                    style={{ background: ratingFilter === null ? '#7F77DD' : 'white', color: ratingFilter === null ? 'white' : '#7F77DD', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '6px 12px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                    Все
                  </button>
                  {[1,2,3,4,5].map(r => (
                    <button key={r} onClick={() => setRatingFilter(ratingFilter === r ? null : r)}
                      style={{ background: ratingFilter === r ? '#F59E0B' : 'white', color: ratingFilter === r ? 'white' : '#9B97CC', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '6px 10px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
                      {'★'.repeat(r)}
                    </button>
                  ))}
                </div>
                <div style={card}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a1040', margin: '0 0 12px' }}>По товарам ({products.length})</p>
                  {products.length === 0 ? <p style={{ color: '#9B97CC', textAlign: 'center', padding: '20px 0' }}>Не найдено</p> : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {products.map((p: any) => (
                        <div key={p.sku} style={{ background: '#F8F7FF', borderRadius: '14px', padding: '12px 16px' }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                            <div style={{ flex: 1 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1a1040' }}>{p.sku}</span>
                                <span style={{ fontSize: '11px', color: '#9B97CC' }}>{p.name}</span>
                                {trendIcon(p.trend, p.trendDiff)}
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', flexWrap: 'wrap' }}>
                                <span style={{ fontSize: '12px', color: '#F59E0B' }}>{stars(Math.round(p.avgRating))}</span>
                                <span style={{ fontSize: '12px', color: '#9B97CC' }}>{p.avgRating} · {p.total} отзывов</span>
                                <span style={{ fontSize: '11px', color: p.answerRate >= 80 ? '#16A34A' : p.answerRate >= 50 ? '#D97706' : '#DC2626', fontWeight: 600 }}>отвечено: {p.answerRate}%</span>
                                {p.unansweredCount > 0 && <span style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: '6px', padding: '2px 6px', fontSize: '10px', fontWeight: 700 }}>{p.unansweredCount} без ответа</span>}
                              </div>
                              <div style={{ display: 'flex', gap: '2px', height: '5px', borderRadius: '3px', overflow: 'hidden', background: '#EDE9FE', marginBottom: '6px' }}>
                                {p.positive > 0 && <div style={{ width: (p.positive/p.total*100)+'%', background: '#16A34A' }} />}
                                {p.neutral > 0 && <div style={{ width: (p.neutral/p.total*100)+'%', background: '#D97706' }} />}
                                {p.negative > 0 && <div style={{ width: (p.negative/p.total*100)+'%', background: '#DC2626' }} />}
                              </div>
                            </div>
                            <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
                              <span style={{ background: '#DCFCE7', color: '#16A34A', borderRadius: '8px', padding: '3px 8px', fontSize: '12px', fontWeight: 700 }}>+{p.positive}</span>
                              <span style={{ background: '#FEF3C7', color: '#D97706', borderRadius: '8px', padding: '3px 8px', fontSize: '12px', fontWeight: 700 }}>{p.neutral}</span>
                              <span style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: '8px', padding: '3px 8px', fontSize: '12px', fontWeight: 700 }}>{p.negative > 0 ? `-${p.negative}` : '0'}</span>
                            </div>
                          </div>
                          {p.recent.filter((r: any) => r.text).slice(0, 2).map((r: any) => (
                            <div key={r.id} style={{ background: 'white', borderRadius: '8px', padding: '6px 10px', display: 'flex', gap: '8px', alignItems: 'flex-start', marginTop: '4px' }}>
                              <span style={{ fontSize: '11px', color: r.rating >= 4 ? '#16A34A' : r.rating <= 2 ? '#DC2626' : '#D97706', fontWeight: 700, flexShrink: 0 }}>{stars(r.rating)}</span>
                              <span style={{ fontSize: '11px', color: '#4B4878', lineHeight: '1.4', flex: 1 }}>{r.text.slice(0,150)}{r.text.length>150?'...':''}</span>
                              {!r.answered && <span style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: '4px', padding: '1px 5px', fontSize: '10px', flexShrink: 0 }}>Без ответа</span>}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}

            {tab === 'tops' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {[
                  { title: '📉 Падает рейтинг', items: data.tops?.falling ?? [], color: '#DC2626', bg: '#FEE2E2', getValue: (p: any) => `${p.trendDiff}` },
                  { title: '📈 Растёт рейтинг', items: data.tops?.rising ?? [], color: '#16A34A', bg: '#DCFCE7', getValue: (p: any) => `+${p.trendDiff}` },
                  { title: '👎 Больше всего негатива', items: data.tops?.topByNegative ?? [], color: '#DC2626', bg: '#FEE2E2', getValue: (p: any) => `${p.negative} отриц.` },
                  { title: '👍 Больше всего позитива', items: data.tops?.topByPositive ?? [], color: '#16A34A', bg: '#DCFCE7', getValue: (p: any) => `${p.positive} полож.` },
                ].map(section => (
                  <div key={section.title} style={card}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a1040', margin: '0 0 10px' }}>{section.title}</p>
                    {section.items.length === 0 ? <p style={{ color: '#9B97CC', fontSize: '12px' }}>Нет данных</p> : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {section.items.map((p: any, i: number) => (
                          <div key={p.sku} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#F8F7FF', borderRadius: '10px', padding: '8px 12px' }}>
                            <span style={{ width: '20px', height: '20px', borderRadius: '50%', background: section.bg, color: section.color, fontSize: '11px', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i+1}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ fontSize: '12px', fontWeight: 700, color: '#1a1040', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.sku}</div>
                              <div style={{ fontSize: '11px', color: '#9B97CC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</div>
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                              <span style={{ fontSize: '12px', fontWeight: 700, color: section.color }}>{section.getValue(p)}</span>
                              <span style={{ fontSize: '10px', color: '#9B97CC' }}>★ {p.avgRating}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {loading && <div style={{ textAlign: 'center', padding: '40px', color: '#9B97CC' }}>Загрузка отзывов из WB...</div>}

        {tab === 'calc' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={card}>
              <p style={{ fontSize: '14px', fontWeight: 800, color: '#1a1040', margin: '0 0 8px' }}>📐 Официальная формула WB</p>
              <div style={{ background: '#F8F7FF', borderRadius: '12px', padding: '14px 16px', fontFamily: 'monospace', fontSize: '13px', color: '#4B4878', lineHeight: '1.8' }}>
                <div>Рейтинг = Σ(оценка × K) / Σ(K)</div>
                <div style={{ color: '#9B97CC', fontSize: '12px', marginTop: '4px' }}>K = 100^-(d - 182) / (730 × 1.5), где d — дней с момента отзыва</div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginTop: '12px' }}>
                {[
                  { label: 'До 90 дней', value: 'K = 1.0', color: '#16A34A', desc: 'Полный вес' },
                  { label: '90-182 дня', value: 'K 0.8-1.0', color: '#D97706', desc: 'Небольшое снижение' },
                  { label: 'Более 2 лет', value: 'K ~ 0.01', color: '#DC2626', desc: 'Почти не влияет' },
                ].map(r => (
                  <div key={r.label} style={{ background: 'white', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '10px 12px' }}>
                    <div style={{ fontSize: '11px', color: '#9B97CC' }}>{r.label}</div>
                    <div style={{ fontSize: '16px', fontWeight: 800, color: r.color }}>{r.value}</div>
                    <div style={{ fontSize: '11px', color: '#9B97CC' }}>{r.desc}</div>
                  </div>
                ))}
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div style={card}>
                <p style={{ fontSize: '14px', fontWeight: 800, color: '#1a1040', margin: '0 0 12px' }}>🎯 Сколько отзывов нужно для цели</p>
                {data?.products?.length > 0 && (
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontSize: '11px', color: '#9B97CC', marginBottom: '4px' }}>Подтянуть данные из отзывов</div>
                    <select value={calcSelectedSku} onChange={e => {
                      const sku = e.target.value;
                      setCalcSelectedSku(sku);
                      if (sku) {
                        const p = data.products.find((p: any) => p.sku === sku);
                        if (p) {
                          setCalcCurrentRating(String(p.avgRating));
                          setCalcCurrentCount(String(p.total));
                        }
                      }
                    }} style={{ width: '100%', background: '#F8F7FF', border: '1px solid #7F77DD', borderRadius: '10px', padding: '8px 12px', fontSize: '13px', outline: 'none', color: '#1a1040', cursor: 'pointer' }}>
                      <option value=''>-- Выбрать артикул --</option>
                      {data.products.map((p: any) => (
                        <option key={p.sku} value={p.sku}>{p.sku} — {p.name.slice(0,30)} (★{p.avgRating}, {p.total} отз.)</option>
                      ))}
                    </select>
                  </div>
                )}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {([
                    ['Текущий рейтинг', calcCurrentRating, setCalcCurrentRating, '4.2'],
                    ['Кол-во отзывов сейчас', calcCurrentCount, setCalcCurrentCount, '50'],
                    ['Целевой рейтинг', calcTargetRating, setCalcTargetRating, '4.5'],
                    ['Оценка новых отзывов (1-5)', calcNewRating, setCalcNewRating, '5'],
                  ] as [string, string, (v: string) => void, string][]).map(([label, value, setter, ph]) => (
                    <div key={label}>
                      <div style={{ fontSize: '11px', color: '#9B97CC', marginBottom: '4px' }}>{label}</div>
                      <input type="number" value={value} onChange={e => setter(e.target.value)} placeholder={ph}
                        style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '8px 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const }} />
                    </div>
                  ))}
                </div>
                {(() => {
                  const cur = parseFloat(calcCurrentRating) || 0;
                  const cnt = parseInt(calcCurrentCount) || 0;
                  const target = parseFloat(calcTargetRating) || 0;
                  const newR = parseInt(calcNewRating) || 5;
                  if (cur <= 0 || cnt <= 0 || target <= cur || newR <= cur) return (
                    <div style={{ marginTop: '12px', background: '#FEF3C7', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#D97706' }}>
                      Целевой рейтинг должен быть выше текущего, оценка новых отзывов выше текущего рейтинга.
                    </div>
                  );
                  const n = Math.ceil(cnt * (target - cur) / (newR - target));
                  if (n <= 0) return <div style={{ marginTop: '12px', background: '#DCFCE7', borderRadius: '10px', padding: '12px', fontSize: '12px', color: '#16A34A' }}>Рейтинг уже достигнут!</div>;
                  const projected = Math.round(((cur * cnt + newR * n) / (cnt + n)) * 10) / 10;
                  return (
                    <div style={{ marginTop: '12px', background: 'linear-gradient(135deg,#EDE9FE,#F8F7FF)', borderRadius: '12px', padding: '14px' }}>
                      <div style={{ fontSize: '32px', fontWeight: 800, color: '#7F77DD' }}>{n}</div>
                      <div style={{ fontSize: '12px', color: '#4B4878', marginBottom: '4px' }}>отзывов со звездой {newR} нужно добавить</div>
                      <div style={{ fontSize: '11px', color: '#9B97CC' }}>Итого: {cnt + n} отзывов, рейтинг станет {projected}</div>
                    </div>
                  );
                })()}
              </div>

              <div style={card}>
                <p style={{ fontSize: '14px', fontWeight: 800, color: '#1a1040', margin: '0 0 12px' }}>⏳ Когда затухнет старый отзыв</p>
                <div style={{ fontSize: '12px', color: '#9B97CC', marginBottom: '12px', lineHeight: '1.5' }}>
                  Введите возраст негативного отзыва в днях — калькулятор покажет его текущий вес.
                </div>
                <div>
                  <div style={{ fontSize: '11px', color: '#9B97CC', marginBottom: '4px' }}>Возраст отзыва (дней)</div>
                  <input type="number" value={calcDaysOld} onChange={e => setCalcDaysOld(e.target.value)} placeholder="180"
                    style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '8px 12px', fontSize: '14px', outline: 'none', boxSizing: 'border-box' as const }} />
                </div>
                {(() => {
                  const d = parseInt(calcDaysOld) || 0;
                  const k = d < 90 ? 1 : Math.pow(100, -(d - 182) / (730 * 1.5));
                  const kRounded = Math.round(k * 1000) / 1000;
                  const color = k > 0.8 ? '#DC2626' : k > 0.4 ? '#D97706' : '#16A34A';
                  const label = k > 0.8 ? 'Высокое влияние' : k > 0.4 ? 'Среднее влияние' : k > 0.05 ? 'Низкое влияние' : 'Минимальное';
                  const daysLeft = d < 90 ? 90 - d : 0;
                  const daysTil = d < 182 + 730 * 1.5 * Math.log(20) / Math.log(100)
                    ? Math.ceil(182 + 730 * 1.5 * Math.log(20) / Math.log(100) - d) : 0;
                  return (
                    <div style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      <div style={{ background: '#F8F7FF', borderRadius: '12px', padding: '14px' }}>
                        <div style={{ fontSize: '11px', color: '#9B97CC', marginBottom: '4px' }}>Коэффициент затухания</div>
                        <div style={{ fontSize: '32px', fontWeight: 800, color }}>{kRounded}</div>
                        <div style={{ fontSize: '12px', color, fontWeight: 600 }}>{label}</div>
                        <div style={{ height: '6px', borderRadius: '3px', background: '#EDE9FE', marginTop: '8px', overflow: 'hidden' }}>
                          <div style={{ width: `${Math.min(100, kRounded * 100)}%`, height: '100%', background: color }} />
                        </div>
                      </div>
                      <div style={{ background: '#F8F7FF', borderRadius: '10px', padding: '10px 12px', fontSize: '12px', color: '#4B4878' }}>
                        {d < 90 ? `До начала затухания: ${daysLeft} дней` :
                         daysTil > 0 ? `До незначительного влияния: ~${daysTil} дней` :
                         'Отзыв практически не влияет на рейтинг'}
                      </div>
                    </div>
                  );
                })()}
              </div>
            </div>

            {calcSelectedSku && data?.products && (() => {
              const p = data.products.find((pr: any) => pr.sku === calcSelectedSku);
              if (!p || !p.allRatings?.length) return null;
              const now = Date.now();
              // Считаем рейтинг по формуле WB
              let sumW = 0, sumK = 0;
              const ratingsWithK = p.allRatings.map((r: any) => {
                const d = r.date ? Math.floor((now - new Date(r.date).getTime()) / (1000*60*60*24)) : 0;
                const k = d < 90 ? 1 : Math.pow(100, -(d - 182) / (730 * 1.5));
                sumW += r.rating * k;
                sumK += k;
                return { ...r, d, k: Math.round(k * 1000) / 1000 };
              });
              const wbR = sumK > 0 ? Math.round(sumW / sumK * 10) / 10 : p.avgRating;
              const simpleAvg = p.avgRating;
              const diff = Math.round((wbR - simpleAvg) * 10) / 10;
              // Симуляция: добавляем N новых отзывов с оценкой newR
              const targetR = parseFloat(calcTargetRating) || 4.5;
              const newStars = parseInt(calcNewRating) || 5;
              // Сколько 5-звёздочных нужно чтобы достичь targetR
              let needed = 0;
              if (targetR > wbR && newStars > wbR) {
                // Бинарный поиск
                let lo = 1, hi = 10000;
                while (lo < hi) {
                  const mid = Math.floor((lo + hi) / 2);
                  const newSumW = sumW + mid * newStars * 1; // новые отзывы с K=1
                  const newSumK = sumK + mid * 1;
                  const newR = newSumW / newSumK;
                  if (newR >= targetR) hi = mid;
                  else lo = mid + 1;
                }
                needed = lo;
              }
              return (
                <div style={card}>
                  <p style={{ fontSize: '14px', fontWeight: 800, color: '#1a1040', margin: '0 0 12px' }}>
                    🔬 Реальный рейтинг {calcSelectedSku} по формуле WB
                  </p>
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px', marginBottom: '14px' }}>
                    <div style={{ background: '#F8F7FF', borderRadius: '12px', padding: '12px' }}>
                      <div style={{ fontSize: '11px', color: '#9B97CC' }}>Простое среднее</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: '#9B97CC' }}>{simpleAvg}</div>
                      <div style={{ fontSize: '11px', color: '#9B97CC' }}>без учёта дат</div>
                    </div>
                    <div style={{ background: 'linear-gradient(135deg,#EDE9FE,#F8F7FF)', borderRadius: '12px', padding: '12px', border: '2px solid #7F77DD' }}>
                      <div style={{ fontSize: '11px', color: '#7F77DD' }}>Рейтинг по WB формуле</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: '#7F77DD' }}>{wbR}</div>
                      <div style={{ fontSize: '11px', color: diff >= 0 ? '#16A34A' : '#DC2626', fontWeight: 600 }}>
                        {diff >= 0 ? `+${diff}` : diff} к среднему
                      </div>
                    </div>
                    <div style={{ background: '#F8F7FF', borderRadius: '12px', padding: '12px' }}>
                      <div style={{ fontSize: '11px', color: '#9B97CC' }}>Отзывов в расчёте</div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: '#1a1040' }}>{p.allRatings.length}</div>
                      <div style={{ fontSize: '11px', color: '#9B97CC' }}>за период</div>
                    </div>
                  </div>

                  {needed > 0 && (
                    <div style={{ background: 'linear-gradient(135deg,#DCFCE7,#F0FDF4)', borderRadius: '12px', padding: '14px', marginBottom: '12px' }}>
                      <div style={{ fontSize: '12px', color: '#16A34A', fontWeight: 600, marginBottom: '4px' }}>
                        Чтобы поднять с {wbR} до {targetR} (оценки ★{newStars}):
                      </div>
                      <div style={{ fontSize: '32px', fontWeight: 800, color: '#16A34A' }}>{needed}</div>
                      <div style={{ fontSize: '12px', color: '#4B4878' }}>новых отзывов нужно (с учётом формулы WB)</div>
                    </div>
                  )}

                  {/* Топ влияющих отзывов */}
                  <div style={{ fontSize: '12px', fontWeight: 700, color: '#1a1040', marginBottom: '8px' }}>
                    Отзывы с наибольшим влиянием:
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    {ratingsWithK.sort((a: any, b: any) => b.k - a.k).slice(0, 5).map((r: any, i: number) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#F8F7FF', borderRadius: '8px', padding: '7px 10px' }}>
                        <span style={{ fontSize: '12px', color: r.rating >= 4 ? '#16A34A' : r.rating <= 2 ? '#DC2626' : '#D97706', fontWeight: 700, flexShrink: 0 }}>
                          {'★'.repeat(r.rating)}{'☆'.repeat(5-r.rating)}
                        </span>
                        <span style={{ fontSize: '11px', color: '#9B97CC', flex: 1 }}>{r.d} дней назад</span>
                        <span style={{ fontSize: '11px', fontFamily: 'monospace', color: '#7F77DD', fontWeight: 700 }}>K={r.k}</span>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })()}

            <div style={card}>
              <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a1040', margin: '0 0 10px' }}>Важные правила WB</p>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: '8px' }}>
                {[
                  ['📊', 'Берутся последние 20 000 валидных оценок за 2 года'],
                  ['⭐', 'Менее 60 отзывов — WB автоматически ставит рейтинг 4.7'],
                  ['🕐', 'Свежие отзывы (до 90 дней) имеют максимальный вес K=1'],
                  ['🔄', 'Рейтинг обновляется дважды в день: в 8:00 и 20:00 МСК'],
                  ['❌', 'Невалидные отзывы (тональность не совпадает с оценкой) не учитываются'],
                  ['🚫', 'Товар скрывается из поиска если рейтинг продавца ниже 3.1'],
                ].map(([icon, text]) => (
                  <div key={text} style={{ display: 'flex', gap: '8px', background: '#F8F7FF', borderRadius: '10px', padding: '10px 12px', alignItems: 'flex-start' }}>
                    <span style={{ fontSize: '16px', flexShrink: 0 }}>{icon}</span>
                    <span style={{ fontSize: '12px', color: '#4B4878', lineHeight: '1.4' }}>{text}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
