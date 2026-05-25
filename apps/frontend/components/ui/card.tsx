'use client';
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
