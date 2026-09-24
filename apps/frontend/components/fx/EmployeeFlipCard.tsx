'use client';
import { useState } from 'react';
import type { CSSProperties } from 'react';

interface Props {
  emp: any;
  isOnline: boolean;
  avatarBg: string;
  statusStyle: { c: string; bg: string; l: string };
  onOpen: () => void;
}

// Лицевая сторона — кто и на месте ли. Обратная — роли, статус и переход в профиль.
export function EmployeeFlipCard({ emp, isOnline, avatarBg, statusStyle, onOpen }: Props) {
  const [flipped, setFlipped] = useState(false);
  const roles: string[] = emp.roles ?? ['EMPLOYEE'];
  const suspended = emp.status === 'SUSPENDED';

  const face: CSSProperties = {
    position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
    WebkitBackfaceVisibility: 'hidden', borderRadius: '20px', background: 'white',
    boxShadow: '0 4px 16px rgba(127,119,221,0.10)', padding: '16px',
    display: 'flex', flexDirection: 'column', gap: '8px', overflow: 'hidden',
  };
  const row: CSSProperties = {
    display: 'flex', justifyContent: 'space-between', gap: '8px',
    fontSize: '12px', color: '#6B7280', borderBottom: '1px dashed #F3F0FF', paddingBottom: '5px',
  };

  return (
    <div
      onClick={() => setFlipped(v => !v)}
      style={{ height: '212px', perspective: '900px', cursor: 'pointer' }}
    >
      <div
        className="fx-flip-inner"
        style={{ position: 'relative', width: '100%', height: '100%',
                 transformStyle: 'preserve-3d',
                 transform: flipped ? 'rotateY(180deg)' : 'none' }}
      >
        {/* Лицевая сторона */}
        <div style={face}>
          <div style={{ position: 'relative', width: '46px', height: '46px' }}>
            <div style={{ width: '46px', height: '46px', borderRadius: '14px', overflow: 'hidden',
                          background: emp.avatarUrl ? 'transparent' : avatarBg, display: 'flex',
                          alignItems: 'center', justifyContent: 'center', color: 'white',
                          fontWeight: 700, fontSize: '16px', opacity: suspended ? 0.5 : 1 }}>
              {emp.avatarUrl
                ? <img src={emp.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                : (emp.name?.charAt(0) ?? '?')}
            </div>
            <span style={{ position: 'absolute', bottom: '-2px', right: '-2px', width: '12px', height: '12px',
                           borderRadius: '50%', border: '2px solid white',
                           background: isOnline ? '#16A34A' : suspended ? '#DC2626' : '#D1D5DB' }} />
          </div>

          <div>
            <div style={{ fontSize: '14px', fontWeight: 700, color: suspended ? '#9B97CC' : '#1a1040' }}>{emp.name}</div>
            <div style={{ fontSize: '11px', color: '#9B97CC', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {emp.email}
            </div>
          </div>

          <div style={{ marginTop: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
            <span style={{ fontSize: '11px', fontWeight: 600, color: isOnline ? '#16A34A' : '#9B97CC' }}>
              {isOnline ? '● Онлайн' : 'Офлайн'}
            </span>
            <span style={{ fontSize: '10px', color: '#9B97CC' }}>Нажмите →</span>
          </div>
        </div>

        {/* Обратная сторона */}
        <div style={{ ...face, background: '#F8F7FF', transform: 'rotateY(180deg)' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#1a1040' }}>Подробнее</div>
          <div style={row}>
            <span>Статус</span>
            <span style={{ fontWeight: 700, color: statusStyle.c }}>{statusStyle.l}</span>
          </div>
          <div style={row}>
            <span>Роли</span>
            <span style={{ fontWeight: 600, color: '#1a1040', textAlign: 'right' }}>{roles.join(', ')}</span>
          </div>
          <div style={row}>
            <span>Активность</span>
            <span style={{ fontWeight: 600, color: isOnline ? '#16A34A' : '#9B97CC' }}>
              {isOnline ? 'На связи' : 'Не в сети'}
            </span>
          </div>
          <button
            onClick={e => { e.stopPropagation(); onOpen(); }}
            style={{ marginTop: 'auto', background: 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white',
                     border: 'none', borderRadius: '12px', padding: '9px 12px', fontSize: '12px',
                     fontWeight: 700, cursor: 'pointer' }}
          >
            Открыть профиль →
          </button>
        </div>
      </div>
    </div>
  );
}
