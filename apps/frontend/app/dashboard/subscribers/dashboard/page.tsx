'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { LineChart, Line, BarChart, Bar, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { PLAN_LABELS } from '@/lib/subscriberConstants';

const API = 'https://employee-tracker.ru/api/v1';
const COLORS = ['#7F77DD', '#2563EB', '#16A34A', '#D97706', '#DC2626', '#0891B2'];

const WIDGET_DEFS: Record<string, { label: string; icon: string; format: 'number' | 'currency' | 'percent' }> = {
  total:            { label: 'Всего пользователей', icon: '👥', format: 'number' },
  active:           { label: 'Активные', icon: '✅', format: 'number' },
  noSubscription:   { label: 'Без подписки', icon: '🚫', format: 'number' },
  overdue:          { label: 'Просроченные', icon: '🔴', format: 'number' },
  endingToday:      { label: 'Заканчивается сегодня', icon: '⏰', format: 'number' },
  endingWeek:       { label: 'Заканчивается через неделю', icon: '🗓', format: 'number' },
  revenue:          { label: 'Доход (MRR)', icon: '💰', format: 'currency' },
  avgCheck:         { label: 'Средний чек', icon: '🧾', format: 'currency' },
  renewals:         { label: 'Продления (30 дн.)', icon: '🔄', format: 'number' },
  churns:           { label: 'Отказы (30 дн.)', icon: '📉', format: 'number' },
  newRegistrations: { label: 'Новые регистрации (30 дн.)', icon: '🆕', format: 'number' },
  ltv:              { label: 'LTV', icon: '💎', format: 'currency' },
  churnRate:        { label: 'Churn', icon: '📊', format: 'percent' },
  mrr:              { label: 'MRR', icon: '📈', format: 'currency' },
  arr:              { label: 'ARR', icon: '📅', format: 'currency' },
};
const DEFAULT_ORDER = Object.keys(WIDGET_DEFS);

function fmt(value: number, format: string): string {
  if (format === 'currency') return `${value.toLocaleString('ru')} ₽`;
  if (format === 'percent') return `${value}%`;
  return value.toLocaleString('ru');
}

export default function SubscriberDashboardPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);
  const [token, setToken] = useState('');
  const [widgets, setWidgets] = useState<any>(null);
  const [charts, setCharts] = useState<any>(null);
  const [reports, setReports] = useState<any>(null);
  const [order, setOrder] = useState<string[]>(DEFAULT_ORDER);
  const [loading, setLoading] = useState(true);
  const [dragIdx, setDragIdx] = useState<number | null>(null);
  const [showPricing, setShowPricing] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => { setMounted(true); }, []);
  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
  }, []);

  const h = useCallback(() => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + (token || localStorage.getItem('access_token')) }), [token]);

  useEffect(() => {
    if (!token) return;
    setLoading(true);
    Promise.all([
      fetch(`${API}/subscriber-dashboard/widgets`, { headers: h() }).then(r => r.json()),
      fetch(`${API}/subscriber-dashboard/charts`, { headers: h() }).then(r => r.json()),
      fetch(`${API}/subscriber-dashboard/layout`, { headers: h() }).then(r => r.json()).catch(() => null),
      fetch(`${API}/subscriber-dashboard/reports`, { headers: h() }).then(r => r.json()).catch(() => null),
    ]).then(([w, c, layout, rep]) => {
      setWidgets(w); setCharts(c); setReports(rep);
      if (layout && Array.isArray(layout) && layout.length > 0) setOrder(layout);
      setLoading(false);
    });
  }, [token, h]);

  const exportExcel = async () => {
    setExporting(true);
    const r = await fetch(`${API}/subscriber-dashboard/export/excel`, { method: 'POST', headers: h(), body: JSON.stringify({}) });
    const blob = await r.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a'); a.href = url; a.download = 'subscribers.xlsx'; a.click();
    setExporting(false);
  };

  const saveOrder = async (newOrder: string[]) => {
    setOrder(newOrder);
    await fetch(`${API}/subscriber-dashboard/layout`, { method: 'POST', headers: h(), body: JSON.stringify({ widgetOrder: newOrder }) }).catch(() => {});
  };

  const onDrop = (targetIdx: number) => {
    if (dragIdx === null || dragIdx === targetIdx) return;
    const next = [...order];
    const [moved] = next.splice(dragIdx, 1);
    next.splice(targetIdx, 0, moved);
    saveOrder(next);
    setDragIdx(null);
  };

  if (!mounted || !token) return <div style={{ minHeight: '100vh', background: '#ECEAF8' }} />;

  return (
    <div style={{ minHeight: '100vh', background: '#ECEAF8' }}>
      <div style={{ background: 'white', padding: '16px 28px', position: 'sticky', top: 0, zIndex: 20, boxShadow: '0 4px 16px rgba(127,119,221,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#1a1040', margin: 0 }}>📊 Dashboard руководителя</h1>
          <p style={{ fontSize: '11px', color: '#9B97CC', margin: '2px 0 0' }}>Перетаскивайте виджеты чтобы изменить порядок</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={exportExcel} disabled={exporting} style={{ background: '#F8F7FF', color: '#16A34A', border: '1px solid #EDE9FE', borderRadius: 20, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>{exporting ? '...' : '📊 Экспорт Excel'}</button>
          <button onClick={() => setShowPricing(true)} style={{ background: '#F8F7FF', color: '#7F77DD', border: '1px solid #EDE9FE', borderRadius: 20, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>💲 Цены тарифов</button>
          <button onClick={() => router.push('/dashboard/subscribers')} style={{ background: '#F8F7FF', color: '#7F77DD', border: '1px solid #EDE9FE', borderRadius: 20, padding: '8px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>← К подписчикам</button>
        </div>
      </div>

      <div style={{ padding: '20px 28px' }}>
        {loading ? (
          <p style={{ color: '#9B97CC', textAlign: 'center', padding: 60 }}>Загрузка...</p>
        ) : (
          <>
            {/* Widgets grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(170px, 1fr))', gap: 12, marginBottom: 24 }}>
              {order.map((key, idx) => {
                const def = WIDGET_DEFS[key];
                if (!def) return null;
                return (
                  <div key={key} draggable onDragStart={() => setDragIdx(idx)} onDragOver={e => e.preventDefault()} onDrop={() => onDrop(idx)}
                    style={{ background: 'white', borderRadius: 16, padding: '16px', boxShadow: '0 4px 16px rgba(127,119,221,0.08)', cursor: 'grab', opacity: dragIdx === idx ? 0.4 : 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                      <span style={{ fontSize: 18 }}>{def.icon}</span>
                      <span style={{ fontSize: 10, color: '#C4C0E8' }}>⠿</span>
                    </div>
                    <p style={{ fontSize: 22, fontWeight: 800, color: '#1a1040', margin: 0 }}>{fmt(widgets?.[key] ?? 0, def.format)}</p>
                    <p style={{ fontSize: 10.5, color: '#9B97CC', margin: '4px 0 0', fontWeight: 600 }}>{def.label}</p>
                  </div>
                );
              })}
            </div>

            {/* Charts */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 16 }}>
              <ChartCard title="📈 Регистрации (30 дней)">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={charts?.registrations ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F0FF" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Line type="monotone" dataKey="count" stroke="#7F77DD" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="💰 Продажи (30 дней)">
                <ResponsiveContainer width="100%" height={220}>
                  <LineChart data={charts?.sales ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F0FF" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} />
                    <YAxis tick={{ fontSize: 10 }} />
                    <Tooltip formatter={(v: any) => `${v} ₽`} />
                    <Line type="monotone" dataKey="revenue" stroke="#16A34A" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="🔄 Продления (30 дней)">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts?.renewals ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F0FF" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#2563EB" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="📉 Отток (30 дней)">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts?.churn ?? []}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F0FF" />
                    <XAxis dataKey="label" tick={{ fontSize: 10 }} interval={4} />
                    <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#DC2626" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="🥧 Распределение по тарифам">
                <ResponsiveContainer width="100%" height={220}>
                  <PieChart>
                    <Pie data={(charts?.plans ?? []).map((p: any) => ({ name: PLAN_LABELS[p.plan] ?? p.plan, value: p.count }))}
                      dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} label>
                      {(charts?.plans ?? []).map((_: any, i: number) => <Cell key={i} fill={COLORS[i % COLORS.length]} />)}
                    </Pie>
                    <Tooltip />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                  </PieChart>
                </ResponsiveContainer>
              </ChartCard>

              <ChartCard title="👤 Активность менеджеров (30 дней)">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={charts?.managerActivity ?? []} layout="vertical">
                    <CartesianGrid strokeDasharray="3 3" stroke="#F3F0FF" />
                    <XAxis type="number" tick={{ fontSize: 10 }} allowDecimals={false} />
                    <YAxis type="category" dataKey="manager" tick={{ fontSize: 10 }} width={90} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#7F77DD" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            </div>

            {/* Reports tables (Этап 9) */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 16, marginTop: 16 }}>
              <ReportTable title="👤 По менеджерам" rows={reports?.byManager ?? []} labelKey="manager" />
              <ReportTable title="🌍 По странам" rows={reports?.byCountry ?? []} labelKey="country" />
              <ReportTable title="🗣 По языкам" rows={reports?.byLanguage ?? []} labelKey="language" />
              <ReportTable title="❌ По причинам отказа" rows={reports?.byCancelReason ?? []} labelKey="reason" countKey="count" />
              <ReportTable title="⚡ Активность подписчиков (топ-20)" rows={reports?.byActivity ?? []} labelKey="subscriber" countKey="events" />
            </div>
          </>
        )}
      </div>

      {showPricing && <PricingModal h={h} onClose={() => setShowPricing(false)} />}
    </div>
  );
}

function ReportTable({ title, rows, labelKey, countKey = 'count' }: { title: string; rows: any[]; labelKey: string; countKey?: string }) {
  return (
    <div style={{ background: 'white', borderRadius: 16, padding: 18, boxShadow: '0 4px 16px rgba(127,119,221,0.08)' }}>
      <p style={{ fontSize: 13, fontWeight: 800, color: '#1a1040', margin: '0 0 12px' }}>{title}</p>
      {rows.length === 0 ? (
        <p style={{ fontSize: 12, color: '#C4C0E8', textAlign: 'center', padding: '16px 0' }}>Нет данных</p>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
          {rows.map((r, i) => (
            <div key={i} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 10px', background: '#F8F7FF', borderRadius: 8 }}>
              <span style={{ fontSize: 12, color: '#1a1040' }}>{r[labelKey]}</span>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: '#7F77DD', background: '#EDE9FE', padding: '1px 9px', borderRadius: 20 }}>{r[countKey]}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ background: 'white', borderRadius: 16, padding: 18, boxShadow: '0 4px 16px rgba(127,119,221,0.08)' }}>
      <p style={{ fontSize: 13, fontWeight: 800, color: '#1a1040', margin: '0 0 12px' }}>{title}</p>
      {children}
    </div>
  );
}

const PAID_PLAN_KEYS = ['START', 'PRO', 'BUSINESS', 'EXPERT'] as const;

function PricingModal({ h, onClose }: any) {
  const [pricing, setPricing] = useState<Record<string, number>>({ START: 0, PRO: 0, BUSINESS: 0, EXPERT: 0 });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetch(`${API}/subscriber-dashboard/pricing`, { headers: h() }).then(r => r.json()).then(setPricing).catch(() => {});
  }, []);

  const save = async () => {
    setSaving(true);
    await Promise.all(PAID_PLAN_KEYS.map(plan =>
      fetch(`${API}/subscriber-dashboard/pricing/${plan}`, { method: 'POST', headers: h(), body: JSON.stringify({ monthlyPrice: pricing[plan] ?? 0 }) })
    ));
    setSaving(false);
    onClose();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,16,64,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.15s ease-out' }}>
      <div style={{ background: 'white', borderRadius: 20, padding: 24, width: 340, boxShadow: '0 24px 64px rgba(127,119,221,0.25)' }}>
        <h3 style={{ fontSize: 15, fontWeight: 800, color: '#1a1040', margin: '0 0 4px' }}>💲 Цены тарифов</h3>
        <p style={{ fontSize: 11.5, color: '#9B97CC', margin: '0 0 16px' }}>Нужны для расчёта MRR, ARR, LTV, среднего чека</p>

        {PAID_PLAN_KEYS.map(plan => (
          <div key={plan}>
            <p style={{ fontSize: 11, color: '#9B97CC', margin: '0 0 4px' }}>Тариф «{PLAN_LABELS[plan]}», ₽/мес</p>
            <input type="number" value={pricing[plan] ?? 0} onChange={e => setPricing({ ...pricing, [plan]: parseFloat(e.target.value) || 0 })}
              style={{ width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '9px 12px', fontSize: 13, marginBottom: 12, outline: 'none', boxSizing: 'border-box' }} />
          </div>
        ))}

        <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
          <button onClick={save} disabled={saving} style={{ flex: 1, background: 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white', border: 'none', borderRadius: 10, padding: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>{saving ? 'Сохраняю...' : 'Сохранить'}</button>
          <button onClick={onClose} style={{ flex: 1, background: '#F8F7FF', color: '#6B7280', border: '1px solid #EDE9FE', borderRadius: 10, padding: 10, fontSize: 13, cursor: 'pointer' }}>Отмена</button>
        </div>
      </div>
    </div>
  );
}
