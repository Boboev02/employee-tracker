const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

// ─── Update tasks page with assignee + deadline in create form ─
let tasksPage = fs.readFileSync('app/dashboard/tasks/page.tsx', 'utf8');

// Add employees state
tasksPage = tasksPage.replace(
  `  const [showForm, setShowForm] = useState(false);`,
  `  const [showForm, setShowForm]   = useState(false);
  const [employees, setEmployees]   = useState<any[]>([]);`
);

// Load employees
tasksPage = tasksPage.replace(
  `    fetch('http://localhost:3001/api/v1/tasks/kanban', {`,
  `    fetch('http://localhost:3001/api/v1/employees', {
        headers: { Authorization: 'Bearer ' + t },
      }).then(r => r.json()).then(d => setEmployees(Array.isArray(d) ? d : [])).catch(() => {});

    fetch('http://localhost:3001/api/v1/tasks/kanban', {`
);

// Add assigneeId and dueDate to form state
tasksPage = tasksPage.replace(
  `  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM' });`,
  `  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', assigneeId: '', dueDate: '' });`
);

// Update createTask to send assigneeId and dueDate
tasksPage = tasksPage.replace(
  `      body: JSON.stringify({ title: form.title, description: form.description, priority: form.priority }),`,
  `      body: JSON.stringify({
          title:       form.title,
          description: form.description,
          priority:    form.priority,
          assigneeId:  form.assigneeId || undefined,
          dueDate:     form.dueDate    || undefined,
        }),`
);

// Reset form after create
tasksPage = tasksPage.replace(
  `      setForm({ title: '', description: '', priority: 'MEDIUM' });`,
  `      setForm({ title: '', description: '', priority: 'MEDIUM', assigneeId: '', dueDate: '' });`
);

// Add assignee + deadline fields to form modal
tasksPage = tasksPage.replace(
  `              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="LOW">Низкий</option>
                  <option value="MEDIUM">Средний</option>
                  <option value="HIGH">Высокий</option>
                  <option value="CRITICAL">Критический</option>
                </select>`,
  `              <select value={form.priority} onChange={e => setForm({ ...form, priority: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="LOW">Низкий</option>
                  <option value="MEDIUM">Средний</option>
                  <option value="HIGH">Высокий</option>
                  <option value="CRITICAL">Критический</option>
                </select>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Исполнитель</label>
                <select value={form.assigneeId} onChange={e => setForm({ ...form, assigneeId: e.target.value })}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="">Не назначен</option>
                  {employees.map(emp => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Дедлайн</label>
                <input type="date" value={form.dueDate} onChange={e => setForm({ ...form, dueDate: e.target.value })}
                  min={new Date().toISOString().slice(0,10)}
                  className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
              </div>`
);

// Show assignee + deadline on kanban cards
tasksPage = tasksPage.replace(
  `                    <p className="text-sm font-medium text-gray-900 mb-2">{task.title}</p>`,
  `                    <p className="text-sm font-medium text-gray-900 mb-1.5">{task.title}</p>
                    {(task.assignee || task.dueDate) && (
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        {task.assignee && (
                          <div className="flex items-center gap-1">
                            <div className="w-4 h-4 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                              {task.assignee.name.charAt(0)}
                            </div>
                            <span className="text-xs text-gray-500">{task.assignee.name}</span>
                          </div>
                        )}
                        {task.dueDate && (
                          <span className={"text-xs px-1.5 py-0.5 rounded font-medium " + (
                            new Date(task.dueDate) < new Date()
                              ? 'bg-red-100 text-red-600'
                              : new Date(task.dueDate) < new Date(Date.now() + 3*24*60*60*1000)
                                ? 'bg-yellow-100 text-yellow-700'
                                : 'bg-gray-100 text-gray-500'
                          )}>
                            📅 {new Date(task.dueDate).toLocaleDateString('ru', { day:'numeric', month:'short' })}
                          </span>
                        )}
                      </div>
                    )}`
);

fs.writeFileSync('app/dashboard/tasks/page.tsx', tasksPage);
console.log('✓ tasks page updated');

// ─── Update task detail page with editable assignee + deadline ─
let detailPage = fs.readFileSync('app/dashboard/tasks/[id]/page.tsx', 'utf8');

// Add employees state and editing states
detailPage = detailPage.replace(
  `  const [posting, setPosting] = useState(false);
  const [userMap, setUserMap]   = useState<Record<string, string>>({});`,
  `  const [posting, setPosting]   = useState(false);
  const [userMap, setUserMap]     = useState<Record<string, string>>({});
  const [employees, setEmployees] = useState<any[]>([]);
  const [saving, setSaving]       = useState(false);`
);

// Load employees
detailPage = detailPage.replace(
  `    fetch('http://localhost:3001/api/v1/employees', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(data => {
        if (Array.isArray(data)) {
          const map: Record<string, string> = {};
          data.forEach((e: any) => { map[e.id] = e.name; });
          setUserMap(map);
        }
      });`,
  `    fetch('http://localhost:3001/api/v1/employees', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(data => {
        if (Array.isArray(data)) {
          const map: Record<string, string> = {};
          data.forEach((e: any) => { map[e.id] = e.name; });
          setUserMap(map);
          setEmployees(data);
        }
      });`
);

// Add updateField function before postComment
detailPage = detailPage.replace(
  `  const postComment = async () => {`,
  `  const updateField = async (field: string, value: any) => {
    setSaving(true);
    try {
      await fetch('http://localhost:3001/api/v1/tasks/' + id, {
        method:  'PATCH',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body:    JSON.stringify({ [field]: value || null }),
      });
      loadTask(token);
    } finally { setSaving(false); }
  };

  const postComment = async () => {`
);

// Update Details section to include editable assignee and deadline
detailPage = detailPage.replace(
  `          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Детали</h3>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Приоритет</span>
                <span className={"text-xs px-2 py-0.5 rounded font-medium " + (PRIORITY_COLORS[task.priority] ?? 'bg-gray-100 text-gray-500')}>
                  {task.priority}
                </span>
              </div>
              {task.assignee && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Исполнитель</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                      {task.assignee.name.charAt(0)}
                    </div>
                    <span className="text-gray-700">{task.assignee.name}</span>
                  </div>
                </div>
              )}
              {task.dueDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Дедлайн</span>
                  <span className="text-gray-700">{new Date(task.dueDate).toLocaleDateString('ru')}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Создана</span>
                <span className="text-gray-700">{new Date(task.createdAt).toLocaleDateString('ru')}</span>
              </div>
              {task.tags?.length > 0 && (
                <div>
                  <span className="text-gray-500 block mb-1">Теги</span>
                  <div className="flex gap-1 flex-wrap">
                    {task.tags.map((tag: string) => (
                      <span key={tag} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>`,
  `          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Детали</h3>
            <div className="flex flex-col gap-3 text-sm">

              {/* Priority */}
              <div className="flex justify-between items-center">
                <span className="text-gray-500">Приоритет</span>
                <span className={"text-xs px-2 py-0.5 rounded font-medium " + (PRIORITY_COLORS[task.priority] ?? 'bg-gray-100 text-gray-500')}>
                  {task.priority}
                </span>
              </div>

              {/* Assignee */}
              <div>
                <span className="text-gray-500 block mb-1.5">Исполнитель</span>
                <select
                  value={task.assigneeId ?? ''}
                  onChange={e => updateField('assigneeId', e.target.value)}
                  disabled={saving}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50">
                  <option value="">Не назначен</option>
                  {employees.map((emp: any) => (
                    <option key={emp.id} value={emp.id}>{emp.name}</option>
                  ))}
                </select>
              </div>

              {/* Deadline */}
              <div>
                <span className="text-gray-500 block mb-1.5">Дедлайн</span>
                <input type="date"
                  value={task.dueDate ? task.dueDate.slice(0, 10) : ''}
                  onChange={e => updateField('dueDate', e.target.value)}
                  disabled={saving}
                  className="w-full border border-gray-200 rounded-lg px-2 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:opacity-50" />
                {task.dueDate && (
                  <p className={"text-xs mt-1 font-medium " + (
                    new Date(task.dueDate) < new Date() ? 'text-red-500' :
                    new Date(task.dueDate) < new Date(Date.now() + 3*24*60*60*1000) ? 'text-yellow-600' :
                    'text-gray-400'
                  )}>
                    {new Date(task.dueDate) < new Date() ? '⚠ Просрочено' :
                     new Date(task.dueDate) < new Date(Date.now() + 3*24*60*60*1000) ? '⏰ Скоро дедлайн' :
                     '✓ ' + new Date(task.dueDate).toLocaleDateString('ru', { day:'numeric', month:'long' })}
                  </p>
                )}
              </div>

              {/* Created */}
              <div className="flex justify-between">
                <span className="text-gray-500">Создана</span>
                <span className="text-gray-700">{new Date(task.createdAt).toLocaleDateString('ru')}</span>
              </div>

              {/* Tags */}
              {task.tags?.length > 0 && (
                <div>
                  <span className="text-gray-500 block mb-1">Теги</span>
                  <div className="flex gap-1 flex-wrap">
                    {task.tags.map((tag: string) => (
                      <span key={tag} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>`
);

fs.writeFileSync('app/dashboard/tasks/[id]/page.tsx', detailPage);
console.log('✓ task detail page updated');

console.log('\n✅ Assignee + deadline done');
