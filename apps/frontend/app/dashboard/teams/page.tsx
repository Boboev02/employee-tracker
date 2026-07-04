'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/usePermissions';

const AVATAR_COLORS = ['#7F77DD','#2563EB','#16A34A','#D97706','#DC2626','#0891B2'];
const avatarColor = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0)??0) % AVATAR_COLORS.length];

export default function TeamsPage() {
  const router = useRouter();
  const perms  = usePermissions();
  const [teams, setTeams]         = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading]     = useState(true);
  const [token, setToken]         = useState('');
  const [showForm, setShowForm]   = useState(false);
  const [teamName, setTeamName]   = useState('');
  const [saving, setSaving]       = useState(false);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [addMemberOpen, setAddMemberOpen] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t); loadAll(t);
  }, []);

  const loadAll = async (t: string) => {
    setLoading(true);
    const [tr, er] = await Promise.all([
      fetch('https://employee-tracker.ru/api/v1/teams',     { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
      fetch('https://employee-tracker.ru/api/v1/employees', { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
    ]);
    setTeams(Array.isArray(tr)?tr:[]); setEmployees(Array.isArray(er)?er:[]);
    setLoading(false);
  };

  const createTeam = async (e: React.FormEvent) => {
    e.preventDefault(); setSaving(true);
    await fetch('https://employee-tracker.ru/api/v1/teams', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+token }, body:JSON.stringify({ name:teamName }) });
    setTeamName(''); setShowForm(false); loadAll(token); setSaving(false);
  };

  const deleteTeam = async (id: string) => {
    if (!confirm('Удалить команду?')) return;
    await fetch('https://employee-tracker.ru/api/v1/teams/'+id, { method:'DELETE', headers:{ Authorization:'Bearer '+token } });
    loadAll(token);
  };

  const addMember = async (teamId: string, userId: string) => {
    await fetch('https://employee-tracker.ru/api/v1/teams/'+teamId+'/members', { method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+token }, body:JSON.stringify({ userId }) });
    loadAll(token);
  };

  const removeMember = async (teamId: string, userId: string) => {
    await fetch('https://employee-tracker.ru/api/v1/teams/'+teamId+'/members/'+userId, { method:'DELETE', headers:{ Authorization:'Bearer '+token } });
    loadAll(token);
  };

  const availableEmployees = selectedTeam ? employees.filter(e=>!selectedTeam.members.find((m:any)=>m.id===e.id)) : [];
  const card: React.CSSProperties = { background:'white', borderRadius:'20px', padding:'20px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' };
  const inp: React.CSSProperties  = { width:'100%', background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'10px', padding:'9px 14px', fontSize:'13px', color:'#1a1040', outline:'none', boxSizing:'border-box' };
  const modal: React.CSSProperties = { position:'fixed', inset:0, background:'rgba(26,16,64,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(4px)' };

  return (
    <div style={{ minHeight:'100vh', background:'#ECEAF8' }}>
      <div style={{ background:'white', padding:'16px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10, boxShadow:'0 4px 16px rgba(127,119,221,0.06)' }}>
        <div>
          <h1 style={{ fontSize:'18px', fontWeight:800, color:'#1a1040', margin:0 }}>Команды</h1>
          <p style={{ fontSize:'11px', color:'#9B97CC', margin:'2px 0 0' }}>{teams.length} команд · {employees.length} сотрудников</p>
        </div>
        {perms.canCreateTeams && (
          <button onClick={()=>setShowForm(true)}
            style={{ background:'linear-gradient(135deg,#7F77DD,#5248C5)', color:'white', border:'none', borderRadius:'20px', padding:'9px 20px', fontSize:'13px', fontWeight:700, cursor:'pointer', boxShadow:'0 4px 12px rgba(127,119,221,0.3)', display:'flex', alignItems:'center', gap:'6px' }}>
            <i className="ti ti-users-plus" style={{ fontSize:'15px' }} aria-hidden="true"/> Создать команду
          </button>
        )}
      </div>

      <div style={{ padding:'20px 28px' }}>
        {loading ? (
          <div style={{ ...card, padding:'60px', textAlign:'center', color:'#9B97CC' }}>Загрузка...</div>
        ) : teams.length===0 ? (
          <div style={{ ...card, padding:'60px', textAlign:'center' }}>
            <div style={{ fontSize:'52px', marginBottom:'16px' }}>👥</div>
            <p style={{ fontSize:'16px', fontWeight:700, color:'#1a1040', margin:'0 0 6px' }}>Нет команд</p>
            <p style={{ fontSize:'13px', color:'#9B97CC', margin:'0 0 20px' }}>Создайте первую команду и добавьте сотрудников</p>
            {perms.canCreateTeams && (
              <button onClick={()=>setShowForm(true)} style={{ background:'linear-gradient(135deg,#7F77DD,#5248C5)', color:'white', border:'none', borderRadius:'20px', padding:'10px 24px', fontSize:'13px', fontWeight:700, cursor:'pointer' }}>
                + Создать команду
              </button>
            )}
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(300px,1fr))', gap:'14px' }}>
            {teams.map((team, tIdx) => (
              <div key={team.id} className="float-in hover-lift" style={{ ...card, position:'relative', overflow:'hidden', animationDelay:(tIdx*0.08)+'s' }}>
                {/* Top accent */}
                <div style={{ position:'absolute', top:0, left:0, right:0, height:'4px', background:'linear-gradient(90deg,#7F77DD,#5248C5)' }}/>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px', marginTop:'4px' }}>
                  <div>
                    <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                      <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:'#EDE9FE', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        <i className="ti ti-users" style={{ fontSize:'20px', color:'#7F77DD' }} aria-hidden="true"/>
                      </div>
                      <div>
                        <p style={{ fontSize:'15px', fontWeight:700, color:'#1a1040', margin:0 }}>{team.name}</p>
                        <p style={{ fontSize:'11px', color:'#9B97CC', margin:'2px 0 0' }}>{team.memberCount} участников</p>
                      </div>
                    </div>
                  </div>
                  {perms.canManageTeams && (
                    <button onClick={()=>deleteTeam(team.id)}
                      style={{ width:'28px', height:'28px', background:'#FEE2E2', border:'none', borderRadius:'8px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', transition:'all 0.15s' }}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#FECACA'}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='#FEE2E2'}>
                      <i className="ti ti-trash" style={{ fontSize:'13px', color:'#DC2626' }} aria-hidden="true"/>
                    </button>
                  )}
                </div>

                <div style={{ display:'flex', flexDirection:'column', gap:'6px', marginBottom:'14px' }}>
                  {team.members.length===0 ? (
                    <p style={{ fontSize:'12px', color:'#9B97CC', textAlign:'center', padding:'12px', background:'#F8F7FF', borderRadius:'10px' }}>Нет участников</p>
                  ) : team.members.map((m:any) => (
                    <div key={m.id} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 10px', background:'#F8F7FF', borderRadius:'10px' }}>
                      <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:avatarColor(m.name), display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <span style={{ color:'white', fontSize:'10px', fontWeight:700 }}>{m.name?.charAt(0)}</span>
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <p style={{ fontSize:'12px', fontWeight:600, color:'#1a1040', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{m.name}</p>
                        <p style={{ fontSize:'10px', color:'#9B97CC', margin:0 }}>{m.roles?.[0]}</p>
                      </div>
                      {perms.canManageTeams && (
                        <button onClick={()=>removeMember(team.id, m.id)}
                          style={{ width:'20px', height:'20px', background:'none', border:'none', cursor:'pointer', color:'#C4C0E8', fontSize:'14px', display:'flex', alignItems:'center', justifyContent:'center', borderRadius:'4px', transition:'all 0.15s' }}
                          onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color='#DC2626';}}
                          onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color='#C4C0E8';}}>
                          <i className="ti ti-x" style={{ fontSize:'12px' }} aria-hidden="true"/>
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                {perms.canManageTeams && (
                  <button onClick={()=>{ setSelectedTeam(team); setAddMemberOpen(true); }}
                    style={{ width:'100%', padding:'9px', fontSize:'12px', fontWeight:700, color:'#7F77DD', background:'#EDE9FE', border:'1.5px dashed #C4BFED', borderRadius:'12px', cursor:'pointer', transition:'all 0.15s' }}
                    onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='#DDD6FE';}}
                    onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='#EDE9FE';}}>
                    <i className="ti ti-user-plus" style={{ fontSize:'13px', marginRight:'5px' }} aria-hidden="true"/>
                    Добавить участника
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Create modal */}
      {showForm && (
        <div style={modal}>
          <div style={{ background:'white', borderRadius:'24px', padding:'28px 32px', width:'400px', boxShadow:'0 24px 64px rgba(127,119,221,0.2)' }}>
            <h2 style={{ fontSize:'18px', fontWeight:800, color:'#1a1040', margin:'0 0 22px' }}>Новая команда</h2>
            <form onSubmit={createTeam} style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <input value={teamName} onChange={e=>setTeamName(e.target.value)} placeholder="Название команды" required autoFocus style={inp}/>
              <div style={{ display:'flex', gap:'10px' }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:'#F8F7FF', color:'#6B7280', border:'1px solid #EDE9FE', borderRadius:'12px', padding:'11px', fontSize:'13px', cursor:'pointer', fontWeight:600 }}>Отмена</button>
                <button type="submit" disabled={saving} style={{ flex:1, background:'linear-gradient(135deg,#7F77DD,#5248C5)', color:'white', border:'none', borderRadius:'12px', padding:'11px', fontSize:'13px', cursor:'pointer', fontWeight:700 }}>{saving?'Создаю...':'Создать →'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add member modal */}
      {addMemberOpen && selectedTeam && (
        <div style={modal}>
          <div style={{ background:'white', borderRadius:'24px', padding:'28px 32px', width:'400px', boxShadow:'0 24px 64px rgba(127,119,221,0.2)' }}>
            <h2 style={{ fontSize:'18px', fontWeight:800, color:'#1a1040', margin:'0 0 4px' }}>Добавить участника</h2>
            <p style={{ fontSize:'12px', color:'#9B97CC', margin:'0 0 16px' }}>в команду «{selectedTeam.name}»</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'4px', maxHeight:'280px', overflowY:'auto' }}>
              {availableEmployees.length===0 ? (
                <p style={{ textAlign:'center', fontSize:'13px', color:'#9B97CC', padding:'20px' }}>Все сотрудники уже в команде</p>
              ) : availableEmployees.map(emp=>(
                <button key={emp.id} onClick={()=>{ addMember(selectedTeam.id, emp.id); setAddMemberOpen(false); setSelectedTeam(null); }}
                  style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px 12px', borderRadius:'12px', background:'transparent', border:'none', cursor:'pointer', textAlign:'left', transition:'background 0.1s' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#F8F7FF'}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                  <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:avatarColor(emp.name), display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <span style={{ color:'white', fontSize:'12px', fontWeight:700 }}>{emp.name?.charAt(0)}</span>
                  </div>
                  <div>
                    <p style={{ fontSize:'13px', fontWeight:600, color:'#1a1040', margin:0 }}>{emp.name}</p>
                    <p style={{ fontSize:'11px', color:'#9B97CC', margin:0 }}>{emp.email}</p>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={()=>{ setAddMemberOpen(false); setSelectedTeam(null); }}
              style={{ width:'100%', marginTop:'12px', padding:'10px', fontSize:'13px', color:'#6B7280', background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'12px', cursor:'pointer', fontWeight:600 }}>
              Закрыть
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
