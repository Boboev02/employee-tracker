'use client';

// Permission rules:
// ADMIN/OWNER/SUPER_ADMIN: full access
// MANAGER: read + manage tasks
// VIEWER/HR: read-only
// EMPLOYEE: own data + own tasks only

export function usePermissions() {
  const getUser = () => {
    try {
      if (typeof window === 'undefined') return null;
      const stored = localStorage.getItem('user');
      return stored ? JSON.parse(stored) : null;
    } catch { return null; }
  };

  const user = getUser();
  const roles: string[] = user?.roles ?? [];

  const isAdmin    = roles.some(r => ['ADMIN','OWNER','SUPER_ADMIN'].includes(r));
  const isManager  = roles.includes('MANAGER');
  const isEmployee = roles.includes('EMPLOYEE');
  const isViewer   = roles.includes('VIEWER') || roles.includes('HR');

  return {
    // Create/invite/delete
    canInviteUsers:    isAdmin,
    canSuspendUsers:   isAdmin,
    canChangeRoles:    isAdmin,
    canCreateTeams:    isAdmin,
    canManageTeams:    isAdmin,
    canDeleteTasks:    isAdmin,

    // Tasks
    canCreateTasks:    isAdmin || isManager || isEmployee,
    canUpdateAnyTask:  isAdmin || isManager,
    canUpdateOwnTask:  true,

    // Analytics
    canViewOrgAnalytics:  isAdmin || isManager,
    canViewTeamAnalytics: isAdmin || isManager,
    canViewOwnAnalytics:  true,

    // Employees list
    canViewAllEmployees: isAdmin || isManager,
    canViewTeamEmployees: isAdmin || isManager,

    // Productivity
    canViewProductivity: isAdmin || isManager,

    roles,
    isAdmin,
    isManager,
    isEmployee,
    isViewer,
  };
}
