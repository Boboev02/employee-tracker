'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const API = 'https://employee-tracker.ru/api/v1';
const COLORS = ['#7F77DD','#8B5CF6','#3B82F6','#10B981','#F59E0B','#EF4444','#EC4899','#06B6D4'];
const STATUS_LABELS: Record<string,string> = { ACTIVE:'Активный', COMPLETED:'Завершён', ARCHIVED:'В архиве', ON_HOLD:'На паузе' };
const STATUS_COLORS: Record<string,string> = { ACTIVE:'#10B981', COMPLETED:'#7F77DD', ARCHIVED:'#9B97CC', ON_HOLD:'#F59E0B' };

export default function ProjectsPage() {
  const router = useRouter();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ name:'', description:'', color:'#7F77DD', dueDate:'' });

  const h = () => ({ 'Content-Type':'application/json', Authorization:'Bearer '+localStorage.getItem('access_token') });

  useEffect(() => {
    if (!localStorage.getItem('access_token')) { router.push('/login'); return; }
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(API+'/projects', { headers: h() });
      setProjects(await res.json());
    } catch {}
    setLoading(false);
  };

  const create = async () => {
    if (!form.name.trim()) return;
    setSaving(true);
    try {
      const res = await fetch(API+'/projects', { method:'POST', headers:h(), body:JSON.stringify(form) });
      const p = await res.json();
      router.push('/dashboard/projects/'+p.id);
    } catch {}
    setSaving(false);
  };

  const filtered = projects.filter(p => {
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase());
    const matchStatus = !filterStatus || p.status === filterStatus;
    return matchSearch && matchStatus;
  });

  const card: React.CSSProperties = { background:'white', borderRadius:'20px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' };
  const inp: React.CSSProperties = { width:'100%', background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'10px', padding:'8px 12px', fontSize:'13px', outline:'none', boxSizing:'border-box' };

  return (
    <div style={{ minHeight:'100vh', background:'#ECEAF8' }}>
      <div style={{ background:'white', padding:'16px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10, boxShadow:'0 4px 16px rgba(127,119,221,0.06)' }}>
        <div>
          <h1 style={{ fontSize:'18px', fontWeight:800, color:'#1a1040', margin:0 }}>Проекты</h1>
          <p style={{ fontSize:'11px', color:'#9B97CC', margin:'2px 0 0' }}>{projects.length} проектов</p>
        </div>
        <button onClick={() => setShowForm(true)}
          style={{ background:'linear-gradient(135deg,#7F77DD,#5248C5)', color:'white', border:'none', borderRadius:'14px', padding:'9px 20px', fontSize:'13px', fontWeight:700, cursor:'pointer' }}>
          + Новый проект
        </button>
      </div>

      <div style={{ padding:'20px 28px', display:'flex', flexDirection:'column', gap:'16px' }}>
        <div style={{ ...card, padding:'14px 18px', display:'flex', gap:'10px', flexWrap:'wrap' }}>
          <input placeholder="Поиск проектов..." value={search} onChange={e => setSearch(e.target.value)}
            style={{ ...inp, flex:1, minWidth:'200px' }} />
          <div style={{ display:'flex', gap:'6px' }}>
            {(['', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'ARCHIVED']).map(s => (
              <button key={s} onClick={() => setFilterStatus(s)}
                style={{ background: filterStatus===s ? 'linear-gradient(135deg,#7F77DD,#5248C5)' : 'white', color: filterStatus===s ? 'white' : '#7F77DD', border:'1px solid #EDE9FE', borderRadius:'10px', padding:'7px 14px', fontSize:'12px', fontWeight:600, cursor:'pointer' }}>
                {s ? STATUS_LABELS[s] : 'Все'}
              </button>
            ))}
          </div>
        </div>

        {showForm && (
          <div style={{ ...card, padding:'20px' }}>
            <p style={{ fontSize:'15px', fontWeight:800, color:'#1a1040', margin:'0 0 16px' }}>Новый проект</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
              <input placeholder="Название проекта *" value={form.name} onChange={e => setForm(f=>({...f,name:e.target.value}))} style={inp} autoFocus />
              <textarea placeholder="Описание (необязательно)" value={form.description} onChange={e => setForm(f=>({...f,description:e.target.value}))} rows={2} style={{ ...inp, resize:'vertical' }} />
              <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                <div>
                  <p style={{ fontSize:'11px', color:'#9B97CC', margin:'0 0 6px', fontWeight:600 }}>Цвет</p>
                  <div style={{ display:'flex', gap:'6px' }}>
                    {COLORS.map(c => (
                      <div key={c} onClick={() => setForm(f=>({...f,color:c}))}
                        style={{ width:'24px', height:'24px', borderRadius:'50%', background:c, cursor:'pointer', border: form.color===c ? '3px solid #1a1040' : '2px solid white', boxShadow:'0 1px 4px rgba(0,0,0,0.2)' }} />
                    ))}
                  </div>
                </div>
                <div style={{ flex:1 }}>
                  <p style={{ fontSize:'11px', color:'#9B97CC', margin:'0 0 6px', fontWeight:600 }}>Дедлайн</p>
                  <input type="date" value={form.dueDate} onChange={e => setForm(f=>({...f,dueDate:e.target.value}))} style={{ ...inp }} />
                </div>
              </div>
              <div style={{ display:'flex', gap:'8px' }}>
                <button onClick={create} disabled={!form.name.trim()||saving}
                  style={{ background:'linear-gradient(135deg,#7F77DD,#5248C5)', color:'white', border:'none', borderRadius:'10px', padding:'9px 20px', fontSize:'13px', fontWeight:700, cursor:'pointer', opacity:(!form.name.trim()||saving)?0.6:1 }}>
                  {saving ? 'Создание...' : 'Создать проект'}
                </button>
                <button onClick={() => setShowForm(false)} style={{ background:'white', color:'#9B97CC', border:'1px solid #EDE9FE', borderRadius:'10px', padding:'9px 16px', fontSize:'13px', cursor:'pointer' }}>Отмена</button>
              </div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ textAlign:'center', padding:'60px', color:'#9B97CC' }}>Загрузка...</div>
        ) : filtered.length === 0 ? (
          <div style={{ ...card, padding:'60px', textAlign:'center' }}>
            <div style={{ fontSize:'48px', marginBottom:'12px' }}>📁</div>
            <p style={{ color:'#9B97CC', fontSize:'14px', margin:0 }}>Проектов пока нет. Создайте первый!</p>
          </div>
        ) : (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'14px' }}>
            {filtered.map(p => (
              <Link key={p.id} href={'/dashboard/projects/'+p.id} style={{ textDecoration:'none' }}>
                <div style={{ ...card, padding:'20px', cursor:'pointer', borderTop:'4px solid '+(p.color??'#7F77DD'), transition:'transform 0.15s, box-shadow 0.15s' }}
                  onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform='translateY(-2px)'; (e.currentTarget as HTMLDivElement).style.boxShadow='0 8px 24px rgba(127,119,221,0.15)'; }}
                  onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform='none'; (e.currentTarget as HTMLDivElement).style.boxShadow='0 4px 16px rgba(127,119,221,0.08)'; }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'12px' }}>
                    <h3 style={{ fontSize:'14px', fontWeight:800, color:'#1a1040', margin:0, flex:1 }}>{p.name}</h3>
                    <span style={{ background:(STATUS_COLORS[p.status]??'#9B97CC')+'20', color:STATUS_COLORS[p.status]??'#9B97CC', borderRadius:'8px', padding:'2px 10px', fontSize:'11px', fontWeight:700, marginLeft:'8px', flexShrink:0 }}>
                      {STATUS_LABELS[p.status]??p.status}
                    </span>
                  </div>
                  {p.description && <p style={{ fontSize:'12px', color:'#9B97CC', margin:'0 0 12px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.description}</p>}
                  <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                      {p.owner && (
                        <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                          <div style={{ width:'24px', height:'24px', borderRadius:'50%', background:'linear-gradient(135deg,#7F77DD,#5248C5)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', color:'white', fontWeight:700 }}>
                            {(p.owner.name??'?')[0].toUpperCase()}
                          </div>
                          <span style={{ fontSize:'11px', color:'#9B97CC' }}>{p.owner.name}</span>
                        </div>
                      )}
                    </div>
                    <div style={{ display:'flex', gap:'12px', fontSize:'11px', color:'#9B97CC' }}>
                      {p._count?.tasks > 0 && <span>✅ {p._count.tasks} задач</span>}
                      {p.dueDate && <span>📅 {new Date(p.dueDate).toLocaleDateString('ru')}</span>}
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
