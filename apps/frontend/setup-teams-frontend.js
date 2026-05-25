const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

write('app/dashboard/teams/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function TeamsPage() {
  const router = useRouter();
  const [teams, setTeams]       = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [token, setToken]       = useState('');
  const [showForm, setShowForm] = useState(false);
  const [teamName, setTeamName] = useState('');
  const [saving, setSaving]     = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    loadAll(t);
  }, []);

  const loadAll = async (t: string) => {
    setLoading(true);
    try {
      const [teamsRes, empRes] = await Promise.all([
        fetch('http://localhost:3001/api/v1/teams',     { headers: { Authorization: 'Bearer ' + t } }),
        fetch('http://localhost:3001/api/v1/employees', { headers: { Authorization: 'Bearer ' + t } }),
      ]);
      const teamsData = await teamsRes.json();
      const empData   = await empRes.json();
      setTeams(Array.isArray(teamsData) ? teamsData : []);
      setEmployees(Array.isArray(empData) ? empData : []);
    } finally { setLoading(false); }
  };

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await fetch('http://localhost:3001/api/v1/teams', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body:    JSON.stringify({ name: teamName }),
      });
      setTeamName('');
      setShowForm(false);
      loadAll(token);
    } finally { setSaving(false); }
  };

  const deleteTeam = async (id: string) => {
    if (!confirm('Удалить команду?')) return;
    await fetch('http://localhost:3001/api/v1/teams/' + id, {
      method: 'DELETE', headers: { Authorization: 'Bearer ' + token },
    });
    loadAll(token);
  };

  const addMember = async (teamId: string, userId: string) => {
    await fetch('http://localhost:3001/api/v1/teams/' + teamId + '/members', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body:    JSON.stringify({ userId }),
    });
    loadAll(token);
  };

  const removeMember = async (teamId: string, userId: string) => {
    await fetch('http://localhost:3001/api/v1/teams/' + teamId + '/members/' + userId, {
      method: 'DELETE', headers: { Authorization: 'Bearer ' + token },
    });
    loadAll(token);
  };

  // Employees not in selected team
  const availableEmployees = selectedTeam
    ? employees.filter(e => !selectedTeam.members.find((m: any) => m.id === e.id))
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Команды</h1>
        <button onClick={() => setShowForm(true)}
          className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Создать команду
        </button>
      </div>

      <div className="p-6">
        {loading ? (
          <div className="text-center py-12 text-gray-400">Загрузка...</div>
        ) : teams.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-xl border border-gray-200">
            <p className="text-4xl mb-3">👥</p>
            <h3 className="text-lg font-semibold text-gray-700 mb-2">Нет команд</h3>
            <p className="text-sm text-gray-500 mb-4">Создай первую команду и добавь сотрудников</p>
            <button onClick={() => setShowForm(true)}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700">
              + Создать команду
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {teams.map(team => (
              <div key={team.id} className="bg-white rounded-xl border border-gray-200 p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-gray-900">{team.name}</h3>
                    <p className="text-xs text-gray-400">{team.memberCount} сотрудников</p>
                  </div>
                  <button onClick={() => deleteTeam(team.id)}
                    className="text-gray-300 hover:text-red-400 transition-colors text-sm">✕</button>
                </div>

                {/* Members */}
                <div className="flex flex-col gap-2 mb-4">
                  {team.members.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-2">Нет участников</p>
                  ) : team.members.map((m: any) => (
                    <div key={m.id} className="flex items-center gap-2 group">
                      <div className="w-6 h-6 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {m.name.charAt(0)}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 truncate">{m.name}</p>
                        <p className="text-xs text-gray-400">{m.roles?.[0]}</p>
                      </div>
                      <button onClick={() => removeMember(team.id, m.id)}
                        className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-400 text-xs transition-all">
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                {/* Add member */}
                <button
                  onClick={() => { setSelectedTeam(team); setAddMemberOpen(true); }}
                  className="w-full py-1.5 text-xs text-indigo-600 border border-dashed border-indigo-200 rounded-lg hover:bg-indigo-50 transition-colors">
                  + Добавить участника
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create team modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-4">Новая команда</h2>
            <form onSubmit={createTeam} className="flex flex-col gap-3">
              <input className="border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder="Название команды" value={teamName}
                onChange={e => setTeamName(e.target.value)} required autoFocus />
              <div className="flex gap-2 justify-end">
                <button type="button" onClick={() => setShowForm(false)}
                  className="px-4 py-2 text-sm text-gray-600">Отмена</button>
                <button type="submit" disabled={saving}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {saving ? 'Создаю...' : 'Создать'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add member modal */}
      {addMemberOpen && selectedTeam && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-sm">
            <h2 className="text-lg font-bold mb-1">Добавить в «{selectedTeam.name}»</h2>
            <p className="text-sm text-gray-500 mb-4">Выбери сотрудника</p>
            <div className="flex flex-col gap-2 max-h-64 overflow-y-auto">
              {availableEmployees.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Все сотрудники уже в команде</p>
              ) : availableEmployees.map(emp => (
                <button key={emp.id}
                  onClick={() => { addMember(selectedTeam.id, emp.id); setAddMemberOpen(false); setSelectedTeam(null); }}
                  className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-indigo-50 transition-colors text-left">
                  <div className="w-8 h-8 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {emp.name.charAt(0)}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-900">{emp.name}</p>
                    <p className="text-xs text-gray-400">{emp.email}</p>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => { setAddMemberOpen(false); setSelectedTeam(null); }}
              className="mt-4 w-full py-2 text-sm text-gray-500 hover:text-gray-700">Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
}
`);

console.log('\n✅ Teams frontend created');
