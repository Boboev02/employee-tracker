// Общие константы модуля CRM подписчиков.
// Вынесены в отдельный файл в рамках Этапа 14 (устранение дублирования кода) —
// раньше PLAN_LABELS/STATUS_LABELS/цвета были продублированы в 4 разных компонентах.

// Точные коды тарифов сверены напрямую с БД KingStats (reporting.users_overview) 10.07.2026:
// trial→TRIAL, basic→START(«Старт»), pro→PRO(«Профи»), standart→BUSINESS(«Бизнес»), premium→EXPERT(«Эксперт»)
export const PLAN_LABELS: Record<string, string> = { TRIAL: 'Пробный', START: 'Старт', PRO: 'Профи', BUSINESS: 'Бизнес', EXPERT: 'Эксперт', NONE: 'Нет подписки' };

export const PLAN_COLORS: Record<string, { bg: string; c: string }> = {
  TRIAL: { bg: '#FEF3C7', c: '#D97706' }, START: { bg: '#E0E7FF', c: '#4F46E5' }, PRO: { bg: '#DBEAFE', c: '#2563EB' },
  BUSINESS: { bg: '#DCFCE7', c: '#16A34A' }, EXPERT: { bg: '#FCE7F3', c: '#DB2777' }, NONE: { bg: '#F3F4F6', c: '#6B7280' },
};

export const STATUS_LABELS: Record<string, string> = {
  NEW: 'Новый', IN_PROGRESS: 'В работе', CONTACTED: 'Связались',
  RENEWED: 'Продлил', LOST: 'Потерян', ARCHIVED: 'В архиве',
};

export const STATUS_COLORS: Record<string, { bg: string; c: string }> = {
  NEW: { bg: '#EDE9FE', c: '#7F77DD' }, IN_PROGRESS: { bg: '#DBEAFE', c: '#2563EB' }, CONTACTED: { bg: '#FEF3C7', c: '#D97706' },
  RENEWED: { bg: '#DCFCE7', c: '#16A34A' }, LOST: { bg: '#FEE2E2', c: '#DC2626' }, ARCHIVED: { bg: '#F3F4F6', c: '#6B7280' },
};

/**
 * ⚠️ Примечание об архитектуре: с Этапа 10 CRM-статусы технически конфигурируемы через
 * /subscriber-settings/statuses (таблица SubscriberCrmStatusDef), но большинство UI-компонентов
 * всё ещё используют эту статичную константу STATUS_LABELS вместо динамической загрузки.
 * Полный перевод всех дропдаунов/цветовых меток на динамические статусы — следующий шаг
 * при необходимости (безопасно отложен, чтобы не трогать много файлов на финальном этапе).
 */
