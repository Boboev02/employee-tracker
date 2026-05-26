'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  present:     { label:'Присутствует', color:'var(--green)',  bg:'var(--green-bg)' },
  late:        { label:'Опоздание',    color:'var(--yellow)', bg:'var(--yellow-bg)' },
  early_leave: { label:'Ранний уход',  color:'var(--orange)', bg:'var(--orange-bg)' },
  absent:      { label:'Отсутствует',  color:'var(--red)',    bg:'var(--red-bg)' },
  weekend:     { label:'Выходной',     color:'var(--text-muted)', bg:'var(--bg-secondary)' },
  no_data:     { label:'—',            color:'var(--text-muted)', bg:'transparent' },
};

function fmt(mins: number) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60); const m = mins % 60;
  return h > 0 ? h + 'ч ' + m + 'м' : m + 'м';
}

function fmtTime(timeStr: string | null) {
  if (!timeStr) return '—';
  return timeStr;
}


export default function TimesheetPage() {
  const router = useRouter();
  const [token, setToken]   = useState('');
  const [data, setData]     = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState('14');
  const [selectedUser, setSelectedUser] = useState('');
  const [employees, setEmployees] = useState<any[]>([]);
  const [todaySessions, setTodaySessions] = useState<any[]>([]);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    loadEmployees(t); load(t, '14', ''); loadTodaySessions(t);
  }, []);

  const loadEmployees = async (t: string) => {
    const res = await fetch('https://employee-tracker.ru/api/v1/employees', { headers: { Authorization: 'Bearer ' + t } });
    const d = await res.json(); setEmployees(Array.isArray(d) ? d : []);
  };

  const loadTodaySessions = async (t: string) => {
    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/work-session/org/today', { headers: { Authorization: 'Bearer ' + t } });
      const d = await res.json(); setTodaySessions(Array.isArray(d) ? d : []);
    } catch {}
  };

  const load = async (t: string, days: string, uid: string) => {
    setLoading(true);
    const params = new URLSearchParams({ days }); if (uid) params.set('userId', uid);
    const res = await fetch('https://employee-tracker.ru/api/v1/timesheet?' + params, { headers: { Authorization: 'Bearer ' + t } });
    const d = await res.json(); setData(Array.isArray(d) ? d : []);
    setLoading(false);
  };

  const dates = data[0]?.days?.map((d: any) => ({ date: d.date, dayOfWeek: d.dayOfWeek })) ?? [];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-tertiary)' }}>
      <div style={{ background: 'var(--bg-primary)', borderBottom: '0.5px solid var(--border)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10, flexWrap: 'wrap', gap: '10px' }}>
        <div>
          <h1 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Табель рабочего времени</h1>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Начало и окончание по данным трекера</p>
        </div>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: '3px', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '3px' }}>
            {[{l:'7д',v:'7'},{l:'14д',v:'14'},{l:'30д',v:'30'}].map(opt => (
              <button key={opt.v} onClick={() => { setPeriod(opt.v); load(token, opt.v, selectedUser); }}
                style={{ padding: '5px 10px', borderRadius: '6px', fontSize: '12px', border: 'none', cursor: 'pointer', background: period === opt.v ? 'var(--bg-primary)' : 'transparent', color: period === opt.v ? 'var(--text-primary)' : 'var(--text-muted)', fontWeight: period === opt.v ? 500 : 400 }}>
                {opt.l}
              </button>
            ))}
          </div>
          <select value={selectedUser} onChange={e => { setSelectedUser(e.target.value); load(token, period, e.target.value); }}
            style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', color: 'var(--text-primary)', outline: 'none' }}>
            <option value="">Все сотрудники</option>
            {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
          </select>
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-muted)', fontSize: '13px' }}>Загрузка...</div>
      ) : (
        <div style={{ padding: '20px 24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

          {/* Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '10px' }}>
            {[
              { label: 'Сотрудников',    value: data.length, color: 'var(--text-primary)' },
              { label: 'Присутствовали', value: data.reduce((s, r) => s + r.presentDays, 0), color: '#22c55e' },
              { label: 'Опозданий',      value: data.reduce((s, r) => s + r.lateDays, 0), color: '#eab308' },
              { label: 'Отсутствий',     value: data.reduce((s, r) => s + r.absentDays, 0), color: '#ef4444' },
            ].map(card => (
              <div key={card.label} style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px' }}>
                <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '0 0 6px', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>{card.label}</p>
                <p style={{ fontSize: '22px', fontWeight: 600, color: card.color, margin: 0 }}>{card.value}</p>
              </div>
            ))}
          </div>

          {/* Today sessions */}
          {todaySessions.length > 0 && (
            <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: '0.5px solid var(--border)', background: 'var(--bg-secondary)' }}>
                <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', margin: 0 }}>Сегодня — ручные отметки</p>
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead>
                  <tr>
                    {['Сотрудник','Начал','Закончил','Работал','Перерыв','Статус'].map(h => (
                      <th key={h} style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--bg-secondary)', borderBottom: '0.5px solid var(--border)', textAlign: 'left' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {todaySessions.map((s: any) => (
                    <tr key={s.userId}>
                      <td style={{ padding: '10px 16px', borderBottom: '0.5px solid var(--border)' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                            <span style={{ color: 'white', fontSize: '10px', fontWeight: 600 }}>{s.name.charAt(0)}</span>
                          </div>
                          <span style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{s.name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '10px 16px', borderBottom: '0.5px solid var(--border)', fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{s.startedAt ?? '—'}</td>
                      <td style={{ padding: '10px 16px', borderBottom: '0.5px solid var(--border)', fontSize: '13px', color: 'var(--text-secondary)' }}>{s.finishedAt ?? '—'}</td>
                      <td style={{ padding: '10px 16px', borderBottom: '0.5px solid var(--border)', fontSize: '13px', color: '#a78bfa', fontWeight: 500 }}>{s.workMinutes >= 60 ? Math.floor(s.workMinutes/60) + 'ч ' + (s.workMinutes%60) + 'м' : s.workMinutes + 'м'}</td>
                      <td style={{ padding: '10px 16px', borderBottom: '0.5px solid var(--border)', fontSize: '13px', color: 'var(--text-muted)' }}>{s.breakMinutes ? s.breakMinutes + 'м' : '—'}</td>
                      <td style={{ padding: '10px 16px', borderBottom: '0.5px solid var(--border)' }}>
                        <span style={{ fontSize: '11px', fontWeight: 500, padding: '3px 8px', borderRadius: '12px', background: s.status === 'working' ? '#f0fdf4' : s.status === 'break' ? '#fefce8' : s.status === 'finished' ? '#f4f4f5' : 'var(--bg-secondary)', color: s.status === 'working' ? '#22c55e' : s.status === 'break' ? '#eab308' : s.status === 'finished' ? '#71717a' : 'var(--text-muted)' }}>
                          {s.status === 'working' ? 'Работает' : s.status === 'break' ? 'Перерыв' : s.status === 'finished' ? 'Завершил' : 'Не начал'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Timesheet table */}
          <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', overflow: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr>
                  <th style={{ padding: '10px 16px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--bg-secondary)', borderBottom: '0.5px solid var(--border)', textAlign: 'left', position: 'sticky', left: 0, minWidth: '160px' }}>Сотрудник</th>
                  <th style={{ padding: '10px 12px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', background: 'var(--bg-secondary)', borderBottom: '0.5px solid var(--border)', textAlign: 'center', minWidth: '60px' }}>Среднее</th>
                  {dates.map((d: any) => (
                    <th key={d.date} style={{ padding: '10px 8px', fontSize: '11px', fontWeight: 600, color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderBottom: '0.5px solid var(--border)', textAlign: 'center', minWidth: '72px' }}>
                      <div>{d.dayOfWeek}</div>
                      <div style={{ fontWeight: 400, color: 'var(--text-muted)' }}>{d.date.slice(5)}</div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.map((row: any) => (
                  <tr key={row.userId}>
                    <td style={{ padding: '10px 16px', borderBottom: '0.5px solid var(--border)', position: 'sticky', left: 0, background: 'var(--bg-primary)' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'var(--accent)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          <span style={{ color: 'white', fontSize: '10px', fontWeight: 600 }}>{row.name.charAt(0)}</span>
                        </div>
                        <div>
                          <p style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{row.name}</p>
                          <p style={{ fontSize: '10px', color: 'var(--text-muted)', margin: 0 }}>{row.avgStartTime} — {row.avgEndTime}</p>
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '10px 12px', borderBottom: '0.5px solid var(--border)', textAlign: 'center' }}>
                      <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{row.avgStartTime}</div>
                      <div style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{fmt(Math.round(row.totalWorkMinutes / (row.presentDays || 1)))}/д</div>
                    </td>
                    {row.days.map((day: any) => {
                      const ss = STATUS_STYLE[day.status] ?? STATUS_STYLE.no_data;
                      return (
                        <td key={day.date} style={{ padding: '8px', borderBottom: '0.5px solid var(--border)', textAlign: 'center' }}>
                          {day.status === 'weekend' || day.status === 'no_data' ? (
                            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>—</span>
                          ) : day.status === 'absent' ? (
                            <span style={{ fontSize: '11px', fontWeight: 600, padding: '2px 6px', borderRadius: '6px', background: '#fef2f2', color: '#ef4444' }}>Нет</span>
                          ) : (
                            <div style={{ fontSize: '11px' }}>
                              <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{day.firstEvent}</div>
                              <div style={{ color: 'var(--text-muted)' }}>{day.lastEvent}</div>
                              {day.lateMinutes > 15 && <div style={{ color: '#eab308', fontWeight: 600 }}>⏰ опозд. {day.lateMinutes >= 60 ? Math.floor(day.lateMinutes/60) + 'ч ' + (day.lateMinutes%60) + 'м' : day.lateMinutes + 'м'}</div>}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            {Object.entries(STATUS_STYLE).filter(([k]) => k !== 'no_data').map(([key, s]) => (
              <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: s.color, flexShrink: 0 }} />
                <span style={{ fontSize: '11px', color: 'var(--text-secondary)' }}>{s.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
