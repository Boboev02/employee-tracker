import React from 'react';

interface Props {
  label: string;
  bg: string;
  color: string;
  size?: 'sm' | 'md';
}

export function Badge({ label, bg, color, size = 'md' }: Props) {
  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      fontSize: size === 'sm' ? '10px' : '11px',
      fontWeight: 500,
      padding: size === 'sm' ? '2px 6px' : '3px 8px',
      borderRadius: '20px',
      background: bg,
      color,
      whiteSpace: 'nowrap',
    }}>
      {label}
    </span>
  );
}
