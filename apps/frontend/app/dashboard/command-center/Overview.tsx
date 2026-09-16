'use client';
import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = '/api/v1';

const BG        = '#0d0f14';
const PANEL     = '#151820';
const CARD      = '#1a1e2a';
const LINE      = 'rgba(255,255,255,0.07)';
const TEXT      = '#e8eaf0';
const MUTED     = '#8892aa';
const DIM       = '#4a5168';
const DANGER    = '#e24b4a';
const WARN      = '#ba7517';
const SUCCESS   = '#27ae60';
const ACCENT    = '#6b5ce7';

interface Metrics {
  overdue: number; unassigned: number; stale: number;
  closedLast24h: number; createdLast24h: number; totalActive: number;
  onlineCount: number; teamCount: number; idleCount: number;
}
interface Signal {
  kind: string; severity: string; title: string; subtitle: string;
  entityType: string; entityId: string;
}
interface Member {
  id: string; name: string; avatarUrl: string | null; position: string | null;
  online: boolean; activeTasks: number; overdueTasks: number;
}

export default function Overview() {
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const token = localStorage.getItem('access_token');
    if (!token) { router.push('/login'); return; }
    try {
      const r = await fetch(`${API}/command-center/overview`, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!r.ok) {
        setError(r.status === 403 ? 'Недостаточно прав' : 'Не удалось загрузить данные');
        setLoading(false);
        return;
      }
      setData(await r.json());
      setError('');
    } catch {
      setError('Сервер недоступен');
    }
    setLoading(false);
  }, [router]);

  useEffect(() => { load(); }, [load]);

  if (loading) {
    return <div style={{ padding: 60, textAlign: 'center', color: DIM, fontSize: 13 }}>Загрузка…</div>;
  }
  if (error) {
    return (
      <div style={{ padding: 60, textAlign: 'center' }}>
        <div style={{ color: DANGER, fontSize: 14, marginBottom: 10 }}>{error}</div>
        <button onClick={() => { setLoading(true); load(); }} style={btn}>Повторить</button>
      </div>
    );
  }

  const m: Metrics = data.metrics;
  const signals: Signal[] = data.signals ?? [];
  const team: Member[] = data.team ?? [];
  const busiest = team[0];
  const idle = team.filter(t => t.activeTasks === 0);

  const openTask = (s: Signal) => {
    if (s.entityType === 'TASK') router.push(`/dashboard/tasks/${s.entityId}`);
    else if (s.entityType === 'PROJECT') router.push(`/dashboard/projects/${s.entityId}`);
  };

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '20px 24px 60px' }}>

      {/* Показатели */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 12, marginBottom: 24 }}>
        <Metric label="Просрочено"      value={m.overdue}       color={m.overdue ? DANGER : DIM} />
        <Metric label="Без исполнителя" value={m.unassigned}    color={m.unassigned ? WARN : DIM} />
        <Metric label="Без движения 3 дня" value={m.stale}      color={m.stale ? WARN : DIM} />
        <Metric label="Закрыто за сутки" value={m.closedLast24h} color={m.closedLast24h ? SUCCESS : DIM} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr)', gap: 16, alignItems: 'start' }}>

        {/* Требует внимания */}
        <section>
          <SectionTitle>Требует внимания</SectionTitle>
          <div style={panel}>
            {signals.length === 0 ? (
              <div style={{ padding: '18px 16px', color: DIM, fontSize: 13 }}>
                Ничего не горит — просрочек и задач без исполнителя нет
              </div>
            ) : signals.map((s, i) => (
              <div key={s.entityId + i} onClick={() => openTask(s)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 11, padding: '12px 14px',
                  borderBottom: i === signals.length - 1 ? 'none' : `1px solid ${LINE}`,
                  cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                <span style={{
                  width: 6, height: 6, borderRadius: '50%', flexShrink: 0,
                  background: s.severity === 'critical' ? DANGER : WARN,
                }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: TEXT, lineHeight: 1.35 }}>{s.title}</div>
                  <div style={{ fontSize: 11.5, color: DIM, marginTop: 2 }}>{s.subtitle}</div>
                </div>
                <span style={{ color: DIM, fontSize: 14, flexShrink: 0 }}>→</span>
              </div>
            ))}
          </div>

          <SectionTitle style={{ marginTop: 22 }}>За последние сутки</SectionTitle>
          <div style={{ ...panel, display: 'flex', gap: 0, flexWrap: 'wrap' }}>
            <Delta label="создано задач"   value={m.createdLast24h} />
            <Delta label="закрыто"          value={m.closedLast24h} />
            <Delta label="активных всего"   value={m.totalActive} last />
          </div>
        </section>

        {/* Команда */}
        <section>
          <SectionTitle>
            Команда
            {m.onlineCount > 0 && (
              <span style={{ color: SUCCESS, fontWeight: 400, marginLeft: 8 }}>
                {m.onlineCount} онлайн
              </span>
            )}
          </SectionTitle>
          <div style={panel}>
            {team.map((t, i) => (
              <div key={t.id} onClick={() => router.push(`/dashboard/employees/${t.id}`)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10, padding: '11px 14px',
                  borderBottom: i === team.length - 1 ? 'none' : `1px solid ${LINE}`,
                  cursor: 'pointer',
                }}
                onMouseEnter={e => (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.03)'}
                onMouseLeave={e => (e.currentTarget as HTMLElement).style.background = 'transparent'}>
                <div style={{
                  width: 26, height: 26, borderRadius: '50%', flexShrink: 0, overflow: 'hidden',
                  background: t.avatarUrl ? 'transparent' : ACCENT,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 11, color: '#fff',
                }}>
                  {t.avatarUrl ? <img src={t.avatarUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                               : t.name.charAt(0).toUpperCase()}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13.5, color: TEXT, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {t.name}
                  </div>
                  <div style={{ fontSize: 11.5, color: t.activeTasks === 0 ? DIM : MUTED, marginTop: 1 }}>
                    {t.activeTasks === 0 ? 'нет активных задач' : `${t.activeTasks} ${plural(t.activeTasks, 'задача', 'задачи', 'задач')}`}
                  </div>
                </div>
                {t.overdueTasks > 0 && (
                  <span style={{ fontSize: 11.5, color: DANGER, flexShrink: 0 }}>
                    {t.overdueTasks} просроч.
                  </span>
                )}
              </div>
            ))}
          </div>

          {/* Наблюдение о распределении — только когда есть о чём сказать */}
          {busiest && idle.length > 0 && busiest.activeTasks >= 3 && (
            <div style={{
              marginTop: 10, padding: '11px 14px', background: PANEL,
              border: `1px solid ${LINE}`, borderRadius: 10, fontSize: 12.5,
              color: MUTED, lineHeight: 1.5,
            }}>
              Вся активная работа на {busiest.name}: {busiest.activeTasks}{' '}
              {plural(busiest.activeTasks, 'задача', 'задачи', 'задач')}.{' '}
              {idle.length === 1 ? `${idle[0].name} без задач.` : `Без задач: ${idle.length}.`}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

/* ── мелочи ── */
const panel: React.CSSProperties = {
  background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12, overflow: 'hidden',
};
const btn: React.CSSProperties = {
  background: CARD, border: `1px solid ${LINE}`, color: TEXT,
  borderRadius: 8, padding: '7px 16px', fontSize: 13, cursor: 'pointer', font: 'inherit',
};

function Metric({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div style={{ background: PANEL, border: `1px solid ${LINE}`, borderRadius: 12, padding: '13px 15px' }}>
      <div style={{ fontSize: 12, color: DIM }}>{label}</div>
      <div style={{ fontSize: 26, color, marginTop: 3, lineHeight: 1.1 }}>{value}</div>
    </div>
  );
}

function Delta({ label, value, last }: { label: string; value: number; last?: boolean }) {
  return (
    <div style={{ flex: 1, minWidth: 120, padding: '13px 15px', borderRight: last ? 'none' : `1px solid ${LINE}` }}>
      <div style={{ fontSize: 20, color: TEXT, lineHeight: 1.1 }}>{value}</div>
      <div style={{ fontSize: 11.5, color: DIM, marginTop: 2 }}>{label}</div>
    </div>
  );
}

function SectionTitle({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ fontSize: 12, color: DIM, marginBottom: 8, letterSpacing: 0.2, ...style }}>
      {children}
    </div>
  );
}

function plural(n: number, one: string, few: string, many: string) {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return one;
  if (m10 >= 2 && m10 <= 4 && (m100 < 10 || m100 >= 20)) return few;
  return many;
}
