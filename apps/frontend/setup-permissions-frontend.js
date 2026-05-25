const fs = require('fs');

function write(filePath, content) {
  const path = require('path');
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

// ─── Permission hook ──────────────────────────────────────────
write('lib/usePermissions.ts', `'use client';

// Permission rules:
// ADMIN/OWNER/SUPER_ADMIN: full access
// MANAGER: read + manage tasks
// VIEWER/HR: read-only
// EMPLOYEE: own data + own tasks only

export function usePermissions() {
  const getUser = () => {
    try {
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
`);

// ─── Update employees page with permission checks ─────────────
let empPage = fs.readFileSync('app/dashboard/employees/page.tsx', 'utf8');

// Add import
empPage = empPage.replace(
  `import { useSocket, type PresenceData } from '@/lib/useSocket';`,
  `import { useSocket, type PresenceData } from '@/lib/useSocket';
import { usePermissions } from '@/lib/usePermissions';`
);

// Add hook
empPage = empPage.replace(
  `  const { connected, presence, getStatus } = useSocket(token);`,
  `  const { connected, presence, getStatus } = useSocket(token);
  const perms = usePermissions();`
);

// Hide invite button for non-admins
empPage = empPage.replace(
  `        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Добавить
        </button>`,
  `        {perms.canInviteUsers && (
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            + Добавить
          </button>
        )}`
);

// Hide role dropdown for non-admins
empPage = empPage.replace(
  `                    <td className="px-4 py-3">
                      <select value={emp.roles?.[0] ?? 'EMPLOYEE'}
                        onChange={e => updateRole(emp.id, e.target.value)}
                        className={"text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer " + (ROLE_COLORS[emp.roles?.[0]] ?? 'bg-gray-100 text-gray-600')}>
                        {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                      </select>
                    </td>`,
  `                    <td className="px-4 py-3">
                      {perms.canChangeRoles ? (
                        <select value={emp.roles?.[0] ?? 'EMPLOYEE'}
                          onChange={e => updateRole(emp.id, e.target.value)}
                          className={"text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer " + (ROLE_COLORS[emp.roles?.[0]] ?? 'bg-gray-100 text-gray-600')}>
                          {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                        </select>
                      ) : (
                        <span className={"text-xs font-medium px-2 py-1 rounded-full " + (ROLE_COLORS[emp.roles?.[0]] ?? 'bg-gray-100 text-gray-600')}>
                          {emp.roles?.[0] ?? 'EMPLOYEE'}
                        </span>
                      )}
                    </td>`
);

// Hide suspend button for non-admins
empPage = empPage.replace(
  `                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={() => toggleStatus(emp)}
                        className={"text-xs px-3 py-1 rounded-lg font-medium " + (emp.status === 'ACTIVE'
                          ? 'bg-red-50 text-red-600 hover:bg-red-100'
                          : 'bg-green-50 text-green-600 hover:bg-green-100')}>
                        {emp.status === 'ACTIVE' ? 'Заблокировать' : 'Активировать'}
                      </button>
                    </td>`,
  `                    <td className="px-4 py-3 text-right">
                      {perms.canSuspendUsers && (
                        <button
                          onClick={() => toggleStatus(emp)}
                          className={"text-xs px-3 py-1 rounded-lg font-medium " + (emp.status === 'ACTIVE'
                            ? 'bg-red-50 text-red-600 hover:bg-red-100'
                            : 'bg-green-50 text-green-600 hover:bg-green-100')}>
                          {emp.status === 'ACTIVE' ? 'Заблокировать' : 'Активировать'}
                        </button>
                      )}
                    </td>`
);

fs.writeFileSync('app/dashboard/employees/page.tsx', empPage);
console.log('✓ employees page permissions');

// ─── Update tasks page with permission checks ─────────────────
let tasksPage = fs.readFileSync('app/dashboard/tasks/page.tsx', 'utf8');

// Add import
tasksPage = tasksPage.replace(
  `'use client';`,
  `'use client';`
);
tasksPage = tasksPage.replace(
  `import { useRouter } from 'next/navigation';`,
  `import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/usePermissions';`
);

// Add hook after router
tasksPage = tasksPage.replace(
  `  const router   = useRouter();`,
  `  const router   = useRouter();
  const perms    = usePermissions();`
);

// Hide create task button for non-permitted users
tasksPage = tasksPage.replace(
  `        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Новая задача
        </button>`,
  `        {perms.canCreateTasks && (
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            + Новая задача
          </button>
        )}`
);

// Hide move buttons for viewers
tasksPage = tasksPage.replace(
  `                    <div className="flex gap-1 flex-wrap">
                      {col.id !== 'IN_PROGRESS' && col.id !== 'DONE' && (
                        <button onClick={() => moveTask(task.id, 'IN_PROGRESS')}
                          className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">
                          В работу
                        </button>
                      )}
                      {col.id === 'IN_PROGRESS' && (
                        <button onClick={() => moveTask(task.id, 'REVIEW')}
                          className="text-xs px-2 py-0.5 bg-yellow-50 text-yellow-600 rounded hover:bg-yellow-100">
                          На проверку
                        </button>
                      )}
                      {col.id === 'REVIEW' && (
                        <button onClick={() => moveTask(task.id, 'DONE')}
                          className="text-xs px-2 py-0.5 bg-green-50 text-green-600 rounded hover:bg-green-100">
                          Готово
                        </button>
                      )}
                    </div>`,
  `                    {perms.canUpdateAnyTask && (
                      <div className="flex gap-1 flex-wrap">
                        {col.id !== 'IN_PROGRESS' && col.id !== 'DONE' && (
                          <button onClick={() => moveTask(task.id, 'IN_PROGRESS')}
                            className="text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100">
                            В работу
                          </button>
                        )}
                        {col.id === 'IN_PROGRESS' && (
                          <button onClick={() => moveTask(task.id, 'REVIEW')}
                            className="text-xs px-2 py-0.5 bg-yellow-50 text-yellow-600 rounded hover:bg-yellow-100">
                            На проверку
                          </button>
                        )}
                        {col.id === 'REVIEW' && (
                          <button onClick={() => moveTask(task.id, 'DONE')}
                            className="text-xs px-2 py-0.5 bg-green-50 text-green-600 rounded hover:bg-green-100">
                            Готово
                          </button>
                        )}
                      </div>
                    )}`
);

fs.writeFileSync('app/dashboard/tasks/page.tsx', tasksPage);
console.log('✓ tasks page permissions');

// ─── Update teams page with permission checks ─────────────────
let teamsPage = fs.readFileSync('app/dashboard/teams/page.tsx', 'utf8');

teamsPage = teamsPage.replace(
  `import { useRouter } from 'next/navigation';`,
  `import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/usePermissions';`
);

teamsPage = teamsPage.replace(
  `  const [saving, setSaving]     = useState(false);`,
  `  const [saving, setSaving]     = useState(false);
  const perms = usePermissions();`
);

// Hide create team button
teamsPage = teamsPage.replace(
  `        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Создать команду
        </button>`,
  `        {perms.canCreateTeams && (
          <button onClick={() => setShowForm(true)}
            className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
            + Создать команду
          </button>
        )}`
);

// Hide delete team button
teamsPage = teamsPage.replace(
  `                  <button onClick={() => deleteTeam(team.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors text-sm">✕</button>`,
  `                  {perms.canManageTeams && (
                    <button onClick={() => deleteTeam(team.id)}
                      className="text-gray-300 hover:text-red-400 transition-colors text-sm">✕</button>
                  )}`
);

// Hide add/remove member buttons
teamsPage = teamsPage.replace(
  `                      <button onClick={() => removeMember(team.id, m.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs transition-all">
                        ✕
                      </button>`,
  `                      {perms.canManageTeams && (
                        <button onClick={() => removeMember(team.id, m.id)}
                          className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs transition-all">
                          ✕
                        </button>
                      )}`
);

teamsPage = teamsPage.replace(
  `                <button
                  onClick={() => { setSelectedTeam(team); setAddMemberOpen(true); }}
                  className="w-full py-1.5 text-xs text-indigo-600 border border-dashed border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">
                  + Добавить участника
                </button>`,
  `                {perms.canManageTeams && (
                  <button
                    onClick={() => { setSelectedTeam(team); setAddMemberOpen(true); }}
                    className="w-full py-1.5 text-xs text-indigo-600 border border-dashed border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">
                    + Добавить участника
                  </button>
                )}`
);

fs.writeFileSync('app/dashboard/teams/page.tsx', teamsPage);
console.log('✓ teams page permissions');

// ─── Update sidebar — hide productivity for employees ─────────
let sidebar = fs.readFileSync('components/layouts/Sidebar.tsx', 'utf8');
sidebar = sidebar.replace(
  `import { useSocket } from '@/lib/useSocket';`,
  `import { useSocket } from '@/lib/useSocket';
import { usePermissions } from '@/lib/usePermissions';`
);
sidebar = sidebar.replace(
  `  const { connected }     = useSocket(token);`,
  `  const { connected }     = useSocket(token);
  const perms             = usePermissions();`
);

// Filter nav items based on permissions
sidebar = sidebar.replace(
  `const NAV = [
  { href: '/dashboard',              icon: '⊞', label: 'Дашборд' },
  { href: '/dashboard/employees',    icon: '👥', label: 'Сотрудники' },
  { href: '/dashboard/tasks',        icon: '✓',  label: 'Задачи' },
  { href: '/dashboard/analytics',    icon: '📊', label: 'Аналитика' },
  { href: '/dashboard/teams',        icon: '🏷️',  label: 'Команды' },
  { href: '/dashboard/productivity', icon: '⭐', label: 'Продуктивность' },
];`,
  `const NAV_BASE = [
  { href: '/dashboard',              icon: '⊞', label: 'Дашборд',        adminOnly: false },
  { href: '/dashboard/employees',    icon: '👥', label: 'Сотрудники',     adminOnly: false },
  { href: '/dashboard/tasks',        icon: '✓',  label: 'Задачи',         adminOnly: false },
  { href: '/dashboard/analytics',    icon: '📊', label: 'Аналитика',      adminOnly: false },
  { href: '/dashboard/teams',        icon: '🏷️',  label: 'Команды',        adminOnly: true  },
  { href: '/dashboard/productivity', icon: '⭐', label: 'Продуктивность', adminOnly: true  },
];`
);

// Use filtered nav
sidebar = sidebar.replace(
  `      <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
        {NAV.map(item => {`,
  `      <nav className="flex-1 p-3 flex flex-col gap-1 overflow-y-auto">
        {NAV_BASE.filter(item => !item.adminOnly || perms.isAdmin || perms.isManager).map(item => {`
);

fs.writeFileSync('components/layouts/Sidebar.tsx', sidebar);
console.log('✓ sidebar permissions');

console.log('\n✅ Frontend permissions done');
console.log('\nAccess rules:');
console.log('  ADMIN:    Full access — invite, suspend, change roles, create teams, manage members');
console.log('  MANAGER:  Can view all, manage tasks, view analytics/productivity');
console.log('  VIEWER/HR: Read-only — no buttons to edit');
console.log('  EMPLOYEE: Read-only — no invite/suspend/role change buttons');
