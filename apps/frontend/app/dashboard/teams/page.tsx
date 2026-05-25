'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/usePermissions';

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
  const perms = usePermissions();

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t); loadAll(t);
  }, []);

  const loadAll = async (t: string) => {
    setLoading(true);
    const [tr, er] = await Promise.all([
      fetch('http://localhost:3001/api/v1/teams',     { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
      fetch('http://localhost:3001/api/v1/employees', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
    ]);
    setTeams(Array.isArray(tr) ? tr : []);
    setEmployees(Array.isArray(er) ? er : []);
    setLoading(false);
  };

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    await fetch('http://localhost:3001/api/v1/teams', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ name: teamName }) });
    setTeamName(''); setShowForm(false); loadAll(token);
    setSaving(false);
  };

  const deleteTeam = async (id: string) => {
    if (!confirm('Удалить команду?')) return;
    await fetch('http://localhost:3001/api/v1/teams/' + id, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
    loadAll(token);
  };

  const addMember = async (teamId: string, userId: string) => {
    await fetch('http://localhost:3001/api/v1/teams/' + teamId + '/members', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }, body: JSON.stringify({ userId }) });
    loadAll(token);
  };

  const removeMember = async (teamId: string, userId: string) => {
    await fetch('http://localhost:3001/api/v1/teams/' + teamId + '/members/' + userId, { method: 'DELETE', headers: { Authorization: 'Bearer ' + token } });
    loadAll(token);
  };

  const COLORS = ['#a78bfa','#378add','#22c55e','#f97316','#ef4444','#eab308'];
  const availableEmployees = selectedTeam ? employees.filter(e => !selectedTeam.members.find((m: any) => m.id === e.id)) : [];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-tertiary)' }}>
      <div style={{ background: 'var(--bg-primary)', borderBottom: '0.5px solid var(--border)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Команды</h1>
        {perms.canCreateTeams && (
          <button onClick={() => setShowForm(true)} style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>
            + Создать команду
          </button>
        )}
      </div>

      <div style={{ padding: '24px' }}>
        {loading ? (
          <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)', fontSize: '13px' }}>Загрузка...</div>
        ) : teams.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '60px 24px', background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)' }}>
            <p style={{ fontSize: '32px', marginBottom: '12px' }}>👥</p>
            <p style={{ fontSize: '15px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '6px' }}>Нет команд</p>
            <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '16px' }}>Создайте первую команду и добавьте сотрудников</p>
            {perms.canCreateTeams && <button onClick={() => setShowForm(true)} style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer' }}>+ Создать команду</button>}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '12px' }}>
            {teams.map((team, ti) => (
              <div key={team.id} style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                  <div>
                    <p style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{team.name}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>{team.memberCount} участников</p>
                  </div>
                  {perms.canManageTeams && (
                    <button onClick={() => deleteTeam(team.id)} style={{ background: 'none', border: 'none', fontSize: '16px', color: 'var(--text-muted)', cursor: 'pointer', lineHeight: 1 }}>×</button>
                  )}
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '12px' }}>
                  {team.members.length === 0 ? (
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', textAlign: 'center', padding: '8px' }}>Нет участников</p>
                  ) : team.members.map((m: any, i: number) => (
                    <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                        <span style={{ color: 'white', fontSize: '10px', fontWeight: 600 }}>{m.name.charAt(0)}</span>
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{m.name}</p>
                        <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>{m.roles?.[0]}</p>
                      </div>
                      {perms.canManageTeams && (
                        <button onClick={() => removeMember(team.id, m.id)} style={{ background: 'none', border: 'none', fontSize: '13px', color: 'var(--text-muted)', cursor: 'pointer' }}>×</button>
                      )}
                    </div>
                  ))}
                </div>

                {perms.canManageTeams && (
                  <button onClick={() => { setSelectedTeam(team); setAddMemberOpen(true); }}
                    style={{ width: '100%', padding: '7px', fontSize: '12px', color: 'var(--accent)', background: 'rgba(167,139,250,0.06)', border: '0.5px dashed rgba(167,139,250,0.4)', borderRadius: '8px', cursor: 'pointer' }}>
                    + Добавить участника
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius)', padding: '24px', width: '380px', border: '0.5px solid var(--border)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '20px' }}>Новая команда</h2>
            <form onSubmit={createTeam} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              <input value={teamName} onChange={e => setTeamName(e.target.value)} placeholder="Название команды" required autoFocus
                style={{ width: '100%', background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none' }} />
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                <button type="button" onClick={() => setShowForm(false)} style={{ background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '0.5px solid var(--border)', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', cursor: 'pointer' }}>Отмена</button>
                <button type="submit" disabled={saving} style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Создаю...' : 'Создать'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add member modal */}
      {addMemberOpen && selectedTeam && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 50 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: 'var(--radius)', padding: '24px', width: '380px', border: '0.5px solid var(--border)' }}>
            <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '6px' }}>Добавить в «{selectedTeam.name}»</h2>
            <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px' }}>Выберите сотрудника</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '280px', overflowY: 'auto' }}>
              {availableEmployees.length === 0 ? (
                <p style={{ textAlign: 'center', fontSize: '13px', color: 'var(--text-muted)', padding: '20px' }}>Все сотрудники уже в команде</p>
              ) : availableEmployees.map((emp, i) => (
                <button key={emp.id} onClick={() => { addMember(selectedTeam.id, emp.id); setAddMemberOpen(false); setSelectedTeam(null); }}
                  style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px', borderRadius: '8px', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', transition: 'background 0.15s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'var(--bg-secondary)'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                  <div style={{ width: '30px', height: '30px', borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                    <span style={{ color: 'white', fontSize: '11px', fontWeight: 600 }}>{emp.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{emp.name}</p>
                    <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>{emp.email}</p>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={() => { setAddMemberOpen(false); setSelectedTeam(null); }}
              style={{ width: '100%', marginTop: '12px', padding: '8px', fontSize: '13px', color: 'var(--text-muted)', background: 'var(--bg-secondary)', border: 'none', borderRadius: '8px', cursor: 'pointer' }}>Закрыть</button>
          </div>
        </div>
      )}
    </div>
  );
}
