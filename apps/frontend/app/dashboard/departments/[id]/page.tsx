'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

const API = 'https://employee-tracker.ru/api/v1';

const STATUS_LABELS: Record<string,string> = { ACTIVE:'Активный', COMPLETED:'Завершён', ARCHIVED:'В архиве', ON_HOLD:'На паузе' };
const STATUS_COLORS: Record<string,string> = { ACTIVE:'#10B981', COMPLETED:'#7F77DD', ARCHIVED:'#9B97CC', ON_HOLD:'#F59E0B' };

export default function DepartmentDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [token, setToken] = useState('');
  const [dept, setDept] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const h = () => ({ Authorization: 'Bearer ' + localStorage.getItem('access_token') });

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    load();
  }, [id]);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/dictionaries/departments/${id}`, { headers: h() });
      setDept(await res.json());
    } catch {}
    setLoading(false);
  };

  const card: React.CSSProperties = { background:'white', borderRadius:'20px', padding:'20px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' };

  if (loading) return <div style={{ minHeight:'100vh', background:'#ECEAF8', display:'flex', alignItems:'center', justifyContent:'center', color:'#9B97CC' }}>Загрузка...</div>;
  if (!dept) return <div style={{ minHeight:'100vh', background:'#ECEAF8', display:'flex', alignItems:'center', justifyContent:'center', color:'#9B97CC' }}>Отдел не найден</div>;

  const totalTasks = dept._count?.tasks ?? 0;
  const completionPercent = totalTasks > 0 ? Math.round((dept.completedTasks / totalTasks) * 100) : 0;

  return (
    <div style={{ minHeight:'100vh', background:'#ECEAF8' }}>
      {/* Header */}
      <div style={{ background:'white', padding:'16px 28px', position:'sticky', top:0, zIndex:10, boxShadow:'0 4px 16px rgba(127,119,221,0.06)', display:'flex', alignItems:'center', gap:12 }}>
        <button onClick={()=>router.push('/dashboard/dictionaries')} style={{ background:'none', border:'none', cursor:'pointer', fontSize:18, color:'#9B97CC' }}>←</button>
        <div style={{ width:14, height:14, borderRadius:'50%', background:dept.color??'#7F77DD' }} />
        <div>
          <h1 style={{ fontSize:'18px', fontWeight:800, color:'#1a1040', margin:0 }}>{dept.name}</h1>
          <p style={{ fontSize:'11px', color:'#9B97CC', margin:'2px 0 0' }}>
            {dept.members?.length ?? 0} сотрудников · {dept.projects?.length ?? 0} проектов · {totalTasks} задач
          </p>
        </div>
      </div>

      <div style={{ padding:'20px 28px', maxWidth:'1000px', margin:'0 auto', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>

        {/* Stats card */}
        <div style={{ ...card, gridColumn:'1 / -1' }}>
          <p style={{ fontSize:'11px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 14px' }}>Показатели</p>
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:16 }}>
            {[
              { label:'Сотрудников', value: dept.members?.length ?? 0, color:'#7F77DD' },
              { label:'Проектов',    value: dept.projects?.length ?? 0, color:'#3B82F6' },
              { label:'Всего задач', value: totalTasks, color:'#F59E0B' },
              { label:'Выполнено',   value: `${completionPercent}%`, color:'#10B981' },
            ].map(s => (
              <div key={s.label}>
                <div style={{ fontSize:'24px', fontWeight:800, color:s.color }}>{s.value}</div>
                <div style={{ fontSize:'11px', color:'#9B97CC', marginTop:2 }}>{s.label}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Employees */}
        <div style={card}>
          <p style={{ fontSize:'11px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 14px' }}>
            👤 Сотрудники ({dept.members?.length ?? 0})
          </p>
          {(!dept.members || dept.members.length === 0) && (
            <p style={{ fontSize:13, color:'#C4C0E8', fontStyle:'italic', margin:0 }}>Нет сотрудников</p>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {dept.members?.map((m: any) => (
              <a key={m.id} href={`/dashboard/employees/${m.user.id}`} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'#F8F7FF', borderRadius:10, textDecoration:'none' }}>
                <div style={{ width:30, height:30, borderRadius:'50%', background:'#7F77DD', display:'flex', alignItems:'center', justifyContent:'center', color:'white', fontSize:12, fontWeight:700, flexShrink:0 }}>
                  {m.user.name?.charAt(0)}
                </div>
                <div style={{ minWidth:0 }}>
                  <p style={{ fontSize:13, fontWeight:600, color:'#1a1040', margin:0 }}>{m.user.name}</p>
                  {m.user.position && <p style={{ fontSize:11, color:'#9B97CC', margin:0 }}>{m.user.position}</p>}
                </div>
              </a>
            ))}
          </div>
        </div>

        {/* Projects */}
        <div style={card}>
          <p style={{ fontSize:'11px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 14px' }}>
            📁 Проекты ({dept.projects?.length ?? 0})
          </p>
          {(!dept.projects || dept.projects.length === 0) && (
            <p style={{ fontSize:13, color:'#C4C0E8', fontStyle:'italic', margin:0 }}>Нет проектов</p>
          )}
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            {dept.projects?.map((p: any) => (
              <a key={p.id} href={`/dashboard/projects/${p.id}`} style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', background:'#F8F7FF', borderRadius:10, textDecoration:'none' }}>
                <div style={{ flex:1, minWidth:0 }}>
                  <p style={{ fontSize:13, fontWeight:600, color:'#1a1040', margin:0 }}>{p.name}</p>
                  <p style={{ fontSize:11, color:'#9B97CC', margin:0 }}>{p._count?.tasks ?? 0} задач</p>
                </div>
                <span style={{ fontSize:10, fontWeight:700, color:STATUS_COLORS[p.status]??'#9B97CC', background:(STATUS_COLORS[p.status]??'#9B97CC')+'18', padding:'3px 8px', borderRadius:20 }}>
                  {STATUS_LABELS[p.status] ?? p.status}
                </span>
              </a>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
