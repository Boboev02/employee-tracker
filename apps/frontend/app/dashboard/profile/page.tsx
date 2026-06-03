'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const AVATAR_COLORS = ['#7F77DD','#2563EB','#16A34A','#D97706','#DC2626','#0891B2','#7C3AED'];
const avatarColor = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0)??0) % AVATAR_COLORS.length];

const ROLE_LABELS: Record<string,string> = {
  ADMIN: 'Администратор', MANAGER: 'Менеджер', EMPLOYEE: 'Сотрудник',
};

export default function ProfilePage() {
  const router = useRouter();
  const [user, setUser]       = useState<any>(null);
  const [token, setToken]     = useState('');
  const [loading, setLoading] = useState(true);

  // Password change
  const [curPass,  setCurPass]  = useState('');
  const [newPass,  setNewPass]  = useState('');
  const [confPass, setConfPass] = useState('');
  const [passErr,  setPassErr]  = useState('');
  const [passDone, setPassDone] = useState(false);
  const [saving,   setSaving]   = useState(false);

  // Stats
  const [stats, setStats] = useState<any>(null);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    const u = localStorage.getItem('user');
    if (!t || !u) { router.push('/login'); return; }
    setToken(t);
    const parsed = JSON.parse(u);
    setUser(parsed);
    loadMe(t);
    loadStats(t, parsed.id);
  }, []);

  const loadMe = async (t: string) => {
    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/auth/me', { headers:{ Authorization:'Bearer '+t } });
      const data = await res.json();
      if (data && !data.error) {
        setUser((prev: any) => ({ ...prev, ...data }));
        localStorage.setItem('user', JSON.stringify({ ...JSON.parse(localStorage.getItem('user')||'{}'), ...data }));
      }
    } finally { setLoading(false); }
  };

  const loadStats = async (t: string, userId: string) => {
    try {
      const res = await fetch(`https://employee-tracker.ru/api/v1/analytics/activity/summary?days=30&userId=${userId}`, { headers:{ Authorization:'Bearer '+t } });
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) setStats(data[0]);
    } catch {}
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassErr(''); setPassDone(false);
    if (newPass.length < 6) { setPassErr('Минимум 6 символов'); return; }
    if (newPass !== confPass) { setPassErr('Пароли не совпадают'); return; }
    setSaving(true);
    try {
      // Проверяем текущий пароль через логин
      const check = await fetch('https://employee-tracker.ru/api/v1/auth/login', {
        method:'POST', headers:{ 'Content-Type':'application/json' },
        body: JSON.stringify({ email: user.email, password: curPass }),
      });
      if (!check.ok) { setPassErr('Неверный текущий пароль'); return; }

      // Меняем пароль через reset (admin endpoint) — используем свой токен
      const res = await fetch(`https://employee-tracker.ru/api/v1/employees/${user.id}/reset-password`, {
        method:'PATCH', headers:{ Authorization:'Bearer '+token, 'Content-Type':'application/json' },
        body: JSON.stringify({ password: newPass }),
      });
      if (!res.ok) { setPassErr('Ошибка смены пароля'); return; }
      setCurPass(''); setNewPass(''); setConfPass('');
      setPassDone(true);
      setTimeout(() => setPassDone(false), 3000);
    } catch { setPassErr('Ошибка подключения'); }
    finally { setSaving(false); }
  };

  if (loading || !user) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'200px', color:'#9B97CC', fontSize:'13px' }}>
      Загрузка...
    </div>
  );

  const card: React.CSSProperties = { background:'white', borderRadius:'20px', padding:'20px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' };
  const inp: React.CSSProperties  = { width:'100%', background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', color:'#1a1040', outline:'none', boxSizing:'border-box' };

  const totalSections = stats ? Object.keys(stats.sections ?? {}).length : 0;
  const topSection = stats ? Object.entries(stats.sections ?? {}).sort((a:any,b:any)=>b[1].events-a[1].events)[0] : null;

  return (
    <div style={{ minHeight:'100vh', background:'#ECEAF8' }}>
      {/* Header */}
      <div style={{ background:'white', padding:'16px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10, boxShadow:'0 4px 16px rgba(127,119,221,0.06)' }}>
        <div>
          <h1 style={{ fontSize:'18px', fontWeight:800, color:'#1a1040', margin:0 }}>Мой профиль</h1>
          <p style={{ fontSize:'11px', color:'#9B97CC', margin:'2px 0 0' }}>Личные данные и настройки</p>
        </div>
      </div>

      <div style={{ padding:'20px 28px', display:'grid', gridTemplateColumns:'320px 1fr', gap:'16px', alignItems:'start' }}>

        {/* Left — profile card */}
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

          {/* Avatar + info */}
          <div style={{ ...card, textAlign:'center', padding:'32px 20px' }}>
            <div style={{ width:'80px', height:'80px', borderRadius:'50%', background:avatarColor(user.name), display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 16px', boxShadow:`0 8px 24px ${avatarColor(user.name)}40` }}>
              <span style={{ color:'white', fontSize:'32px', fontWeight:800 }}>{user.name?.charAt(0)}</span>
            </div>
            <h2 style={{ fontSize:'20px', fontWeight:800, color:'#1a1040', margin:'0 0 6px', letterSpacing:'-0.5px' }}>{user.name}</h2>
            <p style={{ fontSize:'13px', color:'#9B97CC', margin:'0 0 12px' }}>{user.email}</p>
            <div style={{ display:'flex', gap:'6px', justifyContent:'center', flexWrap:'wrap' }}>
              {(user.roles??['EMPLOYEE']).map((role: string) => (
                <span key={role} style={{ fontSize:'11px', fontWeight:700, color:'#7F77DD', background:'#EDE9FE', padding:'3px 10px', borderRadius:'20px' }}>
                  {ROLE_LABELS[role] ?? role}
                </span>
              ))}
            </div>
          </div>

          {/* Stats за 30 дней */}
          <div style={card}>
            <p style={{ fontSize:'11px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 14px' }}>Активность за 30 дней</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              {[
                { l:'Кликов',    v:stats?.totalEvents ?? 0,   icon:'ti-mouse',        c:'#7F77DD', bg:'#EDE9FE' },
                { l:'Активных дней', v:stats?.activeDays ?? 0, icon:'ti-calendar',   c:'#2563EB', bg:'#DBEAFE' },
                { l:'Разделов',  v:totalSections,              icon:'ti-layout-grid', c:'#16A34A', bg:'#DCFCE7' },
              ].map((s,i)=>(
                <div key={i} style={{ display:'flex', alignItems:'center', gap:'12px', padding:'10px 12px', background:'#F8F7FF', borderRadius:'12px' }}>
                  <div style={{ width:'32px', height:'32px', borderRadius:'10px', background:s.bg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <i className={'ti '+s.icon} style={{ fontSize:'16px', color:s.c }} aria-hidden="true"/>
                  </div>
                  <div style={{ flex:1 }}>
                    <p style={{ fontSize:'10px', color:'#9B97CC', margin:0, fontWeight:600 }}>{s.l}</p>
                    <p style={{ fontSize:'18px', fontWeight:800, color:'#1a1040', margin:0, letterSpacing:'-0.5px' }}>{s.v.toLocaleString('ru')}</p>
                  </div>
                </div>
              ))}
              {topSection && (
                <div style={{ padding:'10px 12px', background:'#F8F7FF', borderRadius:'12px', display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ width:'32px', height:'32px', borderRadius:'10px', background:'#FEF3C7', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <i className="ti ti-star" style={{ fontSize:'16px', color:'#D97706' }} aria-hidden="true"/>
                  </div>
                  <div>
                    <p style={{ fontSize:'10px', color:'#9B97CC', margin:0, fontWeight:600 }}>Топ раздел</p>
                    <p style={{ fontSize:'13px', fontWeight:700, color:'#1a1040', margin:0 }}>
                      {(topSection[0] as string).split(':')[1]}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right */}
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

          {/* Account info */}
          <div style={card}>
            <p style={{ fontSize:'11px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 16px' }}>Данные аккаунта</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div>
                  <label style={{ fontSize:'10px', fontWeight:700, color:'#9B97CC', display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.4px' }}>Имя</label>
                  <div style={{ ...inp, color:'#6B7280', cursor:'not-allowed', background:'#F3F4F6', border:'1px solid #E5E7EB' }}>{user.name}</div>
                </div>
                <div>
                  <label style={{ fontSize:'10px', fontWeight:700, color:'#9B97CC', display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.4px' }}>Email</label>
                  <div style={{ ...inp, color:'#6B7280', cursor:'not-allowed', background:'#F3F4F6', border:'1px solid #E5E7EB' }}>{user.email}</div>
                </div>
              </div>
              <div style={{ padding:'12px 14px', background:'#F8F7FF', borderRadius:'12px', fontSize:'12px', color:'#9B97CC', display:'flex', alignItems:'center', gap:'8px' }}>
                <i className="ti ti-info-circle" style={{ fontSize:'16px', color:'#7F77DD', flexShrink:0 }} aria-hidden="true"/>
                Для изменения имени или email обратитесь к администратору
              </div>
            </div>
          </div>

          {/* Change password */}
          <div style={card}>
            <p style={{ fontSize:'11px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 16px' }}>Смена пароля</p>
            <form onSubmit={handleChangePassword} style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              <div>
                <label style={{ fontSize:'10px', fontWeight:700, color:'#9B97CC', display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.4px' }}>Текущий пароль</label>
                <input type="password" value={curPass} onChange={e=>setCurPass(e.target.value)} placeholder="Введите текущий пароль" required style={inp}/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
                <div>
                  <label style={{ fontSize:'10px', fontWeight:700, color:'#9B97CC', display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.4px' }}>Новый пароль</label>
                  <input type="password" value={newPass} onChange={e=>setNewPass(e.target.value)} placeholder="Минимум 6 символов" required style={inp}/>
                </div>
                <div>
                  <label style={{ fontSize:'10px', fontWeight:700, color:'#9B97CC', display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.4px' }}>Подтверждение</label>
                  <input type="password" value={confPass} onChange={e=>setConfPass(e.target.value)} placeholder="Повторите пароль" required style={{ ...inp, borderColor:confPass&&confPass!==newPass?'#FCA5A5':'#EDE9FE' }}/>
                </div>
              </div>
              {passErr && (
                <div style={{ background:'#FEE2E2', color:'#DC2626', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', display:'flex', alignItems:'center', gap:'8px' }}>
                  <i className="ti ti-alert-circle" style={{ fontSize:'16px', flexShrink:0 }} aria-hidden="true"/>
                  {passErr}
                </div>
              )}
              {passDone && (
                <div style={{ background:'#DCFCE7', color:'#16A34A', borderRadius:'10px', padding:'10px 14px', fontSize:'13px', display:'flex', alignItems:'center', gap:'8px' }}>
                  <i className="ti ti-circle-check" style={{ fontSize:'16px', flexShrink:0 }} aria-hidden="true"/>
                  Пароль успешно изменён!
                </div>
              )}
              <div style={{ display:'flex', justifyContent:'flex-end' }}>
                <button type="submit" disabled={saving}
                  style={{ background:saving?'#EDE9FE':'linear-gradient(135deg,#7F77DD,#5248C5)', color:saving?'#C4C0E8':'white', border:'none', borderRadius:'12px', padding:'11px 24px', fontSize:'13px', fontWeight:700, cursor:saving?'not-allowed':'pointer', transition:'all 0.2s', boxShadow:saving?'none':'0 4px 12px rgba(127,119,221,0.3)', display:'flex', alignItems:'center', gap:'8px' }}>
                  <i className="ti ti-key" style={{ fontSize:'15px' }} aria-hidden="true"/>
                  {saving ? 'Сохранение...' : 'Сменить пароль'}
                </button>
              </div>
            </form>
          </div>

          {/* Security info */}
          <div style={card}>
            <p style={{ fontSize:'11px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 14px' }}>Безопасность</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              <div style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 14px', background:'#F8F7FF', borderRadius:'12px' }}>
                <i className="ti ti-shield-check" style={{ fontSize:'20px', color:'#16A34A' }} aria-hidden="true"/>
                <div>
                  <p style={{ fontSize:'13px', fontWeight:600, color:'#1a1040', margin:0 }}>Токен сессии активен</p>
                  <p style={{ fontSize:'11px', color:'#9B97CC', margin:0 }}>Срок действия 7 дней с момента входа</p>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:'12px', padding:'12px 14px', background:'#F8F7FF', borderRadius:'12px' }}>
                <i className="ti ti-device-desktop-analytics" style={{ fontSize:'20px', color:'#2563EB' }} aria-hidden="true"/>
                <div>
                  <p style={{ fontSize:'13px', fontWeight:600, color:'#1a1040', margin:0 }}>Расширение Chrome</p>
                  <p style={{ fontSize:'11px', color:'#9B97CC', margin:0 }}>Трекинг активности на WB и Ozon</p>
                </div>
              </div>
              <button onClick={()=>{ localStorage.removeItem('access_token'); localStorage.removeItem('user'); router.push('/login'); }}
                style={{ display:'flex', alignItems:'center', gap:'8px', padding:'11px 14px', background:'#FEE2E2', color:'#DC2626', border:'none', borderRadius:'12px', cursor:'pointer', fontSize:'13px', fontWeight:700, width:'100%', justifyContent:'center', transition:'all 0.15s' }}
                onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#FECACA'}
                onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='#FEE2E2'}>
                <i className="ti ti-logout" style={{ fontSize:'16px' }} aria-hidden="true"/>
                Выйти из аккаунта
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
