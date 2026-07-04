'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number counting up from 0 to `value` with ease-out easing.
 * Usage: const display = useCountUp(4709); ... <span>{display.toLocaleString('ru-RU')}</span>
 */
export function useCountUp(value: number, durationMs = 900, delayMs = 200): number {
  const [display, setDisplay] = useState(0);
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const timeout = setTimeout(() => {
      const start = performance.now();
      const from = 0;
      const to = value;
      function tick(now: number) {
        const p = Math.min((now - start) / durationMs, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setDisplay(Math.round(from + (to - from) * eased));
        if (p < 1) requestAnimationFrame(tick);
        else setDisplay(to);
      }
      requestAnimationFrame(tick);
    }, delayMs);
    return () => clearTimeout(timeout);
  }, [value, durationMs, delayMs]);

  return display;
}
