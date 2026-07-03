export const ENTITY_TYPES = [
  'TASK', 'PROJECT', 'PRODUCT', 'DEAL', 'EMPLOYEE',
  'DOCUMENT', 'ORDER', 'KNOWLEDGE_ARTICLE', 'NOTE',
] as const;

export type EntityType = typeof ENTITY_TYPES[number];

// Task-to-Task relation types
export const TASK_RELATION_TYPES = [
  'DEPENDS_ON',   // эта задача зависит от той
  'BLOCKS',       // эта задача блокирует ту
  'WAITING_FOR',  // ждёт выполнения той
  'RELATED',      // просто связаны
  'DUPLICATE',    // дубликат
  'CUSTOM',       // пользовательская
] as const;

// Generic relation type for cross-entity
export const GENERIC_RELATION_TYPE = 'LINKED';

export type RelationType = typeof TASK_RELATION_TYPES[number] | 'LINKED';

// Human-readable labels
export const RELATION_LABELS: Record<string, string> = {
  DEPENDS_ON:  'Зависит от',
  BLOCKS:      'Блокирует',
  WAITING_FOR: 'Ожидает',
  RELATED:     'Связана с',
  DUPLICATE:   'Дубликат',
  LINKED:      'Связано',
  CUSTOM:      'Кастомная',
};

// Reverse relation labels (what the target sees)
export const REVERSE_LABELS: Record<string, string> = {
  DEPENDS_ON:  'Необходима для',
  BLOCKS:      'Заблокирована',
  WAITING_FOR: 'Ожидается',
  RELATED:     'Связана с',
  DUPLICATE:   'Дубликат',
  LINKED:      'Связано',
  CUSTOM:      'Кастомная',
};

export const ACTIVITY_ACTIONS = [
  'CREATED', 'UPDATED', 'DELETED',
  'STATUS_CHANGED', 'ASSIGNED', 'UNASSIGNED',
  'LINKED', 'UNLINKED',
  'COMMENTED', 'FILE_ADDED', 'FILE_REMOVED',
  'FIELD_CHANGED', 'PRIORITY_CHANGED', 'DUE_DATE_CHANGED',
] as const;

export type ActivityAction = typeof ACTIVITY_ACTIONS[number];
