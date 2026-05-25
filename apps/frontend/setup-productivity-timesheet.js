const fs = require('fs');
const path = require('path');
function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

// ─── PRODUCTIVITY PAGE ────────────────────────────────────────
write('app/dashboard/productivity/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';

const GRADE_STYLE: Record<string, { bg: string; color: string }> = {
  A: { bg: '#f0fdf4', color: '#22c55e' },
  B: { bg: '#eff6ff', color: '#378add' },
  C: { bg: '#fefce8', color: '#eab308' },
  D: { bg: '#fff7ed', color: '#f97316' },
  F: { bg: '#fef2f2', color: '#ef4444' },
};

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const gs = GRADE_STYLE[grade] ?? GRADE_STYLE['F'];
  const r = 36; const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;
  const strokeColor = gs.color;
  return (
    <div style={{ position: 'relative', width: '88px', height: '88px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width="88" height="88" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="44" cy="44" r={r} fill="none" stroke="var(--border)" strokeWidth="7" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={strokeColor} strokeWidth="7"
          strokeDasharray={circ} strokeDashoffset={offset} strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div style={{ position: 'absolute', textAlign: 'center' }}>
        <div style={{ fontSize: '20px', fontWeight: 600, color: 'var(--text-primary)' }}>{score}</div>
        <div style={{ fontSize: '12px', fontWeight: 600, color: gs.color }}>{grade}</div>
      </div>
    </div>
  );
}

export default function ProductivityPage() {
  const router = useRouter();
  const [token, setToken]       = useState('');
  const [scores, setScores]     = useState<any[]>([]);
  const [loading, setLoading]   = useState(true);
  const [period, setPeriod]     = useState('7');
  const [selected, setSelected] = useState<any>(null);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t); load(t, '7');
  }, []);

  const load = async (t: string, days: string) => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/v1/analytics/productivity?days=' + days, { headers: { Authorization: 'Bearer ' + t } });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setScores(arr);
      if (arr.length > 0) setSelected(arr[0]);
    } finally { setLoading(false); }
  };

  const radarData = selected ? [
    { factor: 'Активность',   value: selected.factors.activity },
    { factor: 'Стабильность', value: selected.factors.consistency },
    { factor: 'Задачи',       value: selected.factors.tasks },
    { factor: 'Фокус',        value: selected.factors.focus },
  ] : [];

  const COLORS = ['#a78bfa','#378add','#22c55e','#f97316','#eab308','#ef4444'];

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-tertiary)' }}>
      <div style={{ background: 'var(--bg-primary)', borderBottom: '0.5px solid var(--border)', padding: '14px 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <h1 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Продуктивность</h1>
        <div style={{ display: 'flex', gap: '4px', background: 'var(--bg-secondary)', borderRadius: '8px', padding: '3px' }}>
          {[{l:'7д',v:'7'},{l:'14д',v:'14'},{l:'30д',v:'30'}].map(opt => (
            <button key={opt.v} onClick={() => { setPeriod(opt.v); load(token, opt.v); }}
              style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: 500, border: 'none', cursor: 'pointer', background: period === opt.v ? 'var(--bg-primary)' : 'transparent', color: period === opt.v ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'all 0.15s' }}>
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '200px', color: 'var(--text-muted)', fontSize: '13px' }}>Загрузка...</div>
      ) : (
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '16px' }}>

            {/* Leaderboard */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '6px' }}>Рейтинг</p>
              {scores.map((sc, i) => {
                const gs = GRADE_STYLE[sc.grade] ?? GRADE_STYLE['F'];
                const isSelected = selected?.userId === sc.userId;
                return (
                  <div key={sc.userId} onClick={() => setSelected(sc)}
                    style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', borderRadius: '10px', cursor: 'pointer', border: '0.5px solid ' + (isSelected ? 'rgba(167,139,250,0.4)' : 'var(--border)'), background: isSelected ? 'rgba(167,139,250,0.06)' : 'var(--bg-primary)', transition: 'all 0.15s' }}>
                    <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', width: '16px' }}>{i + 1}</span>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: COLORS[i % COLORS.length], display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <span style={{ color: 'white', fontSize: '12px', fontWeight: 600 }}>{sc.name.charAt(0)}</span>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{sc.name}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>{sc.details.activeDays}/{sc.details.totalDays} дней</p>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <div style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{sc.score}</div>
                      <span style={{ fontSize: '11px', fontWeight: 600, padding: '1px 6px', borderRadius: '10px', background: gs.bg, color: gs.color }}>{sc.grade}</span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Detail panel */}
            {selected && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {/* Profile */}
                <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '20px', display: 'flex', alignItems: 'center', gap: '20px' }}>
                  <ScoreRing score={selected.score} grade={selected.grade} />
                  <div>
                    <h2 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: '0 0 4px' }}>{selected.name}</h2>
                    <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 8px' }}>
                      {selected.details.activeDays} из {selected.details.totalDays} дней · ~{selected.details.avgEventsPerDay} событий/день
                    </p>
                    <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                      {selected.details.topPlatform !== '—' && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: 'rgba(167,139,250,0.1)', color: '#a78bfa', fontWeight: 500 }}>{selected.details.topPlatform}</span>}
                      {selected.details.tasksCompleted > 0 && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '12px', background: '#f0fdf4', color: '#22c55e', fontWeight: 500 }}>{selected.details.tasksCompleted} задач выполнено</span>}
                    </div>
                  </div>
                </div>

                {/* Factors */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  {[
                    { key: 'activity',    label: 'Активность',   desc: 'События vs среднее' },
                    { key: 'consistency', label: 'Стабильность', desc: 'Регулярность работы' },
                    { key: 'tasks',       label: 'Задачи',       desc: 'Выполнение задач' },
                    { key: 'focus',       label: 'Фокус',        desc: 'Продуктивные разделы' },
                  ].map(factor => {
                    const val = selected.factors[factor.key];
                    const pct = Math.round((val / 25) * 100);
                    const color = pct >= 80 ? '#22c55e' : pct >= 60 ? '#378add' : pct >= 40 ? '#eab308' : '#ef4444';
                    return (
                      <div key={factor.key} style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '14px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '10px' }}>
                          <div>
                            <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{factor.label}</p>
                            <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>{factor.desc}</p>
                          </div>
                          <span style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)' }}>{val}<span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>/25</span></span>
                        </div>
                        <div style={{ height: '4px', background: 'var(--bg-secondary)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '4px', width: pct + '%', background: color, borderRadius: '2px', transition: 'width 0.7s ease' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Radar */}
                <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px' }}>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '8px' }}>Профиль факторов</p>
                  <ResponsiveContainer width="100%" height={180}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="var(--border)" />
                      <PolarAngleAxis dataKey="factor" tick={{ fontSize: 11, fill: 'var(--text-secondary)' }} />
                      <Radar dataKey="value" stroke="#a78bfa" fill="#a78bfa" fillOpacity={0.2} strokeWidth={2} />
                      <Tooltip formatter={(v: any) => [v + ' / 25', 'Балл']} contentStyle={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: '8px', fontSize: '12px' }} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Legend */}
          <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px' }}>
            <p style={{ fontSize: '12px', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '12px' }}>Шкала оценок</p>
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {[{ grade: 'A', range: '85–100', desc: 'Отличный результат' },{ grade: 'B', range: '70–84', desc: 'Хороший результат' },{ grade: 'C', range: '55–69', desc: 'Удовлетворительно' },{ grade: 'D', range: '40–54', desc: 'Требует внимания' },{ grade: 'F', range: '0–39', desc: 'Низкая активность' }].map(g => {
                const gs = GRADE_STYLE[g.grade];
                return (
                  <div key={g.grade} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', borderRadius: '8px', background: gs.bg }}>
                    <span style={{ fontSize: '16px', fontWeight: 700, color: gs.color }}>{g.grade}</span>
                    <div>
                      <p style={{ fontSize: '12px', fontWeight: 500, color: gs.color, margin: 0 }}>{g.range}</p>
                      <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: 0 }}>{g.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
`);
console.log('✓ productivity page done');

// ─── TIMESHEET PAGE ───────────────────────────────────────────
write('app/dashboard/timesheet/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const STATUS_STYLE: Record<string, { label: string; color: string; bg: string }> = {
  present:     { label: 'Присутствует', color: '#22c55e', bg: '#f0fdf4' },
  late:        { label: 'Опоздание',    color: '#eab308', bg: '#fefce8' },
  early_leave: { label: 'Ранний уход',  color: '#f97316', bg: '#fff7ed' },
  absent:      { label: 'Отсутствует',  color: '#ef4444', bg: '#fef2f2' },
  weekend:     { label: 'Выходной',     color: '#a1a1aa', bg: '#f4f4f5' },
  no_data:     { label: '—',            color: '#d4d4d8', bg: 'transparent' },
};

function fmt(mins: number) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60); const m = mins % 60;
  return h > 0 ? h + 'ч ' + m + 'м' : m + 'м';
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
    const res = await fetch('http://localhost:3001/api/v1/employees', { headers: { Authorization: 'Bearer ' + t } });
    const d = await res.json(); setEmployees(Array.isArray(d) ? d : []);
  };

  const loadTodaySessions = async (t: string) => {
    try {
      const res = await fetch('http://localhost:3001/api/v1/work-session/org/today', { headers: { Authorization: 'Bearer ' + t } });
      const d = await res.json(); setTodaySessions(Array.isArray(d) ? d : []);
    } catch {}
  };

  const load = async (t: string, days: string, uid: string) => {
    setLoading(true);
    const params = new URLSearchParams({ days }); if (uid) params.set('userId', uid);
    const res = await fetch('http://localhost:3001/api/v1/timesheet?' + params, { headers: { Authorization: 'Bearer ' + t } });
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
                              {day.lateMinutes > 15 && <div style={{ color: '#eab308', fontWeight: 600 }}>+{day.lateMinutes}м</div>}
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
`);
console.log('✓ timesheet page done');

console.log('\n✅ Productivity & Timesheet updated');
