'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const API = 'https://employee-tracker.ru';

const STEPS = [
  { id:'welcome',   title:'Добро пожаловать', icon:'👋' },
  { id:'org',       title:'Ваша организация', icon:'🏢' },
  { id:'invite',    title:'Пригласите команду', icon:'👥' },
  { id:'extension', title:'Расширение Chrome', icon:'🔌' },
  { id:'done',      title:'Всё готово!', icon:'🎉' },
];

export default function OnboardingPage() {
  const router = useRouter();
  const [step, setStep]                   = useState(0);
  const [token, setToken]                 = useState('');
  const [user, setUser]                   = useState<any>(null);
  const [inviteEmail, setInviteEmail]     = useState('');
  const [inviteRole, setInviteRole]       = useState('EMPLOYEE');
  const [inviting, setInviting]           = useState(false);
  const [invitedCount, setInvitedCount]   = useState(0);
  const [inviteError, setInviteError]     = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [hoveredCard, setHoveredCard]     = useState<string|null>(null);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    const u = localStorage.getItem('user');
    if (!t || !u) { router.push('/login'); return; }
    setToken(t); setUser(JSON.parse(u));
    const parsed = JSON.parse(u);
    if (localStorage.getItem('onboarded_' + parsed.id)) router.push('/dashboard');
  }, []);

  const invite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true); setInviteError(''); setInviteSuccess('');
    try {
      const res = await fetch(`${API}/api/v1/employees/invite`, {
        method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
        body: JSON.stringify({ email:inviteEmail.trim(), role:inviteRole, name:inviteEmail.split('@')[0] }),
      });
      if (res.ok) { setInviteSuccess(inviteEmail + ' добавлен'); setInviteEmail(''); setInvitedCount(c=>c+1); }
      else { const d = await res.json(); setInviteError(d.message ?? 'Ошибка'); }
    } finally { setInviting(false); }
  };

  const finish = () => {
    const u = JSON.parse(localStorage.getItem('user') || '{}');
    localStorage.setItem('onboarded_' + u.id, 'true');
    router.push('/dashboard');
  };
  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep(s => Math.max(s - 1, 0));

  const btn = (onClick: ()=>void, label: string, variant: 'primary'|'ghost' = 'primary') => (
    <button onClick={onClick} style={{
      padding: variant==='primary' ? '11px 28px' : '11px 20px',
      borderRadius:'14px', border:'none', cursor:'pointer', fontSize:'14px', fontWeight:600,
      background: variant==='primary' ? 'linear-gradient(135deg,#7F77DD,#5248C5)' : 'transparent',
      color: variant==='primary' ? 'white' : '#9B97CC',
      boxShadow: variant==='primary' ? '0 6px 16px rgba(127,119,221,0.35)' : 'none',
      transition:'all 0.2s',
    }}>{label}</button>
  );

  return (
    <div style={{ minHeight:'100vh', background:'#ECEAF8', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', padding:'32px 16px' }}>

      {/* Logo */}
      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'32px' }}>
        <div style={{ width:'40px', height:'40px', borderRadius:'12px', background:'linear-gradient(135deg,#7F77DD,#5248C5)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 4px 12px rgba(127,119,221,0.4)' }}>
          <span style={{ fontSize:'18px' }}>ET</span>
        </div>
        <span style={{ fontSize:'18px', fontWeight:800, color:'#1a1040' }}>Employee Tracker</span>
      </div>

      {/* Step indicator */}
      <div style={{ display:'flex', alignItems:'center', gap:'0', marginBottom:'28px' }}>
        {STEPS.map((s, i) => (
          <div key={s.id} style={{ display:'flex', alignItems:'center' }}>
            <div style={{ width:'36px', height:'36px', borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'13px', fontWeight:700, transition:'all 0.3s',
              background: i < step ? '#16A34A' : i===step ? 'linear-gradient(135deg,#7F77DD,#5248C5)' : 'white',
              color: i <= step ? 'white' : '#C4C0E8',
              boxShadow: i===step ? '0 0 0 4px rgba(127,119,221,0.2)' : '0 2px 8px rgba(0,0,0,0.06)',
              border: i > step ? '2px solid #EDE9FE' : 'none',
            }}>
              {i < step ? '✓' : i+1}
            </div>
            {i < STEPS.length-1 && (
              <div style={{ width:'48px', height:'2px', background: i < step ? '#16A34A' : '#EDE9FE', margin:'0 0', transition:'background 0.3s' }}/>
            )}
          </div>
        ))}
      </div>

      {/* Main card */}
      <div style={{ background:'white', borderRadius:'28px', boxShadow:'0 8px 40px rgba(127,119,221,0.12)', padding:'40px', width:'100%', maxWidth:'560px', transition:'all 0.3s' }}>

        {/* Step 0 — Welcome */}
        {step===0 && (
          <div style={{ textAlign:'center' }}>
            <div style={{ width:'80px', height:'80px', borderRadius:'24px', background:'linear-gradient(135deg,#EDE9FE,#7F77DD20)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'40px', margin:'0 auto 20px' }}>👋</div>
            <h1 style={{ fontSize:'26px', fontWeight:800, color:'#1a1040', margin:'0 0 10px' }}>Добро пожаловать{user?.name ? `, ${user.name}!` : '!'}</h1>
            <p style={{ fontSize:'14px', color:'#9B97CC', margin:'0 0 32px', lineHeight:1.7 }}>
              Employee Tracker поможет отслеживать активность команды на Wildberries и Ozon,<br/>управлять задачами и анализировать продуктивность.
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px', marginBottom:'32px' }}>
              {[
                { icon:'📊', title:'Аналитика', desc:'Активность на WB и Ozon', color:'#EDE9FE', accent:'#7F77DD' },
                { icon:'✅', title:'Задачи',    desc:'Канбан для команды',       color:'#DCFCE7', accent:'#16A34A' },
                { icon:'⏱',  title:'Табель',   desc:'Учёт рабочего времени',   color:'#FEF3C7', accent:'#D97706' },
              ].map(f => (
                <div key={f.title} style={{ background:f.color, borderRadius:'16px', padding:'16px 12px', textAlign:'center' }}>
                  <div style={{ fontSize:'28px', marginBottom:'8px' }}>{f.icon}</div>
                  <p style={{ fontSize:'13px', fontWeight:700, color:'#1a1040', margin:'0 0 4px' }}>{f.title}</p>
                  <p style={{ fontSize:'11px', color:'#6B7280', margin:0, lineHeight:1.4 }}>{f.desc}</p>
                </div>
              ))}
            </div>
            {btn(next, 'Начать настройку →')}
          </div>
        )}

        {/* Step 1 — Org */}
        {step===1 && (
          <div>
            <div style={{ textAlign:'center', marginBottom:'28px' }}>
              <div style={{ width:'64px', height:'64px', borderRadius:'20px', background:'#EDE9FE', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'32px', margin:'0 auto 16px' }}>🏢</div>
              <h2 style={{ fontSize:'22px', fontWeight:800, color:'#1a1040', margin:'0 0 6px' }}>Ваша организация</h2>
              <p style={{ fontSize:'13px', color:'#9B97CC', margin:0 }}>Вот что мы знаем о вашей компании</p>
            </div>
            <div style={{ background:'#F8F7FF', borderRadius:'16px', padding:'20px', marginBottom:'16px', display:'flex', flexDirection:'column', gap:'14px' }}>
              {[
                { label:'Администратор', value: user?.name },
                { label:'Email',         value: user?.email },
                { label:'Роль',          value: 'ADMIN', badge:true },
              ].map(row => (
                <div key={row.label} style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:'13px', color:'#9B97CC' }}>{row.label}</span>
                  {row.badge
                    ? <span style={{ fontSize:'11px', fontWeight:700, color:'#7F77DD', background:'#EDE9FE', padding:'3px 10px', borderRadius:'20px' }}>{row.value}</span>
                    : <span style={{ fontSize:'13px', fontWeight:600, color:'#1a1040' }}>{row.value}</span>}
                </div>
              ))}
            </div>
            <div style={{ background:'#EDE9FE', borderRadius:'14px', padding:'14px 16px', marginBottom:'28px', display:'flex', gap:'10px', alignItems:'flex-start' }}>
              <span style={{ fontSize:'16px', flexShrink:0 }}>💡</span>
              <p style={{ fontSize:'12px', color:'#5248C5', margin:0, lineHeight:1.6 }}>
                Рабочие часы по умолчанию: Пн–Пт, 09:00–18:00 (Москва). Вы можете изменить их в разделе <b>Настройки</b>.
              </p>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              {btn(prev, '← Назад', 'ghost')}
              {btn(next, 'Далее →')}
            </div>
          </div>
        )}

        {/* Step 2 — Invite */}
        {step===2 && (
          <div>
            <div style={{ textAlign:'center', marginBottom:'28px' }}>
              <div style={{ width:'64px', height:'64px', borderRadius:'20px', background:'#DCFCE7', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'32px', margin:'0 auto 16px' }}>👥</div>
              <h2 style={{ fontSize:'22px', fontWeight:800, color:'#1a1040', margin:'0 0 6px' }}>Пригласите команду</h2>
              <p style={{ fontSize:'13px', color:'#9B97CC', margin:0 }}>Добавьте сотрудников — они смогут работать в системе</p>
            </div>
            <div style={{ display:'flex', gap:'8px', marginBottom:'10px' }}>
              <input value={inviteEmail} onChange={e=>setInviteEmail(e.target.value)}
                onKeyDown={e=>e.key==='Enter'&&invite()} placeholder="email@company.ru"
                style={{ flex:1, border:'1.5px solid #EDE9FE', borderRadius:'12px', padding:'10px 14px', fontSize:'13px', outline:'none', color:'#1a1040' }}/>
              <select value={inviteRole} onChange={e=>setInviteRole(e.target.value)}
                style={{ border:'1.5px solid #EDE9FE', borderRadius:'12px', padding:'10px 12px', fontSize:'13px', outline:'none', color:'#1a1040', background:'white' }}>
                <option value="EMPLOYEE">Сотрудник</option>
                <option value="MANAGER">Менеджер</option>
                <option value="VIEWER">Наблюдатель</option>
              </select>
              <button onClick={invite} disabled={inviting||!inviteEmail}
                style={{ padding:'10px 16px', background:'linear-gradient(135deg,#7F77DD,#5248C5)', color:'white', border:'none', borderRadius:'12px', fontSize:'13px', fontWeight:600, cursor:'pointer', opacity:inviteEmail?1:0.5, whiteSpace:'nowrap', boxShadow:'0 4px 10px rgba(127,119,221,0.3)' }}>
                {inviting ? '...' : '+ Добавить'}
              </button>
            </div>
            {inviteError   && <p style={{ fontSize:'12px', color:'#DC2626', margin:'0 0 8px' }}>{inviteError}</p>}
            {inviteSuccess && <p style={{ fontSize:'12px', color:'#16A34A', margin:'0 0 8px' }}>✓ {inviteSuccess}</p>}
            {invitedCount > 0 && (
              <div style={{ background:'#DCFCE7', borderRadius:'12px', padding:'12px 14px', marginBottom:'12px' }}>
                <p style={{ fontSize:'12px', color:'#15803D', margin:0 }}>✓ Добавлено сотрудников: {invitedCount}. Пароль по умолчанию: <b>password123</b></p>
              </div>
            )}
            <div style={{ background:'#FEF3C7', borderRadius:'14px', padding:'14px 16px', marginBottom:'28px', display:'flex', gap:'10px', alignItems:'flex-start' }}>
              <span style={{ fontSize:'16px', flexShrink:0 }}>💡</span>
              <p style={{ fontSize:'12px', color:'#854F0B', margin:0, lineHeight:1.6 }}>
                Можно пропустить этот шаг и добавить сотрудников позже в разделе <b>Сотрудники</b>.
              </p>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              {btn(prev, '← Назад', 'ghost')}
              {btn(next, invitedCount>0 ? 'Далее →' : 'Пропустить →')}
            </div>
          </div>
        )}

        {/* Step 3 — Extension */}
        {step===3 && (
          <div>
            <div style={{ textAlign:'center', marginBottom:'28px' }}>
              <div style={{ width:'64px', height:'64px', borderRadius:'20px', background:'#DBEAFE', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'32px', margin:'0 auto 16px' }}>🔌</div>
              <h2 style={{ fontSize:'22px', fontWeight:800, color:'#1a1040', margin:'0 0 6px' }}>Установите расширение Chrome</h2>
              <p style={{ fontSize:'13px', color:'#9B97CC', margin:0 }}>Расширение отслеживает активность сотрудников на WB и Ozon</p>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'8px', marginBottom:'16px' }}>
              {[
                'Откройте Chrome → chrome://extensions',
                'Включите «Режим разработчика» (вверху справа)',
                'Нажмите «Загрузить распакованное расширение»',
                'Выберите папку: apps/extension/dist',
                'Кликните на иконку расширения → войдите с вашим email',
              ].map((text, i) => (
                <div key={i} style={{ display:'flex', alignItems:'flex-start', gap:'12px', background:'#F8F7FF', borderRadius:'12px', padding:'12px 14px' }}>
                  <div style={{ width:'24px', height:'24px', borderRadius:'50%', background:'linear-gradient(135deg,#7F77DD,#5248C5)', color:'white', fontSize:'12px', fontWeight:700, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>{i+1}</div>
                  <p style={{ fontSize:'13px', color:'#1a1040', margin:0, lineHeight:1.5 }}>{text}</p>
                </div>
              ))}
            </div>
            <div style={{ background:'#EDE9FE', borderRadius:'14px', padding:'14px 16px', marginBottom:'28px', display:'flex', gap:'10px', alignItems:'flex-start' }}>
              <span style={{ fontSize:'16px', flexShrink:0 }}>💡</span>
              <p style={{ fontSize:'12px', color:'#5248C5', margin:0, lineHeight:1.6 }}>
                После установки откройте seller.wildberries.ru или seller.ozon.ru — данные начнут поступать автоматически в течение 5 минут.
              </p>
            </div>
            <div style={{ display:'flex', justifyContent:'space-between' }}>
              {btn(prev, '← Назад', 'ghost')}
              {btn(next, 'Готово! Далее →')}
            </div>
          </div>
        )}

        {/* Step 4 — Done */}
        {step===4 && (
          <div style={{ textAlign:'center' }}>
            <div style={{ width:'80px', height:'80px', borderRadius:'24px', background:'linear-gradient(135deg,#DCFCE7,#16A34A20)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'40px', margin:'0 auto 20px' }}>🎉</div>
            <h2 style={{ fontSize:'26px', fontWeight:800, color:'#1a1040', margin:'0 0 10px' }}>Всё готово!</h2>
            <p style={{ fontSize:'14px', color:'#9B97CC', margin:'0 0 32px', lineHeight:1.7 }}>
              Employee Tracker настроен и готов к работе.<br/>Начните с дашборда — там видна вся статистика.
            </p>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px', marginBottom:'28px' }}>
              {[
                { href:'/dashboard',           icon:'📊', label:'Дашборд',    desc:'Обзор организации',  color:'#EDE9FE' },
                { href:'/dashboard/employees', icon:'👥', label:'Сотрудники', desc:'Управление командой', color:'#DCFCE7' },
                { href:'/dashboard/analytics', icon:'📈', label:'Аналитика',  desc:'Графики и KPI',       color:'#FEF3C7' },
                { href:'/dashboard/timesheet', icon:'🗓', label:'Табель',     desc:'Рабочее время',       color:'#DBEAFE' },
              ].map(item => (
                <button key={item.href}
                  onMouseEnter={()=>setHoveredCard(item.href)}
                  onMouseLeave={()=>setHoveredCard(null)}
                  onClick={()=>{ localStorage.setItem('onboarded','1'); router.push(item.href); }}
                  style={{ background: hoveredCard===item.href ? item.color : '#F8F7FF', borderRadius:'16px', padding:'16px', border: hoveredCard===item.href ? `1.5px solid ${item.color}` : '1.5px solid #EDE9FE', cursor:'pointer', textAlign:'left', transition:'all 0.2s', display:'flex', alignItems:'center', gap:'12px' }}>
                  <span style={{ fontSize:'24px' }}>{item.icon}</span>
                  <div>
                    <p style={{ fontSize:'13px', fontWeight:700, color:'#1a1040', margin:'0 0 2px' }}>{item.label}</p>
                    <p style={{ fontSize:'11px', color:'#9B97CC', margin:0 }}>{item.desc}</p>
                  </div>
                </button>
              ))}
            </div>
            <button onClick={finish} style={{ padding:'13px 36px', background:'linear-gradient(135deg,#7F77DD,#5248C5)', color:'white', border:'none', borderRadius:'14px', fontSize:'15px', fontWeight:700, cursor:'pointer', boxShadow:'0 6px 20px rgba(127,119,221,0.4)' }}>
              Перейти на дашборд →
            </button>
          </div>
        )}
      </div>

      {/* Step label */}
      <p style={{ fontSize:'12px', color:'#C4C0E8', marginTop:'16px', textAlign:'center' }}>
        Шаг {step+1} из {STEPS.length} — {STEPS[step].title}
      </p>
    </div>
  );
}
