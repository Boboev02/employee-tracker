// ── Единая дизайн-система ──────────────────────────────────────
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
