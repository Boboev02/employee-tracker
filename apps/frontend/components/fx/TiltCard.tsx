'use client';
import { useRef } from 'react';
import type { CSSProperties, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
  max?: number;            // максимальный угол наклона, градусы
  onClick?: () => void;
}

// Карточка наклоняется вслед за курсором, по стеклу идёт блик.
// На тач-устройствах и при включённом режиме уменьшенной анимации эффект выключен.
export function TiltCard({ children, className, style, max = 12, onClick }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const raf = useRef<number | null>(null);

  const reduced = () =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const onMove = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = ref.current;
    if (!el || e.pointerType !== 'mouse' || reduced()) return;
    const r  = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width;
    const py = (e.clientY - r.top) / r.height;
    if (raf.current) cancelAnimationFrame(raf.current);
    raf.current = requestAnimationFrame(() => {
      el.style.transform =
        'perspective(700px) rotateY(' + ((px - 0.5) * max).toFixed(2) + 'deg) rotateX(' +
        ((0.5 - py) * max).toFixed(2) + 'deg) translateZ(10px)';
      el.style.boxShadow = '0 18px 40px rgba(127,119,221,0.22)';
      el.style.setProperty('--fx-gx', (px * 100).toFixed(1) + '%');
      el.style.setProperty('--fx-gy', (py * 100).toFixed(1) + '%');
      el.style.setProperty('--fx-glare', '1');
    });
  };

  const onLeave = () => {
    const el = ref.current;
    if (!el) return;
    if (raf.current) cancelAnimationFrame(raf.current);
    el.style.transform = '';
    el.style.boxShadow = '';
    el.style.setProperty('--fx-glare', '0');
  };

  return (
    <div
      ref={ref}
      className={'fx-tilt' + (className ? ' ' + className : '')}
      style={style}
      onPointerMove={onMove}
      onPointerLeave={onLeave}
      onClick={onClick}
    >
      <span className="fx-tilt-glare" aria-hidden="true" />
      {children}
    </div>
  );
}
