export type Permission =
  | 'custom_field:manage' | 'custom_field:delete' | 'custom_field:view' | 'custom_field:edit'
  | 'crm:read' | 'crm:write' | 'crm:delete'
  | 'org:read' | 'org:update' | 'org:billing:manage'
  | 'user:invite' | 'user:read:all' | 'user:read:team'
  | 'user:read:self' | 'user:update:any' | 'user:update:self'
  | 'user:suspend' | 'user:delete'
  | 'team:create' | 'team:read:all' | 'team:update' | 'team:members:manage'
  | 'tracking:view:all' | 'tracking:view:team' | 'tracking:view:self' | 'tracking:export'
  | 'analytics:view:org' | 'analytics:view:team' | 'analytics:view:self'
  | 'task:create' | 'task:read:all' | 'task:read:team' | 'task:read:self'
  | 'task:update:any' | 'task:update:self' | 'task:delete' | 'task:assign'
  | 'report:generate:org' | 'report:generate:team' | 'report:view'
  | 'role:assign' | 'audit:view';

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  SUPER_ADMIN: [
    'org:read','org:update','org:billing:manage',
    'user:invite','user:read:all','user:update:any','user:suspend','user:delete',
    'team:create','team:read:all','team:update','team:members:manage',
    'tracking:view:all','tracking:export',
    'analytics:view:org','analytics:view:team','analytics:view:self',
    'task:create','task:read:all','task:update:any','task:delete','task:assign',
    'report:generate:org','report:view','role:assign','audit:view',
    'custom_field:manage','custom_field:delete','custom_field:view','custom_field:edit',
    'crm:read','crm:write','crm:delete',
  ],
  OWNER: [
    'org:read','org:update','org:billing:manage',
    'user:invite','user:read:all','user:update:any','user:suspend','user:delete',
    'team:create','team:read:all','team:update','team:members:manage',
    'tracking:view:all','tracking:export',
    'analytics:view:org','analytics:view:team',
    'task:create','task:read:all','task:update:any','task:delete','task:assign',
    'report:generate:org','report:view','role:assign','audit:view',
    'custom_field:manage','custom_field:delete','custom_field:view','custom_field:edit',
    'crm:read','crm:write','crm:delete',
  ],
  ADMIN: [
    'org:read','org:update',
    'user:invite','user:read:all','user:update:any','user:suspend','user:delete',
    'team:create','team:read:all','team:update','team:members:manage',
    'tracking:view:all','tracking:export',
    'analytics:view:org','analytics:view:team',
    'task:create','task:read:all','task:update:any','task:delete','task:assign',
    'report:generate:org','report:view','role:assign','audit:view',
    'custom_field:manage','custom_field:delete','custom_field:view','custom_field:edit',
    'crm:read','crm:write','crm:delete',
  ],
  MANAGER: [
    'org:read',
    'user:invite','user:read:team','user:read:self','user:update:self',
    'team:read:all','team:members:manage',
    'tracking:view:team','tracking:view:self',
    'analytics:view:team','analytics:view:self',
    'task:create','task:read:team','task:read:self','task:update:any','task:assign',
    'report:generate:team','report:view',
    'custom_field:view','custom_field:edit',
  ],
  VIEWER: [
    'org:read',
    'user:read:team','user:read:self',
    'team:read:all',
    'tracking:view:team','tracking:view:self',
    'analytics:view:team','analytics:view:self',
    'task:read:team','task:read:self',
    'report:view',
  ],
  HR: [
    'org:read',
    'user:invite','user:read:all','user:read:self','user:update:self',
    'team:read:all',
    'tracking:view:all',
    'analytics:view:org','analytics:view:team',
    'report:generate:org','report:view',
  ],
  EMPLOYEE: [
    'user:read:self','user:update:self',
    'tracking:view:self',
    'analytics:view:self',
    'task:read:self','task:update:self',
  ],
};

export function resolvePermissions(roles: string[]): Set<Permission> {
  const perms = new Set<Permission>();
  for (const role of roles) {
    const rolePerms = ROLE_PERMISSIONS[role] ?? [];
    rolePerms.forEach(p => perms.add(p));
  }
  return perms;
}
