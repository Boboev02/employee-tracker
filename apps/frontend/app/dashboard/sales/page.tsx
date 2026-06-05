'use client';
import { useState, useCallback, useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend, AreaChart, Area } from 'recharts';
import * as XLSX from 'xlsx';

// ─── Типы ────────────────────────────────────────────────────────────────────
interface Order {
  sku: string; name: string; brand: string;
  date: Date; hour: number; price: number;
  status: 'Создан' | 'Выкуплен' | 'Отказ' | 'Возврат' | string;
  dayKey: string; // 'YYYY-MM-DD'
}

// ─── Константы ───────────────────────────────────────────────────────────────
const HOURS = Array.from({ length: 24 }, (_, i) => i);
const fmtH = (h: number) => String(h).padStart(2, '0') + ':00';
const fmtNum = (n: number) => n.toLocaleString('ru');
const fmtMoney = (n: number) => fmtNum(Math.round(n)) + '₽';
const STATUS_COLORS: Record<string,string> = {
  'Создан':   '#7F77DD', 'Выкуплен': '#16A34A',
  'Отказ':    '#DC2626', 'Возврат':  '#D97706',
};
const STATUS_BG: Record<string,string> = {
  'Создан': '#EDE9FE', 'Выкуплен': '#DCFCE7',
  'Отказ': '#FEE2E2', 'Возврат': '#FEF3C7',
};

// ─── Парсер Excel ─────────────────────────────────────────────────────────────
function parseDate(val: any): Date | null {
  if (!val) return null;
  if (val instanceof Date) return val;
  if (typeof val === 'number') {
    const d = new Date((val - 25569) * 86400 * 1000);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof val === 'string') {
    const s = val.trim();
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return new Date(s.replace(' ', 'T'));
    if (/^\d{2}\.\d{2}\.\d{4}/.test(s)) {
      const [d, m, y] = s.split(' ')[0].split('.');
      const t = s.split(' ')[1] || '00:00:00';
      return new Date(`${y}-${m}-${d}T${t}`);
    }
  }
  return null;
}

function parseWBExcel(data: ArrayBuffer): Order[] {
  const wb = XLSX.read(data, { type: 'array', cellDates: false, raw: true });
  // Поддержка обоих вариантов листа
  const sheetName = wb.SheetNames.find(n =>
    n.includes('Все заказы') || n.includes('Активн') || n.includes('заказ')
  ) ?? wb.SheetNames[0];
  const ws = wb.Sheets[sheetName];
  const allRows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: null, raw: true });

  // Ищем строку с заголовками
  let headerIdx = -1;
  for (let i = 0; i < Math.min(allRows.length, 5); i++) {
    if (allRows[i]?.some((c: any) => typeof c === 'string' && c.includes('Артикул продавца'))) {
      headerIdx = i; break;
    }
  }
  if (headerIdx === -1) return [];

  const headers: any[] = allRows[headerIdx];
  const col = (name: string) => headers.findIndex((h: any) => typeof h === 'string' && h.includes(name));

  const skuCol    = col('Артикул продавца');
  const nameCol   = col('Название');
  const brandCol  = col('Бренд');
  const dateCol   = col('Дата оформления');
  const priceCol  = col('Стоимость');
  const statusCol = col('Статус заказа');

  if (skuCol === -1 || dateCol === -1) return [];

  const orders: Order[] = [];
  for (let i = headerIdx + 1; i < allRows.length; i++) {
    const row = allRows[i];
    if (!Array.isArray(row)) continue;
    const sku = row[skuCol];
    if (!sku || String(sku).trim() === '') continue;
    const date = parseDate(row[dateCol]);
    if (!date || isNaN(date.getTime())) continue;
    orders.push({
      sku:    String(sku).trim(),
      name:   String(row[nameCol]   ?? ''),
      brand:  String(row[brandCol]  ?? ''),
      date,
      hour:   date.getHours(),
      price:  Number(row[priceCol]  ?? 0),
      status: String(row[statusCol] ?? ''),
      dayKey: date.toISOString().slice(0, 10),
    });
  }
  return orders;
}

// ─── Чтение файла (zip или xlsx) ─────────────────────────────────────────────
async function decompressDeflate(compressed: ArrayBuffer): Promise<ArrayBuffer> {
  const ds = new DecompressionStream('deflate-raw');
  const writer = ds.writable.getWriter();
  const reader = ds.readable.getReader();
  // ВАЖНО: awaiting write и close
  await writer.write(new Uint8Array(compressed));
  await writer.close();
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    chunks.push(value);
  }
  const total = chunks.reduce((s, c) => s + c.length, 0);
  const result = new Uint8Array(total);
  let off = 0;
  for (const chunk of chunks) { result.set(chunk, off); off += chunk.length; }
  return result.buffer;
}

async function readFile(file: File): Promise<Order[]> {
  const name = file.name.toLowerCase();
  if (name.endsWith('.zip')) {
    const data = await file.arrayBuffer();
    const bytes = new Uint8Array(data);
    const view = new DataView(data);
    let offset = 0;
    while (offset < bytes.length - 30) {
      if (view.getUint32(offset, true) === 0x04034b50) {
        const compression = view.getUint16(offset + 8, true);
        const compSize    = view.getUint32(offset + 18, true);
        const nameLen     = view.getUint16(offset + 26, true);
        const extraLen    = view.getUint16(offset + 28, true);
        const fileNameB   = bytes.slice(offset + 30, offset + 30 + nameLen);
        const fileName    = new TextDecoder().decode(fileNameB).toLowerCase();
        const dataOffset  = offset + 30 + nameLen + extraLen;
        if ((fileName.endsWith('.xlsx') || fileName.endsWith('.xls')) && !fileName.startsWith('__')) {
          const comp = data.slice(dataOffset, dataOffset + compSize);
          const xlsxData = compression === 8 ? await decompressDeflate(comp) : comp;
          try {
            const orders = parseWBExcel(xlsxData);
            if (orders.length > 0) return orders;
          } catch {}
        }
        offset = dataOffset + compSize;
      } else { offset++; }
    }
    return [];
  }
  return parseWBExcel(await file.arrayBuffer());
}

// ─── UI компоненты ────────────────────────────────────────────────────────────
function FileDropZone({ onLoad }: { onLoad: (o: Order[], n: string) => void }) {
  const [drag, setDrag] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filename, setFilename] = useState('');

  const handle = useCallback((file: File) => {
    setLoading(true); setFilename(file.name);
    readFile(file)
      .then(o => onLoad(o, file.name))
      .catch(() => onLoad([], file.name))
      .finally(() => setLoading(false));
  }, [onLoad]);

  return (
    <div onDragOver={e=>{e.preventDefault();setDrag(true);}} onDragLeave={()=>setDrag(false)}
      onDrop={e=>{e.preventDefault();setDrag(false);const f=e.dataTransfer.files[0];if(f)handle(f);}}
      onClick={()=>{const i=document.createElement('input');i.type='file';i.accept='.xlsx,.xls,.zip';i.onchange=()=>{if(i.files?.[0])handle(i.files[0]);};i.click();}}
      style={{border:`2px dashed ${drag?'#7F77DD':'#EDE9FE'}`,borderRadius:'20px',padding:'32px',textAlign:'center',background:drag?'#EDE9FE20':'#F8F7FF',cursor:'pointer',transition:'all 0.15s'}}>
      {loading ? <p style={{color:'#9B97CC',fontSize:'14px',margin:0}}>Загружаю и парсю данные...</p>
        : filename ? (
          <div>
            <i className="ti ti-circle-check" style={{fontSize:'32px',color:'#16A34A',display:'block',marginBottom:'8px'}} aria-hidden="true"/>
            <p style={{fontSize:'14px',fontWeight:700,color:'#16A34A',margin:'0 0 4px'}}>{filename}</p>
            <p style={{fontSize:'12px',color:'#9B97CC',margin:0}}>Нажмите для замены файла</p>
          </div>
        ) : (
          <div>
            <i className="ti ti-file-spreadsheet" style={{fontSize:'40px',color:'#7F77DD',display:'block',marginBottom:'12px'}} aria-hidden="true"/>
            <p style={{fontSize:'15px',fontWeight:700,color:'#1a1040',margin:'0 0 6px'}}>Загрузите ленту заказов WB</p>
            <p style={{fontSize:'12px',color:'#9B97CC',margin:'0 0 4px'}}>Перетащите или нажмите для выбора</p>
            <p style={{fontSize:'11px',color:'#C4C0E8',margin:0}}>Поддерживается .xlsx и .zip</p>
          </div>
        )}
    </div>
  );
}

function KpiCard({label,val,sub,accent,bg,icon,delta}:{label:string;val:string|number;sub?:string;accent:string;bg:string;icon:string;delta?:number}) {
  return (
    <div style={{background:'white',borderRadius:'16px',padding:'14px 16px',boxShadow:'0 4px 16px rgba(127,119,221,0.08)'}}>
      <div style={{width:'32px',height:'32px',borderRadius:'10px',background:bg,display:'flex',alignItems:'center',justifyContent:'center',marginBottom:'8px'}}>
        <i className={'ti '+icon} style={{fontSize:'16px',color:accent}} aria-hidden="true"/>
      </div>
      <p style={{fontSize:'10px',color:'#9B97CC',margin:'0 0 2px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.4px'}}>{label}</p>
      <p style={{fontSize:'22px',fontWeight:800,color:'#1a1040',margin:0,letterSpacing:'-0.5px'}}>{val}</p>
      {delta !== undefined && <p style={{fontSize:'11px',color:delta>=0?'#16A34A':'#DC2626',margin:'2px 0 0',fontWeight:600}}>{delta>=0?'+':''}{delta} vs пред. период</p>}
      {sub && <p style={{fontSize:'11px',color:accent,margin:'2px 0 0',fontWeight:600}}>{sub}</p>}
    </div>
  );
}

// ─── Главная страница ─────────────────────────────────────────────────────────
export default function SalesPage() {
  const [orders, setOrders]     = useState<Order[]>([]);
  const [filename, setFilename] = useState('');
  const [tab, setTab]           = useState<'dashboard'|'hours'|'skus'|'days'>('dashboard');

  // Доступные даты в файле
  const availableDays = useMemo(() => {
    const days = Array.from(new Set(orders.map(o => o.dayKey))).sort();
    return days;
  }, [orders]);

  // Период A и B — выбор дат
  const [periodA, setPeriodA] = useState<string[]>([]);
  const [periodB, setPeriodB] = useState<string[]>([]);
  const [filterHourFrom, setFilterHourFrom] = useState(0);
  const [filterHourTo,   setFilterHourTo]   = useState(23);
  const [selectedSkus, setSelectedSkus]     = useState<string[]>([]);

  // Устанавливаем периоды при загрузке файла
  const handleLoad = useCallback((o: Order[], name: string) => {
    setOrders(o);
    setFilename(name);
    setSelectedSkus([]);
    const days = Array.from(new Set(o.map(x => x.dayKey))).sort();
    // По умолчанию: последний день = A, предпоследний = B
    if (days.length >= 2) {
      setPeriodA([days[days.length - 1]]);
      setPeriodB([days[days.length - 2]]);
    } else if (days.length === 1) {
      setPeriodA([days[0]]);
      setPeriodB([]);
    }
  }, []);

  // Фильтрация
  const filterOrders = (dayKeys: string[]) => orders.filter(o =>
    (dayKeys.length === 0 || dayKeys.includes(o.dayKey)) &&
    o.hour >= filterHourFrom && o.hour <= filterHourTo &&
    (selectedSkus.length === 0 || selectedSkus.includes(o.sku))
  );

  const ordersA = useMemo(() => filterOrders(periodA), [orders, periodA, filterHourFrom, filterHourTo, selectedSkus]);
  const ordersB = useMemo(() => filterOrders(periodB), [orders, periodB, filterHourFrom, filterHourTo, selectedSkus]);

  // Статусы
  const byStatus = (arr: Order[], status: string) => arr.filter(o => o.status === status);
  const newA = byStatus(ordersA, 'Создан').length;
  const newB = byStatus(ordersB, 'Создан').length;
  const buyA = byStatus(ordersA, 'Выкуплен').length;
  const buyB = byStatus(ordersB, 'Выкуплен').length;
  const rejA = byStatus(ordersA, 'Отказ').length;
  const rejB = byStatus(ordersB, 'Отказ').length;
  const retA = ordersA.filter(o => o.status.includes('Возврат')).length;
  const retB = ordersB.filter(o => o.status.includes('Возврат')).length;

  // Все уникальные SKU
  const allSkus = useMemo(() => Array.from(new Set(orders.map(o => o.sku))).sort(), [orders]);

  // SKU статистика
  const skuStats = useMemo(() => {
    const map: Record<string, any> = {};
    orders.forEach(o => {
      if (!map[o.sku]) map[o.sku] = { sku: o.sku, name: o.name, newA:0, newB:0, buyA:0, buyB:0, rejA:0, rejB:0 };
    });
    ordersA.forEach(o => {
      if (!map[o.sku]) return;
      if (o.status === 'Создан')   map[o.sku].newA++;
      if (o.status === 'Выкуплен') map[o.sku].buyA++;
      if (o.status === 'Отказ')    map[o.sku].rejA++;
    });
    ordersB.forEach(o => {
      if (!map[o.sku]) return;
      if (o.status === 'Создан')   map[o.sku].newB++;
      if (o.status === 'Выкуплен') map[o.sku].buyB++;
      if (o.status === 'Отказ')    map[o.sku].rejB++;
    });
    return Object.values(map)
      .map(s => ({ ...s, diff: s.newA - s.newB, diffPct: s.newB > 0 ? Math.round((s.newA - s.newB) / s.newB * 100) : (s.newA > 0 ? 100 : 0) }))
      .sort((a, b) => b.newA - a.newA);
  }, [ordersA, ordersB, orders]);

  // Hourly data — только статус Создан
  const hourlyData = useMemo(() => HOURS.map(h => ({
    hour: fmtH(h),
    'Период A': byStatus(ordersA, 'Создан').filter(o => o.hour === h).length,
    'Период B': byStatus(ordersB, 'Создан').filter(o => o.hour === h).length,
  })), [ordersA, ordersB]);

  // Daily data
  const dayData = useMemo(() => {
    const allDays = Array.from(new Set([...ordersA, ...ordersB].map(o => o.dayKey))).sort();
    return allDays.map(d => ({
      date: d.slice(5),
      'Создан A':   ordersA.filter(o => o.dayKey === d && o.status === 'Создан').length,
      'Выкуплен A': ordersA.filter(o => o.dayKey === d && o.status === 'Выкуплен').length,
      'Отказ A':    ordersA.filter(o => o.dayKey === d && o.status === 'Отказ').length,
    }));
  }, [ordersA, ordersB]);

  // TOP-5 новых заказов
  const top5 = skuStats.slice(0, 5);
  const topGrowth = [...skuStats].filter(s => s.diff > 0).sort((a, b) => b.diffPct - a.diffPct).slice(0, 5);
  const topDrop   = [...skuStats].filter(s => s.diff < 0).sort((a, b) => a.diffPct - b.diffPct).slice(0, 5);

  const card: React.CSSProperties = { background: 'white', borderRadius: '20px', padding: '20px', boxShadow: '0 4px 16px rgba(127,119,221,0.08)' };
  const tabBtn = (id: typeof tab, lbl: string) => (
    <button onClick={() => setTab(id)} style={{ padding: '7px 16px', borderRadius: '20px', fontSize: '12px', fontWeight: tab === id ? 700 : 500, border: 'none', cursor: 'pointer', background: tab === id ? 'linear-gradient(135deg,#7F77DD,#5248C5)' : 'transparent', color: tab === id ? 'white' : '#9B97CC', transition: 'all 0.2s' }}>{lbl}</button>
  );

  const labelA = periodA.length === 1 ? periodA[0].slice(5) : periodA.length > 1 ? `${periodA[0].slice(5)}–${periodA[periodA.length-1].slice(5)}` : 'Период A';
  const labelB = periodB.length === 1 ? periodB[0].slice(5) : periodB.length > 1 ? `${periodB[0].slice(5)}–${periodB[periodB.length-1].slice(5)}` : 'Период B';

  return (
    <div style={{ minHeight: '100vh', background: '#ECEAF8' }}>
      {/* Header */}
      <div style={{ background: 'white', padding: '14px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 4px 16px rgba(127,119,221,0.06)' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#1a1040', margin: 0 }}>Аналитика продаж WB</h1>
          <p style={{ fontSize: '11px', color: '#9B97CC', margin: '2px 0 0' }}>
            {filename ? `Файл: ${filename} · ${orders.length} заказов` : 'Загрузите ленту заказов для анализа'}
          </p>
        </div>
        {orders.length > 0 && (
          <div style={{ display: 'flex', gap: '4px', background: '#F8F7FF', borderRadius: '20px', padding: '3px' }}>
            {tabBtn('dashboard', '🎯 Сводка')}
            {tabBtn('hours',     '⏰ По часам')}
            {tabBtn('skus',      '📦 Артикулы')}
            {tabBtn('days',      '📅 По дням')}
          </div>
        )}
      </div>

      <div style={{ padding: '20px 28px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Загрузка файла */}
        {orders.length === 0 && (
          <FileDropZone onLoad={handleLoad} />
        )}

        {orders.length > 0 && (
          <>
            {/* Период и фильтры */}
            <div style={{ ...card, display: 'flex', gap: '20px', flexWrap: 'wrap', alignItems: 'flex-start' }}>

              {/* Замена файла */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
                <i className="ti ti-file-spreadsheet" style={{ fontSize: '18px', color: '#7F77DD' }} aria-hidden="true"/>
                <div>
                  <p style={{ fontSize: '12px', fontWeight: 700, color: '#1a1040', margin: 0 }}>{filename}</p>
                  <button onClick={() => { setOrders([]); setFilename(''); }} style={{ fontSize: '11px', color: '#DC2626', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>✕ Загрузить другой файл</button>
                </div>
              </div>

              <div style={{ width: '1px', background: '#EDE9FE', alignSelf: 'stretch' }}/>

              {/* Период A */}
              <div>
                <label style={{ fontSize: '10px', color: '#7F77DD', display: 'block', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>Период A (основной)</label>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {availableDays.map(d => (
                    <button key={d} onClick={() => setPeriodA(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                      style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: periodA.includes(d) ? 700 : 400, border: 'none', cursor: 'pointer', background: periodA.includes(d) ? '#7F77DD' : '#F8F7FF', color: periodA.includes(d) ? 'white' : '#6B7280' }}>
                      {d.slice(5)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Период B */}
              <div>
                <label style={{ fontSize: '10px', color: '#2563EB', display: 'block', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>Период B (для сравнения)</label>
                <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                  {availableDays.map(d => (
                    <button key={d} onClick={() => setPeriodB(prev => prev.includes(d) ? prev.filter(x => x !== d) : [...prev, d])}
                      style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: periodB.includes(d) ? 700 : 400, border: 'none', cursor: 'pointer', background: periodB.includes(d) ? '#2563EB' : '#F8F7FF', color: periodB.includes(d) ? 'white' : '#6B7280' }}>
                      {d.slice(5)}
                    </button>
                  ))}
                </div>
              </div>

              {/* Часы */}
              <div>
                <label style={{ fontSize: '10px', color: '#9B97CC', display: 'block', marginBottom: '6px', fontWeight: 700, textTransform: 'uppercase' }}>Часы</label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <select value={filterHourFrom} onChange={e => setFilterHourFrom(+e.target.value)}
                    style={{ background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: '8px', padding: '5px 8px', fontSize: '12px', color: '#1a1040', outline: 'none' }}>
                    {HOURS.map(h => <option key={h} value={h}>{fmtH(h)}</option>)}
                  </select>
                  <span style={{ color: '#9B97CC', fontSize: '12px' }}>—</span>
                  <select value={filterHourTo} onChange={e => setFilterHourTo(+e.target.value)}
                    style={{ background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: '8px', padding: '5px 8px', fontSize: '12px', color: '#1a1040', outline: 'none' }}>
                    {HOURS.map(h => <option key={h} value={h}>{fmtH(h)}</option>)}
                  </select>
                </div>
              </div>
            </div>

            {/* Фильтр артикулов */}
            <div style={{ ...card, padding: '14px 20px' }}>
              <label style={{ fontSize: '10px', color: '#9B97CC', display: 'block', marginBottom: '8px', fontWeight: 700, textTransform: 'uppercase' }}>
                Артикулы ({selectedSkus.length === 0 ? 'все' : selectedSkus.length + ' выбрано'})
              </label>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                <button onClick={() => setSelectedSkus([])}
                  style={{ padding: '4px 12px', borderRadius: '20px', fontSize: '11px', fontWeight: selectedSkus.length === 0 ? 700 : 400, border: 'none', cursor: 'pointer', background: selectedSkus.length === 0 ? '#7F77DD' : '#F8F7FF', color: selectedSkus.length === 0 ? 'white' : '#6B7280' }}>
                  Все
                </button>
                {allSkus.map(sku => {
                  const sel = selectedSkus.includes(sku);
                  return (
                    <button key={sku} onClick={() => setSelectedSkus(p => sel ? p.filter(s => s !== sku) : [...p, sku])}
                      style={{ padding: '4px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: sel ? 700 : 400, border: 'none', cursor: 'pointer', background: sel ? '#EDE9FE' : '#F8F7FF', color: sel ? '#7F77DD' : '#6B7280' }}>
                      {sku}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* ─── СВОДКА ──────────────────────────────────────────────────── */}
            {tab === 'dashboard' && (
              <>
                {/* KPI по статусам */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '10px' }}>
                  <KpiCard label="Новые заказы (Создан)" val={fmtNum(newA)} sub={`Период A: ${labelA}`} accent="#7F77DD" bg="#EDE9FE" icon="ti-shopping-cart" delta={newA - newB}/>
                  <KpiCard label="Выкуплено" val={fmtNum(buyA)} sub={`Период A: ${labelA}`} accent="#16A34A" bg="#DCFCE7" icon="ti-circle-check" delta={buyA - buyB}/>
                  <KpiCard label="Отказы" val={fmtNum(rejA)} sub={`Период A: ${labelA}`} accent="#DC2626" bg="#FEE2E2" icon="ti-x" delta={rejA - rejB}/>
                  <KpiCard label="Возвраты" val={fmtNum(retA)} sub={`Период A: ${labelA}`} accent="#D97706" bg="#FEF3C7" icon="ti-arrow-back-up" delta={retA - retB}/>
                </div>

                {/* Конверсия */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '10px' }}>
                  {[
                    { label: 'Конверсия в выкуп A', val: ordersA.length > 0 ? Math.round(buyA / ordersA.length * 100) + '%' : '—', accent: '#16A34A', bg: '#DCFCE7', icon: 'ti-percentage' },
                    { label: 'Процент отказов A',   val: ordersA.length > 0 ? Math.round(rejA / ordersA.length * 100) + '%' : '—', accent: '#DC2626', bg: '#FEE2E2', icon: 'ti-trending-down' },
                    { label: 'Сумма заказов A',      val: fmtMoney(ordersA.filter(o=>o.status==='Создан').reduce((s,o)=>s+o.price,0)), accent: '#D97706', bg: '#FEF3C7', icon: 'ti-currency-ruble' },
                  ].map((k, i) => (
                    <div key={i} style={{ ...card, display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div style={{ width: '36px', height: '36px', borderRadius: '12px', background: k.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <i className={'ti ' + k.icon} style={{ fontSize: '18px', color: k.accent }} aria-hidden="true"/>
                      </div>
                      <div>
                        <p style={{ fontSize: '10px', color: '#9B97CC', margin: '0 0 2px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px' }}>{k.label}</p>
                        <p style={{ fontSize: '22px', fontWeight: 800, color: '#1a1040', margin: 0 }}>{k.val}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* TOP-5 + Рост + Падение */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <div style={card}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a1040', margin: '0 0 14px' }}>🏆 ТОП-5 новых заказов ({labelA})</p>
                    {top5.length === 0 ? <p style={{ color: '#9B97CC', fontSize: '12px' }}>Нет данных</p> : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {top5.map((s, i) => (
                          <div key={s.sku} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <span style={{ width: '20px', height: '20px', borderRadius: '6px', background: i === 0 ? '#FEF3C7' : '#F8F7FF', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', fontWeight: 700, color: i === 0 ? '#D97706' : '#9B97CC', flexShrink: 0 }}>{i + 1}</span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1040', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.sku}</p>
                              <div style={{ height: '3px', background: '#F3F0FF', borderRadius: '2px', marginTop: '4px' }}>
                                <div style={{ height: '3px', width: (top5[0].newA > 0 ? s.newA / top5[0].newA * 100 : 0) + '%', background: '#7F77DD', borderRadius: '2px' }}/>
                              </div>
                            </div>
                            <span style={{ fontSize: '14px', fontWeight: 800, color: '#7F77DD', flexShrink: 0 }}>{s.newA}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={card}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a1040', margin: '0 0 14px' }}>📈 Рост vs {labelB}</p>
                    {topGrowth.length === 0 ? <p style={{ color: '#9B97CC', fontSize: '12px', textAlign: 'center', paddingTop: '16px' }}>Нет данных для сравнения</p>
                      : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {topGrowth.map(s => (
                            <div key={s.sku} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#F0FDF4', borderRadius: '10px' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1040', margin: 0 }}>{s.sku}</p>
                                <p style={{ fontSize: '10px', color: '#9B97CC', margin: 0 }}>{s.newB} → {s.newA} заказов</p>
                              </div>
                              <span style={{ fontSize: '12px', fontWeight: 800, color: '#16A34A', background: '#DCFCE7', padding: '2px 8px', borderRadius: '20px', flexShrink: 0 }}>+{s.diffPct}%</span>
                            </div>
                          ))}
                        </div>}
                  </div>

                  <div style={card}>
                    <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a1040', margin: '0 0 14px' }}>📉 Падение vs {labelB}</p>
                    {topDrop.length === 0 ? <p style={{ color: '#9B97CC', fontSize: '12px', textAlign: 'center', paddingTop: '16px' }}>Нет данных для сравнения</p>
                      : <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          {topDrop.map(s => (
                            <div key={s.sku} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: '#FFF5F5', borderRadius: '10px', border: '1px solid #FEE2E2' }}>
                              <div style={{ flex: 1, minWidth: 0 }}>
                                <p style={{ fontSize: '12px', fontWeight: 600, color: '#1a1040', margin: 0 }}>{s.sku}</p>
                                <p style={{ fontSize: '10px', color: '#9B97CC', margin: 0 }}>{s.newB} → {s.newA} заказов</p>
                              </div>
                              <span style={{ fontSize: '12px', fontWeight: 800, color: '#DC2626', background: '#FEE2E2', padding: '2px 8px', borderRadius: '20px', flexShrink: 0 }}>{s.diffPct}%</span>
                            </div>
                          ))}
                        </div>}
                  </div>
                </div>

                {/* Мини-график */}
                <div style={card}>
                  <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a1040', margin: '0 0 14px' }}>📊 Новые заказы по часам — {labelA} vs {labelB}</p>
                  <ResponsiveContainer width="100%" height={200}>
                    <AreaChart data={hourlyData}>
                      <defs>
                        <linearGradient id="gA" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#7F77DD" stopOpacity={0.3}/><stop offset="95%" stopColor="#7F77DD" stopOpacity={0}/></linearGradient>
                        <linearGradient id="gB" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#93C5FD" stopOpacity={0.3}/><stop offset="95%" stopColor="#93C5FD" stopOpacity={0}/></linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#F3F0FF"/>
                      <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#9B97CC' }} interval={2}/>
                      <YAxis tick={{ fontSize: 9, fill: '#9B97CC' }}/>
                      <Tooltip contentStyle={{ background: 'white', border: '1px solid #EDE9FE', borderRadius: '10px', fontSize: '12px' }}/>
                      <Legend wrapperStyle={{ fontSize: '11px' }}/>
                      <Area type="monotone" dataKey="Период A" stroke="#7F77DD" fill="url(#gA)" strokeWidth={2}/>
                      <Area type="monotone" dataKey="Период B" stroke="#93C5FD" fill="url(#gB)" strokeWidth={2}/>
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </>
            )}

            {/* ─── ПО ЧАСАМ ────────────────────────────────────────────────── */}
            {tab === 'hours' && (
              <div style={card}>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#1a1040', margin: '0 0 16px' }}>Новые заказы по часам — {labelA} vs {labelB}</p>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={hourlyData} barSize={12}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F0FF"/>
                    <XAxis dataKey="hour" tick={{ fontSize: 10, fill: '#9B97CC' }}/>
                    <YAxis tick={{ fontSize: 10, fill: '#9B97CC' }}/>
                    <Tooltip contentStyle={{ background: 'white', border: '1px solid #EDE9FE', borderRadius: '10px', fontSize: '12px' }}/>
                    <Legend wrapperStyle={{ fontSize: '12px' }}/>
                    <Bar dataKey="Период A" fill="#7F77DD" radius={[4, 4, 0, 0]}/>
                    <Bar dataKey="Период B" fill="#93C5FD" radius={[4, 4, 0, 0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}

            {/* ─── ПО АРТИКУЛАМ ─────────────────────────────────────────────── */}
            {tab === 'skus' && (
              <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
                <div style={{ padding: '14px 20px', borderBottom: '1px solid #F3F0FF', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <p style={{ fontSize: '14px', fontWeight: 700, color: '#1a1040', margin: 0 }}>Все артикулы — {labelA}</p>
                  <p style={{ fontSize: '11px', color: '#9B97CC', margin: 0 }}>{skuStats.filter(s => s.newA > 0 || s.newB > 0).length} артикулов</p>
                </div>
                <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                  <thead>
                    <tr style={{ background: '#F8F7FF' }}>
                      {['Артикул', 'Создан A', 'Создан B', 'Δ', 'Выкуплен A', 'Отказ A'].map(h => (
                        <th key={h} style={{ padding: '10px 14px', fontSize: '10px', fontWeight: 700, color: '#9B97CC', textTransform: 'uppercase', textAlign: h === 'Артикул' ? 'left' : 'center', borderBottom: '1px solid #F3F0FF' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {skuStats.filter(s => s.newA > 0 || s.newB > 0).map((s, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid #F9F8FF' }}
                        onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F8F7FF'}
                        onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                        <td style={{ padding: '10px 14px', fontSize: '12px', fontWeight: 700, color: '#1a1040' }}>{s.sku}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: '14px', fontWeight: 700, color: '#7F77DD' }}>{s.newA}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: '14px', fontWeight: 700, color: '#2563EB' }}>{s.newB}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center' }}>
                          <span style={{ fontSize: '12px', fontWeight: 700, color: s.diff > 0 ? '#16A34A' : s.diff < 0 ? '#DC2626' : '#9B97CC', background: s.diff > 0 ? '#DCFCE7' : s.diff < 0 ? '#FEE2E2' : '#F3F4F6', padding: '2px 8px', borderRadius: '20px' }}>
                            {s.diff > 0 ? '+' : ''}{s.diff}
                          </span>
                        </td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: '#16A34A' }}>{s.buyA}</td>
                        <td style={{ padding: '10px 14px', textAlign: 'center', fontSize: '13px', fontWeight: 700, color: '#DC2626' }}>{s.rejA}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {/* ─── ПО ДНЯМ ──────────────────────────────────────────────────── */}
            {tab === 'days' && (
              <div style={card}>
                <p style={{ fontSize: '14px', fontWeight: 700, color: '#1a1040', margin: '0 0 16px' }}>Заказы по дням и статусам</p>
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={dayData} barSize={14}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F0FF"/>
                    <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#9B97CC' }}/>
                    <YAxis tick={{ fontSize: 11, fill: '#9B97CC' }}/>
                    <Tooltip contentStyle={{ background: 'white', border: '1px solid #EDE9FE', borderRadius: '10px', fontSize: '12px' }}/>
                    <Legend wrapperStyle={{ fontSize: '12px' }}/>
                    <Bar dataKey="Создан A"   fill="#7F77DD" radius={[4, 4, 0, 0]}/>
                    <Bar dataKey="Выкуплен A" fill="#16A34A" radius={[4, 4, 0, 0]}/>
                    <Bar dataKey="Отказ A"    fill="#FCA5A5" radius={[4, 4, 0, 0]}/>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
