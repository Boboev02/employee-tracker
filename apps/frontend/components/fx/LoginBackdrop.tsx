'use client';
import { useEffect, useRef } from 'react';

interface Pt { x: number; y: number; z: number; vx: number; vy: number; }

// Фон страницы входа: сеть точек на трёх глубинах.
// Ближние слои смещаются за курсором сильнее дальних.
export function LoginBackdrop() {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const count   = window.innerWidth < 640 ? 26 : 54;
    const pts: Pt[] = [];
    for (let i = 0; i < count; i++) {
      pts.push({
        x: Math.random(), y: Math.random(),
        z: 0.35 + Math.random() * 0.9,
        vx: (Math.random() - 0.5) * 0.00035,
        vy: (Math.random() - 0.5) * 0.00022,
      });
    }

    let w = 1, h = 1, raf = 0;
    let mx = 0.5, my = 0.5, tx = 0.5, ty = 0.5;

    const fit = () => {
      const d = window.devicePixelRatio || 1;
      w = cv.clientWidth; h = cv.clientHeight;
      cv.width = w * d; cv.height = h * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };

    const onMove = (e: PointerEvent) => {
      tx = e.clientX / window.innerWidth;
      ty = e.clientY / window.innerHeight;
    };

    const draw = () => {
      mx += (tx - mx) * 0.06;
      my += (ty - my) * 0.06;
      ctx.clearRect(0, 0, w, h);

      const proj = pts.map(p => {
        if (!reduced) {
          p.x += p.vx; p.y += p.vy;
          if (p.x < -0.05) p.x = 1.05; if (p.x > 1.05) p.x = -0.05;
          if (p.y < -0.05) p.y = 1.05; if (p.y > 1.05) p.y = -0.05;
        }
        return {
          x: (p.x + (mx - 0.5) * 0.10 * p.z) * w,
          y: (p.y + (my - 0.5) * 0.10 * p.z) * h,
          z: p.z,
        };
      });

      const link = w < 640 ? 72 : 108;
      for (let i = 0; i < proj.length; i++) {
        for (let j = i + 1; j < proj.length; j++) {
          const d = Math.hypot(proj[i].x - proj[j].x, proj[i].y - proj[j].y);
          if (d < link) {
            ctx.strokeStyle = 'rgba(127,119,221,' + (0.16 * (1 - d / link)).toFixed(3) + ')';
            ctx.lineWidth = 1;
            ctx.beginPath();
            ctx.moveTo(proj[i].x, proj[i].y);
            ctx.lineTo(proj[j].x, proj[j].y);
            ctx.stroke();
          }
        }
      }
      for (const p of proj) {
        ctx.fillStyle = 'rgba(127,119,221,' + (0.18 + p.z * 0.28).toFixed(3) + ')';
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.z * 2.0, 0, Math.PI * 2);
        ctx.fill();
      }
      raf = requestAnimationFrame(draw);
    };

    fit();
    window.addEventListener('resize', fit);
    window.addEventListener('pointermove', onMove);
    raf = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', fit);
      window.removeEventListener('pointermove', onMove);
    };
  }, []);

  return (
    <canvas
      ref={ref}
      aria-hidden="true"
      style={{ position:'fixed', inset:0, width:'100%', height:'100%', pointerEvents:'none', zIndex:0 }}
    />
  );
}
