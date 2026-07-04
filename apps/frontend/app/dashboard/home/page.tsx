'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { AnimatedNumber } from '@/components/AnimatedNumber';

const API = 'https://employee-tracker.ru/api/v1';
const STATUS_COLORS: Record<string,string> = { NEW:'#9B97CC', IN_PROGRESS:'#2563EB', REVIEW:'#D97706', BLOCKED:'#DC2626', DONE:'#16A34A', OVERDUE:'#DC2626' };
const STATUS_LABELS: Record<string,string> = { NEW:'Новая', IN_PROGRESS:'В работе', REVIEW:'Проверка', BLOCKED:'Заблокировано', DONE:'Готово', OVERDUE:'Просрочена' };
const PRIORITY_COLORS: Record<string,string> = { LOW:'#6B7280', MEDIUM:'#2563EB', HIGH:'#D97706', CRITICAL:'#DC2626' };
const PRIORITY_LABELS: Record<string,string> = { LOW:'Низкий', MEDIUM:'Средний', HIGH:'Высокий', CRITICAL:'Критичный' };

export default function HomePage() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [myTasks, setMyTasks] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'todo'|'done'|'delegated'>('todo');
  const [quickTitle, setQuickTitle] = useState('');
  const [creating, setCreating] = useState(false);

  const h = () => ({ 'Content-Type':'application/json', Authorization:'Bearer '+(localStorage.getItem('access_token')||'') });

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    try { setUser(JSON.parse(localStorage.getItem('user')||'{}')); } catch {}
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tRes, pRes] = await Promise.all([
        fetch(API+'/tasks', { headers: h() }),
        fetch(API+'/projects', { headers: h() }),
      ]);
      const tData = await tRes.json();
      const pData = await pRes.json();
      setMyTasks(Array.isArray(tData) ? tData : tData.tasks ?? []);
      setProjects(Array.isArray(pData) ? pData.slice(0,6) : []);
    } catch {}
    setLoading(false);
  };

  const quickCreate = async () => {
    if (!quickTitle.trim()) return;
    setCreating(true);
    try {
      await fetch(API+'/tasks', {
        method:'POST', headers:h(),
        body:JSON.stringify({ title:quickTitle.trim(), priority:'MEDIUM' }),
      });
      setQuickTitle('');
      loadData();
    } catch {}
    setCreating(false);
  };

  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const activeTasks = myTasks.filter(t => t.status !== 'DONE');
  const doneTasks = myTasks.filter(t => t.status === 'DONE');
  const todayTasks = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) <= new Date(today.getTime() + 24*60*60*1000));
  const overdueTasks = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) < today && t.status !== 'DONE');
  const upcomingTasks = activeTasks.filter(t => t.dueDate && new Date(t.dueDate) > new Date(today.getTime() + 24*60*60*1000));
  const noDateTasks = activeTasks.filter(t => !t.dueDate);

  const hour = now.getHours();
  const greeting = hour < 12 ? 'Доброе утро' : hour < 18 ? 'Добрый день' : 'Добрый вечер';

  const card: React.CSSProperties = { background:'white', borderRadius:'20px', padding:'20px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' };

  const TaskRow = ({ task }: { task: any }) => {
    const isOverdue = task.dueDate && new Date(task.dueDate) < today && task.status !== 'DONE';
    return (
      <Link href={'/dashboard/tasks/'+task.id} style={{ textDecoration:'none' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'12px', padding:'8px 0', borderBottom:'1px solid #F8F7FF', cursor:'pointer' }}
          onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.background='#FAFAFE'}
          onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.background='transparent'}>
          <div style={{ width:'16px', height:'16px', borderRadius:'50%', border:'2px solid '+(STATUS_COLORS[task.status]??'#9B97CC'), background:task.status==='DONE'?(STATUS_COLORS[task.status]??'#9B97CC'):'white', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
            {task.status==='DONE' && <span style={{ color:'white', fontSize:'9px' }}>✓</span>}
          </div>
          <span style={{ fontSize:'13px', color:task.status==='DONE'?'#9B97CC':'#1a1040', fontWeight:600, flex:1, textDecoration:task.status==='DONE'?'line-through':'none', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {task.title}
          </span>
          <div style={{ display:'flex', gap:'6px', alignItems:'center', flexShrink:0 }}>
            {task.dueDate && (
              <span style={{ fontSize:'11px', color:isOverdue?'#DC2626':'#9B97CC', fontWeight:isOverdue?700:400 }}>
                📅 {new Date(task.dueDate).toLocaleDateString('ru', { day:'numeric', month:'short' })}
              </span>
            )}
            <span style={{ fontSize:'10px', fontWeight:700, color:PRIORITY_COLORS[task.priority]??'#9B97CC', background:(PRIORITY_COLORS[task.priority]??'#9B97CC')+'15', borderRadius:'6px', padding:'2px 6px' }}>
              {PRIORITY_LABELS[task.priority]??task.priority}
            </span>
          </div>
        </div>
      </Link>
    );
  };

  return (
    <div style={{ minHeight:'100vh', background:'#ECEAF8' }}>
      <div style={{ background:'white', padding:'16px 28px', position:'sticky', top:0, zIndex:10, boxShadow:'0 4px 16px rgba(127,119,221,0.06)' }}>
        <h1 style={{ fontSize:'18px', fontWeight:800, color:'#1a1040', margin:0 }}>Мои задачи</h1>
      </div>

      <div style={{ padding:'24px 28px', maxWidth:'1200px', display:'flex', flexDirection:'column', gap:'20px' }}>
        <div style={{ ...card, background:'linear-gradient(135deg,#7F77DD,#5248C5)', color:'white' }}>
          <h2 style={{ fontSize:'22px', fontWeight:800, margin:'0 0 6px' }}>{greeting}{user?.name ? ', '+user.name.split(' ')[0] : ''}! 👋</h2>
          <p style={{ fontSize:'13px', margin:'0 0 16px', opacity:0.8 }}>
            {activeTasks.length === 0 ? 'Все задачи выполнены! 🎉' : `У вас ${activeTasks.length} активных задач${overdueTasks.length > 0 ? `, из них ${overdueTasks.length} просрочено` : ''}`}
          </p>
          <div style={{ display:'flex', gap:'8px' }}>
            <input placeholder="Быстро добавить задачу..." value={quickTitle}
              onChange={e=>setQuickTitle(e.target.value)}
              onKeyDown={e=>e.key==='Enter'&&quickCreate()}
              style={{ flex:1, background:'rgba(255,255,255,0.2)', border:'1px solid rgba(255,255,255,0.3)', borderRadius:'10px', padding:'9px 14px', fontSize:'13px', color:'white', outline:'none' }} />
            <button onClick={quickCreate} disabled={!quickTitle.trim()||creating}
              style={{ background:'white', color:'#7F77DD', border:'none', borderRadius:'10px', padding:'9px 18px', fontSize:'13px', fontWeight:700, cursor:'pointer', opacity:(!quickTitle.trim()||creating)?0.7:1 }}>
              {creating?'...':'+ Добавить'}
            </button>
          </div>
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'12px' }}>
          {[
            { label:'Всего активных', value:activeTasks.length, color:'#7F77DD', icon:'✅' },
            { label:'Сегодня', value:todayTasks.length, color:'#2563EB', icon:'📅' },
            { label:'Просрочено', value:overdueTasks.length, color:'#DC2626', icon:'⚠️' },
            { label:'Выполнено', value:doneTasks.length, color:'#16A34A', icon:'🏆' },
          ].map((s,sIdx) => (
            <div key={s.label} className="float-in hover-lift" style={{ ...card, display:'flex', alignItems:'center', gap:'14px', animationDelay:(sIdx*0.07)+'s' }}>
              <div className="icon-pop" style={{ width:'44px', height:'44px', borderRadius:'12px', background:s.color+'15', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'20px', flexShrink:0 }}>
                {s.icon}
              </div>
              <div>
                <p style={{ fontSize:'24px', fontWeight:800, color:s.color, margin:0 }}><AnimatedNumber value={s.value} /></p>
                <p style={{ fontSize:'11px', color:'#9B97CC', margin:0, fontWeight:600 }}>{s.label}</p>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display:'grid', gridTemplateColumns:'2fr 1fr', gap:'20px' }}>
          <div style={card}>
            <div style={{ display:'flex', gap:'6px', marginBottom:'16px' }}>
              {(['todo','done','delegated'] as const).map(t => (
                <button key={t} onClick={()=>setTab(t)}
                  style={{ background:tab===t?'linear-gradient(135deg,#7F77DD,#5248C5)':'#F8F7FF', color:tab===t?'white':'#9B97CC', border:'none', borderRadius:'10px', padding:'6px 16px', fontSize:'12px', fontWeight:700, cursor:'pointer' }}>
                  {t==='todo'?'К выполнению':t==='done'?'Выполнено':'Делегировано'}
                </button>
              ))}
            </div>

            {loading ? (
              <p style={{ color:'#9B97CC', textAlign:'center', padding:'20px 0' }}>Загрузка...</p>
            ) : tab==='todo' ? (
              <>
                {overdueTasks.length > 0 && (
                  <div style={{ marginBottom:'16px' }}>
                    <p style={{ fontSize:'11px', fontWeight:700, color:'#DC2626', textTransform:'uppercase', margin:'0 0 8px', display:'flex', alignItems:'center', gap:'6px' }}>
                      ⚠️ Просрочено ({overdueTasks.length})
                    </p>
                    {overdueTasks.map(t => <TaskRow key={t.id} task={t} />)}
                  </div>
                )}
                {todayTasks.filter(t=>!overdueTasks.find(o=>o.id===t.id)).length > 0 && (
                  <div style={{ marginBottom:'16px' }}>
                    <p style={{ fontSize:'11px', fontWeight:700, color:'#2563EB', textTransform:'uppercase', margin:'0 0 8px' }}>
                      📅 Сегодня ({todayTasks.filter(t=>!overdueTasks.find(o=>o.id===t.id)).length})
                    </p>
                    {todayTasks.filter(t=>!overdueTasks.find(o=>o.id===t.id)).map(t => <TaskRow key={t.id} task={t} />)}
                  </div>
                )}
                {upcomingTasks.length > 0 && (
                  <div style={{ marginBottom:'16px' }}>
                    <p style={{ fontSize:'11px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', margin:'0 0 8px' }}>
                      Предстоящие ({upcomingTasks.length})
                    </p>
                    {upcomingTasks.slice(0,5).map(t => <TaskRow key={t.id} task={t} />)}
                  </div>
                )}
                {noDateTasks.length > 0 && (
                  <div>
                    <p style={{ fontSize:'11px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', margin:'0 0 8px' }}>
                      Без дедлайна ({noDateTasks.length})
                    </p>
                    {noDateTasks.slice(0,5).map(t => <TaskRow key={t.id} task={t} />)}
                  </div>
                )}
                {activeTasks.length === 0 && (
                  <div style={{ textAlign:'center', padding:'40px' }}>
                    <div style={{ fontSize:'40px', marginBottom:'10px' }}>🎉</div>
                    <p style={{ color:'#9B97CC', margin:0 }}>Все задачи выполнены!</p>
                  </div>
                )}
              </>
            ) : tab==='done' ? (
              <>
                {doneTasks.length === 0 ? (
                  <p style={{ color:'#9B97CC', textAlign:'center', padding:'20px 0' }}>Нет выполненных задач</p>
                ) : doneTasks.slice(0,20).map(t => <TaskRow key={t.id} task={t} />)}
              </>
            ) : (
              <p style={{ color:'#9B97CC', textAlign:'center', padding:'20px 0' }}>Делегированные задачи появятся здесь</p>
            )}
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
            <div style={card}>
              <p style={{ fontSize:'13px', fontWeight:800, color:'#1a1040', margin:'0 0 14px' }}>Мои проекты</p>
              {projects.length === 0 ? (
                <p style={{ color:'#9B97CC', fontSize:'13px' }}>Нет проектов</p>
              ) : projects.map(p => (
                <Link key={p.id} href={'/dashboard/projects/'+p.id} style={{ textDecoration:'none' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'8px 0', borderBottom:'1px solid #F8F7FF', cursor:'pointer' }}>
                    <div style={{ width:'10px', height:'10px', borderRadius:'50%', background:p.color??'#7F77DD', flexShrink:0 }} />
                    <span style={{ fontSize:'13px', color:'#1a1040', fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</span>
                    {p._count?.tasks > 0 && <span style={{ fontSize:'11px', color:'#9B97CC' }}>{p._count.tasks}</span>}
                  </div>
                </Link>
              ))}
              <Link href="/dashboard/projects" style={{ textDecoration:'none' }}>
                <p style={{ fontSize:'12px', color:'#7F77DD', margin:'12px 0 0', fontWeight:600, cursor:'pointer' }}>Все проекты →</p>
              </Link>
            </div>

            <div style={card}>
              <p style={{ fontSize:'13px', fontWeight:800, color:'#1a1040', margin:'0 0 14px' }}>Быстрые ссылки</p>
              {[
                { label:'📋 Все задачи', href:'/dashboard/tasks' },
                { label:'📁 Проекты', href:'/dashboard/projects' },
                { label:'📦 Карточки товаров', href:'/dashboard/products' },
                { label:'👥 Сотрудники', href:'/dashboard/employees' },
                { label:'🎥 Видеозвонки', href:'/dashboard/calls' },
              ].map(l => (
                <Link key={l.href} href={l.href} style={{ textDecoration:'none' }}>
                  <div style={{ padding:'7px 0', fontSize:'13px', color:'#1a1040', fontWeight:500, cursor:'pointer', borderBottom:'1px solid #F8F7FF' }}
                    onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.color='#7F77DD'}
                    onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.color='#1a1040'}>
                    {l.label}
                  </div>
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
