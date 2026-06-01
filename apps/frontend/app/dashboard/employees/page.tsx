'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const STATUS_COLORS: Record<string,string> = { ACTIVE:'#43A047', INACTIVE:'#aaa', SUSPENDED:'#E53935' };
const STATUS_LABELS: Record<string,string> = { ACTIVE:'Активен', INACTIVE:'Неактивен', SUSPENDED:'Заблокирован' };
const AVATAR_COLORS = ['#6C5CE7','#4A90E2','#43A047','#FB8C00','#E53935','#00ACC1','#8E24AA'];
const avatarColor = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0)??0) % AVATAR_COLORS.length];

export default function EmployeesPage() {
  const router = useRouter();
  const [employees, setEmployees] = useState<any[]>([]);
  const [presence, setPresence]   = useState<Record<string,any>>({});
  const [search, setSearch]       = useState('');
  const [loading, setLoading]     = useState(true);
  const [showInvite, setShowInvite] = useState(false);
  const [invite, setInvite]       = useState({ name:'', email:'', password:'', role:'EMPLOYEE' });
  const [inviteError, setInviteError] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    loadData(t);
  }, []);

  const loadData = async (t: string) => {
    try {
      const [emps, pres] = await Promise.all([
        fetch('https://employee-tracker.ru/api/v1/employees', { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
        fetch('https://employee-tracker.ru/api/v1/presence',  { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
      ]);
      if (Array.isArray(emps)) setEmployees(emps);
      if (pres && !pres.error) {
        if (Array.isArray(pres)) setPresence(Object.fromEntries(pres.map((p:any)=>[p.userId,p])));
        else setPresence(pres);
      }
    } catch(e) {} finally { setLoading(false); }
  };

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setInviteError('');
    const t = localStorage.getItem('access_token');
    if (!t) return;
    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/employees/invite', {
        method: 'POST', headers:{ Authorization:'Bearer '+t, 'Content-Type':'application/json' },
        body: JSON.stringify(invite),
      });
      const data = await res.json();
      if (!res.ok) { setInviteError(data.message??'Ошибка'); return; }
      setShowInvite(false);
      setInvite({ name:'', email:'', password:'', role:'EMPLOYEE' });
      loadData(t);
    } catch { setInviteError('Ошибка подключения'); }
  };

  const filtered = employees.filter(e =>
    e.name?.toLowerCase().includes(search.toLowerCase()) ||
    e.email?.toLowerCase().includes(search.toLowerCase())
  );
  const onlineCount = Object.values(presence).filter((p:any)=>p.isOnline||p.status==='ONLINE').length;

  const card: React.CSSProperties = { background:'#fff', borderRadius:'12px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', border:'1px solid #eee' };
  const inp: React.CSSProperties = { width:'100%', background:'#F5F3FC', border:'1.5px solid #E0DDF0', borderRadius:'8px', padding:'9px 12px', fontSize:'13px', color:'#1a1a2e', outline:'none', boxSizing:'border-box' };

  return (
    <div style={{ minHeight:'100vh', background:'#EBE8F6' }}>
      {/* Header */}
      <div style={{ background:'#fff', borderBottom:'1px solid #eee', padding:'16px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10, boxShadow:'0 2px 8px rgba(108,92,231,0.06)' }}>
        <div>
          <h1 style={{ fontSize:'18px', fontWeight:700, color:'#1a1a2e', margin:0 }}>Сотрудники</h1>
          <p style={{ fontSize:'12px', color:'#aaa', margin:'2px 0 0' }}>{employees.length} всего · {onlineCount} онлайн</p>
        </div>
        <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
          <input placeholder="Поиск по имени или email..." value={search} onChange={e=>setSearch(e.target.value)}
            style={{ ...inp, width:'240px' }} />
          <button onClick={()=>setShowInvite(true)}
            style={{ background:'#6C5CE7', color:'white', border:'none', borderRadius:'9px', padding:'9px 18px', fontSize:'13px', fontWeight:600, cursor:'pointer', boxShadow:'0 4px 12px rgba(108,92,231,0.3)' }}>
            + Пригласить
          </button>
        </div>
      </div>

      <div style={{ padding:'24px 28px' }}>
        {/* Stats row */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'14px', marginBottom:'20px' }}>
          {[
            { label:'Всего сотрудников', value:employees.length, color:'#6C5CE7', bg:'#EDE9FF', icon:'ti-users' },
            { label:'Онлайн сейчас',     value:onlineCount,       color:'#43A047', bg:'#E8F5E9', icon:'ti-circle-check' },
            { label:'Активных',          value:employees.filter(e=>e.status==='ACTIVE').length, color:'#4A90E2', bg:'#E3F2FD', icon:'ti-user-check' },
          ].map((s,i) => (
            <div key={i} style={{ ...card, padding:'16px 20px', display:'flex', alignItems:'center', gap:'14px' }}>
              <div style={{ width:'42px', height:'42px', borderRadius:'10px', background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                <i className={'ti '+s.icon} style={{ fontSize:'20px', color:s.color }} aria-hidden="true" />
              </div>
              <div>
                <p style={{ fontSize:'24px', fontWeight:700, color:'#1a1a2e', margin:0, lineHeight:1 }}>{s.value}</p>
                <p style={{ fontSize:'12px', color:'#aaa', margin:'4px 0 0' }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={card}>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid #f0f0f0' }}>
                {['Сотрудник','Email','Роль','Статус','Активность',''].map(h => (
                  <th key={h} style={{ padding:'12px 16px', textAlign:'left', fontSize:'11px', fontWeight:600, color:'#aaa', textTransform:'uppercase', letterSpacing:'0.6px' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} style={{ padding:'40px', textAlign:'center', color:'#aaa' }}>Загрузка...</td></tr>
              ) : filtered.length===0 ? (
                <tr><td colSpan={6} style={{ padding:'40px', textAlign:'center', color:'#aaa' }}>Нет сотрудников</td></tr>
              ) : filtered.map((emp:any) => {
                const pres = presence[emp.id] ?? presence[emp.userId];
                const isOnline = pres?.isOnline || pres?.status==='ONLINE';
                const lastActivity = pres?.lastActivityAt;
                return (
                  <tr key={emp.id} style={{ borderBottom:'1px solid #f9f9f9', cursor:'pointer', transition:'background 0.1s' }}
                    onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = '#F5F3FC'}
                    onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}
                    onClick={()=>router.push('/dashboard/employees/'+emp.id)}>
                    <td style={{ padding:'12px 16px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                        <div style={{ position:'relative', flexShrink:0 }}>
                          <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:avatarColor(emp.name), display:'flex', alignItems:'center', justifyContent:'center' }}>
                            <span style={{ color:'white', fontSize:'13px', fontWeight:600 }}>{emp.name?.charAt(0)}</span>
                          </div>
                          <span style={{ position:'absolute', bottom:0, right:0, width:'9px', height:'9px', borderRadius:'50%', background:isOnline?'#43A047':'#ddd', border:'2px solid white' }} />
                        </div>
                        <span style={{ fontSize:'13px', fontWeight:500, color:'#1a1a2e' }}>{emp.name}</span>
                      </div>
                    </td>
                    <td style={{ padding:'12px 16px', fontSize:'13px', color:'#666' }}>{emp.email}</td>
                    <td style={{ padding:'12px 16px' }}>
                      <span style={{ fontSize:'11px', fontWeight:600, color:'#6C5CE7', background:'#EDE9FF', padding:'3px 9px', borderRadius:'8px' }}>{emp.roles?.[0]??'EMPLOYEE'}</span>
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      <span style={{ fontSize:'11px', fontWeight:600, color:STATUS_COLORS[emp.status]??'#aaa', background:(STATUS_COLORS[emp.status]??'#aaa')+'15', padding:'3px 9px', borderRadius:'8px' }}>
                        {STATUS_LABELS[emp.status]??emp.status}
                      </span>
                    </td>
                    <td style={{ padding:'12px 16px', fontSize:'12px', color:isOnline?'#43A047':'#aaa' }}>
                      {isOnline ? '● Онлайн сейчас' : lastActivity ? new Date(lastActivity).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}) : '—'}
                    </td>
                    <td style={{ padding:'12px 16px' }}>
                      <button onClick={e=>{e.stopPropagation();router.push('/dashboard/employees/'+emp.id);}}
                        style={{ background:'#EDE9FF', color:'#6C5CE7', border:'none', borderRadius:'7px', padding:'5px 12px', fontSize:'12px', cursor:'pointer', fontWeight:500 }}>
                        Подробнее →
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Invite modal */}
      {showInvite && (
        <div style={{ position:'fixed', inset:0, background:'rgba(26,26,46,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(2px)' }}>
          <div style={{ background:'#fff', borderRadius:'16px', padding:'28px 32px', width:'420px', boxShadow:'0 16px 48px rgba(108,92,231,0.2)' }}>
            <h3 style={{ fontSize:'16px', fontWeight:700, color:'#1a1a2e', margin:'0 0 22px' }}>Пригласить сотрудника</h3>
            <form onSubmit={handleInvite} style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {[
                { label:'Имя', field:'name', type:'text', ph:'Иван Иванов' },
                { label:'Email', field:'email', type:'email', ph:'ivan@company.ru' },
                { label:'Пароль', field:'password', type:'password', ph:'Минимум 6 символов' },
              ].map(f => (
                <div key={f.field}>
                  <label style={{ fontSize:'11px', fontWeight:600, color:'#888', letterSpacing:'0.3px', display:'block', marginBottom:'6px' }}>{f.label.toUpperCase()}</label>
                  <input type={f.type} placeholder={f.ph} required value={(invite as any)[f.field]}
                    onChange={e => setInvite({...invite, [f.field]:e.target.value})} style={inp} />
                </div>
              ))}
              <div>
                <label style={{ fontSize:'11px', fontWeight:600, color:'#888', letterSpacing:'0.3px', display:'block', marginBottom:'6px' }}>РОЛЬ</label>
                <select value={invite.role} onChange={e=>setInvite({...invite,role:e.target.value})} style={inp}>
                  <option value="EMPLOYEE">Сотрудник</option>
                  <option value="MANAGER">Менеджер</option>
                  <option value="ADMIN">Администратор</option>
                </select>
              </div>
              {inviteError && <div style={{ background:'#FFEBEE', color:'#C62828', borderRadius:'8px', padding:'8px 12px', fontSize:'12px' }}>{inviteError}</div>}
              <div style={{ display:'flex', gap:'10px', marginTop:'8px' }}>
                <button type="button" onClick={()=>setShowInvite(false)}
                  style={{ flex:1, background:'#F5F3FC', color:'#666', border:'1px solid #E0DDF0', borderRadius:'9px', padding:'10px', fontSize:'13px', cursor:'pointer', fontWeight:500 }}>
                  Отмена
                </button>
                <button type="submit"
                  style={{ flex:1, background:'#6C5CE7', color:'white', border:'none', borderRadius:'9px', padding:'10px', fontSize:'13px', cursor:'pointer', fontWeight:600 }}>
                  Пригласить →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
