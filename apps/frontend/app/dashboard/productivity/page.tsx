'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';

const GRADE_STYLE: Record<string, { bg: string; color: string }> = {
  A: { bg: 'var(--green-bg)',  color: 'var(--green)' },
  B: { bg: 'var(--blue-bg)',   color: 'var(--blue)' },
  C: { bg: 'var(--yellow-bg)', color: 'var(--yellow)' },
  D: { bg: 'var(--orange-bg)', color: 'var(--orange)' },
  F: { bg: 'var(--red-bg)',    color: 'var(--red)' },
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
      const res = await fetch('https://employee-tracker.ru/api/v1/analytics/productivity?days=' + days, { headers: { Authorization: 'Bearer ' + t } });
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

  const FACTOR_INFO = [
    { key: 'activity',    label: 'Активность',   max: 25, desc: 'События трекинга относительно среднего по команде' },
    { key: 'consistency', label: 'Стабильность', max: 25, desc: 'Процент рабочих дней с активностью' },
    { key: 'tasks',       label: 'Задачи',        max: 25, desc: 'Выполненные задачи с учётом приоритета' },
    { key: 'focus',       label: 'Фокус',         max: 25, desc: 'Доля времени в продуктивных разделах' },
  ];

  

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
