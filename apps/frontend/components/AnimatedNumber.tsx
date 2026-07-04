'use client';
import { useCountUp } from '@/hooks/useCountUp';

export function AnimatedNumber({ value, suffix = '', durationMs = 900, delayMs = 200 }: { value: number; suffix?: string; durationMs?: number; delayMs?: number }) {
  const display = useCountUp(value, durationMs, delayMs);
  return <>{display.toLocaleString('ru-RU')}{suffix}</>;
}
