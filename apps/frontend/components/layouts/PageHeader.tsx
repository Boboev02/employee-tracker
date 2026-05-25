import React from 'react';

interface Props {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  filters?: React.ReactNode;
}

export function PageHeader({ title, subtitle, actions, filters }: Props) {
  return (
    <div style={{ background:'var(--bg-primary)', borderBottom:'0.5px solid var(--border)', padding:'14px 24px', position:'sticky', top:0, zIndex:10 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom: filters ? '12px' : 0 }}>
        <div>
          <h1 style={{ fontSize:'16px', fontWeight:600, color:'var(--text-primary)', margin:0 }}>{title}</h1>
          {subtitle && <p style={{ fontSize:'12px', color:'var(--text-muted)', margin:'2px 0 0' }}>{subtitle}</p>}
        </div>
        {actions && <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>{actions}</div>}
      </div>
      {filters && <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>{filters}</div>}
    </div>
  );
}
