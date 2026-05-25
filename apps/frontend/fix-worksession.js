const fs = require('fs');
const home = require('os').homedir();
const base = home + '/employee-tracker/apps/frontend';

// ─── 1. ПОЛНЫЙ WorkSessionWidget для всех ролей ───────────────
fs.writeFileSync(base + '/components/WorkSessionWidget.tsx', `'use client';
import { useEffect, useState, useCallback } from 'react';

interface Props { token: string; compact?: boolean; }

function fmtDuration(ms: number): string {
  if (ms <= 0) return '0м';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return h + 'ч ' + m + 'м';
  return m + 'м';
}

const API = 'https://employee-tracker.ru';

export function WorkSessionWidget({ token, compact = false }: Props) {
  const [session, setSession]   = useState<any>(null);
  const [elapsed, setElapsed]   = useState(0);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(API + '/api/v1/work-session/me', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.ok) {
        const data = await res.json();
        setSession(data);
        setError('');
      }
    } catch { setError('Нет соединения'); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Таймер — обновляем каждые 30 сек
  useEffect(() => {
    if (!session?.startedAt || session.status === 'finished') return;
    const tick = () => {
      const start    = new Date(session.startedAt).getTime();
      const breakMs  = (session.totalBreakMs ?? 0) +
        (session.status === 'break' && session.breakAt
          ? Date.now() - new Date(session.breakAt).getTime()
          : 0);
      setElapsed(Math.max(0, Date.now() - start - breakMs));
    };
    tick();
    const iv = setInterval(tick, 30000);
    return () => clearInterval(iv);
  }, [session]);

  const action = async (endpoint: string) => {
    setLoading(true); setError('');
    try {
      const res = await fetch(API + '/api/v1/work-session/' + endpoint, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.ok) await load();
      else setError('Ошибка сервера');
    } catch { setError('Нет соединения'); }
    finally { setLoading(false); }
  };

  const status = session?.status ?? null;

  // Цвета статуса
  const statusColor = status === 'working' ? 'var(--green)'
    : status === 'break' ? 'var(--orange)'
    : status === 'finished' ? 'var(--text-muted)'
    : 'var(--text-muted)';

  const statusLabel = status === 'working' ? 'Рабочий день идёт'
    : status === 'break' ? 'Перерыв'
    : status === 'finished' ? 'День завершён'
    : 'Рабочий день не начат';

  if (compact) {
    // Компактный вид для сайдбара или хедера
    return (
      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:statusColor, flexShrink:0 }} />
        <span style={{ fontSize:'12px', color:'var(--text-secondary)' }}>{statusLabel}</span>
        {status === null && (
          <button onClick={() => action('start')} disabled={loading}
            style={{ fontSize:'11px', color:'var(--green)', background:'var(--green-bg)', border:'none', padding:'2px 8px', borderRadius:'6px', cursor:'pointer' }}>
            Начать
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ background:'var(--bg-primary)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 20px', display:'flex', alignItems:'center', gap:'16px', flexWrap:'wrap' }}>
      {/* Иконка + статус */}
      <div style={{ display:'flex', alignItems:'center', gap:'10px', flex:1, minWidth:'200px' }}>
        <div style={{ width:'36px', height:'36px', borderRadius:'50%', background: status === 'working' ? 'var(--green-bg)' : status === 'break' ? 'var(--orange-bg)' : 'var(--bg-secondary)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <i className={'ti ' + (status === 'working' ? 'ti-player-play' : status === 'break' ? 'ti-player-pause' : status === 'finished' ? 'ti-check' : 'ti-clock')}
            style={{ fontSize:'16px', color:statusColor }} aria-hidden="true" />
        </div>
        <div>
          <p style={{ fontSize:'13px', fontWeight:500, color:'var(--text-primary)', margin:'0 0 2px' }}>{statusLabel}</p>
          <p style={{ fontSize:'11px', color:'var(--text-muted)', margin:0 }}>
            {status === 'working' && elapsed > 0 && 'Активное время: ' + fmtDuration(elapsed)}
            {status === 'break' && 'На перерыве'}
            {status === 'finished' && session?.startedAt && 'Итого: ' + fmtDuration(elapsed)}
            {status === null && 'Нажмите «Начать» чтобы отметить приход'}
          </p>
        </div>
      </div>

      {/* Кнопки */}
      <div style={{ display:'flex', gap:'8px', flexShrink:0 }}>
        {error && <span style={{ fontSize:'11px', color:'var(--red)', alignSelf:'center' }}>{error}</span>}

        {status === null && (
          <button onClick={() => action('start')} disabled={loading}
            style={{ background:'var(--green)', color:'white', border:'none', padding:'8px 16px', borderRadius:'8px', fontSize:'13px', fontWeight:500, cursor:'pointer', opacity: loading ? 0.7 : 1 }}>
            ▶ Начать день
          </button>
        )}

        {status === 'working' && (<>
          <button onClick={() => action('break')} disabled={loading}
            style={{ background:'var(--orange-bg)', color:'var(--orange)', border:'0.5px solid var(--orange)', padding:'8px 14px', borderRadius:'8px', fontSize:'13px', fontWeight:500, cursor:'pointer', opacity: loading ? 0.7 : 1 }}>
            ⏸ Перерыв
          </button>
          <button onClick={() => action('finish')} disabled={loading}
            style={{ background:'var(--red-bg)', color:'var(--red)', border:'0.5px solid var(--red)', padding:'8px 14px', borderRadius:'8px', fontSize:'13px', fontWeight:500, cursor:'pointer', opacity: loading ? 0.7 : 1 }}>
            ■ Завершить
          </button>
        </>)}

        {status === 'break' && (<>
          <button onClick={() => action('break-end')} disabled={loading}
            style={{ background:'var(--green)', color:'white', border:'none', padding:'8px 16px', borderRadius:'8px', fontSize:'13px', fontWeight:500, cursor:'pointer', opacity: loading ? 0.7 : 1 }}>
            ▶ Продолжить
          </button>
          <button onClick={() => action('finish')} disabled={loading}
            style={{ background:'var(--red-bg)', color:'var(--red)', border:'0.5px solid var(--red)', padding:'8px 14px', borderRadius:'8px', fontSize:'13px', fontWeight:500, cursor:'pointer', opacity: loading ? 0.7 : 1 }}>
            ■ Завершить
          </button>
        </>)}

        {status === 'finished' && (
          <span style={{ fontSize:'12px', color:'var(--green)', background:'var(--green-bg)', padding:'6px 12px', borderRadius:'8px' }}>
            ✓ День завершён
          </span>
        )}
      </div>
    </div>
  );
}
`);
console.log('✓ WorkSessionWidget.tsx updated');

// ─── 2. Dashboard - показывать WorkSession всем ───────────────
let dash = fs.readFileSync(base + '/app/dashboard/page.tsx', 'utf8');

// Убедимся что импорт есть
if (!dash.includes('WorkSessionWidget')) {
  dash = `import { WorkSessionWidget } from '@/components/WorkSessionWidget';\n` + dash;
}

// Показываем виджет всем (убираем условие isAdmin если есть)
dash = dash.replace(/\{token && isAdmin && <WorkSessionWidget/g, '{token && <WorkSessionWidget');
dash = dash.replace(/\{token && user\?\.isAdmin && <WorkSessionWidget/g, '{token && <WorkSessionWidget');

fs.writeFileSync(base + '/app/dashboard/page.tsx', dash);
console.log('✓ dashboard page.tsx updated');

// ─── 3. Fix MutationObserver leak in extension ───────────────
const extBase = require('os').homedir() + '/employee-tracker/apps/extension/src';
let wb = fs.readFileSync(extBase + '/content/wb-tracker.ts', 'utf8');

// Add observer cleanup
wb = wb.replace(
  `  protected attachSectionListeners() {
    this.sectionListeners.forEach(({ el, fn }) => el.removeEventListener('click', fn));
    this.sectionListeners = [];
    const section = this.detectSection();
    const config  = WB_SECTIONS[section];
    if (!config) return;
    const attach = () => {`,
  `  private sectionObserver: MutationObserver | null = null;

  protected attachSectionListeners() {
    this.sectionListeners.forEach(({ el, fn }) => el.removeEventListener('click', fn));
    this.sectionListeners = [];
    if (this.sectionObserver) { this.sectionObserver.disconnect(); this.sectionObserver = null; }
    const section = this.detectSection();
    const config  = WB_SECTIONS[section];
    if (!config) return;
    const attach = () => {`
);
wb = wb.replace(
  `    attach();
    new MutationObserver(attach).observe(document.body, { childList: true, subtree: true });
  }
}

try { new WbTracker().init(); }`,
  `    attach();
    this.sectionObserver = new MutationObserver(attach);
    this.sectionObserver.observe(document.body, { childList: true, subtree: true });
  }
}

try { new WbTracker().init(); }`
);
fs.writeFileSync(extBase + '/content/wb-tracker.ts', wb);
console.log('✓ wb-tracker.ts MutationObserver fixed');

// Same fix for ozon
let oz = fs.readFileSync(extBase + '/content/ozon-tracker.ts', 'utf8');
oz = oz.replace(
  `  protected attachSectionListeners() {
    this.sectionListeners.forEach(({ el, fn }) => el.removeEventListener('click', fn));
    this.sectionListeners = [];
    const section = this.detectSection();
    const config  = OZON_SECTIONS[section];
    if (!config) return;
    const attach = () => {`,
  `  private sectionObserver: MutationObserver | null = null;

  protected attachSectionListeners() {
    this.sectionListeners.forEach(({ el, fn }) => el.removeEventListener('click', fn));
    this.sectionListeners = [];
    if (this.sectionObserver) { this.sectionObserver.disconnect(); this.sectionObserver = null; }
    const section = this.detectSection();
    const config  = OZON_SECTIONS[section];
    if (!config) return;
    const attach = () => {`
);
oz = oz.replace(
  `    attach();
    new MutationObserver(attach).observe(document.body, { childList: true, subtree: true });
  }
}

try { new OzonTracker().init(); }`,
  `    attach();
    this.sectionObserver = new MutationObserver(attach);
    this.sectionObserver.observe(document.body, { childList: true, subtree: true });
  }
}

try { new OzonTracker().init(); }`
);
fs.writeFileSync(extBase + '/content/ozon-tracker.ts', oz);
console.log('✓ ozon-tracker.ts MutationObserver fixed');

console.log('\n✅ All fixes applied');
