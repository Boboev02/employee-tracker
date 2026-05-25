'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/usePermissions';

const REPORTS = [
  { id: 'activity',    title: 'Активность', desc: 'События трекинга, платформы, разделы', icon: '⏱', permission: 'canViewOrgAnalytics', hasPeriod: true },
  { id: 'employees',   title: 'Сотрудники', desc: 'Роли, статусы, события и задачи',      icon: '👥', permission: 'canViewAllEmployees', hasPeriod: false },
  { id: 'tasks',       title: 'Задачи',     desc: 'Все задачи с датами и исполнителями',   icon: '✓',  permission: 'canViewOrgAnalytics', hasPeriod: false },
  { id: 'productivity',title: 'Продуктивность', desc: 'Рейтинг и факторы команды',         icon: '⭐', permission: 'canViewOrgAnalytics', hasPeriod: true },
];

const PERIODS = [{ l: 'Сегодня', v: '1' },{ l: '7 дней', v: '7' },{ l: '14 дней', v: '14' },{ l: '30 дней', v: '30' },{ l: '90 дней', v: '90' }];

export default function ExportPage() {
  const router = useRouter();
  const [token, setToken]   = useState('');
  const [period, setPeriod] = useState('7');
  const [loading, setLoading] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const perms = usePermissions();

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
  }, []);

  const download = async (id: string) => {
    setLoading(id); setSuccess(null);
    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/export/' + id + '?days=' + period, { headers: { Authorization: 'Bearer ' + token } });
      if (!res.ok) { alert('Ошибка ' + res.status); return; }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a'); a.href = url; a.download = id + '-report.csv';
      document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url);
      setSuccess(id); setTimeout(() => setSuccess(null), 3000);
    } finally { setLoading(null); }
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-tertiary)' }}>
      <div style={{ background: 'var(--bg-primary)', borderBottom: '0.5px solid var(--border)', padding: '14px 24px' }}>
        <h1 style={{ fontSize: '16px', fontWeight: 600, color: 'var(--text-primary)', margin: 0 }}>Экспорт отчётов</h1>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '3px 0 0' }}>CSV для Excel или Google Sheets</p>
      </div>

      <div style={{ padding: '24px', maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Period */}
        <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px' }}>
          <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', marginBottom: '12px' }}>Период</p>
          <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
            {PERIODS.map(p => (
              <button key={p.v} onClick={() => setPeriod(p.v)}
                style={{ padding: '6px 14px', borderRadius: '8px', fontSize: '13px', fontWeight: 500, cursor: 'pointer', border: 'none', background: period === p.v ? 'var(--accent)' : 'var(--bg-secondary)', color: period === p.v ? 'white' : 'var(--text-secondary)', transition: 'background 0.15s' }}>
                {p.l}
              </button>
            ))}
          </div>
        </div>

        {/* Reports grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
          {REPORTS.filter(r => (perms as any)[r.permission]).map(report => (
            <div key={report.id} style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '16px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: 'rgba(167,139,250,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '16px', flexShrink: 0 }}>
                  {report.icon}
                </div>
                <div>
                  <p style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)', margin: 0 }}>{report.title}</p>
                  <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '3px 0 0' }}>{report.desc}</p>
                  {report.hasPeriod && <p style={{ fontSize: '11px', color: 'var(--text-muted)', margin: '2px 0 0' }}>Период: {PERIODS.find(p => p.v === period)?.l}</p>}
                </div>
              </div>
              <button onClick={() => download(report.id)} disabled={loading === report.id}
                style={{ width: '100%', padding: '8px', borderRadius: '8px', fontSize: '12px', fontWeight: 500, cursor: 'pointer', border: '0.5px solid var(--border)', background: success === report.id ? '#f0fdf4' : loading === report.id ? 'var(--bg-secondary)' : 'var(--bg-primary)', color: success === report.id ? '#22c55e' : 'var(--text-secondary)', transition: 'all 0.15s' }}>
                {success === report.id ? '✓ Скачано' : loading === report.id ? 'Формирую...' : '↓ Скачать CSV'}
              </button>
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(167,139,250,0.06)', border: '0.5px solid rgba(167,139,250,0.2)', borderRadius: 'var(--radius)', padding: '14px 16px' }}>
          <p style={{ fontSize: '12px', color: '#a78bfa', fontWeight: 500, marginBottom: '4px' }}>Открытие в Excel</p>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Файл сохраняется в UTF-8 с BOM — кириллица откроется корректно. При проблемах: Данные → Из текста/CSV → UTF-8.</p>
        </div>
      </div>
    </div>
  );
}
