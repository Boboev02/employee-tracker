'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { RelationsBlock } from '@/components/relations/RelationsBlock';
import { ActivityLogBlock } from '@/components/relations/ActivityLogBlock';

const API = 'https://employee-tracker.ru/api/v1';
const STATUS_LABELS: Record<string,string> = { ACTIVE:'Активный', COMPLETED:'Завершён', ARCHIVED:'В архиве', ON_HOLD:'На паузе' };
const TASK_STATUS_LABELS: Record<string,string> = { NEW:'Новая', IN_PROGRESS:'В работе', REVIEW:'Проверка', BLOCKED:'Заблокировано', DONE:'Готово', OVERDUE:'Просрочена' };
const TASK_STATUS_COLORS: Record<string,string> = { NEW:'#9B97CC', IN_PROGRESS:'#7F77DD', REVIEW:'#D97706', BLOCKED:'#DC2626', DONE:'#16A34A', OVERDUE:'#DC2626' };
const P_COLORS: Record<string,string> = { LOW:'#9B97CC', MEDIUM:'#D97706', HIGH:'#DC2626', CRITICAL:'#7F1D1D' };

export default function ProjectDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const [project, setProject] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<'tasks'|'members'|'activity'>('tasks');
  const [filterStatus, setFilterStatus] = useState('');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [departments, setDepartments] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [taskForm, setTaskForm] = useState({ title:'', priority:'MEDIUM', assigneeId:'', dueDate:'', departmentId:'' });
  const [aiDept, setAiDept] = useState<any>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [timer, setTimer] = useState<any>(null);
  const [editing, setEditing] = useState(false);
  const [editForm, setEditForm] = useState({ name:'', description:'', status:'ACTIVE', dueDate:'' });

  const h = () => ({ 'Content-Type':'application/json', Authorization:'Bearer '+localStorage.getItem('access_token') });

  useEffect(() => {
    if (!localStorage.getItem('access_token')) { router.push('/login'); return; }
    load();
    fetch(API+'/employees', {headers:h()}).then(r=>r.json()).then(d=>setEmployees(d.employees??d??[])).catch(()=>{});
    fetch(API+'/dictionaries/departments', {headers:h()}).then(r=>r.json()).then(d=>setDepartments(Array.isArray(d)?d:[])).catch(()=>{});
  }, [id]);

  const load = async () => {
    setLoading(true);
    try {
      const [pRes, sRes] = await Promise.all([
        fetch(API+'/projects/'+id, {headers:h()}),
        fetch(API+'/projects/'+id+'/stats', {headers:h()}),
      ]);
      const p = await pRes.json();
      setProject(p);
      setEditForm({ name:p.name, description:p.description??'', status:p.status, dueDate:p.dueDate?p.dueDate.slice(0,10):'' });
      setStats(await sRes.json());
    } catch {}
    setLoading(false);
  };

  const classify = async (title: string) => {
    if (title.length < 5) { setAiDept(null); return; }
    setAiLoading(true);
    try {
      const r = await fetch(API+'/ai/classify-department', {method:'POST',headers:h(),body:JSON.stringify({title})});
      const d = await r.json();
      if (d.departmentId) {
        const found = departments.find((x:any)=>x.id===d.departmentId);
        if (found) { setAiDept(found); setTaskForm(f=>({...f,departmentId:found.id})); }
        else setAiDept(null);
      } else setAiDept(null);
    } catch { setAiDept(null); }
    setAiLoading(false);
  };

  const onTitle = (title: string) => {
    setTaskForm(f=>({...f,title}));
    setAiDept(null);
    if (timer) clearTimeout(timer);
    setTimer(setTimeout(()=>classify(title), 800));
  };

  const createTask = async () => {
    if (!taskForm.title.trim()) return;
    setSaving(true);
    try {
      await fetch(API+'/tasks', {
        method:'POST', headers:h(),
        body:JSON.stringify({ ...taskForm, projectId:id, assigneeId:taskForm.assigneeId||undefined, dueDate:taskForm.dueDate||undefined, departmentId:taskForm.departmentId||undefined }),
      });
      setTaskForm({title:'',priority:'MEDIUM',assigneeId:'',dueDate:'',departmentId:''});
      setAiDept(null);
      setShowTaskForm(false);
      load();
    } catch {}
    setSaving(false);
  };

  const saveEdit = async () => {
    await fetch(API+'/projects/'+id, { method:'PATCH', headers:h(), body:JSON.stringify(editForm) });
    setEditing(false);
    load();
  };

  if (loading) return <div style={{padding:'40px',textAlign:'center',color:'#9B97CC'}}>Загрузка...</div>;
  if (!project) return <div style={{padding:'40px',textAlign:'center',color:'#9B97CC'}}>Проект не найден</div>;

  const tasks = project.tasks ?? [];
  const filtered = filterStatus ? tasks.filter((t:any)=>t.status===filterStatus) : tasks;
  const inp: React.CSSProperties = { width:'100%', background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'10px', padding:'8px 12px', fontSize:'13px', outline:'none', boxSizing:'border-box' };
  const card: React.CSSProperties = { background:'white', borderRadius:'20px', padding:'20px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' };

  return (
    <div style={{minHeight:'100vh',background:'#ECEAF8'}}>
      <div style={{background:'white',padding:'14px 28px',display:'flex',alignItems:'center',gap:'12px',boxShadow:'0 4px 16px rgba(127,119,221,0.06)',position:'sticky',top:0,zIndex:10}}>
        <Link href="/dashboard/projects" style={{color:'#9B97CC',textDecoration:'none',fontSize:'13px'}}>← Проекты</Link>
        <span style={{color:'#EDE9FE'}}>|</span>
        <div style={{width:'14px',height:'14px',borderRadius:'50%',background:project.color??'#7F77DD',flexShrink:0}}></div>
        {editing ? (
          <input value={editForm.name} onChange={e=>setEditForm(f=>({...f,name:e.target.value}))}
            style={{fontSize:'14px',fontWeight:700,color:'#1a1040',flex:1,background:'#F8F7FF',border:'1px solid #EDE9FE',borderRadius:'8px',padding:'4px 10px',outline:'none'}} autoFocus />
        ) : (
          <span style={{fontSize:'14px',fontWeight:700,color:'#1a1040',flex:1}}>{project.name}</span>
        )}
        <span style={{background:(project.status==='ACTIVE'?'#10B981':project.status==='COMPLETED'?'#7F77DD':'#9B97CC')+'20',color:project.status==='ACTIVE'?'#10B981':project.status==='COMPLETED'?'#7F77DD':'#9B97CC',borderRadius:'8px',padding:'3px 10px',fontSize:'11px',fontWeight:700}}>
          {STATUS_LABELS[project.status]??project.status}
        </span>
        {editing ? (
          <div style={{display:'flex',gap:'6px'}}>
            <button onClick={saveEdit} style={{background:'#10B981',color:'white',border:'none',borderRadius:'8px',padding:'6px 14px',fontSize:'12px',cursor:'pointer',fontWeight:700}}>Сохранить</button>
            <button onClick={()=>setEditing(false)} style={{background:'white',color:'#9B97CC',border:'1px solid #EDE9FE',borderRadius:'8px',padding:'6px 10px',fontSize:'12px',cursor:'pointer'}}>Отмена</button>
          </div>
        ) : (
          <button onClick={()=>setEditing(true)} style={{background:'#F8F7FF',color:'#7F77DD',border:'1px solid #EDE9FE',borderRadius:'10px',padding:'6px 14px',fontSize:'12px',cursor:'pointer',fontWeight:600}}>✏️ Редактировать</button>
        )}
      </div>

      <div style={{padding:'20px 28px',display:'grid',gridTemplateColumns:'280px 1fr',gap:'20px',maxWidth:'1300px'}}>
        <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
          {stats && (
            <div style={card}>
              <p style={{fontSize:'11px',color:'#9B97CC',margin:'0 0 12px',fontWeight:700,textTransform:'uppercase'}}>Прогресс</p>
              <div style={{fontSize:'28px',fontWeight:800,color:'#1a1040',marginBottom:'6px'}}>{stats.progress}%</div>
              <div style={{background:'#F8F7FF',borderRadius:'6px',height:'8px',overflow:'hidden',marginBottom:'12px'}}>
                <div style={{width:stats.progress+'%',height:'100%',background:'linear-gradient(90deg,#7F77DD,#16A34A)',borderRadius:'6px',transition:'width 0.3s'}} />
              </div>
              {[
                {label:'Всего задач',value:stats.total,color:'#7F77DD'},
                {label:'Выполнено',value:stats.done,color:'#16A34A'},
                {label:'В работе',value:stats.inProgress,color:'#3B82F6'},
                {label:'Просрочено',value:stats.overdue,color:'#DC2626'},
              ].map(s => (
                <div key={s.label} style={{display:'flex',justifyContent:'space-between',padding:'5px 0',borderBottom:'1px solid #F8F7FF'}}>
                  <span style={{fontSize:'12px',color:'#9B97CC'}}>{s.label}</span>
                  <span style={{fontSize:'13px',fontWeight:700,color:s.color}}>{s.value}</span>
                </div>
              ))}
            </div>
          )}

          {editing && (
            <div style={card}>
              <p style={{fontSize:'11px',color:'#9B97CC',margin:'0 0 12px',fontWeight:700,textTransform:'uppercase'}}>Настройки</p>
              <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                <textarea placeholder="Описание" value={editForm.description} onChange={e=>setEditForm(f=>({...f,description:e.target.value}))} rows={3} style={{...inp,resize:'vertical'}} />
                <select value={editForm.status} onChange={e=>setEditForm(f=>({...f,status:e.target.value}))} style={inp}>
                  {Object.entries(STATUS_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>
                <input type="date" value={editForm.dueDate} onChange={e=>setEditForm(f=>({...f,dueDate:e.target.value}))} style={inp} />
              </div>
            </div>
          )}

          <div style={card}>
            <p style={{fontSize:'11px',color:'#9B97CC',margin:'0 0 12px',fontWeight:700,textTransform:'uppercase'}}>Участники ({project.members?.length??0})</p>
            {project.members?.map((m:any) => (
              <div key={m.userId} style={{display:'flex',alignItems:'center',gap:'8px',padding:'6px 0',borderBottom:'1px solid #F8F7FF'}}>
                <div style={{width:'28px',height:'28px',borderRadius:'50%',background:'linear-gradient(135deg,#7F77DD,#5248C5)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',color:'white',fontWeight:700,flexShrink:0}}>
                  {m.userId[0]?.toUpperCase()??'?'}
                </div>
                <div style={{flex:1}}>
                  <span style={{fontSize:'12px',color:'#1a1040',fontWeight:600}}>{m.userId.slice(0,8)}...</span>
                  <span style={{fontSize:'11px',color:'#9B97CC',marginLeft:'6px'}}>{m.role}</span>
                </div>
              </div>
            ))}
          </div>

          {project.description && !editing && (
            <div style={card}>
              <p style={{fontSize:'11px',color:'#9B97CC',margin:'0 0 8px',fontWeight:700,textTransform:'uppercase'}}>Описание</p>
              <p style={{fontSize:'13px',color:'#1a1040',margin:0,lineHeight:1.6}}>{project.description}</p>
            </div>
          )}
        </div>

        <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
          <div style={{display:'flex',gap:'6px',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap'}}>
            <div style={{display:'flex',gap:'6px'}}>
              {(['tasks','members','activity'] as const).map(t => (
                <button key={t} onClick={()=>setTab(t)}
                  style={{background:tab===t?'linear-gradient(135deg,#7F77DD,#5248C5)':'white',color:tab===t?'white':'#7F77DD',border:'1px solid #EDE9FE',borderRadius:'12px',padding:'8px 18px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>
                  {t==='tasks'?'Задачи ('+tasks.length+')':t==='members'?'Участники':'Активность'}
                </button>
              ))}
            </div>
            <button onClick={()=>{ setTab('tasks'); setShowTaskForm(true); }}
              style={{background:'linear-gradient(135deg,#7F77DD,#5248C5)',color:'white',border:'none',borderRadius:'14px',padding:'9px 18px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>
              + Добавить задачу
            </button>
          </div>

          {tab==='tasks' && (
            <>
              {showTaskForm && (
                <div style={card}>
                  <p style={{fontSize:'14px',fontWeight:700,color:'#1a1040',margin:'0 0 14px'}}>Новая задача в проекте</p>
                  <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                    <div>
                      <input placeholder="Название задачи *" value={taskForm.title} onChange={e=>onTitle(e.target.value)} style={inp} autoFocus />
                      {aiLoading && <div style={{fontSize:'11px',color:'#9B97CC',marginTop:'4px'}}>⟳ Определяю отдел...</div>}
                      {aiDept && !aiLoading && (
                        <div style={{display:'flex',alignItems:'center',gap:'8px',marginTop:'6px',background:'#F0FDF4',border:'1px solid #86EFAC',borderRadius:'10px',padding:'6px 10px'}}>
                          <span style={{fontSize:'11px',color:'#16A34A',fontWeight:600}}>✨ ИИ:</span>
                          <div style={{width:'8px',height:'8px',borderRadius:'50%',background:aiDept.color??'#7F77DD'}}></div>
                          <span style={{fontSize:'12px',fontWeight:700,color:'#1a1040',flex:1}}>{aiDept.name}</span>
                          <button type="button" onClick={()=>setTaskForm(f=>({...f,departmentId:aiDept.id}))}
                            style={{background:taskForm.departmentId===aiDept.id?'#16A34A':'white',color:taskForm.departmentId===aiDept.id?'white':'#16A34A',border:'1px solid #86EFAC',borderRadius:'8px',padding:'2px 8px',fontSize:'11px',cursor:'pointer',fontWeight:600}}>
                            {taskForm.departmentId===aiDept.id?'✓':'Принять'}
                          </button>
                        </div>
                      )}
                    </div>
                    <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'10px'}}>
                      <select value={taskForm.priority} onChange={e=>setTaskForm(f=>({...f,priority:e.target.value}))} style={inp}>
                        <option value="LOW">Низкий</option>
                        <option value="MEDIUM">Средний</option>
                        <option value="HIGH">Высокий</option>
                        <option value="CRITICAL">Критичный</option>
                      </select>
                      <select value={taskForm.assigneeId} onChange={e=>setTaskForm(f=>({...f,assigneeId:e.target.value}))} style={inp}>
                        <option value="">Исполнитель</option>
                        {employees.map((e:any)=><option key={e.id} value={e.id}>{e.name}</option>)}
                      </select>
                      <select value={taskForm.departmentId} onChange={e=>setTaskForm(f=>({...f,departmentId:e.target.value}))} style={inp}>
                        <option value="">Отдел</option>
                        {departments.map((d:any)=><option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                    <input type="date" value={taskForm.dueDate} onChange={e=>setTaskForm(f=>({...f,dueDate:e.target.value}))} style={inp} />
                    <div style={{display:'flex',gap:'8px'}}>
                      <button onClick={createTask} disabled={!taskForm.title.trim()||saving}
                        style={{background:'linear-gradient(135deg,#7F77DD,#5248C5)',color:'white',border:'none',borderRadius:'10px',padding:'9px 20px',fontSize:'13px',fontWeight:700,cursor:'pointer',opacity:(!taskForm.title.trim()||saving)?0.6:1}}>
                        {saving?'Создание...':'Создать задачу'}
                      </button>
                      <button onClick={()=>setShowTaskForm(false)} style={{background:'white',color:'#9B97CC',border:'1px solid #EDE9FE',borderRadius:'10px',padding:'9px 16px',fontSize:'13px',cursor:'pointer'}}>Отмена</button>
                    </div>
                  </div>
                </div>
              )}

              {tasks.length > 0 && (
                <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                  <button onClick={()=>setFilterStatus('')}
                    style={{background:!filterStatus?'linear-gradient(135deg,#7F77DD,#5248C5)':'white',color:!filterStatus?'white':'#7F77DD',border:'1px solid #EDE9FE',borderRadius:'10px',padding:'6px 12px',fontSize:'11px',fontWeight:600,cursor:'pointer'}}>
                    Все ({tasks.length})
                  </button>
                  {Object.entries(TASK_STATUS_LABELS).map(([key,label]) => {
                    const count = tasks.filter((t:any)=>t.status===key).length;
                    if (!count) return null;
                    return (
                      <button key={key} onClick={()=>setFilterStatus(filterStatus===key?'':key)}
                        style={{background:filterStatus===key?(TASK_STATUS_COLORS[key]??'#9B97CC'):'white',color:filterStatus===key?'white':(TASK_STATUS_COLORS[key]??'#9B97CC'),border:'1px solid '+(TASK_STATUS_COLORS[key]??'#9B97CC')+'40',borderRadius:'10px',padding:'6px 12px',fontSize:'11px',fontWeight:600,cursor:'pointer'}}>
                        {label} ({count})
                      </button>
                    );
                  })}
                </div>
              )}

              {filtered.length === 0 ? (
                <div style={{...card,textAlign:'center',padding:'40px'}}>
                  <div style={{fontSize:'36px',marginBottom:'10px'}}>✅</div>
                  <p style={{color:'#9B97CC',fontSize:'13px',margin:0}}>{tasks.length===0?'Задач пока нет. Нажмите "+ Добавить задачу"':'Нет задач с таким статусом'}</p>
                </div>
              ) : (
                <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                  {filtered.map((task:any) => (
                    <Link key={task.id} href={'/dashboard/tasks/'+task.id} style={{textDecoration:'none'}}>
                      <div style={{...card,padding:'14px 18px',cursor:'pointer',borderLeft:'4px solid '+(P_COLORS[task.priority]??'#9B97CC'),transition:'transform 0.1s'}}
                        onMouseEnter={e=>{(e.currentTarget as HTMLDivElement).style.transform='translateX(2px)';}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLDivElement).style.transform='none';}}>
                        <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                          <span style={{background:(TASK_STATUS_COLORS[task.status]??'#9B97CC')+'20',color:TASK_STATUS_COLORS[task.status]??'#9B97CC',borderRadius:'8px',padding:'3px 10px',fontSize:'11px',fontWeight:700,flexShrink:0}}>
                            {TASK_STATUS_LABELS[task.status]??task.status}
                          </span>
                          <span style={{fontSize:'13px',fontWeight:700,color:'#1a1040',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{task.title}</span>
                          <div style={{display:'flex',gap:'10px',fontSize:'11px',color:'#9B97CC',flexShrink:0}}>
                            {task.assignee && <span>{'👤 '+task.assignee.name}</span>}
                            {task.dueDate && <span>{'📅 '+new Date(task.dueDate).toLocaleDateString('ru')}</span>}
                          </div>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </>
          )}

          {tab==='activity' && (
            <div style={card}>
              <p style={{fontSize:'13px',fontWeight:700,color:'#1a1040',margin:'0 0 14px'}}>История активности</p>
              {project.activities?.length===0 ? (
                <p style={{color:'#9B97CC',fontSize:'13px'}}>Нет активности</p>
              ) : project.activities?.map((a:any) => (
                <div key={a.id} style={{display:'flex',gap:'10px',padding:'8px 0',borderBottom:'1px solid #F8F7FF'}}>
                  <div style={{width:'8px',height:'8px',borderRadius:'50%',background:'#7F77DD',marginTop:'5px',flexShrink:0}}></div>
                  <div>
                    <p style={{fontSize:'12px',color:'#1a1040',margin:'0 0 2px',fontWeight:600}}>{a.details}</p>
                    <p style={{fontSize:'11px',color:'#9B97CC',margin:0}}>{new Date(a.createdAt).toLocaleString('ru')}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Relations */}
          {token && project && (
            <div style={card}>
              <p style={{ fontSize:'11px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 12px' }}>Связи</p>
              <RelationsBlock entityType="PROJECT" entityId={project.id} token={token} />
            </div>
          )}

          {/* Activity Log */}
          {token && project && (
            <div style={card}>
              <p style={{ fontSize:'11px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 12px' }}>История изменений</p>
              <ActivityLogBlock entityType="PROJECT" entityId={project.id} token={token} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}
