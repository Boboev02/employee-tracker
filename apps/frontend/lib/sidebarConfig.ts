/**
 * Персональная раскладка сайдбара.
 *
 * Важно про гидрацию: первый рендер на сервере и на клиенте обязан совпадать,
 * поэтому Sidebar стартует с DEFAULT_CONFIG, а личная раскладка подставляется
 * только после монтирования (из localStorage мгновенно, затем из API).
 */

export type SidebarItem = { href: string; icon: string; label: string; admin: boolean };
export type SidebarGroup = { id: string; label: string; icon: string; items: string[]; collapsed?: boolean };
export type SidebarConfig = { pinned: string[]; groups: SidebarGroup[]; hidden: string[] };

/** Реестр всех разделов системы. Ключ — href. */
export const REGISTRY: Record<string, SidebarItem> = {
  '/dashboard':                        { href: '/dashboard',                        icon: 'ti-layout-dashboard',        label: 'Дашборд',          admin: false },
  '/dashboard/home':                   { href: '/dashboard/home',                   icon: 'ti-home',                    label: 'Мои задачи',       admin: false },
  '/dashboard/command-center':         { href: '/dashboard/command-center',         icon: 'ti-topology-star-3',         label: 'Command Center',   admin: false },
  '/dashboard/chat':                   { href: '/dashboard/chat',                   icon: 'ti-message-circle',          label: 'Чат',              admin: false },

  '/dashboard/tasks':                  { href: '/dashboard/tasks',                  icon: 'ti-checkbox',                label: 'Задачи',           admin: false },
  '/dashboard/projects':               { href: '/dashboard/projects',               icon: 'ti-layout-kanban',           label: 'Проекты',          admin: false },
  '/dashboard/products':               { href: '/dashboard/products',               icon: 'ti-package',                 label: 'Карточки товаров', admin: false },
  '/dashboard/knowledge':              { href: '/dashboard/knowledge',              icon: 'ti-book',                    label: 'База знаний',      admin: false },
  '/dashboard/routines':               { href: '/dashboard/routines',               icon: 'ti-repeat',                  label: 'Рутины',           admin: false },

  '/dashboard/employees':              { href: '/dashboard/employees',              icon: 'ti-users',                   label: 'Сотрудники',       admin: false },
  '/dashboard/calls':                  { href: '/dashboard/calls',                  icon: 'ti-video',                   label: 'Видеозвонки',      admin: false },
  '/dashboard/timesheet':              { href: '/dashboard/timesheet',              icon: 'ti-calendar',                label: 'Табель',           admin: false },
  '/dashboard/teams':                  { href: '/dashboard/teams',                  icon: 'ti-tag',                     label: 'Команды',          admin: true  },
  '/dashboard/productivity':           { href: '/dashboard/productivity',           icon: 'ti-star',                    label: 'Продуктивность',   admin: true  },

  '/dashboard/analytics':              { href: '/dashboard/analytics',              icon: 'ti-chart-bar',               label: 'Аналитика',        admin: false },
  '/dashboard/sales':                  { href: '/dashboard/sales',                  icon: 'ti-chart-arrows',            label: 'Продажи WB',       admin: true  },
  '/dashboard/reviews':                { href: '/dashboard/reviews',                icon: 'ti-star',                    label: 'Отзывы WB',        admin: true  },
  '/dashboard/kpi':                    { href: '/dashboard/kpi',                    icon: 'ti-target',                  label: 'KPI',              admin: true  },
  '/dashboard/reports':                { href: '/dashboard/reports',                icon: 'ti-file-report',             label: 'Отчёты и экспорт', admin: true  },

  '/dashboard/subscribers':            { href: '/dashboard/subscribers',            icon: 'ti-users-group',             label: 'CRM · Подписчики', admin: false },
  '/dashboard/notebook':               { href: '/dashboard/notebook',               icon: 'ti-notebook',                label: 'Мой блокнот',      admin: false },

  '/dashboard/dictionaries':           { href: '/dashboard/dictionaries',           icon: 'ti-list-details',            label: 'Справочники',      admin: true  },
  '/dashboard/settings/custom-fields': { href: '/dashboard/settings/custom-fields', icon: 'ti-adjustments-horizontal',  label: 'Поля задач',       admin: true  },
  '/dashboard/settings':               { href: '/dashboard/settings',               icon: 'ti-settings',                label: 'Настройки',        admin: true  },
  '/dashboard/audit':                  { href: '/dashboard/audit',                  icon: 'ti-shield-lock',             label: 'Журнал действий',  admin: true  },
};

/** Иконки, доступные для пользовательских групп. */
export const GROUP_ICONS = [
  'ti-folder', 'ti-briefcase', 'ti-users', 'ti-chart-bar', 'ti-package',
  'ti-settings', 'ti-star', 'ti-rocket', 'ti-bulb', 'ti-flame',
  'ti-target', 'ti-building-store', 'ti-book', 'ti-tools', 'ti-calendar',
];

export const DEFAULT_CONFIG: SidebarConfig = {
  pinned: ['/dashboard', '/dashboard/home'],
  groups: [
    {
      id: 'work', label: 'Работа', icon: 'ti-briefcase',
      items: ['/dashboard/tasks', '/dashboard/projects', '/dashboard/products', '/dashboard/knowledge'],
    },
    {
      id: 'team', label: 'Команда', icon: 'ti-users',
      items: ['/dashboard/employees', '/dashboard/calls', '/dashboard/timesheet', '/dashboard/routines'],
    },
    {
      id: 'analytics', label: 'Аналитика', icon: 'ti-chart-bar', collapsed: true,
      items: ['/dashboard/analytics', '/dashboard/sales', '/dashboard/reviews', '/dashboard/kpi', '/dashboard/reports'],
    },
    {
      id: 'admin', label: 'Администрирование', icon: 'ti-settings', collapsed: true,
      items: ['/dashboard/dictionaries', '/dashboard/settings/custom-fields', '/dashboard/settings', '/dashboard/audit'],
    },
  ],
  hidden: ['/dashboard/command-center', '/dashboard/chat', '/dashboard/subscribers', '/dashboard/notebook', '/dashboard/teams', '/dashboard/productivity'],
};

const LS_KEY = 'sidebar_config_v2';

/** Приводит конфиг к валидному виду: выкидывает удалённые разделы, добавляет новые. */
export function normalize(raw: any): SidebarConfig {
  const base: SidebarConfig = {
    pinned: Array.isArray(raw?.pinned) ? raw.pinned.filter((h: string) => REGISTRY[h]) : [],
    groups: Array.isArray(raw?.groups)
      ? raw.groups
          .filter((g: any) => g && typeof g.id === 'string')
          .map((g: any) => ({
            id: String(g.id),
            label: String(g.label ?? 'Без названия'),
            icon: String(g.icon ?? 'ti-folder'),
            collapsed: Boolean(g.collapsed),
            items: Array.isArray(g.items) ? g.items.filter((h: string) => REGISTRY[h]) : [],
          }))
      : [],
    hidden: Array.isArray(raw?.hidden) ? raw.hidden.filter((h: string) => REGISTRY[h]) : [],
  };

  // разделы, которых нет ни в одной корзине (например, появились после обновления)
  const placed = new Set([...base.pinned, ...base.hidden, ...base.groups.flatMap(g => g.items)]);
  const orphans = Object.keys(REGISTRY).filter(h => !placed.has(h));
  if (orphans.length) {
    const target = base.groups[0];
    if (target) target.items.push(...orphans);
    else base.pinned.push(...orphans);
  }
  return base;
}

export function readCache(): SidebarConfig | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.localStorage.getItem(LS_KEY);
    return raw ? normalize(JSON.parse(raw)) : null;
  } catch {
    return null;
  }
}

export function writeCache(config: SidebarConfig) {
  if (typeof window === 'undefined') return;
  try { window.localStorage.setItem(LS_KEY, JSON.stringify(config)); } catch {}
}

export function clearCache() {
  if (typeof window === 'undefined') return;
  try { window.localStorage.removeItem(LS_KEY); } catch {}
}

export async function fetchConfig(token: string): Promise<SidebarConfig | null> {
  try {
    const r = await fetch('/api/v1/users/sidebar', { headers: { Authorization: 'Bearer ' + token } });
    if (!r.ok) return null;
    const d = await r.json();
    return d?.config ? normalize(d.config) : null;
  } catch {
    return null;
  }
}

export async function saveConfig(token: string, config: SidebarConfig) {
  writeCache(config);
  try {
    await fetch('/api/v1/users/sidebar', {
      method: 'PUT',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({ config }),
    });
  } catch {}
}

export async function resetConfig(token: string) {
  clearCache();
  try {
    await fetch('/api/v1/users/sidebar', { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
  } catch {}
}
