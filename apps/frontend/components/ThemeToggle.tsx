'use client';
import { useTheme } from '@/lib/useTheme';
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  return (
    <button onClick={toggle} title={theme==='light'?'Тёмная тема':'Светлая тема'}
      style={{ width:'28px', height:'28px', borderRadius:'6px', display:'flex', alignItems:'center', justifyContent:'center', background:'transparent', border:'none', cursor:'pointer', color:'#4a4d5e', transition:'background 0.15s', fontSize:'13px' }}
      onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.08)'}
      onMouseLeave={e => (e.currentTarget as HTMLElement).style.background='transparent'}>
      {theme==='light'?'🌙':'☀️'}
    </button>
  );
}
