'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/usePermissions';

const STATUS_COLS = [
  { id:'NEW',         label:'Новые',          dot:'#9B97CC', colBg:'#F8F7FF', accentC:'#7F77DD', accentBg:'#EDE9FE', next:'IN_PROGRESS', nextLabel:'В работу' },
  { id:'IN_PROGRESS', label:'В работе',       dot:'#2563EB', colBg:'#F0F7FF', accentC:'#2563EB', accentBg:'#DBEAFE', next:'REVIEW', nextLabel:'На проверку' },
  { id:'REVIEW',      label:'Проверка',       dot:'#D97706', colBg:'#FFFBF0', accentC:'#D97706', accentBg:'#FEF3C7', next:'DONE', nextLabel:'Готово' },
  { id:'BLOCKED',     label:'Заблокировано',  dot:'#DC2626', colBg:'#FFF5F5', accentC:'#DC2626', accentBg:'#FEE2E2', next:'IN_PROGRESS', nextLabel:'Вернуть в работу' },
  { id:'OVERDUE',     label:'Просрочено',     dot:'#DC2626', colBg:'#FFF0F0', accentC:'#DC2626', accentBg:'#FEE2E2', next:'IN_PROGRESS', nextLabel:'Вернуть в работу' },
  { id:'DONE',        label:'Готово',         dot:'#16A34A', colBg:'#F0FDF4', accentC:'#16A34A', accentBg:'#DCFCE7', next:null, nextLabel:'' },
];

const PRIORITY_STYLE: Record<string,{c:string;bg:string;l:string}> = {
  LOW:      { c:'#6B7280', bg:'#F3F4F6', l:'Низкий' },
  MEDIUM:   { c:'#2563EB', bg:'#DBEAFE', l:'Средний' },
  HIGH:     { c:'#D97706', bg:'#FEF3C7', l:'Высокий' },
  CRITICAL: { c:'#DC2626', bg:'#FEE2E2', l:'Критич.' },
};

export default function TasksPage() {
  const router  = useRouter();
  const perms   = usePermissions();
  const [columns, setColumns]   = useState<Record<string,any[]>>({});
  const [loading, setLoading]   = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [newTask, setNewTask]   = useState({ title:'', priority:'MEDIUM', description:'', assigneeId:'', dueDate:'' });
  const [token, setToken]       = useState('');
  const [mounted, setMounted]   = useState(false);
  const [dragTask, setDragTask] = useState<{id:string;fromCol:string}|null>(null);
  const [dragOverCol, setDragOverCol] = useState<string|null>(null);
  useEffect(()=>setMounted(true),[]);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t); loadKanban(t);
    fetch('https://employee-tracker.ru/api/v1/employees', { headers:{ Authorization:'Bearer '+t } })
      .then(r=>r.json()).then(d=>setEmployees(Array.isArray(d)?d:[])).catch(()=>{});
  }, []);

  const loadKanban = async (t: string) => {
    setLoading(true);
    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/tasks/kanban', { headers:{ Authorization:'Bearer '+t } });
      const data = await res.json(); setColumns(data);
    } finally { setLoading(false); }
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    await fetch('https://employee-tracker.ru/api/v1/tasks', {
      method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+token },
      body: JSON.stringify({ ...newTask, assigneeId:newTask.assigneeId||undefined, dueDate:newTask.dueDate||undefined }),
    });
    setNewTask({ title:'', priority:'MEDIUM', description:'', assigneeId:'', dueDate:'' });
    setShowForm(false); loadKanban(token);
  };

  const moveTask = async (id: string, status: string) => {
    setColumns(prev => {
      const updated = { ...prev };
      let task: any = null;
      for (const col of Object.keys(updated)) {
        const idx = updated[col].findIndex((t:any)=>t.id===id);
        if (idx!==-1) { task={...updated[col][idx],status}; updated[col]=updated[col].filter((_:any,i:number)=>i!==idx); break; }
      }
      if (task) updated[status]=[...(updated[status]??[]),task];
      return updated;
    });
    try {
      await fetch('https://employee-tracker.ru/api/v1/tasks/'+id+'/move', {
        method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+token },
        body: JSON.stringify({ status }),
      });
    } catch(e) { loadKanban(token); }
  };

  const handleDragStart = (e: React.DragEvent, taskId: string, fromCol: string) => {
    setDragTask({ id:taskId, fromCol }); e.dataTransfer.effectAllowed='move';
  };
  const handleDragEnd = () => { setDragTask(null); setDragOverCol(null); };
  const handleDrop = (e: React.DragEvent, colId: string) => {
    e.preventDefault();
    if (dragTask && dragTask.fromCol!==colId) moveTask(dragTask.id, colId);
    setDragTask(null); setDragOverCol(null);
  };

  const totalTasks = Object.values(columns).reduce((s,arr)=>s+arr.length,0);
  const inp: React.CSSProperties = { width:'100%', background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'10px', padding:'9px 14px', fontSize:'13px', color:'#1a1040', outline:'none', boxSizing:'border-box', fontFamily:'inherit' };

  return (
    <div style={{ minHeight:'100vh', background:'#ECEAF8', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ background:'white', padding:'16px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10, boxShadow:'0 4px 16px rgba(127,119,221,0.06)' }}>
        <div>
          <h1 style={{ fontSize:'18px', fontWeight:800, color:'#1a1040', margin:0 }}>Задачи</h1>
          <p style={{ fontSize:'11px', color:'#9B97CC', margin:'2px 0 0' }}>
            {totalTasks} задач · {dragTask?<span style={{ color:'#7F77DD', fontWeight:600 }}>перетащите в нужную колонку</span>:'канбан доска'}
          </p>
        </div>
        {mounted && perms.canCreateTasks && (
          <button onClick={()=>setShowForm(true)}
            style={{ background:'linear-gradient(135deg,#7F77DD,#5248C5)', color:'white', border:'none', borderRadius:'20px', padding:'9px 22px', fontSize:'13px', fontWeight:700, cursor:'pointer', boxShadow:'0 4px 12px rgba(127,119,221,0.3)' }}>
            + Новая задача
          </button>
        )}
      </div>

      {/* Kanban */}
      {loading ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flex:1, color:'#9B97CC', fontSize:'13px' }}>Загрузка...</div>
      ) : (
        <div style={{ display:'flex', flex:1, overflowX:'auto', height:'calc(100vh - 65px)', padding:'16px', gap:'12px' }}>
          {STATUS_COLS.map(col => {
            const tasks = columns[col.id] ?? [];
            const isDragOver = dragOverCol===col.id && dragTask?.fromCol!==col.id;
            return (
              <div key={col.id}
                onDragOver={e=>{e.preventDefault();setDragOverCol(col.id);}}
                onDragLeave={e=>{const r=(e.currentTarget as HTMLElement).getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)setDragOverCol(null);}}
                onDrop={e=>handleDrop(e,col.id)}
                style={{ width:'260px', flexShrink:0, display:'flex', flexDirection:'column', height:'100%', transition:'all 0.15s' }}>
                {/* Column header */}
                <div style={{ background:'white', borderRadius:'16px 16px 0 0', padding:'12px 14px', display:'flex', alignItems:'center', gap:'8px', borderBottom:'1px solid #F3F0FF', boxShadow:'0 4px 16px rgba(127,119,221,0.06)' }}>
                  <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:col.dot, flexShrink:0, boxShadow:`0 0 6px ${col.dot}60` }} />
                  <span style={{ fontSize:'13px', fontWeight:700, color:'#1a1040' }}>{col.label}</span>
                  <span style={{ marginLeft:'auto', fontSize:'10px', fontWeight:700, color:col.accentC, background:col.accentBg, padding:'2px 8px', borderRadius:'10px' }}>{tasks.length}</span>
                </div>
                {/* Tasks area */}
                <div style={{ flex:1, padding:'8px', background:isDragOver?col.accentBg:col.colBg, borderRadius:'0 0 16px 16px', border:isDragOver?`2px dashed ${col.accentC}40`:'2px solid transparent', overflowY:'auto', transition:'all 0.15s', display:'flex', flexDirection:'column', gap:'8px', boxShadow:'0 4px 16px rgba(127,119,221,0.04)' }}>
                  {tasks.length===0 && !isDragOver && (
                    <div style={{ padding:'24px', textAlign:'center', color:'#C4C0E8', fontSize:'12px' }}>Нет задач</div>
                  )}
                  {isDragOver && tasks.length===0 && (
                    <div style={{ padding:'20px', textAlign:'center', color:col.accentC, fontSize:'12px', fontWeight:600, background:col.accentBg, borderRadius:'12px', border:`1.5px dashed ${col.accentC}60` }}>
                      Переместить сюда
                    </div>
                  )}
                  {tasks.map((task:any) => {
                    const ps = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.MEDIUM;
                    const isDragging = dragTask?.id===task.id;
                    const overdue = task.dueDate && new Date(task.dueDate)<new Date() && task.status!=='DONE';
                    return (
                      <div key={task.id}
                        draggable={true}
                        onDragStart={e=>handleDragStart(e,task.id,col.id)}
                        onDragEnd={handleDragEnd}
                        onClick={()=>!dragTask&&router.push('/dashboard/tasks/'+task.id)}
                        style={{ background:'white', borderRadius:'14px', padding:'12px 14px', cursor:'grab', border:overdue?'1.5px solid #FED7D7':'1px solid #F3F0FF', boxShadow:isDragging?'0 8px 24px rgba(127,119,221,0.2)':'0 2px 8px rgba(127,119,221,0.06)', opacity:isDragging?0.5:1, transform:isDragging?'scale(1.02)':'none', transition:'all 0.15s', userSelect:'none' }}
                        onMouseEnter={e=>{if(!dragTask)(e.currentTarget as HTMLElement).style.boxShadow='0 4px 16px rgba(127,119,221,0.15)';}}
                        onMouseLeave={e=>{if(!isDragging)(e.currentTarget as HTMLElement).style.boxShadow='0 2px 8px rgba(127,119,221,0.06)';}}>
                        {/* Drag handle */}
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                          <span style={{ fontSize:'9px', fontWeight:700, color:ps.c, background:ps.bg, padding:'2px 7px', borderRadius:'8px' }}>{ps.l}</span>
                          <i className="ti ti-grip-horizontal" style={{ fontSize:'14px', color:'#D4D0F0' }} aria-hidden="true" />
                        </div>
                        <p style={{ fontSize:'13px', fontWeight:600, color:'#1a1040', margin:'0 0 8px', lineHeight:1.4 }}>{task.title}</p>
                        <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap' }}>
                          {task.dueDate && (
                            <span style={{ fontSize:'10px', color:overdue?'#DC2626':'#9B97CC', background:overdue?'#FEE2E2':'#F8F7FF', padding:'2px 7px', borderRadius:'8px' }}>
                              📅 {new Date(task.dueDate).toLocaleDateString('ru',{day:'numeric',month:'short'})}
                            </span>
                          )}
                          {task.assignee && (
                            <div style={{ display:'flex', alignItems:'center', gap:'4px', marginLeft:'auto' }}>
                              <div style={{ width:'18px', height:'18px', borderRadius:'50%', background:'#7F77DD', display:'flex', alignItems:'center', justifyContent:'center' }}>
                                <span style={{ color:'white', fontSize:'8px', fontWeight:700 }}>{task.assignee.name?.charAt(0)}</span>
                              </div>
                              <span style={{ fontSize:'10px', color:'#9B97CC' }}>{task.assignee.name?.split(' ')[0]}</span>
                            </div>
                          )}
                        </div>
                        {mounted && perms.canUpdateAnyTask && col.next && (
                          <div style={{ marginTop:'8px', paddingTop:'8px', borderTop:'1px solid #F3F0FF' }} onClick={e=>e.stopPropagation()}>
                            <button onClick={()=>moveTask(task.id,col.next!)}
                              style={{ fontSize:'10px', fontWeight:700, color:col.accentC, background:col.accentBg, border:'none', borderRadius:'8px', padding:'4px 10px', cursor:'pointer', width:'100%' }}>
                              {col.nextLabel} →
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {isDragOver && tasks.length>0 && (
                    <div style={{ height:'3px', background:col.accentC, borderRadius:'3px', opacity:0.6 }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(26,16,64,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, backdropFilter:'blur(4px)' }}>
          <div style={{ background:'white', borderRadius:'24px', padding:'28px 32px', width:'460px', boxShadow:'0 24px 64px rgba(127,119,221,0.2)' }}>
            <h2 style={{ fontSize:'18px', fontWeight:800, color:'#1a1040', margin:'0 0 22px', letterSpacing:'-0.5px' }}>Новая задача</h2>
            <form onSubmit={createTask} style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              <input autoFocus placeholder="Название задачи" value={newTask.title} onChange={e=>setNewTask({...newTask,title:e.target.value})} required style={inp} />
              <textarea placeholder="Описание (необязательно)" value={newTask.description} onChange={e=>setNewTask({...newTask,description:e.target.value})} rows={3} style={{ ...inp, resize:'none' }} />
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <div>
                  <label style={{ fontSize:'10px', color:'#9B97CC', display:'block', marginBottom:'5px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px' }}>Приоритет</label>
                  <select value={newTask.priority} onChange={e=>setNewTask({...newTask,priority:e.target.value})} style={inp}>
                    <option value="LOW">Низкий</option>
                    <option value="MEDIUM">Средний</option>
                    <option value="HIGH">Высокий</option>
                    <option value="CRITICAL">Критический</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:'10px', color:'#9B97CC', display:'block', marginBottom:'5px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px' }}>Дедлайн</label>
                  <input type="date" value={newTask.dueDate} onChange={e=>setNewTask({...newTask,dueDate:e.target.value})} min={new Date().toISOString().slice(0,10)} style={inp} />
                </div>
              </div>
              <div>
                <label style={{ fontSize:'10px', color:'#9B97CC', display:'block', marginBottom:'5px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px' }}>Исполнитель</label>
                <select value={newTask.assigneeId} onChange={e=>setNewTask({...newTask,assigneeId:e.target.value})} style={inp}>
                  <option value="">Не назначен</option>
                  {employees.map(emp=><option key={emp.id} value={emp.id}>{emp.name}</option>)}
                </select>
              </div>
              <div style={{ display:'flex', gap:'10px', marginTop:'6px' }}>
                <button type="button" onClick={()=>setShowForm(false)} style={{ flex:1, background:'#F8F7FF', color:'#6B7280', border:'1px solid #EDE9FE', borderRadius:'12px', padding:'11px', fontSize:'13px', cursor:'pointer', fontWeight:600 }}>Отмена</button>
                <button type="submit" style={{ flex:1, background:'linear-gradient(135deg,#7F77DD,#5248C5)', color:'white', border:'none', borderRadius:'12px', padding:'11px', fontSize:'13px', cursor:'pointer', fontWeight:700 }}>Создать →</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
