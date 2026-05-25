const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

write('app/dashboard/productivity/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip } from 'recharts';

const GRADE_COLORS: Record<string, { bg: string; text: string; ring: string }> = {
  A: { bg: 'bg-green-50',  text: 'text-green-700',  ring: 'ring-green-400' },
  B: { bg: 'bg-blue-50',   text: 'text-blue-700',   ring: 'ring-blue-400' },
  C: { bg: 'bg-yellow-50', text: 'text-yellow-700', ring: 'ring-yellow-400' },
  D: { bg: 'bg-orange-50', text: 'text-orange-700', ring: 'ring-orange-400' },
  F: { bg: 'bg-red-50',    text: 'text-red-700',    ring: 'ring-red-400' },
};

const PLATFORM_LABELS: Record<string, string> = {
  WILDBERRIES: 'WB', OZON: 'Ozon', OTHER: 'Прочее',
};

const SECTION_LABELS: Record<string, string> = {
  orders: 'Заказы', products: 'Товары', analytics: 'Аналитика',
  finance: 'Финансы', supply: 'Поставки', pricing: 'Цены',
  reviews: 'Отзывы', other: 'Прочее', unknown: '—',
};

function ScoreRing({ score, grade }: { score: number; grade: string }) {
  const colors = GRADE_COLORS[grade] ?? GRADE_COLORS['F'];
  const r = 36;
  const circ = 2 * Math.PI * r;
  const offset = circ - (score / 100) * circ;

  return (
    <div className="relative w-24 h-24 flex items-center justify-center">
      <svg width="96" height="96" className="-rotate-90">
        <circle cx="48" cy="48" r={r} fill="none" stroke="#f3f4f6" strokeWidth="8" />
        <circle cx="48" cy="48" r={r} fill="none"
          stroke={grade === 'A' ? '#22c55e' : grade === 'B' ? '#3b82f6' : grade === 'C' ? '#eab308' : grade === 'D' ? '#f97316' : '#ef4444'}
          strokeWidth="8" strokeDasharray={circ} strokeDashoffset={offset}
          strokeLinecap="round" style={{ transition: 'stroke-dashoffset 0.8s ease' }} />
      </svg>
      <div className="absolute text-center">
        <div className="text-xl font-bold text-gray-900">{score}</div>
        <div className={"text-xs font-bold " + colors.text}>{grade}</div>
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
    setToken(t);
    load(t, '7');
  }, []);

  const load = async (t: string, days: string) => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/v1/analytics/productivity?days=' + days, {
        headers: { Authorization: 'Bearer ' + t },
      });
      const data = await res.json();
      const arr = Array.isArray(data) ? data : [];
      setScores(arr);
      if (arr.length > 0 && !selected) setSelected(arr[0]);
    } finally { setLoading(false); }
  };

  const radarData = selected ? [
    { factor: 'Активность', value: selected.factors.activity,    max: 25 },
    { factor: 'Стабильность', value: selected.factors.consistency, max: 25 },
    { factor: 'Задачи',     value: selected.factors.tasks,       max: 25 },
    { factor: 'Фокус',      value: selected.factors.focus,       max: 25 },
  ] : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <h1 className="text-xl font-bold text-gray-900">Продуктивность</h1>
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
          {[{l:'7 дней',v:'7'},{l:'14 дней',v:'14'},{l:'30 дней',v:'30'}].map(opt => (
            <button key={opt.v}
              onClick={() => { setPeriod(opt.v); load(token, opt.v); }}
              className={"px-3 py-1.5 rounded-md text-xs font-medium transition-colors " +
                (period === opt.v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500')}>
              {opt.l}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-64 text-gray-400">Загрузка...</div>
      ) : (
        <div className="p-6 flex flex-col gap-6">

          {/* Leaderboard */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Ranking list */}
            <div className="lg:col-span-1 flex flex-col gap-2">
              <h3 className="text-sm font-semibold text-gray-700 mb-2">Рейтинг команды</h3>
              {scores.map((sc, i) => {
                const colors = GRADE_COLORS[sc.grade] ?? GRADE_COLORS['F'];
                const isSelected = selected?.userId === sc.userId;
                return (
                  <button key={sc.userId}
                    onClick={() => setSelected(sc)}
                    className={"w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left " +
                      (isSelected ? 'border-indigo-300 bg-indigo-50 shadow-sm' : 'border-gray-200 bg-white hover:border-gray-300')}>
                    <span className="text-sm font-bold text-gray-400 w-5">{i + 1}</span>
                    <div className="w-9 h-9 rounded-full bg-indigo-500 flex items-center justify-center text-white text-sm font-bold flex-shrink-0">
                      {sc.name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{sc.name}</p>
                      <p className="text-xs text-gray-400">{sc.details.activeDays}/{sc.details.totalDays} активных дней</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="text-lg font-bold text-gray-900">{sc.score}</div>
                      <div className={"text-xs font-bold px-1.5 py-0.5 rounded " + colors.bg + ' ' + colors.text}>
                        {sc.grade}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            {/* Detail panel */}
            {selected && (
              <div className="lg:col-span-2 flex flex-col gap-4">

                {/* Header */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <div className="flex items-center gap-5">
                    <ScoreRing score={selected.score} grade={selected.grade} />
                    <div className="flex-1">
                      <h2 className="text-xl font-bold text-gray-900">{selected.name}</h2>
                      <p className="text-sm text-gray-500 mt-0.5">
                        {selected.details.activeDays} из {selected.details.totalDays} дней активен ·
                        ~{selected.details.avgEventsPerDay} событий/день
                      </p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {selected.details.topPlatform !== '—' && (
                          <span className="text-xs px-2 py-0.5 bg-purple-100 text-purple-700 rounded font-medium">
                            {PLATFORM_LABELS[selected.details.topPlatform] ?? selected.details.topPlatform}
                          </span>
                        )}
                        {selected.details.topSection !== '—' && (
                          <span className="text-xs px-2 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                            {SECTION_LABELS[selected.details.topSection] ?? selected.details.topSection}
                          </span>
                        )}
                        {selected.details.tasksCompleted > 0 && (
                          <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded font-medium">
                            {selected.details.tasksCompleted}/{selected.details.tasksTotal} задач
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Factors */}
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { key: 'activity',    label: 'Активность',   desc: 'События vs среднее по команде', max: 25 },
                    { key: 'consistency', label: 'Стабильность', desc: 'Регулярность работы',            max: 25 },
                    { key: 'tasks',       label: 'Задачи',       desc: 'Выполнение задач',               max: 25 },
                    { key: 'focus',       label: 'Фокус',        desc: 'Продуктивные разделы',           max: 25 },
                  ].map(factor => {
                    const val = selected.factors[factor.key];
                    const pct = Math.round((val / factor.max) * 100);
                    return (
                      <div key={factor.key} className="bg-white rounded-xl border border-gray-200 p-4">
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <p className="text-sm font-semibold text-gray-800">{factor.label}</p>
                            <p className="text-xs text-gray-400">{factor.desc}</p>
                          </div>
                          <span className="text-lg font-bold text-gray-900">{val}<span className="text-xs text-gray-400">/{factor.max}</span></span>
                        </div>
                        <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                          <div className="h-full rounded-full transition-all duration-700"
                            style={{ width: pct + '%',
                              background: pct >= 80 ? '#22c55e' : pct >= 60 ? '#3b82f6' : pct >= 40 ? '#eab308' : '#ef4444' }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Radar chart */}
                <div className="bg-white rounded-xl border border-gray-200 p-5">
                  <h3 className="text-sm font-semibold text-gray-700 mb-3">Профиль факторов</h3>
                  <ResponsiveContainer width="100%" height={200}>
                    <RadarChart data={radarData}>
                      <PolarGrid stroke="#f0f0f0" />
                      <PolarAngleAxis dataKey="factor" tick={{ fontSize: 11 }} />
                      <Radar dataKey="value" stroke="#6366f1" fill="#6366f1" fillOpacity={0.25} strokeWidth={2} />
                      <Tooltip formatter={(v: any) => [v + ' / 25', 'Балл']} />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>

          {/* Grade legend */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Шкала оценок</h3>
            <div className="flex gap-4 flex-wrap">
              {[
                { grade: 'A', range: '85–100', desc: 'Отличный результат' },
                { grade: 'B', range: '70–84',  desc: 'Хороший результат' },
                { grade: 'C', range: '55–69',  desc: 'Удовлетворительно' },
                { grade: 'D', range: '40–54',  desc: 'Требует внимания' },
                { grade: 'F', range: '0–39',   desc: 'Низкая активность' },
              ].map(g => {
                const colors = GRADE_COLORS[g.grade];
                return (
                  <div key={g.grade} className={"flex items-center gap-2 px-3 py-2 rounded-lg " + colors.bg}>
                    <span className={"text-lg font-bold " + colors.text}>{g.grade}</span>
                    <div>
                      <p className={"text-xs font-semibold " + colors.text}>{g.range} баллов</p>
                      <p className="text-xs text-gray-500">{g.desc}</p>
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

console.log('\n✅ Productivity frontend created');
