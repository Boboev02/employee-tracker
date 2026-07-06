// Универсальный движок фильтрации задач в стиле ClickUp: [Поле] → [Оператор] → [Значение], связки И/ИЛИ

export type FieldType = 'text' | 'enum' | 'date' | 'user';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: { value: string; label: string }[]; // для enum
}

export const FILTER_FIELDS: FieldDef[] = [
  { key: 'title',        label: 'Название',    type: 'text' },
  { key: 'description',  label: 'Описание',    type: 'text' },
  { key: 'status',       label: 'Статус',      type: 'enum', options: [
    { value:'NEW', label:'Новая' }, { value:'IN_PROGRESS', label:'В работе' },
    { value:'REVIEW', label:'Проверка' }, { value:'BLOCKED', label:'Заблокировано' },
    { value:'DONE', label:'Готово' },
  ]},
  { key: 'priority',     label: 'Приоритет',   type: 'enum', options: [
    { value:'LOW', label:'Низкий' }, { value:'MEDIUM', label:'Средний' },
    { value:'HIGH', label:'Высокий' }, { value:'CRITICAL', label:'Критический' },
  ]},
  { key: 'assigneeId',   label: 'Исполнитель', type: 'user' },
  { key: 'dueDate',      label: 'Срок',        type: 'date' },
  { key: 'createdAt',    label: 'Дата создания', type: 'date' },
];

export const TEXT_OPERATORS = [
  { value:'contains',     label:'содержит' },
  { value:'not_contains', label:'не содержит' },
  { value:'is_empty',     label:'пусто' },
  { value:'is_not_empty', label:'не пусто' },
];
export const ENUM_OPERATORS = [
  { value:'is',        label:'равно' },
  { value:'is_not',     label:'не равно' },
  { value:'is_any_of', label:'один из' },
];
export const DATE_OPERATORS = [
  { value:'is',            label:'равно' },
  { value:'before',        label:'до' },
  { value:'after',         label:'после' },
  { value:'is_empty',      label:'пусто' },
  { value:'is_set',        label:'заполнено' },
  { value:'today',         label:'сегодня' },
  { value:'yesterday',     label:'вчера' },
  { value:'overdue',       label:'просрочено' },
  { value:'next_7_days',   label:'в следующие 7 дней' },
  { value:'this_week',     label:'на этой неделе' },
];

export function operatorsForType(type: FieldType) {
  if (type === 'text') return TEXT_OPERATORS;
  if (type === 'date') return DATE_OPERATORS;
  return ENUM_OPERATORS; // enum + user
}

// Операторы, не требующие значения (динамические/пустые проверки)
export const VALUELESS_OPERATORS = new Set(['is_empty', 'is_not_empty', 'is_set', 'today', 'yesterday', 'overdue', 'next_7_days', 'this_week']);

export interface FilterRule {
  id: string;
  field: string;
  operator: string;
  value: any;
}
export interface FilterGroupState {
  conjunction: 'AND' | 'OR';
  rules: FilterRule[];
}

export const EMPTY_FILTER_GROUP: FilterGroupState = { conjunction: 'AND', rules: [] };

function startOfDay(d: Date): Date { const x = new Date(d); x.setHours(0,0,0,0); return x; }
function endOfDay(d: Date): Date { const x = new Date(d); x.setHours(23,59,59,999); return x; }

function evalDate(taskValue: any, operator: string, ruleValue: any): boolean {
  const now = new Date();
  if (operator === 'is_empty') return !taskValue;
  if (operator === 'is_set') return !!taskValue;
  if (!taskValue) return false;
  const d = new Date(taskValue);

  switch (operator) {
    case 'today':       return d >= startOfDay(now) && d <= endOfDay(now);
    case 'yesterday': { const y = new Date(now); y.setDate(y.getDate()-1); return d >= startOfDay(y) && d <= endOfDay(y); }
    case 'overdue':      return d < now;
    case 'next_7_days': { const future = new Date(now); future.setDate(future.getDate()+7); return d >= now && d <= future; }
    case 'this_week': {
      const start = new Date(now); start.setDate(now.getDate() - now.getDay() + 1); // Monday
      const end = new Date(start); end.setDate(start.getDate()+6);
      return d >= startOfDay(start) && d <= endOfDay(end);
    }
    case 'is':     return !ruleValue ? false : startOfDay(d).getTime() === startOfDay(new Date(ruleValue)).getTime();
    case 'before': return !ruleValue ? false : d < new Date(ruleValue);
    case 'after':  return !ruleValue ? false : d > new Date(ruleValue);
    default: return true;
  }
}

function evalText(taskValue: any, operator: string, ruleValue: string): boolean {
  const v = (taskValue ?? '').toString().toLowerCase();
  const rv = (ruleValue ?? '').toString().toLowerCase();
  switch (operator) {
    case 'contains':     return v.includes(rv);
    case 'not_contains': return !v.includes(rv);
    case 'is_empty':     return v.trim() === '';
    case 'is_not_empty': return v.trim() !== '';
    default: return true;
  }
}

function evalEnum(taskValue: any, operator: string, ruleValue: any): boolean {
  switch (operator) {
    case 'is':        return taskValue === ruleValue;
    case 'is_not':    return taskValue !== ruleValue;
    case 'is_any_of': return Array.isArray(ruleValue) ? ruleValue.includes(taskValue) : taskValue === ruleValue;
    default: return true;
  }
}

export function evaluateRule(task: any, rule: FilterRule): boolean {
  const field = FILTER_FIELDS.find(f => f.key === rule.field);
  if (!field) return true;
  const taskValue = task[rule.field];
  if (field.type === 'date')  return evalDate(taskValue, rule.operator, rule.value);
  if (field.type === 'text')  return evalText(taskValue, rule.operator, rule.value);
  return evalEnum(taskValue, rule.operator, rule.value); // enum + user (assigneeId is plain equality)
}

export function evaluateFilterGroup(task: any, group: FilterGroupState): boolean {
  if (!group.rules.length) return true;
  const results = group.rules.map(r => evaluateRule(task, r));
  return group.conjunction === 'AND' ? results.every(Boolean) : results.some(Boolean);
}

export function filterGroupIsEmpty(group: FilterGroupState): boolean {
  return group.rules.length === 0;
}
