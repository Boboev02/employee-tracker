const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

write('app/dashboard/employees/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const ROLES = ['ADMIN', 'MANAGER', 'EMPLOYEE', 'VIEWER', 'HR'];

const ROLE_COLORS: Record<string, string> = {
  ADMIN:    'bg-purple-100 text-purple-700',
  MANAGER:  'bg-blue-100 text-blue-700',
  EMPLOYEE: 'bg-green-100 text-green-700',
  VIEWER:   'bg-gray-100 text-gray-600',
  HR:       'bg-pink-100 text-pink-700',
};

const STATUS_COLORS: Record<string, string> = {
  ACTIVE:    'bg-green-100 text-green-700',
  SUSPENDED: 'bg-red-100 text-red-700',
};

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [token, setToken]         = useState('');
  const [form, setForm]           = useState({ name: '', email: '', role: 'EMPLOYEE', password: '' });
  const [saving, setSaving]       = useState(false);
  const [error, setError]         = useState('');

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    load(t);
  }, []);

  const load = async (t: string, q = '') => {
    setLoading(true);
    try {
      const url = 'http://localhost:3001/api/v1/employees' + (q ? '?search=' + encodeURIComponent(q) : '');
      const res = await fetch(url, { headers: { Authorization: 'Bearer ' + t } });
      setEmployees(await res.json());
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
    load(token, e.target.value);
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      const res = await fetch('http://localhost:3001/api/v1/employees/invite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const d = await res.json();
        setError(d.message ?? 'Ошибка');
        return;
      }
      setShowForm(false);
      setForm({ name: '', email: '', role: 'EMPLOYEE', password: '' });
      load(token);
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (emp: any) => {
    const action = emp.status === 'ACTIVE' ? 'suspend' : 'activate';
    await fetch('http://localhost:3001/api/v1/employees/' + emp.id + '/' + action, {
      method: 'PATCH',
      headers: { Authorization: 'Bearer ' + token },
    });
    load(token);
  };

  const updateRole = async (empId: string, role: string) => {
    await fetch('http://localhost:3001/api/v1/employees/' + empId + '/role', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body: JSON.stringify({ role }),
    });
    load(token);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => router.push('/dashboard')} className="text-gray-400 hover:text-gray-600 text-sm">
            ← Назад
          </button>
          <h1 className="text-xl font-bold text-gray-900">Сотрудники</h1>
          <span className="text-sm text-gray-400">{employees.length} чел.</span>
        </div>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Добавить
        </button>
      </div>

      {/* Search */}
      <div className="px-6 py-4">
        <input
          type="text"
          placeholder="Поиск по имени или email..."
          value={search}
          onChange={handleSearch}
          className="w-full max-w-md border border-gray-200 rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
        />
      </div>

      {/* Table */}
      <div className="px-6">
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Сотрудник</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Роль</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Статус</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Добавлен</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Действия</th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">Загрузка...</td></tr>
              )}
              {!loading && employees.length === 0 && (
                <tr><td colSpan={5} className="text-center py-12 text-gray-400">Нет сотрудников</td></tr>
              )}
              {!loading && employees.map(emp => (
                <tr key={emp.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {emp.name.charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{emp.name}</p>
                        <p className="text-xs text-gray-400">{emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={emp.roles?.[0] ?? 'EMPLOYEE'}
                      onChange={e => updateRole(emp.id, e.target.value)}
                      className={"text-xs font-medium px-2 py-1 rounded-full border-0 cursor-pointer " + (ROLE_COLORS[emp.roles?.[0]] ?? 'bg-gray-100 text-gray-600')}
                    >
                      {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </td>
                  <td className="px-4 py-3">
                    <span className={"text-xs font-medium px-2 py-1 rounded-full " + (STATUS_COLORS[emp.status] ?? 'bg-gray-100 text-gray-600')}>
                      {emp.status === 'ACTIVE' ? 'Активен' : 'Заблокирован'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(emp.createdAt).toLocaleDateString('ru')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => toggleStatus(emp)}
                      className={"text-xs px-3 py-1 rounded-lg font-medium " + (emp.status === 'ACTIVE'
                        ? 'bg-red-50 text-red-600 hover:bg-red-100'
                        : 'bg-green-50 text-green-600 hover:bg-green-100')}
                    >
                      {emp.status === 'ACTIVE' ? 'Заблокировать' : 'Активировать'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md">
            <h2 className="text-lg font-bold mb-4">Добавить сотрудника</h2>
            <form onSubmit={handleInvite} className="flex flex-col gap-3">
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Имя</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  placeholder="Иван Иванов" value={form.name}
                  onChange={e => setForm({...form, name: e.target.value})} required />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Email</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  type="email" placeholder="ivan@company.ru" value={form.email}
                  onChange={e => setForm({...form, email: e.target.value})} required />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Роль</label>
                <select className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  value={form.role} onChange={e => setForm({...form, role: e.target.value})}>
                  {ROLES.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs font-medium text-gray-600 mb-1 block">Пароль (по умолчанию: Welcome123!)</label>
                <input className="w-full border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                  type="text" placeholder="Welcome123!" value={form.password}
                  onChange={e => setForm({...form, password: e.target.value})} />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
              <div className="flex gap-2 justify-end mt-2">
                <button type="button" onClick={() => { setShowForm(false); setError(''); }}
                  className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800">Отмена</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? 'Добавляю...' : 'Добавить'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
`);

console.log('\n✅ Employees frontend created');
