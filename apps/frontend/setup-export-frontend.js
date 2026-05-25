const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

write('app/dashboard/export/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/usePermissions';

const REPORTS = [
  {
    id: 'activity',
    title: 'Активность сотрудников',
    desc: 'События отслеживания, платформы, разделы',
    icon: '⏱',
    color: 'bg-indigo-50 border-indigo-200',
    iconBg: 'bg-indigo-100 text-indigo-600',
    hasPeriod: true,
    permission: 'canViewOrgAnalytics',
  },
  {
    id: 'employees',
    title: 'Список сотрудников',
    desc: 'Роли, статусы, количество событий и задач',
    icon: '👥',
    color: 'bg-blue-50 border-blue-200',
    iconBg: 'bg-blue-100 text-blue-600',
    hasPeriod: false,
    permission: 'canViewAllEmployees',
  },
  {
    id: 'tasks',
    title: 'Задачи',
    desc: 'Все задачи с исполнителями, статусами, датами',
    icon: '✓',
    color: 'bg-green-50 border-green-200',
    iconBg: 'bg-green-100 text-green-600',
    hasPeriod: false,
    permission: 'canViewOrgAnalytics',
  },
  {
    id: 'productivity',
    title: 'Продуктивность',
    desc: 'Рейтинг и факторы продуктивности команды',
    icon: '⭐',
    color: 'bg-yellow-50 border-yellow-200',
    iconBg: 'bg-yellow-100 text-yellow-600',
    hasPeriod: true,
    permission: 'canViewOrgAnalytics',
  },
];

export default function ExportPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [period, setPeriod] = useState('7');
  const [success, setSuccess] = useState<string | null>(null);
  const perms = usePermissions();

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
  }, []);

  const download = async (reportId: string) => {
    setLoading(reportId);
    setSuccess(null);
    try {
      const params = new URLSearchParams();
      if (period) params.set('days', period);

      const res = await fetch(
        'http://localhost:3001/api/v1/export/' + reportId + '?' + params,
        { headers: { Authorization: 'Bearer ' + token } }
      );

      if (!res.ok) {
        alert('Ошибка: ' + res.status);
        return;
      }

      const blob = await res.blob();
      const url  = URL.createObjectURL(blob);
      const a    = document.createElement('a');
      a.href     = url;
      a.download = reportId + '-report.csv';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      setSuccess(reportId);
      setTimeout(() => setSuccess(null), 3000);
    } finally {
      setLoading(null);
    }
  };

  const availableReports = REPORTS.filter(r => (perms as any)[r.permission]);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4">
        <h1 className="text-xl font-bold text-gray-900">Экспорт отчётов</h1>
        <p className="text-sm text-gray-500 mt-0.5">Скачай данные в формате CSV для Excel или Google Sheets</p>
      </div>

      <div className="p-6 flex flex-col gap-6 max-w-3xl">

        {/* Period selector */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Период для отчётов по активности</h3>
          <div className="flex gap-2 flex-wrap">
            {[
              { l: 'Сегодня', v: '1' },
              { l: '7 дней',  v: '7' },
              { l: '14 дней', v: '14' },
              { l: '30 дней', v: '30' },
              { l: '90 дней', v: '90' },
            ].map(opt => (
              <button key={opt.v}
                onClick={() => setPeriod(opt.v)}
                className={"px-4 py-2 rounded-lg text-sm font-medium border transition-colors " +
                  (period === opt.v
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-200 hover:border-indigo-300')}>
                {opt.l}
              </button>
            ))}
          </div>
        </div>

        {/* Reports grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {availableReports.map(report => (
            <div key={report.id}
              className={"rounded-xl border p-5 flex flex-col gap-3 " + report.color}>
              <div className="flex items-start gap-3">
                <div className={"w-10 h-10 rounded-xl flex items-center justify-center text-xl " + report.iconBg}>
                  {report.icon}
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900">{report.title}</h3>
                  <p className="text-xs text-gray-500 mt-0.5">{report.desc}</p>
                  {report.hasPeriod && (
                    <p className="text-xs text-gray-400 mt-1">Период: {
                      period === '1' ? 'сегодня' : 'последние ' + period + ' дней'
                    }</p>
                  )}
                </div>
              </div>

              <button
                onClick={() => download(report.id)}
                disabled={loading === report.id}
                className={"w-full py-2 rounded-lg text-sm font-medium transition-all " +
                  (success === report.id
                    ? 'bg-green-500 text-white'
                    : loading === report.id
                      ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200 hover:border-gray-300')}>
                {success === report.id
                  ? '✓ Скачано'
                  : loading === report.id
                    ? 'Формирую...'
                    : '↓ Скачать CSV'}
              </button>
            </div>
          ))}
        </div>

        {/* Info */}
        <div className="bg-blue-50 border border-blue-100 rounded-xl p-4">
          <p className="text-sm text-blue-700 font-medium mb-1">Как открыть в Excel</p>
          <p className="text-xs text-blue-600">
            Файл сохраняется в UTF-8 с BOM — Excel откроет кириллицу корректно.
            Если символы отображаются неверно: Данные → Из текста/CSV → кодировка UTF-8.
          </p>
        </div>

      </div>
    </div>
  );
}
`);

// Add export to sidebar
const sidebar = fs.readFileSync('components/layouts/Sidebar.tsx', 'utf8');
if (!sidebar.includes('/dashboard/export')) {
  const updated = sidebar.replace(
    `{ href: '/dashboard/productivity', icon: '⭐', label: 'Продуктивность', adminOnly: true  },`,
    `{ href: '/dashboard/productivity', icon: '⭐', label: 'Продуктивность', adminOnly: true  },
    { href: '/dashboard/export',       icon: '↓',  label: 'Экспорт',        adminOnly: true  },`
  );
  fs.writeFileSync('components/layouts/Sidebar.tsx', updated);
  console.log('✓ sidebar updated');
}

console.log('\n✅ Export frontend created');
