'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = 'https://employee-tracker.ru/api/v1';

export default function ProductsPage() {
  const router = useRouter();
  const [products, setProducts] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState<'WB' | 'OZON' | null>(null);
  const [marketplace, setMarketplace] = useState('');
  const [search, setSearch] = useState('');
  const [syncResult, setSyncResult] = useState('');
  const [showApiSettings, setShowApiSettings] = useState(false);
  const [user, setUser] = useState<any>(null);

  const h = () => ({ Authorization: 'Bearer ' + localStorage.getItem('access_token') });

  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) { router.push('/login'); return; }
    try { setUser(JSON.parse(localStorage.getItem('user') ?? '{}')); } catch {}
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page), limit: '48' });
      if (marketplace) params.set('marketplace', marketplace);
      if (search) params.set('search', search);
      const res = await fetch(`${API}/products?${params}`, { headers: h() });
      const data = await res.json();
      setProducts(data.products ?? []);
      setTotal(data.total ?? 0);
      setPages(data.pages ?? 1);
    } catch {}
    setLoading(false);
  }, [page, marketplace, search]);

  useEffect(() => { load(); }, [load]);

  const sync = async (mp: 'WB' | 'OZON') => {
    setSyncing(mp); setSyncResult('');
    try {
      const res = await fetch(`${API}/products/sync/${mp.toLowerCase()}`, { method: 'POST', headers: h() });
      const data = await res.json();
      if (data.error) { setSyncResult(`❌ ${data.error}`); }
      else { setSyncResult(`✅ ${mp}: синхронизировано ${data.synced} карточек`); load(); }
    } catch (e: any) { setSyncResult(`❌ Ошибка: ${e.message}`); }
    setSyncing(null);
  };

  const isAdmin = user?.roles?.some((r: string) => ['ADMIN', 'SUPER_ADMIN', 'OWNER', 'MANAGER'].includes(r));

  const card: React.CSSProperties = { background: 'white', borderRadius: '20px', boxShadow: '0 4px 16px rgba(127,119,221,0.08)' };

  return (
    <div style={{ minHeight: '100vh', background: '#ECEAF8' }}>
      <div style={{ background: 'white', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 4px 16px rgba(127,119,221,0.06)' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#1a1040', margin: 0 }}>Карточки товаров</h1>
          <p style={{ fontSize: '11px', color: '#9B97CC', margin: '2px 0 0' }}>
            {total > 0 ? `${total} карточек` : 'Синхронизируйте карточки с маркетплейсов'}
          </p>
        </div>
        {isAdmin && (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            {syncResult && <span style={{ fontSize: '12px', color: syncResult.startsWith('✅') ? '#16A34A' : '#DC2626' }}>{syncResult}</span>}
            <button onClick={() => setShowApiSettings(true)}
              style={{ background: '#F8F7FF', color: '#7F77DD', border: '1px solid #EDE9FE', borderRadius: '14px', padding: '9px 18px', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}>
              ⚙️ API ключи
            </button>
            <button onClick={() => sync('WB')} disabled={!!syncing}
              style={{ background: 'linear-gradient(135deg,#8B2FC9,#5D0FA3)', color: 'white', border: 'none', borderRadius: '14px', padding: '9px 18px', fontSize: '12px', fontWeight: 700, cursor: syncing ? 'not-allowed' : 'pointer', opacity: syncing === 'WB' ? 0.7 : 1 }}>
              {syncing === 'WB' ? '⏳ Загрузка...' : '🔄 Синхр. WB'}
            </button>
            <button onClick={() => sync('OZON')} disabled={!!syncing}
              style={{ background: 'linear-gradient(135deg,#005BFF,#0040CC)', color: 'white', border: 'none', borderRadius: '14px', padding: '9px 18px', fontSize: '12px', fontWeight: 700, cursor: syncing ? 'not-allowed' : 'pointer', opacity: syncing === 'OZON' ? 0.7 : 1 }}>
              {syncing === 'OZON' ? '⏳ Загрузка...' : '🔄 Синхр. Ozon'}
            </button>
          </div>
        )}
      </div>

      <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ ...card, padding: '14px 18px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <input placeholder="Поиск по названию или артикулу..." value={search} onChange={e => { setSearch(e.target.value); setPage(1); }}
            style={{ flex: 1, minWidth: '200px', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: '12px', padding: '9px 14px', fontSize: '13px', outline: 'none' }} />
          <div style={{ display: 'flex', gap: '6px' }}>
            {['', 'WB', 'OZON'].map(mp => (
              <button key={mp} onClick={() => { setMarketplace(mp); setPage(1); }}
                style={{ background: marketplace === mp ? (mp === 'WB' ? '#8B2FC9' : mp === 'OZON' ? '#005BFF' : 'linear-gradient(135deg,#7F77DD,#5248C5)') : 'white', color: marketplace === mp ? 'white' : '#7F77DD', border: '1px solid #EDE9FE', borderRadius: '12px', padding: '8px 16px', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>
                {mp || 'Все'}
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: '#9B97CC', fontSize: '14px' }}>Загрузка...</div>
        ) : products.length === 0 ? (
          <div style={{ ...card, padding: '60px', textAlign: 'center' }}>
            <div style={{ fontSize: '48px', marginBottom: '12px' }}>📦</div>
            <p style={{ color: '#9B97CC', fontSize: '14px', margin: 0 }}>Карточек пока нет. Нажмите "Синхр. WB" или "Синхр. Ozon" чтобы загрузить товары.</p>
          </div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '14px' }}>
              {products.map((p, pIdx) => (
                <Link key={p.id} href={`/dashboard/products/${p.id}`} style={{ textDecoration: 'none' }}>
                  <div className="row-in" style={{ ...card, overflow: 'hidden', cursor: 'pointer', transition: 'transform 0.15s, box-shadow 0.15s', animationDelay:Math.min(pIdx*0.03,0.4)+'s' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 8px 24px rgba(127,119,221,0.15)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; (e.currentTarget as HTMLDivElement).style.boxShadow = '0 4px 16px rgba(127,119,221,0.08)'; }}>
                    <div style={{ position: 'relative', aspectRatio: '1', background: '#F8F7FF', overflow: 'hidden' }}>
                      {p.photoUrl ? (
                        <img src={p.photoUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '36px' }}>📦</div>
                      )}
                      <span style={{ position: 'absolute', top: '8px', left: '8px', background: p.marketplace === 'WB' ? '#8B2FC9' : '#005BFF', color: 'white', borderRadius: '8px', padding: '2px 8px', fontSize: '10px', fontWeight: 700 }}>
                        {p.marketplace}
                      </span>
                      {p._count?.tasks > 0 && (
                        <span style={{ position: 'absolute', top: '8px', right: '8px', background: '#7F77DD', color: 'white', borderRadius: '10px', padding: '2px 8px', fontSize: '10px', fontWeight: 700 }}>
                          {p._count.tasks} задач
                        </span>
                      )}
                    </div>
                    <div style={{ padding: '12px' }}>
                      <p style={{ fontSize: '12px', fontWeight: 700, color: '#1a1040', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={p.name}>{p.name}</p>
                      <p style={{ fontSize: '11px', color: '#9B97CC', margin: '0 0 4px' }}>Арт: {p.articleId}</p>
                      {p.price && <p style={{ fontSize: '12px', fontWeight: 700, color: '#7F77DD', margin: 0 }}>{p.price.toLocaleString('ru')} ₽</p>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            {pages > 1 && (
              <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
                <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page <= 1}
                  style={{ background: 'white', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '8px 16px', fontSize: '13px', cursor: page <= 1 ? 'default' : 'pointer', opacity: page <= 1 ? 0.5 : 1 }}>← Назад</button>
                <span style={{ fontSize: '13px', color: '#9B97CC', alignSelf: 'center' }}>{page} / {pages}</span>
                <button onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page >= pages}
                  style={{ background: 'white', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '8px 16px', fontSize: '13px', cursor: page >= pages ? 'default' : 'pointer', opacity: page >= pages ? 0.5 : 1 }}>Вперёд →</button>
              </div>
            )}
          </>
        )}
      </div>

      {showApiSettings && <ApiSettingsModal h={h} onClose={() => setShowApiSettings(false)} />}
    </div>
  );
}

function ApiSettingsModal({ h, onClose }: { h: () => any; onClose: () => void }) {
  const [wbToken, setWbToken] = useState('');
  const [wbStatus, setWbStatus] = useState<{ hasToken: boolean; tokenPreview: string | null } | null>(null);
  const [ozonToken, setOzonToken] = useState('');
  const [ozonClientId, setOzonClientId] = useState('');
  const [savingWb, setSavingWb] = useState(false);
  const [savingOzon, setSavingOzon] = useState(false);
  const [msg, setMsg] = useState('');

  useEffect(() => {
    fetch(`${API}/settings/wb-token`, { headers: h() }).then(r => r.json()).then(setWbStatus).catch(() => {});
  }, []);

  const saveWb = async () => {
    if (!wbToken.trim()) return;
    setSavingWb(true);
    const res = await fetch(`${API}/settings/wb-token`, { method: 'POST', headers: { ...h(), 'Content-Type': 'application/json' }, body: JSON.stringify({ token: wbToken.trim() }) });
    const data = await res.json();
    setMsg(data.success ? '✅ WB-токен сохранён' : `⚠️ ${data.error ?? 'Ошибка'}`);
    if (data.success) { setWbToken(''); fetch(`${API}/settings/wb-token`, { headers: h() }).then(r => r.json()).then(setWbStatus).catch(() => {}); }
    setSavingWb(false);
  };

  const saveOzon = async () => {
    if (!ozonToken.trim() || !ozonClientId.trim()) return;
    setSavingOzon(true);
    const res = await fetch(`${API}/products/settings/ozon-token`, { method: 'POST', headers: { ...h(), 'Content-Type': 'application/json' }, body: JSON.stringify({ token: ozonToken.trim(), clientId: ozonClientId.trim() }) });
    const data = await res.json().catch(() => ({}));
    setMsg(res.ok ? '✅ Ozon-ключи сохранены' : `⚠️ ${data.error ?? 'Ошибка сохранения'}`);
    if (res.ok) { setOzonToken(''); setOzonClientId(''); }
    setSavingOzon(false);
  };

  const inp: React.CSSProperties = { width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,16,64,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.15s ease-out' }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 24, width: 420, boxShadow: '0 24px 64px rgba(127,119,221,0.2)' }}>
        <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1a1040', margin: '0 0 4px' }}>⚙️ API-ключи маркетплейсов</h3>
        <p style={{ fontSize: 11.5, color: '#9B97CC', margin: '0 0 18px' }}>Нужны для синхронизации карточек товаров</p>

        <p style={{ fontSize: 12, fontWeight: 700, color: '#8B2FC9', margin: '0 0 8px' }}>Wildberries</p>
        {wbStatus?.hasToken && <p style={{ fontSize: 11, color: '#16A34A', margin: '0 0 8px' }}>✓ Токен уже сохранён ({wbStatus.tokenPreview})</p>}
        <input type="password" value={wbToken} onChange={e => setWbToken(e.target.value)} placeholder="Токен из личного кабинета WB (Настройки → Доступ к API)" style={{ ...inp, marginBottom: 8 }} />
        <button onClick={saveWb} disabled={savingWb || !wbToken.trim()} style={{ background: wbToken.trim() ? 'linear-gradient(135deg,#8B2FC9,#5D0FA3)' : '#EDE9FE', color: wbToken.trim() ? 'white' : '#C4C0E8', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 12.5, fontWeight: 700, cursor: wbToken.trim() ? 'pointer' : 'not-allowed', marginBottom: 20 }}>
          {savingWb ? 'Сохраняю...' : 'Сохранить WB-токен'}
        </button>

        <p style={{ fontSize: 12, fontWeight: 700, color: '#005BFF', margin: '0 0 8px' }}>Ozon</p>
        <input value={ozonClientId} onChange={e => setOzonClientId(e.target.value)} placeholder="Client-Id" style={{ ...inp, marginBottom: 8 }} />
        <input type="password" value={ozonToken} onChange={e => setOzonToken(e.target.value)} placeholder="Api-Key из личного кабинета Ozon Seller" style={{ ...inp, marginBottom: 8 }} />
        <button onClick={saveOzon} disabled={savingOzon || !ozonToken.trim() || !ozonClientId.trim()} style={{ background: (ozonToken.trim() && ozonClientId.trim()) ? 'linear-gradient(135deg,#005BFF,#0040CC)' : '#EDE9FE', color: (ozonToken.trim() && ozonClientId.trim()) ? 'white' : '#C4C0E8', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 12.5, fontWeight: 700, cursor: (ozonToken.trim() && ozonClientId.trim()) ? 'pointer' : 'not-allowed' }}>
          {savingOzon ? 'Сохраняю...' : 'Сохранить Ozon-ключи'}
        </button>

        {msg && <p style={{ fontSize: 12, color: msg.startsWith('✅') ? '#16A34A' : '#D97706', background: msg.startsWith('✅') ? '#DCFCE7' : '#FFFBEB', padding: '8px 12px', borderRadius: 8, margin: '20px 0 0' }}>{msg}</p>}

        <button onClick={onClose} style={{ width: '100%', background: 'none', border: 'none', color: '#9B97CC', fontSize: 12, cursor: 'pointer', padding: '14px 0 0' }}>Закрыть</button>
      </div>
    </div>
  );
}
