const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

// ─── Login page ───────────────────────────────────────────────
write('app/login/page.tsx', `'use client';
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
      const res = await fetch('http://localhost:3001/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.message ?? 'Ошибка входа'); return; }
      localStorage.setItem('access_token', data.accessToken);
      localStorage.setItem('user', JSON.stringify(data.user));
      const isAdmin   = data.user.roles?.some((r: string) => ['ADMIN','OWNER','SUPER_ADMIN'].includes(r));
      const onboarded = localStorage.getItem('onboarded');
      router.push(isAdmin && !onboarded ? '/onboarding' : '/dashboard');
    } catch { setError('Ошибка подключения к серверу'); }
    finally { setLoading(false); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '24px' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '44px', height: '44px', background: 'var(--accent)', borderRadius: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 16px' }}>
            <span style={{ color: 'white', fontSize: '16px', fontWeight: 700 }}>ET</span>
          </div>
          <h1 style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 6px' }}>Employee Tracker</h1>
          <p style={{ fontSize: '13px', color: 'var(--text-secondary)', margin: 0 }}>Войдите в свой аккаунт</p>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '24px' }}>
          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Email</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="admin@test.ru" required
                style={{ width: '100%', background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '6px' }}>Пароль</label>
              <input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required
                style={{ width: '100%', background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '10px 12px', fontSize: '13px', color: 'var(--text-primary)', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            {error && (
              <div style={{ background: '#fef2f2', border: '0.5px solid #fecaca', borderRadius: '8px', padding: '10px 12px', fontSize: '12px', color: '#ef4444' }}>
                {error}
              </div>
            )}
            <button type="submit" disabled={loading}
              style={{ background: 'var(--accent)', color: 'white', border: 'none', padding: '11px', borderRadius: '8px', fontSize: '14px', fontWeight: 500, cursor: loading ? 'not-allowed' : 'pointer', opacity: loading ? 0.7 : 1, transition: 'opacity 0.15s' }}>
              {loading ? 'Вхожу...' : 'Войти'}
            </button>
          </form>
        </div>

        <p style={{ textAlign: 'center', fontSize: '12px', color: 'var(--text-muted)', marginTop: '16px' }}>
          Employee Tracker — мониторинг WB & Ozon
        </p>
      </div>
    </div>
  );
}
`);

// ─── Layout header component ──────────────────────────────────
write('components/layouts/PageHeader.tsx', `'use client';

interface PageHeaderProps {
  title: string;
  action?: React.ReactNode;
  back?: string;
}

export function PageHeader({ title, action, back }: PageHeaderProps) {
  return (
    <div style={{ background: 'var(--bg-primary)', borderBottom: '0.5px solid var(--border)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        {back && (
          <a href={back} style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'none', display: 'flex', alignItems: 'center', gap: '4px' }}>
            ← Назад
          </a>
        )}
        <h1 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>{title}</h1>
      </div>
      {action && <div>{action}</div>}
    </div>
  );
}
`);

// ─── Shared button component ──────────────────────────────────
write('components/ui/Button.tsx', `'use client';
import { ReactNode, CSSProperties } from 'react';

interface ButtonProps {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'danger' | 'ghost';
  size?: 'sm' | 'md';
  disabled?: boolean;
  type?: 'button' | 'submit';
  style?: CSSProperties;
}

const variants = {
  primary:   { background: 'var(--accent)', color: 'white', border: 'none' },
  secondary: { background: 'var(--bg-secondary)', color: 'var(--text-primary)', border: '0.5px solid var(--border)' },
  danger:    { background: '#fef2f2', color: '#ef4444', border: '0.5px solid #fecaca' },
  ghost:     { background: 'transparent', color: 'var(--text-secondary)', border: 'none' },
};
const sizes = {
  sm: { padding: '5px 10px', fontSize: '12px', borderRadius: '7px' },
  md: { padding: '8px 16px', fontSize: '13px', borderRadius: '8px' },
};

export function Button({ children, onClick, variant = 'primary', size = 'md', disabled, type = 'button', style }: ButtonProps) {
  return (
    <button type={type} onClick={onClick} disabled={disabled}
      style={{ ...variants[variant], ...sizes[size], fontWeight: 500, cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.6 : 1, transition: 'opacity 0.15s, background 0.15s', ...style }}>
      {children}
    </button>
  );
}
`);

// ─── Shared card component ────────────────────────────────────
write('components/ui/Card.tsx', `'use client';
import { ReactNode, CSSProperties } from 'react';

interface CardProps {
  children: ReactNode;
  style?: CSSProperties;
  padding?: string;
}

export function Card({ children, style, padding = '16px' }: CardProps) {
  return (
    <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding, ...style }}>
      {children}
    </div>
  );
}
`);

// ─── Shared badge component ───────────────────────────────────
write('components/ui/Badge.tsx', `'use client';

interface BadgeProps {
  label: string;
  bg: string;
  color: string;
}

export function Badge({ label, bg, color }: BadgeProps) {
  return (
    <span style={{ fontSize: '11px', fontWeight: 500, padding: '3px 8px', borderRadius: '20px', background: bg, color, display: 'inline-block', whiteSpace: 'nowrap' }}>
      {label}
    </span>
  );
}
`);

// ─── Updated globals.css ──────────────────────────────────────
write('app/globals.css', `@import "tailwindcss";

:root {
  --bg-primary: #ffffff;
  --bg-secondary: #f4f4f5;
  --bg-tertiary: #f9fafb;
  --text-primary: #09090b;
  --text-secondary: #71717a;
  --text-muted: #a1a1aa;
  --border: #e4e4e7;
  --border-strong: #d4d4d8;
  --accent: #a78bfa;
  --accent-bg: rgba(167,139,250,0.1);
  --radius: 10px;
  --radius-sm: 7px;
  --sidebar-bg: #18181b;
  --sidebar-text: #71717a;
  --sidebar-active-bg: rgba(167,139,250,0.15);
  --sidebar-border: rgba(255,255,255,0.07);
}

.dark {
  --bg-primary: #18181b;
  --bg-secondary: #27272a;
  --bg-tertiary: #09090b;
  --text-primary: #fafafa;
  --text-secondary: #a1a1aa;
  --text-muted: #52525b;
  --border: #27272a;
  --border-strong: #3f3f46;
  --sidebar-bg: #09090b;
  --sidebar-border: rgba(255,255,255,0.06);
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--bg-tertiary);
  color: var(--text-primary);
  font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', sans-serif;
  font-size: 14px;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
}

input, select, textarea, button {
  font-family: inherit;
}

input:focus, select:focus, textarea:focus {
  outline: none;
  border-color: var(--accent) !important;
  box-shadow: 0 0 0 3px rgba(167,139,250,0.15);
}

/* Dark mode overrides */
.dark .bg-white { background-color: var(--bg-primary) !important; }
.dark .bg-gray-50 { background-color: var(--bg-tertiary) !important; }
.dark .bg-gray-100 { background-color: var(--bg-secondary) !important; }
.dark .border-gray-100, .dark .border-gray-200 { border-color: var(--border) !important; }
.dark .text-gray-900 { color: var(--text-primary) !important; }
.dark .text-gray-700 { color: #d4d4d8 !important; }
.dark .text-gray-600 { color: var(--text-secondary) !important; }
.dark .text-gray-500 { color: var(--text-muted) !important; }
.dark .hover\\:bg-gray-50:hover { background-color: var(--bg-secondary) !important; }
.dark .hover\\:bg-gray-100:hover { background-color: var(--bg-secondary) !important; }
.dark input, .dark select, .dark textarea {
  background-color: var(--bg-secondary) !important;
  border-color: var(--border-strong) !important;
  color: var(--text-primary) !important;
}
.dark .sticky { background-color: var(--bg-primary) !important; }

::-webkit-scrollbar { width: 4px; height: 4px; }
::-webkit-scrollbar-track { background: transparent; }
::-webkit-scrollbar-thumb { background: var(--border-strong); border-radius: 4px; }
`);

console.log('\n✅ Design system pages created');
