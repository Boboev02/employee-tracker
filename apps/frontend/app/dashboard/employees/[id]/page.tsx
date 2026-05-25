'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

const ROLE_STYLE: Record<string, { bg: string; color: string }> = {
  ADMIN:    { bg: 'var(--accent-bg)',  color: 'var(--accent)' },
  MANAGER:  { bg: 'var(--blue-bg)',    color: 'var(--blue)' },
  EMPLOYEE: { bg: 'var(--green-bg)',   color: 'var(--green)' },
  VIEWER:   { bg: 'var(--bg-secondary)', color: 'var(--text-muted)' },
  HR:       { bg: 'var(--orange-bg)', color: 'var(--orange)' },
};

export default function EmployeeProfilePage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [token, setToken] = useState('');
  const [emp, setEmp]     = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    Promise.all([
      fetch('https://employee-tracker.ru/api/v1/employees/' + id, { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
      fetch('https://employee-tracker.ru/api/v1/analytics/employees', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
      fetch('https://employee-tracker.ru/api/v1/analytics/activity/summary?userId=' + id, { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
    ]).then(([e, empStats, activity]) => {
      setEmp(e);
      const my = Array.isArray(empStats) ? empStats.find((x: any) => x.id === id) : null;
      const myAct = Array.isArray(activity) ? activity.find((x: any) => x.userId === id) : null;
      setStats({ ...my, ...myAct });
    }).catch(() => {}).finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'200px', color:'var(--text-muted)', fontSize:'13px' }}>Загрузка...</div>;
  if (!emp) return <div style={{ padding:'24px', color:'var(--text-muted)', fontSize:'13px' }}>Сотрудник не найден</div>;

  const role = emp.roles?.[0] ?? 'EMPLOYEE';
  const rs = ROLE_STYLE[role] ?? ROLE_STYLE.VIEWER;

  const card: React.CSSProperties = { background:'var(--bg-primary)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', padding:'20px' };
  const label: React.CSSProperties = { fontSize:'11px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', margin:'0 0 8px' };
  const row: React.CSSProperties = { display:'flex', justifyContent:'space-between', alignItems:'center', padding:'10px 0', borderBottom:'0.5px solid var(--border)' };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-tertiary)' }}>
      {/* Header */}
      <div style={{ background:'var(--bg-primary)', borderBottom:'0.5px solid var(--border)', padding:'14px 24px', display:'flex', alignItems:'center', gap:'12px', position:'sticky', top:0, zIndex:10 }}>
        <button onClick={() => router.push('/dashboard/employees')} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'13px', color:'var(--text-muted)', padding:'4px 8px', borderRadius:'6px' }}>← Назад</button>
        <h1 style={{ fontSize:'16px', fontWeight:600, color:'var(--text-primary)', margin:0 }}>{emp.name}</h1>
        <span style={{ fontSize:'11px', fontWeight:500, padding:'3px 8px', borderRadius:'20px', background:rs.bg, color:rs.color }}>{role}</span>
      </div>

      <div style={{ padding:'24px', display:'grid', gridTemplateColumns:'280px 1fr', gap:'16px', maxWidth:'960px' }}>

        {/* Left panel */}
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <div style={{ ...card, textAlign:'center' }}>
            <div style={{ width:'64px', height:'64px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', margin:'0 auto 12px' }}>
              <span style={{ color:'white', fontSize:'24px', fontWeight:600 }}>{emp.name.charAt(0)}</span>
            </div>
            <h2 style={{ fontSize:'16px', fontWeight:600, color:'var(--text-primary)', margin:'0 0 4px' }}>{emp.name}</h2>
            <p style={{ fontSize:'12px', color:'var(--text-muted)', margin:'0 0 12px' }}>{emp.email}</p>
            <span style={{ fontSize:'12px', fontWeight:500, padding:'4px 12px', borderRadius:'20px', background:rs.bg, color:rs.color }}>{role}</span>
          </div>

          <div style={card}>
            <p style={label}>Информация</p>
            {[
              { l:'Статус', v: <span style={{ fontSize:'12px', color: emp.status==='ACTIVE' ? 'var(--green)' : 'var(--red)' }}>{emp.status==='ACTIVE'?'Активен':'Заблокирован'}</span> },
              { l:'Email', v: emp.email },
              { l:'В организации', v: new Date(emp.createdAt).toLocaleDateString('ru') },
            ].map(item => (
              <div key={item.l} style={{ ...row, fontSize:'13px' }}>
                <span style={{ color:'var(--text-muted)' }}>{item.l}</span>
                <span style={{ color:'var(--text-primary)', fontWeight:500 }}>{item.v}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
            {[
              { l:'Создано задач', v: stats?.created ?? '—', color:'var(--text-primary)' },
              { l:'Выполнено задач', v: stats?.completed ?? '—', color:'var(--green)' },
              { l:'Событий', v: stats?.totalEvents ?? '—', color:'var(--accent)' },
            ].map(s => (
              <div key={s.l} style={{ ...card }}>
                <p style={{ fontSize:'11px', color:'var(--text-muted)', margin:'0 0 6px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{s.l}</p>
                <p style={{ fontSize:'22px', fontWeight:600, color:s.color, margin:0 }}>{s.v}</p>
              </div>
            ))}
          </div>

          <div style={card}>
            <p style={label}>Активность</p>
            {stats?.totalEvents > 0 ? (
              <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                {[
                  { l:'Всего событий', v: stats.totalEvents },
                  { l:'~Время работы', v: stats.totalEstimatedMins >= 60 ? Math.floor(stats.totalEstimatedMins/60)+'ч '+(stats.totalEstimatedMins%60)+'м' : (stats.totalEstimatedMins??0)+'м' },
                  { l:'Активных дней', v: stats.activeDays ?? '—' },
                ].map(item => (
                  <div key={item.l} style={{ ...row, fontSize:'13px' }}>
                    <span style={{ color:'var(--text-muted)' }}>{item.l}</span>
                    <span style={{ color:'var(--text-primary)', fontWeight:500 }}>{item.v}</span>
                  </div>
                ))}
              </div>
            ) : (
              <div style={{ textAlign:'center', padding:'24px', color:'var(--text-muted)', fontSize:'13px' }}>
                <p style={{ fontSize:'24px', marginBottom:'8px' }}>📊</p>
                Нет данных активности. Установите расширение Chrome.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
