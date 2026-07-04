'use client';
import { useEffect, useRef, useState } from 'react';

/**
 * Animates a number counting up to `value` with ease-out easing.
 * Re-triggers whenever `value` changes (e.g. when API data arrives after initial 0 state).
 * Usage: const display = useCountUp(4709); ... <span>{display.toLocaleString('ru-RU')}</span>
 */
export function useCountUp(value: number, durationMs = 900, delayMs = 200): number {
  const [display, setDisplay] = useState(value);
  const prevValue = useRef<number | null>(null);
  const rafId = useRef<number | undefined>(undefined);

  useEffect(() => {
    // Skip animating if value hasn't actually changed (avoids re-animating on unrelated re-renders)
    if (prevValue.current === value) return;
    const from = prevValue.current === null ? 0 : display;
    prevValue.current = value;

    const timeout = setTimeout(() => {
      const start = performance.now();
      function tick(now: number) {
        const p = Math.min((now - start) / durationMs, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        setDisplay(Math.round(from + (value - from) * eased));
        if (p < 1) rafId.current = requestAnimationFrame(tick);
        else setDisplay(value);
      }
      rafId.current = requestAnimationFrame(tick);
    }, delayMs);

    return () => {
      clearTimeout(timeout);
      if (rafId.current) cancelAnimationFrame(rafId.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);

  return display;
}

