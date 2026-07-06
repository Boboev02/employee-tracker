/**
 * Универсальный конструктор фильтров в духе ClickUp:
 * { conjunction: 'AND'|'OR', rules: [{ field, operator, value }] }
 * Конвертируется в Prisma `where`-условие для модели Task.
 */

export type FilterOperator =
  | 'IS' | 'IS_NOT' | 'IS_ANY_OF'
  | 'CONTAINS' | 'NOT_CONTAINS'
  | 'IS_EMPTY' | 'IS_NOT_EMPTY'
  | 'BEFORE' | 'AFTER';

export type FilterField =
  | 'status' | 'priority' | 'assigneeId' | 'departmentId' | 'projectId'
  | 'title' | 'description' | 'dueDate' | 'taskTypeId';

export interface FilterRule {
  field: FilterField;
  operator: FilterOperator;
  value?: any;
}

export interface FilterGroup {
  conjunction: 'AND' | 'OR';
  rules: FilterRule[];
}

const ENUM_FIELDS = new Set(['status', 'priority', 'departmentId', 'projectId', 'taskTypeId']);
const TEXT_FIELDS = new Set(['title', 'description']);
const DATE_FIELDS  = new Set(['dueDate']);

// Динамические диапазоны дат: TODAY | YESTERDAY | NEXT_7_DAYS | OVERDUE
function resolveDynamicDateRange(value: string): { gte?: Date; lte?: Date; lt?: Date } | null {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday    = new Date(startOfToday.getTime() + 86400000 - 1);

  switch (value) {
    case 'TODAY':
      return { gte: startOfToday, lte: endOfToday };
    case 'YESTERDAY': {
      const y = new Date(startOfToday.getTime() - 86400000);
      return { gte: y, lte: new Date(y.getTime() + 86400000 - 1) };
    }
    case 'NEXT_7_DAYS':
      return { gte: startOfToday, lte: new Date(startOfToday.getTime() + 7 * 86400000) };
    case 'OVERDUE':
      return { lt: startOfToday };
    default:
      return null;
  }
}

function buildRuleCondition(rule: FilterRule): Record<string, any> | null {
  const { field, operator, value } = rule;

  // ── Поля-перечисления (статус, приоритет, отдел, проект, тип) ──────────────
  if (ENUM_FIELDS.has(field)) {
    if (operator === 'IS_EMPTY') return { [field]: null };
    if (operator === 'IS_NOT_EMPTY') return { [field]: { not: null } };
    if (operator === 'IS') return { [field]: value };
    if (operator === 'IS_NOT') return { [field]: { not: value } };
    if (operator === 'IS_ANY_OF') return { [field]: { in: Array.isArray(value) ? value : [value] } };
    return null;
  }

  // ── Исполнитель — массивное поле assigneeIds ────────────────────────────────
  if (field === 'assigneeId') {
    if (operator === 'IS_EMPTY') return { assigneeIds: { isEmpty: true } };
    if (operator === 'IS_NOT_EMPTY') return { assigneeIds: { isEmpty: false } };
    if (operator === 'IS') return { assigneeIds: { has: value } };
    if (operator === 'IS_NOT') return { NOT: { assigneeIds: { has: value } } };
    if (operator === 'IS_ANY_OF') {
      const arr = Array.isArray(value) ? value : [value];
      return { OR: arr.map((v: string) => ({ assigneeIds: { has: v } })) };
    }
    return null;
  }

  // ── Текстовые поля ───────────────────────────────────────────────────────────
  if (TEXT_FIELDS.has(field)) {
    if (operator === 'IS_EMPTY') return { [field]: null };
    if (operator === 'IS_NOT_EMPTY') return { [field]: { not: null } };
    if (operator === 'CONTAINS') return { [field]: { contains: value, mode: 'insensitive' } };
    if (operator === 'NOT_CONTAINS') return { NOT: { [field]: { contains: value, mode: 'insensitive' } } };
    return null;
  }

  // ── Поля дат (с поддержкой динамических диапазонов) ─────────────────────────
  if (DATE_FIELDS.has(field)) {
    if (operator === 'IS_EMPTY') return { [field]: null };
    if (operator === 'IS_NOT_EMPTY') return { [field]: { not: null } };
    if (operator === 'IS' && typeof value === 'string') {
      const range = resolveDynamicDateRange(value);
      if (range) return { [field]: range };
      const d = new Date(value);
      const next = new Date(d.getTime() + 86400000);
      return { [field]: { gte: d, lt: next } };
    }
    if (operator === 'BEFORE') return { [field]: { lt: new Date(value) } };
    if (operator === 'AFTER')  return { [field]: { gt: new Date(value) } };
    return null;
  }

  return null;
}

/**
 * Собирает Prisma-условие `where` из FilterGroup.
 * Возвращает null если фильтр пуст/некорректен.
 */
export function buildFilterWhere(group: FilterGroup | null | undefined): Record<string, any> | null {
  if (!group || !Array.isArray(group.rules) || group.rules.length === 0) return null;

  const conditions = group.rules
    .map(buildRuleCondition)
    .filter((c): c is Record<string, any> => c !== null);

  if (conditions.length === 0) return null;
  if (conditions.length === 1) return conditions[0];

  return group.conjunction === 'OR' ? { OR: conditions } : { AND: conditions };
}
