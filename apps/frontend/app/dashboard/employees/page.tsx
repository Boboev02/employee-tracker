'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const AVATAR_COLORS = ['#7F77DD','#2563EB','#16A34A','#D97706','#DC2626','#0891B2','#7C3AED'];
const avatarColor = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0)??0) % AVATAR_COLORS.length];
const STATUS_STYLES: Record<string,{c:string;bg:string;l:string}> = {
  ACTIVE:    { c:'#16A34A', bg:'#DCFCE7', l:'Активен' },
  INACTIVE:  { c:'#6B7280', bg:'#F3F4F6', l:'Неактивен' },
  SUSPENDED: { c:'#DC2626', bg:'#FEE2E2', l:'Заблокирован' },
};
const ROLE_STYLES: Record<string,{c:string;bg:string}> = {
  ADMIN:    { c:'#D97706', bg:'#FEF3C7' },
  MANAGER:  { c:'#2563EB', bg:'#DBEAFE' },
  EMPLOYEE: { c:'#7F77DD', bg:'#EDE9FE' },
};

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
    e.preventDefault(); setInviteError('');
    const t = localStorage.getItem('access_token');
    if (!t) return;
    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/employees/invite', {
        method:'POST', headers:{ Authorization:'Bearer '+t, 'Content-Type':'application/json' },
        body: JSON.stringify(invite),
      });
      const data = await res.json();
      if (!res.ok) { setInviteError(data.message??'Ошибка'); return; }
      setShowInvite(false); setInvite({ name:'', email:'', password:'', role:'EMPLOYEE' }); loadData(t);
    } catch { setInviteError('Ошибка подключения'); }
  };

  const filtered = employees.filter(e => e.name?.toLowerCase().includes(search.toLowerCase()) || e.email?.toLowerCase().includes(search.toLowerCase()));
  const onlineCount = Object.values(presence).filter((p:any)=>p.isOnline||p.status==='ONLINE').length;
  const card: React.CSSProperties = { background:'white', borderRadius:'20px', padding:'18px 20px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' };
  const inp: React.CSSProperties = { width:'100%', background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'10px', padding:'9px 14px', fontSize:'13px', color:'#1a1040', outline:'none', boxSizing:'border-box', transition:'border-color 0.15s' };

  return (
    <div style={{ minHeight:'100vh', background:'#ECEAF8' }}>
      {/* Header */}
      <div style={{ background:'white', padding:'16px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10, boxShadow:'0 4px 16px rgba(127,119,221,0.06)' }}>
        <div>
          <h1 style={{ fontSize:'18px', fontWeight:800, color:'#1a1040', margin:0, letterSpacing:'-0.5px' }}>Сотрудники</h1>
          <p style={{ fontSize:'11px', color:'#9B97CC', margin:'2px 0 0' }}>{employees.length} всего · {onlineCount} онлайн</p>
        </div>
        <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
          <div style={{ position:'relative' }}>
            <i className="ti ti-search" style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', fontSize:'14px', color:'#9B97CC' }} aria-hidden="true" />
            <input placeholder="Поиск..." value={search} onChange={e=>setSearch(e.target.value)}
              style={{ ...inp, width:'220px', paddingLeft:'34px' }} />
          </div>
          <button onClick={()=>setShowInvite(true)}
            style={{ background:'linear-gradient(135deg,#7F77DD,#5248C5)', color:'white', border:'none', borderRadius:'20px', padding:'9px 20px', fontSize:'13px', fontWeight:700, cursor:'pointer', boxShadow:'0 4px 12px rgba(127,119,221,0.3)' }}>
            + Пригласить
          </button>
        </div>
      </div>

      <div style={{ padding:'20px 28px', display:'flex', flexDirection:'column', gap:'16px' }}>
        {/* KPI */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'14px' }}>
          {[
            { l:'Всего сотрудников', v:employees.length, badge:'+0', badgeC:'#7F77DD', badgeBg:'#EDE9FE', icon:'ti-users', accent:'#7F77DD', accBg:'#EDE9FE' },
            { l:'Онлайн сейчас',     v:onlineCount,       badge:'● онлайн', badgeC:'#16A34A', badgeBg:'#DCFCE7', icon:'ti-circle-check', accent:'#16A34A', accBg:'#DCFCE7' },
            { l:'Активных',          v:employees.filter(e=>e.status==='ACTIVE').length, badge:'активны', badgeC:'#2563EB', badgeBg:'#DBEAFE', icon:'ti-user-check', accent:'#2563EB', accBg:'#DBEAFE' },
          ].map((k,i) => (
            <div key={i} style={{ ...card, position:'relative', overflow:'hidden' }}>
              <div style={{ position:'absolute', top:'14px', right:'14px', fontSize:'10px', fontWeight:700, color:k.badgeC, background:k.badgeBg, padding:'2px 8px', borderRadius:'10px' }}>{k.badge}</div>
              <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:k.accBg, display:'flex', alignItems:'center', justifyContent:'center', marginBottom:'12px' }}>
                <i className={'ti '+k.icon} style={{ fontSize:'20px', color:k.accent }} aria-hidden="true" />
              </div>
              <p style={{ fontSize:'10px', color:'#9B97CC', margin:'0 0 4px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.5px' }}>{k.l}</p>
              <p style={{ fontSize:'28px', fontWeight:800, color:'#1a1040', margin:0, letterSpacing:'-1px' }}>{k.v}</p>
            </div>
          ))}
        </div>

        {/* Table */}
        <div style={card}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
            <h2 style={{ fontSize:'15px', fontWeight:700, color:'#1a1040', margin:0 }}>Список сотрудников</h2>
            <span style={{ fontSize:'11px', color:'#9B97CC' }}>{filtered.length} записей</span>
          </div>
          <div style={{ overflow:'hidden', borderRadius:'12px', border:'1px solid #F3F0FF' }}>
            <div style={{ display:'grid', gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1.2fr 100px', padding:'8px 16px', background:'#F8F7FF', borderBottom:'1px solid #F3F0FF' }}>
              {['Сотрудник','Email','Роль','Статус','Активность',''].map(h=>(
                <span key={h} style={{ fontSize:'10px', fontWeight:600, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px' }}>{h}</span>
              ))}
            </div>
            {loading ? (
              <div style={{ padding:'40px', textAlign:'center', color:'#9B97CC' }}>Загрузка...</div>
            ) : filtered.length===0 ? (
              <div style={{ padding:'40px', textAlign:'center', color:'#9B97CC' }}>Нет сотрудников</div>
            ) : filtered.map((emp:any, i:number) => {
              const pres = presence[emp.id] ?? presence[emp.userId];
              const isOnline = pres?.isOnline || pres?.status==='ONLINE';
              const ss = STATUS_STYLES[emp.status] ?? STATUS_STYLES.ACTIVE;
              const rs = ROLE_STYLES[emp.roles?.[0]] ?? ROLE_STYLES.EMPLOYEE;
              return (
                <div key={emp.id}
                  style={{ display:'grid', gridTemplateColumns:'2fr 1.5fr 1fr 1fr 1.2fr 100px', padding:'11px 16px', borderBottom:i<filtered.length-1?'1px solid #FAF9FF':'none', alignItems:'center', cursor:'pointer', transition:'background 0.1s' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#F8F7FF'}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}
                  onClick={()=>router.push('/dashboard/employees/'+emp.id)}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px' }}>
                    <div style={{ position:'relative', flexShrink:0 }}>
                      <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:avatarColor(emp.name), display:'flex', alignItems:'center', justifyContent:'center', fontWeight:700, fontSize:'13px', color:'white' }}>{emp.name?.charAt(0)}</div>
                      <span style={{ position:'absolute', bottom:0, right:0, width:'10px', height:'10px', borderRadius:'50%', background:isOnline?'#16A34A':'#D1D5DB', border:'2px solid white' }} />
                    </div>
                    <span style={{ fontSize:'13px', fontWeight:600, color:'#1a1040' }}>{emp.name}</span>
                  </div>
                  <span style={{ fontSize:'12px', color:'#6B7280' }}>{emp.email}</span>
                  <span style={{ fontSize:'10px', fontWeight:700, color:rs.c, background:rs.bg, padding:'3px 9px', borderRadius:'20px', display:'inline-block' }}>{emp.roles?.[0]??'EMPLOYEE'}</span>
                  <span style={{ fontSize:'10px', fontWeight:700, color:ss.c, background:ss.bg, padding:'3px 9px', borderRadius:'20px', display:'inline-block' }}>{ss.l}</span>
                  <span style={{ fontSize:'12px', color:isOnline?'#16A34A':'#9B97CC', fontWeight:isOnline?600:400 }}>{isOnline?'● Онлайн':'Офлайн'}</span>
                  <button onClick={e=>{e.stopPropagation();router.push('/dashboard/employees/'+emp.id);}}
                    style={{ fontSize:'11px', color:'#7F77DD', background:'#EDE9FE', border:'none', borderRadius:'20px', padding:'5px 12px', cursor:'pointer', fontWeight:600 }}>
                    Открыть →
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Invite Modal */}
      {showInvite && (
        <div style={{ position:'fixed', inset:0, background:'rgba(26,16,64,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(4px)' }}>
          <div style={{ background:'white', borderRadius:'24px', padding:'28px 32px', width:'420px', boxShadow:'0 24px 64px rgba(127,119,221,0.2)' }}>
            <h3 style={{ fontSize:'18px', fontWeight:800, color:'#1a1040', margin:'0 0 22px', letterSpacing:'-0.5px' }}>Пригласить сотрудника</h3>
            <form onSubmit={handleInvite} style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              {[['Имя','name','text','Иван Иванов'],['Email','email','email','ivan@company.ru'],['Пароль','password','password','Минимум 6 символов']].map(([label,field,type,ph]) => (
                <div key={field as string}>
                  <label style={{ fontSize:'11px', fontWeight:600, color:'#9B97CC', letterSpacing:'0.4px', display:'block', marginBottom:'6px', textTransform:'uppercase' }}>{label as string}</label>
                  <input type={type as string} placeholder={ph as string} required value={(invite as any)[field as string]}
                    onChange={e=>setInvite({...invite,[field as string]:e.target.value})}
                    style={inp}
                    onFocus={e=>(e.target as HTMLElement).style.borderColor='#7F77DD'}
                    onBlur={e=>(e.target as HTMLElement).style.borderColor='#EDE9FE'} />
                </div>
              ))}
              <div>
                <label style={{ fontSize:'11px', fontWeight:600, color:'#9B97CC', letterSpacing:'0.4px', display:'block', marginBottom:'6px', textTransform:'uppercase' }}>Роль</label>
                <select value={invite.role} onChange={e=>setInvite({...invite,role:e.target.value})} style={inp}>
                  <option value="EMPLOYEE">Сотрудник</option>
                  <option value="MANAGER">Менеджер</option>
                  <option value="ADMIN">Администратор</option>
                </select>
              </div>
              {inviteError && <div style={{ background:'#FEE2E2', color:'#DC2626', borderRadius:'10px', padding:'8px 14px', fontSize:'12px' }}>{inviteError}</div>}
              <div style={{ display:'flex', gap:'10px', marginTop:'6px' }}>
                <button type="button" onClick={()=>setShowInvite(false)} style={{ flex:1, background:'#F8F7FF', color:'#6B7280', border:'1px solid #EDE9FE', borderRadius:'12px', padding:'11px', fontSize:'13px', cursor:'pointer', fontWeight:600 }}>Отмена</button>
                <button type="submit" style={{ flex:1, background:'linear-gradient(135deg,#7F77DD,#5248C5)', color:'white', border:'none', borderRadius:'12px', padding:'11px', fontSize:'13px', cursor:'pointer', fontWeight:700 }}>Пригласить →</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
