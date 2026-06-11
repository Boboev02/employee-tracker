'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = 'https://employee-tracker.ru';

export default function RegisterPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [form, setForm] = useState({ name:'', email:'', password:'', confirm:'', orgName:'' });
  const set = (k: string, v: string) => setForm(p => ({...p, [k]: v}));

  const submit = async () => {
    setError('');
    if (!form.name.trim()||!form.email.trim()||!form.password||!form.orgName.trim()) { setError('Заполните все поля'); return; }
    if (form.password !== form.confirm) { setError('Пароли не совпадают'); return; }
    if (form.password.length < 6) { setError('Пароль минимум 6 символов'); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/auth/register`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name:form.name, email:form.email, password:form.password, orgName:form.orgName }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? 'Ошибка регистрации'); return; }
      const loginRes = await fetch(`${API}/api/v1/auth/login`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ email:form.email, password:form.password }),
      });
      if (loginRes.ok) {
        const d = await loginRes.json();
        localStorage.setItem('access_token', d.accessToken);
        localStorage.setItem('user', JSON.stringify(d.user));
        router.push('/onboarding');
      } else { setSuccess(true); }
    } catch { setError('Ошибка соединения'); }
    finally { setLoading(false); }
  };

  const inp = (placeholder: string, key: string, type='text') => (
    <input type={type} placeholder={placeholder} value={(form as any)[key]}
      onChange={e=>set(key,e.target.value)} onKeyDown={e=>e.key==='Enter'&&submit()}
      style={{width:'100%',border:'1.5px solid #EDE9FE',borderRadius:'12px',padding:'12px 16px',fontSize:'14px',outline:'none',color:'#1a1040',background:'#F8F7FF',boxSizing:'border-box',marginBottom:'10px'}}
      onFocus={e=>e.target.style.borderColor='#7F77DD'} onBlur={e=>e.target.style.borderColor='#EDE9FE'}/>
  );

  if (success) return (
    <div style={{minHeight:'100vh',background:'#ECEAF8',display:'flex',alignItems:'center',justifyContent:'center'}}>
      <div style={{background:'white',borderRadius:'24px',padding:'48px 40px',maxWidth:'420px',width:'100%',textAlign:'center',boxShadow:'0 8px 40px rgba(127,119,221,0.12)'}}>
        <div style={{fontSize:'56px',marginBottom:'16px'}}>🎉</div>
        <h2 style={{fontSize:'22px',fontWeight:800,color:'#1a1040',margin:'0 0 10px'}}>Аккаунт создан!</h2>
        <p style={{fontSize:'13px',color:'#9B97CC',margin:'0 0 24px'}}>Войдите чтобы начать работу</p>
        <button onClick={()=>router.push('/login')} style={{width:'100%',background:'linear-gradient(135deg,#7F77DD,#5248C5)',color:'white',border:'none',borderRadius:'14px',padding:'14px',fontSize:'15px',fontWeight:700,cursor:'pointer'}}>
          Войти →
        </button>
      </div>
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:'#ECEAF8',display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}}>
      <div style={{width:'100%',maxWidth:'460px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',justifyContent:'center',marginBottom:'24px'}}>
          <div style={{width:'38px',height:'38px',borderRadius:'11px',background:'linear-gradient(135deg,#7F77DD,#5248C5)',display:'flex',alignItems:'center',justifyContent:'center',boxShadow:'0 4px 12px rgba(127,119,221,0.4)'}}>
            <span style={{color:'white',fontSize:'13px',fontWeight:800}}>ET</span>
          </div>
          <span style={{fontSize:'17px',fontWeight:800,color:'#1a1040'}}>Employee Tracker</span>
        </div>

        <div style={{background:'white',borderRadius:'24px',padding:'36px',boxShadow:'0 8px 40px rgba(127,119,221,0.12)'}}>
          <div style={{background:'linear-gradient(135deg,#7F77DD,#5248C5)',borderRadius:'14px',padding:'14px 18px',marginBottom:'28px',display:'flex',alignItems:'center',gap:'12px'}}>
            <span style={{fontSize:'24px'}}>🎁</span>
            <div>
              <p style={{fontSize:'13px',fontWeight:700,color:'white',margin:0}}>14 дней бесплатно</p>
              <p style={{fontSize:'11px',color:'rgba(255,255,255,0.75)',margin:0}}>Полный доступ. Карта не нужна.</p>
            </div>
          </div>

          <h1 style={{fontSize:'22px',fontWeight:800,color:'#1a1040',margin:'0 0 6px'}}>Создать аккаунт</h1>
          <p style={{fontSize:'13px',color:'#9B97CC',margin:'0 0 24px'}}>Для управления командой на WB и Ozon</p>

          {inp('Ваше имя', 'name')}
          {inp('Email', 'email', 'email')}
          {inp('Название компании / магазина', 'orgName')}
          {inp('Пароль (мин. 6 символов)', 'password', 'password')}
          {inp('Повторите пароль', 'confirm', 'password')}

          {error && <div style={{background:'#FEE2E2',borderRadius:'10px',padding:'10px 14px',marginBottom:'14px'}}><p style={{fontSize:'12px',color:'#DC2626',margin:0}}>⚠ {error}</p></div>}

          <button onClick={submit} disabled={loading}
            style={{width:'100%',background:'linear-gradient(135deg,#7F77DD,#5248C5)',color:'white',border:'none',borderRadius:'14px',padding:'14px',fontSize:'15px',fontWeight:700,cursor:'pointer',opacity:loading?0.7:1,boxShadow:'0 6px 20px rgba(127,119,221,0.35)',marginBottom:'16px'}}>
            {loading ? 'Создаю аккаунт...' : 'Начать бесплатно →'}
          </button>

          <p style={{fontSize:'12px',color:'#C4C0E8',textAlign:'center',margin:0}}>
            Уже есть аккаунт?{' '}
            <Link href="/login" style={{color:'#7F77DD',fontWeight:600,textDecoration:'none'}}>Войти</Link>
          </p>
        </div>

        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginTop:'16px'}}>
          {[['📊','Аналитика WB и Ozon'],['✅','Задачи и KPI'],['⏱','Учёт рабочего времени'],['🔌','Chrome-расширение']].map(([icon,text])=>(
            <div key={text} style={{background:'white',borderRadius:'12px',padding:'10px 14px',display:'flex',alignItems:'center',gap:'8px',boxShadow:'0 2px 8px rgba(127,119,221,0.06)'}}>
              <span style={{fontSize:'16px'}}>{icon}</span>
              <span style={{fontSize:'11px',color:'#6B7280',fontWeight:500}}>{text}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
