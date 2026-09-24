'use client';
import { useEffect, useState } from 'react';

interface Item { label: string; value: number; color: string; }

// Столбцы вырастают из плоскости при открытии страницы.
export function IsoBars({ data, height = 200 }: { data: Item[]; height?: number }) {
  const [grown, setGrown] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setGrown(true), 60);
    return () => clearTimeout(t);
  }, []);

  if (!data.length) return null;
  const max  = Math.max(...data.map(d => d.value), 1);
  const maxH = Math.max(40, height - 104);
  const cell = data.length > 5 ? 24 : 32;

  return (
    <div>
      <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center',
                    perspective:'900px', overflow:'hidden' }}>
        <div style={{ transform:'rotateX(56deg) rotateZ(-44deg)', transformStyle:'preserve-3d',
                      display:'flex', gap: cell / 2 + 'px' }}>
          {data.map((d, i) => {
            const h    = Math.max(4, (d.value / max) * maxH);
            const ease = 'transform 700ms cubic-bezier(0.22,1,0.36,1) ' + (i * 90) + 'ms';
            return (
              <div key={d.label + i} style={{ position:'relative', width:cell, height:cell, transformStyle:'preserve-3d' }}>
                {/* след на плоскости */}
                <div style={{ position:'absolute', inset:0, borderRadius:'3px', background:'rgba(127,119,221,0.12)' }} />
                {/* боковая грань */}
                <div className="fx-iso" style={{ position:'absolute', left:0, top:0, width:cell, height:h + 'px',
                              background:d.color, opacity:0.5, borderRadius:'3px', transformOrigin:'top center',
                              transform:'rotateX(-90deg) scaleY(' + (grown ? 1 : 0) + ')', transition:ease }} />
                {/* верхняя грань */}
                <div className="fx-iso" style={{ position:'absolute', inset:0, borderRadius:'3px', background:d.color,
                              boxShadow:'inset 0 0 0 1px rgba(255,255,255,0.28)',
                              transform:'translateZ(' + (grown ? h : 0) + 'px)', transition:ease }} />
              </div>
            );
          })}
        </div>
      </div>

      <div style={{ display:'flex', flexWrap:'wrap', gap:'8px 16px', justifyContent:'center' }}>
        {data.map((d, i) => (
          <span key={d.label + i} style={{ display:'inline-flex', alignItems:'center', gap:'6px', fontSize:'11px', color:'#6B7280' }}>
            <span style={{ width:'9px', height:'9px', borderRadius:'3px', background:d.color }} />
            {d.label} <b style={{ color:'#1a1040' }}>{d.value}</b>
          </span>
        ))}
      </div>
    </div>
  );
}
