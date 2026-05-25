'use client';
import { useEffect, useState } from 'react';

interface Props { token: string; }

export function WorkSessionWidget({ token }: Props) {
  const [session, setSession] = useState<any>(null);
  const [elapsed, setElapsed] = useState(0);
  const [loading, setLoading] = useState(false);

  const load = async () => {
    try {
      const res = await fetch('http://localhost:3001/api/v1/work-session/me', { headers: { Authorization: 'Bearer ' + token } });
      if (res.ok) setSession(await res.json());
    } catch {}
  };

  useEffect(() => { if (token) load(); }, [token]);

  useEffect(() => {
    if (!session?.startedAt || session.status === 'finished') return;
    const tick = () => {
      const start = new Date(session.startedAt).getTime();
      const breakMins = session.breakMinutes ?? 0;
      setElapsed(Math.floor((Date.now() - start) / 60000) - breakMins);
    };
    tick();
    const interval = setInterval(tick, 30000);
    return () => clearInterval(interval);
  }, [session]);

  const action = async (endpoint: string) => {
    setLoading(true);
    try {
      await fetch('http://localhost:3001/api/v1/work-session/' + endpoint, { method: 'POST', headers: { Authorization: 'Bearer ' + token } });
      await load();
    } finally { setLoading(false); }
  };

  const fmt = (m: number) => m >= 60 ? Math.floor(m/60) + 'ч ' + (m%60) + 'м' : m + 'м';
  const s = session?.status;

  const card: React.CSSProperties = { background:'var(--bg-primary)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 16px', display:'flex', alignItems:'center', gap:'14px' };
  const btn = (bg: string, color: string): React.CSSProperties => ({ background:bg, color, border:'none', padding:'7px 14px', borderRadius:'7px', fontSize:'12px', fontWeight:500, cursor:loading?'not-allowed':'pointer', opacity:loading?0.6:1 });

  return (
    <div style={card}>
      <div style={{ width:'36px', height:'36px', borderRadius:'50%', background:'var(--accent-bg)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        <span style={{ fontSize:'16px' }}>⏱</span>
      </div>
      <div style={{ flex:1 }}>
        <p style={{ fontSize:'12px', fontWeight:500, color:'var(--text-primary)', margin:'0 0 2px' }}>
          {!s || s==='finished' ? 'Рабочий день не начат' : s==='working' ? 'Рабочее время: ' + fmt(elapsed) : s==='break' ? 'Перерыв' : 'Неизвестно'}
        </p>
        <p style={{ fontSize:'11px', color:'var(--text-muted)', margin:0 }}>
          {s==='working' ? 'Нажмите «Перерыв» или «Завершить»' : s==='break' ? 'Нажмите «Продолжить» чтобы вернуться' : 'Нажмите «Начать» чтобы отметить приход'}
        </p>
      </div>
      <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
        {(!s || s==='finished') && <button style={btn('var(--accent)','white')} onClick={() => action('start')}>▶ Начать</button>}
        {s==='working' && <>
          <button style={btn('var(--bg-secondary)','var(--text-secondary)')} onClick={() => action('break')}>⏸ Перерыв</button>
          <button style={btn('var(--red-bg)','var(--red)')} onClick={() => action('finish')}>■ Завершить</button>
        </>}
        {s==='break' && <button style={btn('var(--green-bg)','var(--green)')} onClick={() => action('break-end')}>▶ Продолжить</button>}
      </div>
    </div>
  );
}
