'use client';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/auth/login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
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
    width: '100%', background: '#F5F3FC', border: '1.5px solid #E0DDF0',
    borderRadius: '10px', padding: '11px 14px', fontSize: '13px', color: '#1a1a2e',
    outline: 'none', boxSizing: 'border-box', transition: 'border-color 0.15s, box-shadow 0.15s',
  };

  return (
    <div style={{ minHeight: '100vh', background: '#EBE8F6', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '420px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '52px', height: '52px', background: '#6C5CE7', borderRadius: '14px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px', boxShadow: '0 8px 24px rgba(108,92,231,0.35)' }}>
            <span style={{ color: 'white', fontSize: '18px', fontWeight: 800 }}>ET</span>
          </div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#1a1a2e', margin: '0 0 6px', letterSpacing: '-0.5px' }}>Employee Tracker</h1>
          <p style={{ fontSize: '13px', color: '#888', margin: 0 }}>Мониторинг активности WB & Ozon</p>
        </div>

        {/* Card */}
        <div style={{ background: '#fff', borderRadius: '16px', padding: '28px 32px', boxShadow: '0 8px 32px rgba(108,92,231,0.12)', border: '1px solid #eee' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 600, color: '#1a1a2e', margin: '0 0 22px' }}>Войти в аккаунт</h2>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#666', marginBottom: '7px', letterSpacing: '0.3px' }}>EMAIL</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@company.ru" required style={inp}
                onFocus={e => { e.target.style.borderColor = '#6C5CE7'; e.target.style.boxShadow = '0 0 0 3px #EDE9FF'; }}
                onBlur={e => { e.target.style.borderColor = '#E0DDF0'; e.target.style.boxShadow = 'none'; }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: '#666', marginBottom: '7px', letterSpacing: '0.3px' }}>ПАРОЛЬ</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required style={inp}
                onFocus={e => { e.target.style.borderColor = '#6C5CE7'; e.target.style.boxShadow = '0 0 0 3px #EDE9FF'; }}
                onBlur={e => { e.target.style.borderColor = '#E0DDF0'; e.target.style.boxShadow = 'none'; }} />
            </div>
            {error && (
              <div style={{ background: '#FFEBEE', border: '1px solid rgba(229,57,53,0.2)', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', color: '#C62828', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <i className="ti ti-alert-circle" style={{ fontSize: '15px', flexShrink: 0 }} />
                {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              style={{ background: loading ? '#9d8ff8' : '#6C5CE7', color: 'white', border: 'none', padding: '12px', borderRadius: '10px', fontSize: '14px', fontWeight: 600, cursor: loading ? 'not-allowed' : 'pointer', transition: 'all 0.15s ease', marginTop: '4px', boxShadow: '0 4px 14px rgba(108,92,231,0.35)' }}
              onMouseEnter={e => { if (!loading) { (e.currentTarget as HTMLElement).style.background = '#5a4bd1'; (e.currentTarget as HTMLElement).style.transform = 'translateY(-1px)'; } }}
              onMouseLeave={e => { (e.currentTarget as HTMLElement).style.background = loading ? '#9d8ff8' : '#6C5CE7'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}>
              {loading ? 'Входим...' : 'Войти →'}
            </button>
          </form>
        </div>
        <p style={{ textAlign: 'center', fontSize: '12px', color: '#bbb', marginTop: '20px' }}>Employee Tracker © 2026</p>
      </div>
    </div>
  );
}
