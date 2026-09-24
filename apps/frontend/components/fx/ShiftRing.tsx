'use client';
import type { ReactNode } from 'react';

interface Props {
  color: string;
  bg: string;
  spinning: boolean;
  size?: number;
  children?: ReactNode;
}

// Кольца вращаются в наклонной плоскости, пока идёт смена, и замирают на паузе.
export function ShiftRing({ color, bg, spinning, size = 44, children }: Props) {
  const ring = (inset: number, opacity: number, tilt: number): React.CSSProperties => ({
    position: 'absolute', inset: inset + 'px', borderRadius: '50%',
    border: '1.5px solid transparent', borderTopColor: color, borderRightColor: color,
    opacity, transform: 'rotateZ(' + tilt + 'deg)',
  });

  return (
    <div style={{ width:size, height:size, position:'relative', flexShrink:0, display:'grid', placeItems:'center' }}>
      <div style={{ position:'absolute', inset:'4px', borderRadius:'50%', background:bg }} />
      <div
        className={'fx-ring' + (spinning ? ' fx-ring-on' : '')}
        style={{ position:'absolute', inset:0, transformStyle:'preserve-3d' }}
      >
        <span style={ring(0, 0.95, 0)} />
        <span style={ring(4, 0.55, 40)} />
        <span style={ring(8, 0.35, -30)} />
      </div>
      <div style={{ position:'relative', zIndex:2, display:'flex' }}>{children}</div>
    </div>
  );
}
