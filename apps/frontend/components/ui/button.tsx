'use client';
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
