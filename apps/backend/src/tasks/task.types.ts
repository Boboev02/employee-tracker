export const TaskStatus = {
  NEW:         'NEW',
  IN_PROGRESS: 'IN_PROGRESS',
  REVIEW:      'REVIEW',
  DONE:        'DONE',
  OVERDUE:     'OVERDUE',
  BLOCKED:     'BLOCKED',
} as const;

export const TaskPriority = {
  CRITICAL: 'CRITICAL',
  HIGH:     'HIGH',
  MEDIUM:   'MEDIUM',
  LOW:      'LOW',
} as const;

export const TASK_TRANSITIONS: Record<string, string[]> = {
  NEW:         ['IN_PROGRESS', 'BLOCKED'],
  IN_PROGRESS: ['REVIEW', 'BLOCKED', 'DONE'],
  REVIEW:      ['IN_PROGRESS', 'DONE', 'BLOCKED'],
  BLOCKED:     ['IN_PROGRESS'],
  OVERDUE:     ['IN_PROGRESS', 'DONE'],
  DONE:        ['IN_PROGRESS'],
};
