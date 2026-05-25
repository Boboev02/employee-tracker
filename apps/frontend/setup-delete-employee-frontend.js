const fs = require('fs');

let empPage = fs.readFileSync('app/dashboard/employees/page.tsx', 'utf8');

// Add deleteEmployee function after toggleStatus
empPage = empPage.replace(
  `  const updateRole = async (empId: string, role: string) => {`,
  `  const deleteEmployee = async (emp: any) => {
    if (!confirm('Удалить сотрудника ' + emp.name + '? Это действие необратимо.')) return;
    await fetch('http://localhost:3001/api/v1/employees/' + emp.id, {
      method: 'DELETE', headers: { Authorization: 'Bearer ' + token! },
    });
    load(token!);
  };

  const updateRole = async (empId: string, role: string) => {`
);

// Add delete button in actions column
empPage = empPage.replace(
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
                    </td>`,
  `                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        {perms.canSuspendUsers && (
                          <button
                            onClick={() => toggleStatus(emp)}
                            className={"text-xs px-3 py-1 rounded-lg font-medium " + (emp.status === 'ACTIVE'
                              ? 'bg-red-50 text-red-600 hover:bg-red-100'
                              : 'bg-green-50 text-green-600 hover:bg-green-100')}>
                            {emp.status === 'ACTIVE' ? 'Заблокировать' : 'Активировать'}
                          </button>
                        )}
                        {perms.canInviteUsers && (
                          <button
                            onClick={e => { e.stopPropagation(); deleteEmployee(emp); }}
                            className="text-xs px-3 py-1 rounded-lg font-medium bg-gray-50 text-gray-400 hover:bg-red-50 hover:text-red-600 transition-colors">
                            Удалить
                          </button>
                        )}
                      </div>
                    </td>`
);

fs.writeFileSync('app/dashboard/employees/page.tsx', empPage);
console.log('✓ employees page updated with delete button');
console.log('\n✅ Delete employee frontend done');
