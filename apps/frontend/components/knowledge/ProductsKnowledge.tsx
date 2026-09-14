'use client';
import { useEffect, useState, useCallback } from 'react';

const API = '/api/v1';

/* ---- design tokens (1:1 с макетом) ---- */
const T = {
  paper:  '#F4F6F9',
  surface:'#FFFFFF',
  ink:    '#15171D',
  muted:  '#626b7a',
  muted2: '#909aa8',
  brand:  '#3B33C9',
  brandBg:'#ECEBFB',
  teal:   '#0F9E86',
  tealBg: '#E4F5F1',
  amber:  '#C77A05',
  amberBg:'#FBF0DC',
  green:  '#0F9E6A',
  greenBg:'#E3F5EC',
  line:   '#E4E7EE',
  line2:  '#D3D8E2',
};
const MONO = "'JetBrains Mono', ui-monospace, monospace";

const GROUP_ORDER = ['Характеристики','Описание','Производители','Таможня и документы','Регулирование и стандарты'];
const GICON: Record<string,string> = {
  'Характеристики':'⚙️','Описание':'📝','Производители':'🏭',
  'Таможня и документы':'🛃','Регулирование и стандарты':'📋',
};

const TASK_PILL: Record<string,{bg:string;c:string;l:string}> = {
  DONE:        { bg:T.greenBg, c:T.green, l:'Готово' },
  REVIEW:      { bg:T.amberBg, c:T.amber, l:'На проверке' },
  IN_PROGRESS: { bg:T.brandBg, c:T.brand, l:'В работе' },
  NEW:         { bg:T.paper,   c:T.muted, l:'К выполнению' },
  BLOCKED:     { bg:'#FBE9EC', c:'#D6455D', l:'Заблокирована' },
  OVERDUE:     { bg:'#FBE9EC', c:'#D6455D', l:'Просрочена' },
};

/* ---- shared styles ---- */
const sec: React.CSSProperties = {
  background: T.surface, border: `1px solid ${T.line}`,
  borderRadius: 14, marginBottom: 16, overflow: 'hidden',
};
const secHead: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 9,
  padding: '13px 18px', borderBottom: `1px solid ${T.line}`,
  fontSize: 14, fontWeight: 600, color: T.ink,
};
const addBtn: React.CSSProperties = {
  marginLeft: 'auto', fontSize: 12, fontWeight: 500, color: T.brand,
  background: 'none', border: 'none', cursor: 'pointer', font: 'inherit',
};
const kvWrap: React.CSSProperties = {
  display: 'grid', gridTemplateColumns: '210px 1fr', gap: 1, background: T.line,
};
const kCell: React.CSSProperties = { background: T.surface, padding: '11px 18px', fontSize: 13.5, color: T.muted, fontWeight: 500 };
const vCell: React.CSSProperties = { background: T.surface, padding: '11px 18px', fontSize: 13.5, display: 'flex', alignItems: 'flex-start', gap: 8 };
const emptyRow: React.CSSProperties = { padding: '14px 18px', color: T.muted, fontSize: 13 };
const fldInput: React.CSSProperties = {
  font: 'inherit', fontSize: 13.5, padding: '8px 10px',
  border: `1px solid ${T.line2}`, borderRadius: 8, width: '100%',
  boxSizing: 'border-box', outline: 'none', color: T.ink, background: T.surface,
};
const btnBase: React.CSSProperties = {
  font: 'inherit', fontSize: 14, fontWeight: 600, padding: '9px 18px',
  borderRadius: 9, cursor: 'pointer', border: '1px solid transparent',
};
const btnGhost: React.CSSProperties = { ...btnBase, background: 'none', borderColor: T.line2, color: T.ink };
const btnPrim:  React.CSSProperties = { ...btnBase, background: T.brand, color: '#fff' };

function KvRow({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <>
      <div style={kCell}>{k}</div>
      <div style={vCell}><span style={{ flex: 1, color: T.ink }}>{v || '—'}</span></div>
    </>
  );
}

export default function ProductsKnowledge({ token, canEdit }: { token: string; canEdit: boolean }) {
  const [products, setProducts]   = useState<any[]>([]);
  const [curId, setCurId]         = useState<string|null>(null);
  const [detail, setDetail]       = useState<any>(null);
  const [groups, setGroups]       = useState<any[]>([]);
  const [fields, setFields]       = useState<any[]>([]);
  const [q, setQ]                 = useState('');
  const [loading, setLoading]     = useState(true);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // spec modal
  const [specOpen, setSpecOpen]   = useState(false);
  const [specEditId, setSpecEditId] = useState<string|null>(null);
  const [sGroup, setSGroup]       = useState('');
  const [sName, setSName]         = useState('');
  const [sValue, setSValue]       = useState('');
  const [sLink, setSLink]         = useState('');
  const [saving, setSaving]       = useState(false);

  // product modal
  const [prodOpen, setProdOpen]   = useState(false);
  const [prodIsNew, setProdIsNew] = useState(false);
  const [pf, setPf]               = useState<any>({});

  const h = useCallback(() => ({ Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' }), [token]);

  /* ---- load ---- */
  const loadProducts = useCallback(async (selectFirst = false) => {
    try {
      const r = await fetch(`${API}/products?limit=200`, { headers: h() });
      const d = await r.json();
      const list = d.products ?? [];
      setProducts(list);
      if (selectFirst && list.length && !curId) setCurId(list[0].id);
    } catch {}
    setLoading(false);
  }, [h, curId]);

  const loadMeta = useCallback(async () => {
    try {
      const [gr, fr] = await Promise.all([
        fetch(`${API}/custom-fields/groups`, { headers: h() }),
        fetch(`${API}/custom-fields`,        { headers: h() }),
      ]);
      const g = await gr.json(); const f = await fr.json();
      setGroups(Array.isArray(g) ? g : []);
      setFields(Array.isArray(f) ? f : []);
    } catch {}
  }, [h]);

  const loadDetail = useCallback(async (id: string) => {
    setLoadingDetail(true);
    try {
      const r = await fetch(`${API}/products/${id}`, { headers: h() });
      if (r.ok) setDetail(await r.json());
    } catch {}
    setLoadingDetail(false);
  }, [h]);

  useEffect(() => { if (token) { loadProducts(true); loadMeta(); } }, [token]);
  useEffect(() => { if (curId) loadDetail(curId); }, [curId, loadDetail]);

  /* ---- derived ---- */
  const list = products.filter(p =>
    !q || `${p.name ?? ''}${p.articleId ?? ''}${p.brand ?? ''}`.toLowerCase().includes(q.toLowerCase())
  );
  const valueMap: Record<string, { value: any; link: string|null }> = {};
  (detail?.fieldValues ?? []).forEach((v: any) => { valueMap[v.fieldId] = { value: v.value, link: v.link }; });

  const orderedGroups = [...groups].sort((a, b) => {
    const ia = GROUP_ORDER.indexOf(a.name); const ib = GROUP_ORDER.indexOf(b.name);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
  const filledCount = (detail?.fieldValues ?? []).filter((v: any) => v.value !== null && v.value !== '').length;

  /* ---- spec save ---- */
  const openSpec = (groupName: string, fieldId?: string) => {
    setSGroup(groupName);
    if (fieldId) {
      const f = fields.find(x => x.id === fieldId);
      setSpecEditId(fieldId);
      setSName(f?.name ?? '');
      setSValue(valueMap[fieldId]?.value != null ? String(valueMap[fieldId].value) : '');
      setSLink(valueMap[fieldId]?.link ?? '');
    } else {
      setSpecEditId(null); setSName(''); setSValue(''); setSLink('');
    }
    setSpecOpen(true);
  };

  const saveSpec = async () => {
    if (!sName.trim() || !curId) return;
    setSaving(true);
    try {
      let fieldId = specEditId;
      if (!fieldId) {
        const group = groups.find(g => g.name === sGroup);
        const existing = fields.find(f => f.name === sName.trim() && f.groupId === group?.id);
        if (existing) fieldId = existing.id;
        else {
          const r = await fetch(`${API}/custom-fields`, {
            method: 'POST', headers: h(),
            body: JSON.stringify({
              name: sName.trim(), type: sLink.trim() ? 'LINK' : 'TEXT',
              groupId: group?.id ?? null,
              showInCard: true, showInTable: false, showInFilter: true, showOnCreate: false,
            }),
          });
          const nf = await r.json();
          fieldId = nf.id;
          setFields(prev => [...prev, nf]);
        }
      }
      await fetch(`${API}/products/${curId}/fields`, {
        method: 'PATCH', headers: h(),
        body: JSON.stringify({ fieldId, value: sValue.trim(), link: sLink.trim() || undefined }),
      });
      setSpecOpen(false);
      await Promise.all([loadDetail(curId), loadMeta()]);
    } catch {}
    setSaving(false);
  };

  const clearSpec = async () => {
    if (!specEditId || !curId) return;
    if (!confirm('Очистить значение характеристики?')) return;
    setSaving(true);
    await fetch(`${API}/products/${curId}/fields`, {
      method: 'PATCH', headers: h(), body: JSON.stringify({ fieldId: specEditId, value: '' }),
    }).catch(() => {});
    setSpecOpen(false);
    await loadDetail(curId);
    setSaving(false);
  };

  /* ---- product save ---- */
  const PF = ['articleId','name','brand','model','categoryName','tnved','okpd','declaration','url','ozonUrl','gtdNumber','gtdUrl','photoUrl'];
  const openProduct = (isNew: boolean) => {
    setProdIsNew(isNew);
    if (isNew) {
      const o: any = {}; PF.forEach(f => o[f] = '');
      o.articleId = 'SKU-' + String(products.length + 1).padStart(3, '0');
      o.marketplace = 'WB';
      setPf(o);
    } else {
      const o: any = {}; PF.forEach(f => o[f] = detail?.[f] ?? '');
      o.marketplace = detail?.marketplace ?? 'WB';
      setPf(o);
    }
    setProdOpen(true);
  };

  const saveProduct = async () => {
    if (!pf.name?.trim()) { alert('Укажите название товара'); return; }
    setSaving(true);
    try {
      if (prodIsNew) {
        const r = await fetch(`${API}/products`, { method: 'POST', headers: h(), body: JSON.stringify(pf) });
        const np = await r.json();
        setProdOpen(false);
        await loadProducts();
        if (np?.id) setCurId(np.id);
      } else {
        await fetch(`${API}/products/${curId}`, { method: 'PATCH', headers: h(), body: JSON.stringify(pf) });
        setProdOpen(false);
        await Promise.all([loadProducts(), loadDetail(curId!)]);
      }
    } catch {}
    setSaving(false);
  };

  const deleteProduct = async () => {
    if (!curId || !confirm('Удалить весь товар из базы?')) return;
    await fetch(`${API}/products/${curId}`, { method: 'DELETE', headers: h() }).catch(() => {});
    setProdOpen(false);
    const rest = products.filter(p => p.id !== curId);
    setProducts(rest);
    setCurId(rest[0]?.id ?? null);
    setDetail(null);
  };

  /* ================= render ================= */
  return (
    <div style={{
      display: 'flex', gap: 0, background: T.paper,
      border: `1px solid ${T.line}`, borderRadius: 14, overflow: 'hidden',
      height: 'calc(100vh - 150px)', minHeight: 520,
      fontFamily: "'Golos Text', system-ui, -apple-system, sans-serif", color: T.ink,
    }}>
      {/* ============ SIDEBAR ============ */}
      <div style={{ width: 270, flexShrink: 0, background: T.surface, borderRight: `1px solid ${T.line}`, display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '18px 18px 12px' }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 9, margin: 0 }}>
            <span style={{ width: 12, height: 12, borderRadius: 4, background: T.brand, display: 'inline-block' }} />
            База знаний
          </h1>
          <div style={{ fontSize: 12, color: T.muted, marginTop: 3 }}>Товары · связанная база</div>
        </div>

        <div style={{ margin: '6px 14px 8px' }}>
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Поиск товара…"
            style={{ ...fldInput, fontSize: 13, padding: '8px 11px', borderRadius: 9, background: T.paper }} />
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '4px 10px 14px' }}>
          {loading ? (
            <div style={emptyRow}>Загрузка…</div>
          ) : list.length === 0 ? (
            <div style={emptyRow}>Ничего не найдено</div>
          ) : list.map(p => {
            const on = p.id === curId;
            return (
              <div key={p.id} onClick={() => setCurId(p.id)}
                style={{
                  padding: '10px 12px', borderRadius: 10, cursor: 'pointer', marginBottom: 3,
                  border: `1px solid ${on ? '#D9D6F5' : 'transparent'}`,
                  background: on ? T.brandBg : 'transparent',
                }}
                onMouseEnter={e => { if (!on) (e.currentTarget as HTMLElement).style.background = T.paper; }}
                onMouseLeave={e => { if (!on) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}>
                <div style={{ fontSize: 14, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {p.name || '—'}
                </div>
                <div style={{ fontSize: 12, color: T.muted, marginTop: 2, display: 'flex', gap: 7, alignItems: 'center' }}>
                  <span style={{ fontFamily: MONO, fontSize: 10.5, color: T.muted2 }}>{p.articleId}</span>
                  {p.brand && p.brand !== '—' ? '· ' + p.brand : ''}
                  <span style={{ marginLeft: 'auto', color: T.muted2, fontSize: 11 }}>
                    {p._count?.tasks ? `${p._count.tasks} задач` : ''}
                  </span>
                </div>
              </div>
            );
          })}
        </div>

        {canEdit && (
          <button onClick={() => openProduct(true)}
            style={{
              margin: '6px 14px 16px', font: 'inherit', fontSize: 13, fontWeight: 500,
              color: T.brand, background: T.brandBg, border: 'none', padding: 9,
              borderRadius: 9, cursor: 'pointer', width: 'calc(100% - 28px)',
            }}>
            ＋ Добавить товар
          </button>
        )}
      </div>

      {/* ============ MAIN ============ */}
      <div style={{ flex: 1, minWidth: 0, padding: '22px 26px 60px', overflowY: 'auto' }}>
        {!detail ? (
          <div style={{ padding: 60, textAlign: 'center', color: T.muted, fontSize: 13 }}>
            {loadingDetail ? 'Загрузка…' : 'Выберите товар слева'}
          </div>
        ) : (
          <>
            {/* header */}
            <div style={{ display: 'flex', gap: 18, marginBottom: 20 }}>
              <div style={{
                width: 104, height: 104, borderRadius: 14, background: T.paper,
                border: `1px solid ${T.line}`, flexShrink: 0, display: 'grid',
                placeItems: 'center', color: T.muted2, fontSize: 30, overflow: 'hidden',
              }}>
                {detail.photoUrl
                  ? <img src={detail.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  : '📦'}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 13, color: T.muted, fontWeight: 500 }}>{detail.brand || '—'}</div>
                <h2 style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', margin: '1px 0 6px' }}>
                  {detail.name || 'Без названия'}
                </h2>
                <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontSize: 11, fontWeight: 500, padding: '4px 9px', borderRadius: 20, background: T.greenBg, color: T.green }}>
                    {detail.status || 'Активный'}
                  </span>
                  <span style={{ fontSize: 11, fontWeight: 500, padding: '4px 9px', borderRadius: 20, background: T.paper, color: T.muted, border: `1px solid ${T.line}` }}>
                    {detail.categoryName || '—'}
                  </span>
                  <span onClick={() => document.getElementById('versSec')?.scrollIntoView({ behavior: 'smooth' })}
                    style={{ fontSize: 11, fontWeight: 500, padding: '4px 9px', borderRadius: 20, background: T.brandBg, color: T.brand, cursor: 'pointer' }}>
                    v{detail.versions?.length || 1} · история
                  </span>
                  <span style={{ fontFamily: MONO, color: T.muted2, fontSize: 11 }}>{detail.articleId}</span>
                  <span style={{ fontSize: 11, fontWeight: 500, padding: '4px 9px', borderRadius: 20, background: detail.marketplace === 'WB' ? '#F3E8FB' : '#E5EFFF', color: detail.marketplace === 'WB' ? '#8B2FC9' : '#005BFF' }}>
                    {detail.marketplace}
                  </span>
                </div>
              </div>
              {canEdit && (
                <button onClick={() => openProduct(false)}
                  style={{
                    marginLeft: 'auto', font: 'inherit', fontSize: 12.5, color: T.muted,
                    background: 'none', border: `1px solid ${T.line}`, padding: '6px 11px',
                    borderRadius: 8, cursor: 'pointer', height: 'fit-content',
                  }}>
                  ✎ Реквизиты
                </button>
              )}
            </div>

            {/* quick links */}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 22 }}>
              {detail.url && <QL href={detail.url}>🟣 Карточка WB</QL>}
              {detail.ozonUrl && <QL href={detail.ozonUrl}>🔵 Карточка Ozon</QL>}
              {detail.gtdUrl && <QL href={detail.gtdUrl}>📄 ГТД {detail.gtdNumber || ''}</QL>}
              {!detail.gtdUrl && detail.gtdNumber && <QLStatic>📄 ГТД {detail.gtdNumber}</QLStatic>}
              {detail.declaration && <QLStatic>✅ {detail.declaration}</QLStatic>}
              <QL href={`/dashboard/products/${detail.id}`}>📋 Карточка в системе</QL>
            </div>

            {/* identifiers */}
            <div style={sec}>
              <div style={secHead}><span style={{ fontSize: 16 }}>🏷️</span>Идентификаторы</div>
              <div style={kvWrap}>
                <KvRow k="Бренд / модель" v={[detail.brand, detail.model].filter(Boolean).join(' — ')} />
                <KvRow k="Код ТН ВЭД" v={detail.tnved} />
                <KvRow k="ОКПД 2" v={detail.okpd} />
                <KvRow k="Декларация ЕАЭС" v={detail.declaration} />
                <KvRow k="Штрихкод" v={detail.barcode} />
              </div>
            </div>

            {/* spec groups */}
            {orderedGroups.map(g => {
              const gf = fields.filter(f => f.groupId === g.id);
              const filled = gf.filter(f => valueMap[f.id]?.value != null && valueMap[f.id]?.value !== '');
              if (!filled.length && g.name !== 'Характеристики') {
                return (
                  <div key={g.id} style={sec}>
                    <div style={secHead}>
                      <span style={{ fontSize: 16 }}>{g.icon || GICON[g.name] || '📋'}</span>{g.name}
                      {canEdit && <button style={addBtn} onClick={() => openSpec(g.name)}>＋ добавить</button>}
                    </div>
                    <div style={emptyRow}>Пока пусто — «＋ добавить»</div>
                  </div>
                );
              }
              return (
                <div key={g.id} style={sec}>
                  <div style={secHead}>
                    <span style={{ fontSize: 16 }}>{g.icon || GICON[g.name] || '📋'}</span>{g.name}
                    {canEdit && <button style={addBtn} onClick={() => openSpec(g.name)}>＋ добавить</button>}
                  </div>
                  {filled.length ? (
                    <div style={kvWrap}>
                      {filled.map(f => {
                        const entry = valueMap[f.id];
                        const raw = entry?.value;
                        const link = entry?.link;
                        const text = f.type === 'PERCENT' && raw != null ? `${raw}%` : String(raw ?? '');
                        return (
                          <SpecRow key={f.id} name={f.name} text={text} link={link}
                            canEdit={canEdit} onEdit={() => openSpec(g.name, f.id)} />
                        );
                      })}
                    </div>
                  ) : <div style={emptyRow}>Пока пусто — «＋ добавить»</div>}
                </div>
              );
            })}

            {/* trademarks */}
            <div style={sec}>
              <div style={secHead}><span style={{ fontSize: 16 }}>®️</span>Товарные знаки</div>
              {detail.trademarks?.length ? (
                <div style={kvWrap}>
                  {detail.trademarks.map((t: any) => <KvRow key={t.id} k={t.name} v={t.status} />)}
                </div>
              ) : <div style={emptyRow}>Не указаны</div>}
            </div>

            {/* kits */}
            <div style={sec}>
              <div style={secHead}><span style={{ fontSize: 16 }}>🎁</span>Входит в наборы</div>
              {detail.kits?.length ? (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '14px 18px' }}>
                  {detail.kits.map((k: any) => <Chip key={k.id}>{k.kitName}</Chip>)}
                </div>
              ) : <div style={emptyRow}>Не входит в наборы</div>}
            </div>

            {/* supplies */}
            <div style={sec}>
              <div style={secHead}>
                <span style={{ fontSize: 16 }}>🚢</span>Поставки этого товара
                <span style={{ marginLeft: 'auto', fontWeight: 400, fontSize: 12, color: T.muted }}>→ модуль «Поставки»</span>
              </div>
              <div style={emptyRow}>Нет привязанных поставок</div>
            </div>

            {/* tasks */}
            <div style={sec}>
              <div style={secHead}>
                <span style={{ fontSize: 16 }}>✅</span>Задачи по товару
                <span style={{ marginLeft: 'auto', fontWeight: 400, fontSize: 12, color: T.muted }}>→ модуль «Задачи»</span>
              </div>
              {detail.tasks?.length ? (
                <div style={{ padding: '8px 18px 14px' }}>
                  {detail.tasks.map((t: any, i: number) => {
                    const pill = TASK_PILL[t.status] ?? TASK_PILL.NEW;
                    return (
                      <a key={t.id} href={`/dashboard/tasks/${t.id}`} style={{ textDecoration: 'none', color: 'inherit' }}>
                        <div style={{
                          display: 'flex', alignItems: 'center', gap: 10, padding: '9px 0',
                          borderBottom: i === detail.tasks.length - 1 ? 'none' : `1px solid ${T.line}`,
                          fontSize: 13.5, cursor: 'pointer',
                        }}>
                          <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</span>
                          <span style={{ fontSize: 11, padding: '3px 9px', borderRadius: 20, fontWeight: 500, background: pill.bg, color: pill.c, flexShrink: 0 }}>
                            {pill.l}
                          </span>
                        </div>
                      </a>
                    );
                  })}
                </div>
              ) : <div style={emptyRow}>Нет задач</div>}
            </div>

            {/* versions */}
            <div style={sec} id="versSec">
              <div style={secHead}><span style={{ fontSize: 16 }}>🕘</span>История версий</div>
              {detail.versions?.length ? (
                <div style={{ padding: '6px 18px 12px' }}>
                  {detail.versions.map((v: any, i: number) => (
                    <div key={v.id} style={{
                      display: 'flex', gap: 12, padding: '8px 0', fontSize: 13,
                      borderBottom: i === detail.versions.length - 1 ? 'none' : `1px solid ${T.line}`,
                    }}>
                      <span style={{ fontFamily: MONO, fontSize: 11.5, color: T.muted2, whiteSpace: 'nowrap' }}>{v.date}</span>
                      <span style={{ color: T.muted, whiteSpace: 'nowrap' }}>{v.who}</span>
                      <span>{v.change}</span>
                    </div>
                  ))}
                </div>
              ) : <div style={emptyRow}>История пуста</div>}
            </div>
          </>
        )}
      </div>

      {/* ============ SPEC MODAL ============ */}
      {specOpen && (
        <Overlay onClose={() => setSpecOpen(false)}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '17px 20px', borderBottom: `1px solid ${T.line}` }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{specEditId ? 'Характеристика' : 'Новая характеристика'}</h3>
            <button onClick={() => setSpecOpen(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 22, color: T.muted, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ padding: '18px 20px' }}>
            <Fld label="Раздел">
              <select value={sGroup} onChange={e => setSGroup(e.target.value)} style={fldInput} disabled={!!specEditId}>
                {orderedGroups.map(g => <option key={g.id} value={g.name}>{g.name}</option>)}
              </select>
            </Fld>
            <Fld label="Название параметра">
              <input value={sName} onChange={e => setSName(e.target.value)} style={fldInput} disabled={!!specEditId} list="spec-names" />
              <datalist id="spec-names">
                {fields.filter(f => f.groupId === groups.find(g => g.name === sGroup)?.id).map(f => <option key={f.id} value={f.name} />)}
              </datalist>
            </Fld>
            <Fld label="Значение">
              <textarea value={sValue} onChange={e => setSValue(e.target.value)} rows={2} style={{ ...fldInput, resize: 'vertical' }} />
            </Fld>
            <Fld label="Ссылка (необязательно)">
              <input value={sLink} onChange={e => setSLink(e.target.value)} placeholder="https://… или пусто" style={fldInput} />
            </Fld>
          </div>
          <div style={{ display: 'flex', gap: 10, padding: '15px 20px', borderTop: `1px solid ${T.line}` }}>
            {specEditId && (
              <button onClick={clearSpec} style={{ font: 'inherit', fontSize: 13, color: '#D6455D', background: 'none', border: 'none', cursor: 'pointer' }}>
                Очистить
              </button>
            )}
            <div style={{ marginLeft: 'auto' }} />
            <button onClick={() => setSpecOpen(false)} style={btnGhost}>Отмена</button>
            <button onClick={saveSpec} disabled={saving || !sName.trim()} style={{ ...btnPrim, opacity: saving || !sName.trim() ? 0.6 : 1 }}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </Overlay>
      )}

      {/* ============ PRODUCT MODAL ============ */}
      {prodOpen && (
        <Overlay onClose={() => setProdOpen(false)}>
          <div style={{ display: 'flex', alignItems: 'center', padding: '17px 20px', borderBottom: `1px solid ${T.line}` }}>
            <h3 style={{ fontSize: 16, fontWeight: 600, margin: 0 }}>{prodIsNew ? 'Новый товар' : 'Реквизиты товара'}</h3>
            <button onClick={() => setProdOpen(false)} style={{ marginLeft: 'auto', background: 'none', border: 'none', fontSize: 22, color: T.muted, cursor: 'pointer' }}>×</button>
          </div>
          <div style={{ padding: '18px 20px', maxHeight: '60vh', overflowY: 'auto' }}>
            <Fld label="Артикул / SKU"><input value={pf.articleId ?? ''} onChange={e => setPf({ ...pf, articleId: e.target.value })} style={fldInput} /></Fld>
            <Fld label="Маркетплейс">
              <select value={pf.marketplace ?? 'WB'} onChange={e => setPf({ ...pf, marketplace: e.target.value })} style={fldInput}>
                <option value="WB">WB</option><option value="OZON">Ozon</option>
              </select>
            </Fld>
            <Fld label="Народное название"><input value={pf.name ?? ''} onChange={e => setPf({ ...pf, name: e.target.value })} style={fldInput} /></Fld>
            <Fld label="Бренд"><input value={pf.brand ?? ''} onChange={e => setPf({ ...pf, brand: e.target.value })} style={fldInput} /></Fld>
            <Fld label="Модель / артикул производителя"><input value={pf.model ?? ''} onChange={e => setPf({ ...pf, model: e.target.value })} style={fldInput} /></Fld>
            <Fld label="Категория"><input value={pf.categoryName ?? ''} onChange={e => setPf({ ...pf, categoryName: e.target.value })} style={fldInput} /></Fld>
            <Fld label="Код ТН ВЭД"><input value={pf.tnved ?? ''} onChange={e => setPf({ ...pf, tnved: e.target.value })} style={fldInput} /></Fld>
            <Fld label="ОКПД 2"><input value={pf.okpd ?? ''} onChange={e => setPf({ ...pf, okpd: e.target.value })} style={fldInput} /></Fld>
            <Fld label="Декларация ЕАЭС"><input value={pf.declaration ?? ''} onChange={e => setPf({ ...pf, declaration: e.target.value })} style={fldInput} /></Fld>
            <Fld label="№ ГТД"><input value={pf.gtdNumber ?? ''} onChange={e => setPf({ ...pf, gtdNumber: e.target.value })} style={fldInput} /></Fld>
            <Fld label="Ссылка на ГТД (PDF)"><input value={pf.gtdUrl ?? ''} onChange={e => setPf({ ...pf, gtdUrl: e.target.value })} style={fldInput} /></Fld>
            <Fld label="Ссылка WB"><input value={pf.url ?? ''} onChange={e => setPf({ ...pf, url: e.target.value })} style={fldInput} /></Fld>
            <Fld label="Ссылка Ozon"><input value={pf.ozonUrl ?? ''} onChange={e => setPf({ ...pf, ozonUrl: e.target.value })} style={fldInput} /></Fld>
            <Fld label="Фото (URL)"><input value={pf.photoUrl ?? ''} onChange={e => setPf({ ...pf, photoUrl: e.target.value })} style={fldInput} /></Fld>
          </div>
          <div style={{ display: 'flex', gap: 10, padding: '15px 20px', borderTop: `1px solid ${T.line}` }}>
            {!prodIsNew && (
              <button onClick={deleteProduct} style={{ font: 'inherit', fontSize: 13, color: '#D6455D', background: 'none', border: 'none', cursor: 'pointer' }}>
                Удалить товар
              </button>
            )}
            <div style={{ marginLeft: 'auto' }} />
            <button onClick={() => setProdOpen(false)} style={btnGhost}>Отмена</button>
            <button onClick={saveProduct} disabled={saving} style={{ ...btnPrim, opacity: saving ? 0.6 : 1 }}>
              {saving ? 'Сохранение…' : 'Сохранить'}
            </button>
          </div>
        </Overlay>
      )}
    </div>
  );
}

/* ---- small pieces ---- */
function QL({ href, children }: { href: string; children: React.ReactNode }) {
  const [hov, setHov] = useState(false);
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5,
        padding: '7px 12px', border: `1px solid ${hov ? T.brand : T.line}`,
        borderRadius: 9, background: T.surface, color: hov ? T.brand : T.ink, textDecoration: 'none',
      }}>
      {children}
    </a>
  );
}
function QLStatic({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5,
      padding: '7px 12px', border: `1px solid ${T.line}`, borderRadius: 9,
      background: T.surface, color: T.ink,
    }}>{children}</span>
  );
}
function Chip({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      fontFamily: MONO, fontSize: 11.5, padding: '5px 10px', borderRadius: 8,
      background: T.tealBg, border: '1px solid transparent', color: '#0a7d68',
    }}>{children}</span>
  );
}
function SpecRow({ name, text, link, canEdit, onEdit }: { name: string; text: string; link?: string|null; canEdit: boolean; onEdit: () => void }) {
  const [hov, setHov] = useState(false);
  return (
    <>
      <div style={kCell} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>{name}</div>
      <div style={vCell} onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}>
        <span style={{ flex: 1, color: T.ink, whiteSpace: 'pre-wrap' }}>
          {link
            ? <a href={link} target="_blank" rel="noopener noreferrer" style={{ color: T.brand, textDecoration: 'none' }}>{text || link}</a>
            : (text || '—')}
        </span>
        {canEdit && (
          <span onClick={onEdit} title="Изменить"
            style={{ opacity: hov ? 1 : 0, color: T.muted2, cursor: 'pointer', fontSize: 13, flexShrink: 0, transition: 'opacity .15s' }}>
            ✎
          </span>
        )}
      </div>
    </>
  );
}
function Fld({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 5, marginBottom: 13 }}>
      <label style={{ fontSize: 12, color: T.muted }}>{label}</label>
      {children}
    </div>
  );
}
function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div onClick={e => { if (e.target === e.currentTarget) onClose(); }}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(20,22,30,.4)', display: 'flex',
        alignItems: 'flex-start', justifyContent: 'center', padding: '40px 16px',
        overflowY: 'auto', zIndex: 1000,
      }}>
      <div style={{
        background: T.surface, borderRadius: 16, width: '100%', maxWidth: 520,
        boxShadow: '0 20px 60px rgba(20,22,30,.25)',
        fontFamily: "'Golos Text', system-ui, sans-serif", color: T.ink,
      }}>
        {children}
      </div>
    </div>
  );
}
