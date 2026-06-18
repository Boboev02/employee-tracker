'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [showPass, setShowPass] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? 'Ошибка входа'); return; }
      localStorage.setItem('access_token', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      const onboarded = localStorage.getItem('onboarded_' + data.user.id);
      router.push(!onboarded ? '/onboarding' : '/dashboard');
    } catch { setError('Ошибка подключения к серверу'); }
    finally { setLoading(false); }
  };

  const inp: React.CSSProperties = {
    width: '100%', background: '#F8F7FF', border: '1.5px solid #EDE9FE',
    borderRadius: '12px', padding: '12px 16px', fontSize: '14px',
    color: '#1a1040', outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#ECEAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      {/* Background decoration */}
      <div style={{ position: 'fixed', top: '-120px', right: '-120px', width: '400px', height: '400px', borderRadius: '50%', background: 'rgba(127,119,221,0.08)', pointerEvents: 'none' }}/>
      <div style={{ position: 'fixed', bottom: '-80px', left: '-80px', width: '300px', height: '300px', borderRadius: '50%', background: 'rgba(127,119,221,0.06)', pointerEvents: 'none' }}/>

      <div style={{ width: '100%', maxWidth: '400px', position: 'relative' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '56px', height: '56px', background: 'linear-gradient(135deg,#7F77DD,#5248C5)', borderRadius: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(127,119,221,0.35)' }}>
            <span style={{ color: 'white', fontSize: '18px', fontWeight: 800, letterSpacing: '-0.5px' }}>ET</span>
          </div>
          <h1 style={{ fontSize: '24px', fontWeight: 800, color: '#1a1040', margin: '0 0 6px', letterSpacing: '-0.5px' }}>Employee Tracker</h1>
          <p style={{ fontSize: '13px', color: '#9B97CC', margin: 0 }}>Мониторинг активности WB & Ozon</p>
        </div>

        {/* Card */}
        <div style={{ background: 'white', borderRadius: '24px', padding: '32px', boxShadow: '0 8px 32px rgba(127,119,221,0.12)' }}>
          <h2 style={{ fontSize: '18px', fontWeight: 700, color: '#1a1040', margin: '0 0 24px', letterSpacing: '-0.3px' }}>Войти в аккаунт</h2>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Email */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#9B97CC', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Email
              </label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@company.ru" required
                style={inp}
                onFocus={e => (e.target as HTMLElement).style.borderColor = '#7F77DD'}
                onBlur={e  => (e.target as HTMLElement).style.borderColor = '#EDE9FE'}
              />
            </div>

            {/* Password */}
            <div>
              <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#9B97CC', marginBottom: '8px', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Пароль
              </label>
              <div style={{ position: 'relative' }}>
                <input
                  type={showPass ? 'text' : 'password'}
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" required
                  style={{ ...inp, paddingRight: '44px' }}
                  onFocus={e => (e.target as HTMLElement).style.borderColor = '#7F77DD'}
                  onBlur={e  => (e.target as HTMLElement).style.borderColor = '#EDE9FE'}
                />
                <button
                  type="button" onClick={() => setShowPass(!showPass)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#9B97CC', padding: '4px', display: 'flex', alignItems: 'center' }}>
                  <i className={`ti ${showPass ? 'ti-eye-off' : 'ti-eye'}`} style={{ fontSize: '16px' }} aria-hidden="true"/>
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: '12px', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ti ti-alert-circle" style={{ fontSize: '16px', color: '#EF4444', flexShrink: 0 }} aria-hidden="true"/>
                <span style={{ fontSize: '13px', color: '#DC2626', fontWeight: 500 }}>{error}</span>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit" disabled={loading}
              style={{ background: loading ? '#C4BFED' : 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white', border: 'none', padding: '13px', borderRadius: '12px', fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.2s', boxShadow: loading ? 'none' : '0 4px 16px rgba(127,119,221,0.35)', letterSpacing: '0.2px', marginTop: '4px', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              {loading ? (
                <>
                  <i className="ti ti-loader" style={{ fontSize: '16px', animation: 'spin 1s linear infinite' }} aria-hidden="true"/>
                  Вхожу...
                </>
              ) : (
                <>
                  Войти
                  <i className="ti ti-arrow-right" style={{ fontSize: '16px' }} aria-hidden="true"/>
                </>
              )}
            </button>
          <p style={{fontSize:'12px',color:'#C4C0E8',textAlign:'center',marginTop:'16px',marginBottom:0}}>
            Нет аккаунта?{' '}
            <a href="/register" style={{color:'#7F77DD',fontWeight:600,textDecoration:'none'}}>Начать бесплатно →</a>
          </p>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: '11px', color: '#C4C0E8', marginTop: '20px' }}>
          Employee Tracker © 2026 · Мониторинг WB & Ozon
        </p>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
}
