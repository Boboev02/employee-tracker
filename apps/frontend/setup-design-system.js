const fs = require('fs');
const path = require('path');
const home = require('os').homedir();
const base = home + '/employee-tracker/apps/frontend';

function write(p, c) {
  const full = base + '/' + p;
  fs.mkdirSync(path.dirname(full), { recursive: true });
  fs.writeFileSync(full, c);
  console.log('✓', p);
}

// ─── 1. DESIGN TOKENS (lib/ds.ts) ────────────────────────────
write('lib/ds.ts', `// ── Единая дизайн-система ──────────────────────────────────────
// Используй эти константы во всех страницах

export const C = {
  // Backgrounds
  bgPrimary:   'var(--bg-primary)',
  bgSecondary: 'var(--bg-secondary)',
  bgTertiary:  'var(--bg-tertiary)',
  // Text
  textPrimary:   'var(--text-primary)',
  textSecondary: 'var(--text-secondary)',
  textMuted:     'var(--text-muted)',
  // Border
  border:       'var(--border)',
  borderStrong: 'var(--border-strong)',
  // Accents
  accent:      'var(--accent)',
  accentBg:    'var(--accent-bg)',
  // Semantic
  green:     'var(--green)',   greenBg:  'var(--green-bg)',
  blue:      'var(--blue)',    blueBg:   'var(--blue-bg)',
  orange:    'var(--orange)',  orangeBg: 'var(--orange-bg)',
  red:       'var(--red)',     redBg:    'var(--red-bg)',
  yellow:    'var(--yellow)',  yellowBg: 'var(--yellow-bg)',
} as const;

// ── Общие стили компонентов ──────────────────────────────────
export const S = {
  card: {
    background: C.bgPrimary,
    border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '16px',
  } as React.CSSProperties,

  cardCompact: {
    background: C.bgPrimary,
    border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius)',
    padding: '12px',
  } as React.CSSProperties,

  tableWrapper: {
    background: C.bgPrimary,
    border: '0.5px solid var(--border)',
    borderRadius: 'var(--radius)',
    overflow: 'hidden' as const,
  } as React.CSSProperties,

  tableHeader: {
    padding: '10px 16px',
    fontSize: '11px',
    fontWeight: 600,
    color: C.textMuted,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.05em',
    background: C.bgSecondary,
    borderBottom: '0.5px solid var(--border)',
    textAlign: 'left' as const,
    whiteSpace: 'nowrap' as const,
  } as React.CSSProperties,

  tableCell: {
    padding: '12px 16px',
    borderBottom: '0.5px solid var(--border)',
    fontSize: '13px',
    color: C.textPrimary,
    verticalAlign: 'middle' as const,
  } as React.CSSProperties,

  input: {
    width: '100%',
    background: C.bgSecondary,
    border: '0.5px solid var(--border-strong)',
    borderRadius: '8px',
    padding: '8px 12px',
    fontSize: '13px',
    color: C.textPrimary,
    outline: 'none',
  } as React.CSSProperties,

  select: {
    background: C.bgSecondary,
    border: '0.5px solid var(--border-strong)',
    borderRadius: '8px',
    padding: '7px 10px',
    fontSize: '12px',
    color: C.textPrimary,
    outline: 'none',
  } as React.CSSProperties,

  btnPrimary: {
    background: 'var(--accent)',
    color: 'white',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  } as React.CSSProperties,

  btnSecondary: {
    background: 'var(--bg-secondary)',
    color: 'var(--text-secondary)',
    border: '0.5px solid var(--border)',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  } as React.CSSProperties,

  btnDanger: {
    background: 'var(--red-bg)',
    color: 'var(--red)',
    border: 'none',
    padding: '8px 16px',
    borderRadius: '8px',
    fontSize: '13px',
    fontWeight: 500,
    cursor: 'pointer',
  } as React.CSSProperties,

  pageHeader: {
    background: C.bgPrimary,
    borderBottom: '0.5px solid var(--border)',
    padding: '14px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky' as const,
    top: 0,
    zIndex: 10,
  } as React.CSSProperties,

  pageContent: {
    padding: '20px 24px',
    display: 'flex' as const,
    flexDirection: 'column' as const,
    gap: '14px',
  } as React.CSSProperties,

  emptyState: {
    textAlign: 'center' as const,
    padding: '48px',
    color: C.textMuted,
    fontSize: '13px',
  } as React.CSSProperties,

  loading: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '200px',
    color: C.textMuted,
    fontSize: '13px',
  } as React.CSSProperties,
} as const;

// ── Статусы задач ────────────────────────────────────────────
export const TASK_STATUS: Record<string, { bg: string; color: string; label: string }> = {
  NEW:         { bg:'var(--bg-secondary)',  color:'var(--text-muted)',  label:'Новая' },
  IN_PROGRESS: { bg:'var(--blue-bg)',       color:'var(--blue)',        label:'В работе' },
  REVIEW:      { bg:'var(--orange-bg)',     color:'var(--orange)',      label:'Проверка' },
  DONE:        { bg:'var(--green-bg)',      color:'var(--green)',       label:'Готово' },
  BLOCKED:     { bg:'var(--red-bg)',        color:'var(--red)',         label:'Заблок.' },
};

export const TASK_PRIORITY: Record<string, { color: string; bg: string; label: string }> = {
  LOW:      { color:'var(--text-muted)',  bg:'var(--bg-secondary)',  label:'Низкий' },
  MEDIUM:   { color:'var(--blue)',        bg:'var(--blue-bg)',       label:'Средний' },
  HIGH:     { color:'var(--orange)',      bg:'var(--orange-bg)',     label:'Высокий' },
  CRITICAL: { color:'var(--red)',         bg:'var(--red-bg)',        label:'Критич.' },
};

// ── Роли сотрудников ─────────────────────────────────────────
export const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  ADMIN:    { bg:'var(--accent-bg)',  color:'var(--accent)' },
  MANAGER:  { bg:'var(--blue-bg)',   color:'var(--blue)' },
  EMPLOYEE: { bg:'var(--green-bg)',  color:'var(--green)' },
  VIEWER:   { bg:'var(--bg-secondary)', color:'var(--text-muted)' },
  HR:       { bg:'var(--orange-bg)', color:'var(--orange)' },
};

// ── Платформы ────────────────────────────────────────────────
export const PLATFORM_STYLE: Record<string, { color: string; bg: string; label: string }> = {
  WILDBERRIES: { color:'var(--accent)', bg:'rgba(139,124,246,0.12)', label:'Wildberries' },
  OZON:        { color:'var(--blue)',   bg:'rgba(77,157,224,0.12)',  label:'Ozon' },
  OTHER:       { color:'var(--text-muted)', bg:'var(--bg-secondary)', label:'Прочее' },
};

// ── Разделы маркетплейсов ────────────────────────────────────
export const SECTION_LABELS: Record<string, string> = {
  orders:'Заказы', feedbacks:'Отзывы', reviews:'Отзывы', questions:'Вопросы',
  products:'Товары', prices:'Цены', stocks:'Остатки', remains:'Остатки',
  supplies:'Поставки', supply:'Поставки', advertising:'Реклама',
  analytics:'Аналитика', finance:'Финансы', chat:'Чат', fintech:'Финансы',
  promotions:'Акции', promotion:'Продвижение', logistics:'Логистика',
  rating:'Рейтинг', knowledge:'База знаний', other:'Прочее',
};

// ── Хелперы ──────────────────────────────────────────────────
export function fmtTime(sec: number): string {
  if (!sec || sec <= 0) return '—';
  if (sec < 60) return sec + 'с';
  if (sec < 3600) return Math.floor(sec/60) + 'м ' + (sec%60) + 'с';
  return Math.floor(sec/3600) + 'ч ' + Math.floor((sec%3600)/60) + 'м';
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('ru', { day:'numeric', month:'short' });
}

export function timeAgo(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (diff < 1) return 'только что';
  if (diff < 60) return diff + 'м назад';
  if (diff < 1440) return Math.floor(diff/60) + 'ч назад';
  return Math.floor(diff/1440) + 'д назад';
}
`);

// ─── 2. SHARED PAGE HEADER COMPONENT ────────────────────────
write('components/layouts/PageHeader.tsx', `import React from 'react';

interface Props {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions, filters }: Props) {
  return (
    <div style={{ background:'var(--bg-primary)', borderBottom:'0.5px solid var(--border)', padding:'14px 24px', position:'sticky', top:0, zIndex:10 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: filters ? '12px' : 0 }}>
        <div>
          <h1 style={{ fontSize:'16px', fontWeight:600, color:'var(--text-primary)', margin:0 }}>{title}</h1>
          {subtitle && <p style={{ fontSize:'12px', color:'var(--text-muted)', margin:'2px 0 0' }}>{subtitle}</p>}
        </div>
        {actions && <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>{actions}</div>}
      </div>
      {filters && <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>{filters}</div>}
    </div>
  );
}
`);

// ─── 3. SHARED COMPONENTS ────────────────────────────────────
write('components/ui/Badge.tsx', `import React from 'react';

interface Props {
  label: string;
  bg: string;
  color: string;
  size?: 'sm' | 'md';
}

export function Badge({ label, bg, color, size = 'md' }: Props) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: size === 'sm' ? '10px' : '11px',
      fontWeight: 500,
      padding: size === 'sm' ? '2px 6px' : '3px 8px',
      borderRadius: '20px',
      background: bg,
      color,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}
`);

// ─── 4. UPDATE EMPLOYEES PAGE ────────────────────────────────
let empPage = fs.readFileSync(base + '/app/dashboard/employees/page.tsx', 'utf8');

// Fix hardcoded role colors
empPage = empPage.replace(
  /const ROLE_STYLE[^=]+=\s*\{[\s\S]*?\};/,
  `import { ROLE_STYLE } from '@/lib/ds';`
);

// Fix hardcoded colors in role style if still present
if (empPage.includes("ADMIN:    { bg: 'rgba")) {
  empPage = empPage.replace(
    /const ROLE_STYLE[^=]+=\s*\{[\s\S]*?^};/m,
    ''
  );
}

fs.writeFileSync(base + '/app/dashboard/employees/page.tsx', empPage);
console.log('✓ employees/page.tsx patched');

// ─── 5. UPDATE GLOBALS.CSS – ensure all vars present ─────────
let globals = fs.readFileSync(base + '/app/globals.css', 'utf8');
// Ensure --radius is defined
if (!globals.includes('--radius:')) {
  globals = globals.replace(':root {', ':root {\n  --radius: 10px;\n  --radius-sm: 7px;');
  fs.writeFileSync(base + '/app/globals.css', globals);
  console.log('✓ globals.css patched with radius vars');
}

// ─── 6. UPDATE SETTINGS PAGE ─────────────────────────────────
let settingsPage = fs.readFileSync(base + '/app/dashboard/settings/page.tsx', 'utf8');
settingsPage = settingsPage.replace(
  /const selectStyle = \{[\s\S]*?\};/,
  `const selectStyle: React.CSSProperties = { width:'100%', background:'var(--bg-secondary)', border:'0.5px solid var(--border-strong)', borderRadius:'8px', padding:'8px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none' };`
);
fs.writeFileSync(base + '/app/dashboard/settings/page.tsx', settingsPage);
console.log('✓ settings/page.tsx patched');

// ─── 7. UPDATE EXPORT PAGE ───────────────────────────────────
let exportPage = fs.readFileSync(base + '/app/dashboard/export/page.tsx', 'utf8');
// Make period buttons consistent
exportPage = exportPage.replace(
  /background: period === p\.v \? 'var\(--accent\)' : 'var\(--bg-secondary\)'/g,
  `background: period === p.v ? 'var(--accent)' : 'var(--bg-secondary)'`
);
fs.writeFileSync(base + '/app/dashboard/export/page.tsx', exportPage);
console.log('✓ export/page.tsx patched');

// ─── 8. UPDATE TASKS PAGE – unified colors ────────────────────
let tasksPage = fs.readFileSync(base + '/app/dashboard/tasks/page.tsx', 'utf8');
tasksPage = tasksPage.replace(
  /const STATUS_COLS = \[[\s\S]*?\];/,
  `const STATUS_COLS = [
  { id: 'NEW',         label: 'Новые',         color: 'var(--text-muted)', dot: 'var(--text-muted)' },
  { id: 'IN_PROGRESS', label: 'В работе',      color: 'var(--blue)',       dot: 'var(--blue)' },
  { id: 'REVIEW',      label: 'Проверка',      color: 'var(--orange)',     dot: 'var(--orange)' },
  { id: 'BLOCKED',     label: 'Заблокировано', color: 'var(--red)',        dot: 'var(--red)' },
  { id: 'DONE',        label: 'Готово',        color: 'var(--green)',      dot: 'var(--green)' },
];`
);
tasksPage = tasksPage.replace(
  /const PRIORITY_STYLE[^=]*=\s*\{[\s\S]*?^};/m,
  `const PRIORITY_STYLE: Record<string, { color: string; label: string }> = {
  LOW:      { color: 'var(--text-muted)', label: 'Низкий' },
  MEDIUM:   { color: 'var(--blue)',       label: 'Средний' },
  HIGH:     { color: 'var(--orange)',     label: 'Высокий' },
  CRITICAL: { color: 'var(--red)',        label: 'Критич.' },
};`
);
fs.writeFileSync(base + '/app/dashboard/tasks/page.tsx', tasksPage);
console.log('✓ tasks/page.tsx patched');

// ─── 9. UPDATE PRODUCTIVITY PAGE – unified colors ────────────
let prodPage = fs.readFileSync(base + '/app/dashboard/productivity/page.tsx', 'utf8');
prodPage = prodPage.replace(
  /const GRADE_STYLE[^=]*=\s*\{[\s\S]*?^};/m,
  `const GRADE_STYLE: Record<string, { bg: string; color: string }> = {
  A: { bg: 'var(--green-bg)',  color: 'var(--green)' },
  B: { bg: 'var(--blue-bg)',   color: 'var(--blue)' },
  C: { bg: 'var(--yellow-bg)', color: 'var(--yellow)' },
  D: { bg: 'var(--orange-bg)', color: 'var(--orange)' },
  F: { bg: 'var(--red-bg)',    color: 'var(--red)' },
};`
);
fs.writeFileSync(base + '/app/dashboard/productivity/page.tsx', prodPage);
console.log('✓ productivity/page.tsx patched');

// ─── 10. UPDATE ANALYTICS PAGE – unified colors ──────────────
let analyticsPage = fs.readFileSync(base + '/app/dashboard/analytics/page.tsx', 'utf8');
analyticsPage = analyticsPage.replace(
  /const STATUS_COLORS[^=]*=\s*\{[^}]*\};/,
  `const STATUS_COLORS: Record<string, string> = { NEW:'var(--text-muted)', IN_PROGRESS:'var(--blue)', REVIEW:'var(--orange)', DONE:'var(--green)', OVERDUE:'var(--red)', BLOCKED:'var(--accent)' };`
);
analyticsPage = analyticsPage.replace(
  /const PRIORITY_COLORS[^=]*=\s*\{[^}]*\};/,
  `const PRIORITY_COLORS: Record<string, string> = { CRITICAL:'var(--red)', HIGH:'var(--orange)', MEDIUM:'var(--blue)', LOW:'var(--text-muted)' };`
);
analyticsPage = analyticsPage.replace(
  /const PLATFORM_COLORS[^=]*=\s*\{[^}]*\};/,
  `const PLATFORM_COLORS: Record<string, string> = { WILDBERRIES:'var(--accent)', OZON:'var(--blue)', OTHER:'var(--text-muted)' };`
);
fs.writeFileSync(base + '/app/dashboard/analytics/page.tsx', analyticsPage);
console.log('✓ analytics/page.tsx patched');

// ─── 11. UPDATE TIMESHEET – unified colors ────────────────────
let timesheetPage = fs.readFileSync(base + '/app/dashboard/timesheet/page.tsx', 'utf8');
timesheetPage = timesheetPage.replace(
  /const STATUS_STYLE[^=]*=\s*\{[\s\S]*?^};/m,
  `const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  present:     { label:'Присутствует', color:'var(--green)',  bg:'var(--green-bg)' },
  late:        { label:'Опоздание',    color:'var(--yellow)', bg:'var(--yellow-bg)' },
  early_leave: { label:'Ранний уход',  color:'var(--orange)', bg:'var(--orange-bg)' },
  absent:      { label:'Отсутствует',  color:'var(--red)',    bg:'var(--red-bg)' },
  weekend:     { label:'Выходной',     color:'var(--text-muted)', bg:'var(--bg-secondary)' },
  no_data:     { label:'—',            color:'var(--text-muted)', bg:'transparent' },
};`
);
fs.writeFileSync(base + '/app/dashboard/timesheet/page.tsx', timesheetPage);
console.log('✓ timesheet/page.tsx patched');

console.log('\n✅ Design system unified across all pages');
