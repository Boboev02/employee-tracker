'use client';
import { useEffect, useState, useCallback } from 'react';

interface Props { token: string; compact?: boolean; }

function fmtDuration(ms: number): string {
  if (ms <= 0) return '0м';
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  if (h > 0) return h + 'ч ' + m + 'м';
  return m + 'м';
}

const API = 'https://employee-tracker.ru';

export function WorkSessionWidget({ token, compact = false }: Props) {
  const [session, setSession]   = useState<any>(null);
  const [elapsed, setElapsed]   = useState(0);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState('');

  const load = useCallback(async () => {
    if (!token) return;
    try {
      const res = await fetch(API + '/api/v1/work-session/me', {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.ok) {
        const data = await res.json();
        setSession(data);
        setError('');
      }
    } catch { setError('Нет соединения'); }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  // Таймер — обновляем каждые 30 сек
  useEffect(() => {
    if (!session?.startedAt || session.status === 'finished') return;
    const tick = () => {
      const start    = new Date(session.startedAt).getTime();
      const breakMs  = (session.totalBreakMs ?? 0) +
        (session.status === 'break' && session.breakAt
          ? Date.now() - new Date(session.breakAt).getTime()
          : 0);
      setElapsed(Math.max(0, Date.now() - start - breakMs));
    };
    tick();
    const iv = setInterval(tick, 30000);
    return () => clearInterval(iv);
  }, [session]);

  const action = async (endpoint: string) => {
    setLoading(true); setError('');
    try {
      const res = await fetch(API + '/api/v1/work-session/' + endpoint, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
      });
      if (res.ok) await load();
      else setError('Ошибка сервера');
    } catch { setError('Нет соединения'); }
    finally { setLoading(false); }
  };

  const status = session?.status ?? null;

  // Цвета статуса
  const statusColor = status === 'working' ? '#16A34A'
    : status === 'break' ? '#D97706'
    : status === 'finished' ? '#9B97CC'
    : '#9B97CC';

  const statusLabel = status === 'working' ? 'Рабочий день идёт'
    : status === 'break' ? 'Перерыв'
    : status === 'finished' ? 'День завершён'
    : 'Рабочий день не начат';

  if (compact) {
    // Компактный вид для сайдбара или хедера
    return (
      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
        <span style={{ width:'6px', height:'6px', borderRadius:'50%', background:statusColor, flexShrink:0 }} />
        <span style={{ fontSize:'12px', color:'#6B7280' }}>{statusLabel}</span>
        {status === null && (
          <button onClick={() => action('start')} disabled={loading}
            style={{ fontSize:'11px', color:'#16A34A', background:'#DCFCE7', border:'none', padding:'2px 8px', borderRadius:'6px', cursor:'pointer' }}>
            Начать
          </button>
        )}
      </div>
    );
  }

  return (
    <div style={{ background:'white', borderRadius:'20px', padding:'16px 20px', display:'flex', alignItems:'center', gap:'16px', flexWrap:'wrap', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' }}>
      {/* Иконка + статус */}
      <div style={{ display:'flex', alignItems:'center', gap:'10px', flex:1, minWidth:'200px' }}>
        <div style={{ width:'36px', height:'36px', borderRadius:'50%', background: status === 'working' ? '#DCFCE7' : status === 'break' ? '#FEF3C7' : '#F8F7FF', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          <i className={'ti ' + (status === 'working' ? 'ti-player-play' : status === 'break' ? 'ti-player-pause' : status === 'finished' ? 'ti-check' : 'ti-clock')}
            style={{ fontSize:'16px', color:statusColor }} aria-hidden="true" />
        </div>
        <div>
          <p style={{ fontSize:'13px', fontWeight:500, color:'#1a1040', margin:'0 0 2px' }}>{statusLabel}</p>
          <p style={{ fontSize:'11px', color:'#9B97CC', margin:0 }}>
            {status === 'working' && elapsed > 0 && 'Активное время: ' + fmtDuration(elapsed)}
            {status === 'break' && 'На перерыве'}
            {status === 'finished' && session?.startedAt && 'Итого: ' + fmtDuration(elapsed)}
            {status === null && 'Нажмите «Начать» чтобы отметить приход'}
          </p>
        </div>
      </div>

      {/* Кнопки */}
      <div style={{ display:'flex', gap:'8px', flexShrink:0 }}>
        {error && <span style={{ fontSize:'11px', color:'#DC2626', alignSelf:'center' }}>{error}</span>}

        {status === null && (
          <button onClick={() => action('start')} disabled={loading}
            style={{ background:'#16A34A', color:'white', border:'none', padding:'8px 16px', borderRadius:'8px', fontSize:'13px', fontWeight:500, cursor:'pointer', opacity: loading ? 0.7 : 1 }}>
            ▶ Начать день
          </button>
        )}

        {status === 'working' && (<>
          <button onClick={() => action('break')} disabled={loading}
            style={{ background:'#FEF3C7', color:'#D97706', border:'0.5px solid #D97706', padding:'8px 14px', borderRadius:'8px', fontSize:'13px', fontWeight:500, cursor:'pointer', opacity: loading ? 0.7 : 1 }}>
            ⏸ Перерыв
          </button>
          <button onClick={() => action('finish')} disabled={loading}
            style={{ background:'#FEE2E2', color:'#DC2626', border:'0.5px solid #DC2626', padding:'8px 14px', borderRadius:'8px', fontSize:'13px', fontWeight:500, cursor:'pointer', opacity: loading ? 0.7 : 1 }}>
            ■ Завершить
          </button>
        </>)}

        {status === 'break' && (<>
          <button onClick={() => action('break-end')} disabled={loading}
            style={{ background:'#16A34A', color:'white', border:'none', padding:'8px 16px', borderRadius:'8px', fontSize:'13px', fontWeight:500, cursor:'pointer', opacity: loading ? 0.7 : 1 }}>
            ▶ Продолжить
          </button>
          <button onClick={() => action('finish')} disabled={loading}
            style={{ background:'#FEE2E2', color:'#DC2626', border:'0.5px solid #DC2626', padding:'8px 14px', borderRadius:'8px', fontSize:'13px', fontWeight:500, cursor:'pointer', opacity: loading ? 0.7 : 1 }}>
            ■ Завершить
          </button>
        </>)}

        {status === 'finished' && (
          <span style={{ fontSize:'12px', color:'#16A34A', background:'#DCFCE7', padding:'6px 12px', borderRadius:'8px' }}>
            ✓ День завершён
          </span>
        )}
      </div>
    </div>
  );
}
