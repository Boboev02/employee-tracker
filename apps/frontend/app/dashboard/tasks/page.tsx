'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const COLUMNS = [
  { id:'NEW',         label:'Новые',       dot:'#aaa',     next:'IN_PROGRESS', nextLabel:'В работу' },
  { id:'IN_PROGRESS', label:'В работе',    dot:'#4A90E2',  next:'REVIEW',      nextLabel:'На проверку' },
  { id:'REVIEW',      label:'Проверка',    dot:'#FB8C00',  next:'DONE',        nextLabel:'Готово' },
  { id:'BLOCKED',     label:'Заблокировано',dot:'#E53935', next:null,          nextLabel:'' },
  { id:'DONE',        label:'Готово',      dot:'#43A047',  next:null,          nextLabel:'' },
];

const PRIORITY_STYLE: Record<string,{color:string;bg:string;label:string}> = {
  LOW:      { color:'#2E7D32', bg:'#E8F5E9', label:'Низкий' },
  MEDIUM:   { color:'#1565C0', bg:'#E3F2FD', label:'Средний' },
  HIGH:     { color:'#FB8C00', bg:'#FFF3E0', label:'Высокий' },
  CRITICAL: { color:'#C62828', bg:'#FFEBEE', label:'Критич.' },
};

export default function TasksPage() {
  const router = useRouter();
  const [columns, setColumns] = useState<Record<string,any[]>>({});
  const [employees, setEmployees] = useState<any[]>([]);
  const [showNew, setShowNew] = useState(false);
  const [newTask, setNewTask] = useState({ title:'', priority:'MEDIUM', description:'', assigneeId:'', dueDate:'' });
  const [loading, setLoading] = useState(true);
  const token = () => localStorage.getItem('access_token') || '';

  useEffect(() => {
    if (!token()) { router.push('/login'); return; }
    loadAll();
  }, []);

  const loadAll = async () => {
    const t = token();
    try {
      const [kanban, emps] = await Promise.all([
        fetch('https://employee-tracker.ru/api/v1/tasks/kanban', { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
        fetch('https://employee-tracker.ru/api/v1/employees',    { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
      ]);
      if (kanban && !kanban.error) setColumns(kanban);
      if (Array.isArray(emps)) setEmployees(emps);
    } catch(e) {} finally { setLoading(false); }
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const t = token();
    await fetch('https://employee-tracker.ru/api/v1/tasks', {
      method:'POST', headers:{ Authorization:'Bearer '+t, 'Content-Type':'application/json' },
      body: JSON.stringify({ ...newTask, assigneeId: newTask.assigneeId||undefined, dueDate: newTask.dueDate||undefined }),
    });
    setShowNew(false);
    setNewTask({ title:'', priority:'MEDIUM', description:'', assigneeId:'', dueDate:'' });
    loadAll();
  };

  const moveTask = async (id: string, status: string) => {
    await fetch(`https://employee-tracker.ru/api/v1/tasks/${id}/move`, {
      method:'PATCH', headers:{ Authorization:'Bearer '+token(), 'Content-Type':'application/json' },
      body: JSON.stringify({ status }),
    });
    loadAll();
  };

  const inp: React.CSSProperties = { width:'100%', background:'#F5F3FC', border:'1.5px solid #E0DDF0', borderRadius:'8px', padding:'9px 12px', fontSize:'13px', color:'#1a1a2e', outline:'none', boxSizing:'border-box' };
  const totalTasks = Object.values(columns).reduce((s,arr)=>s+arr.length,0);

  return (
    <div style={{ minHeight:'100vh', background:'#EBE8F6', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ background:'#fff', borderBottom:'1px solid #eee', padding:'16px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10, boxShadow:'0 2px 8px rgba(108,92,231,0.06)' }}>
        <div>
          <h1 style={{ fontSize:'18px', fontWeight:700, color:'#1a1a2e', margin:0 }}>Задачи</h1>
          <p style={{ fontSize:'12px', color:'#aaa', margin:'2px 0 0' }}>{totalTasks} задач · канбан доска</p>
        </div>
        <button onClick={()=>setShowNew(true)}
          style={{ background:'#6C5CE7', color:'white', border:'none', borderRadius:'9px', padding:'9px 20px', fontSize:'13px', fontWeight:600, cursor:'pointer', boxShadow:'0 4px 12px rgba(108,92,231,0.3)' }}>
          + Новая задача
        </button>
      </div>

      {/* Kanban */}
      <div style={{ flex:1, display:'flex', overflowX:'auto', gap:0 }}>
        {COLUMNS.map(col => {
          const tasks = columns[col.id] ?? [];
          return (
            <div key={col.id} style={{ minWidth:'280px', flex:'0 0 280px', borderRight:'1px solid #e8e4f0', display:'flex', flexDirection:'column', background:col.id==='DONE'?'rgba(67,160,71,0.03)':col.id==='BLOCKED'?'rgba(229,57,53,0.03)':'transparent' }}>
              {/* Column header */}
              <div style={{ padding:'14px 16px', borderBottom:'1px solid #e8e4f0', display:'flex', alignItems:'center', gap:'8px', background:'#fff' }}>
                <span style={{ width:'8px', height:'8px', borderRadius:'50%', background:col.dot, flexShrink:0 }} />
                <span style={{ fontSize:'13px', fontWeight:600, color:'#1a1a2e' }}>{col.label}</span>
                <span style={{ marginLeft:'auto', fontSize:'11px', fontWeight:600, color:'#6C5CE7', background:'#EDE9FF', padding:'2px 8px', borderRadius:'10px' }}>{tasks.length}</span>
              </div>
              {/* Cards */}
              <div style={{ flex:1, padding:'10px', display:'flex', flexDirection:'column', gap:'8px', background:'#F5F3FC' }}>
                {tasks.length===0 ? (
                  <div style={{ padding:'24px', textAlign:'center', color:'#ccc', fontSize:'12px' }}>Нет задач</div>
                ) : tasks.map((task:any) => {
                  const ps = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.MEDIUM;
                  const overdue = task.dueDate && new Date(task.dueDate)<new Date() && task.status!=='DONE';
                  return (
                    <div key={task.id}
                      onClick={()=>router.push('/dashboard/tasks/'+task.id)}
                      style={{ background:'#fff', borderRadius:'12px', padding:'12px 14px', cursor:'pointer', border:overdue?'1.5px solid rgba(229,57,53,0.3)':'1px solid #eee', boxShadow:'0 1px 4px rgba(0,0,0,0.05)', transition:'all 0.15s' }}
                      onMouseEnter={e => { (e.currentTarget as HTMLElement).style.boxShadow='0 4px 12px rgba(108,92,231,0.12)'; (e.currentTarget as HTMLElement).style.borderColor='#E0DDF0'; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLElement).style.boxShadow='0 1px 4px rgba(0,0,0,0.05)'; (e.currentTarget as HTMLElement).style.borderColor=overdue?'rgba(229,57,53,0.3)':'#eee'; }}>
                      <p style={{ fontSize:'13px', fontWeight:500, color:'#1a1a2e', margin:'0 0 8px', lineHeight:1.4 }}>{task.title}</p>
                      <div style={{ display:'flex', alignItems:'center', gap:'6px', flexWrap:'wrap', marginBottom:task.assignee||task.dueDate?'8px':'0' }}>
                        <span style={{ fontSize:'11px', fontWeight:600, color:ps.color, background:ps.bg, padding:'2px 7px', borderRadius:'6px' }}>{ps.label}</span>
                        {task.dueDate && (
                          <span style={{ fontSize:'11px', color:overdue?'#C62828':'#aaa' }}>📅 {new Date(task.dueDate).toLocaleDateString('ru',{day:'numeric',month:'short'})}</span>
                        )}
                        {task.assignee && (
                          <div style={{ display:'flex', alignItems:'center', gap:'4px', marginLeft:'auto' }}>
                            <div style={{ width:'18px', height:'18px', borderRadius:'50%', background:'#6C5CE7', display:'flex', alignItems:'center', justifyContent:'center' }}>
                              <span style={{ color:'white', fontSize:'8px', fontWeight:700 }}>{task.assignee.name?.charAt(0)}</span>
                            </div>
                            <span style={{ fontSize:'11px', color:'#888' }}>{task.assignee.name?.split(' ')[0]}</span>
                          </div>
                        )}
                      </div>
                      {col.next && (
                        <div style={{ display:'flex', justifyContent:'flex-end' }}>
                          <button onClick={e=>{e.stopPropagation();moveTask(task.id,col.next!);}}
                            style={{ fontSize:'11px', padding:'4px 10px', borderRadius:'7px', border:'none', background:'#EDE9FF', color:'#6C5CE7', cursor:'pointer', fontWeight:500 }}>
                            {col.nextLabel} →
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* New task modal */}
      {showNew && (
        <div style={{ position:'fixed', inset:0, background:'rgba(26,26,46,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(2px)' }}>
          <div style={{ background:'#fff', borderRadius:'16px', padding:'28px 32px', width:'460px', boxShadow:'0 16px 48px rgba(108,92,231,0.2)' }}>
            <h3 style={{ fontSize:'16px', fontWeight:700, color:'#1a1a2e', margin:'0 0 22px' }}>Новая задача</h3>
            <form onSubmit={createTask} style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              <input autoFocus placeholder="Название задачи" value={newTask.title} onChange={e=>setNewTask({...newTask,title:e.target.value})} required style={inp} />
              <textarea placeholder="Описание (необязательно)" value={newTask.description} onChange={e=>setNewTask({...newTask,description:e.target.value})} rows={3} style={{ ...inp, resize:'vertical' }} />
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <select value={newTask.priority} onChange={e=>setNewTask({...newTask,priority:e.target.value})} style={inp}>
                  <option value="LOW">Низкий</option>
                  <option value="MEDIUM">Средний</option>
                  <option value="HIGH">Высокий</option>
                  <option value="CRITICAL">Критичный</option>
                </select>
                <input type="date" value={newTask.dueDate} onChange={e=>setNewTask({...newTask,dueDate:e.target.value})} style={inp} />
              </div>
              <select value={newTask.assigneeId} onChange={e=>setNewTask({...newTask,assigneeId:e.target.value})} style={inp}>
                <option value="">Без исполнителя</option>
                {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
              </select>
              <div style={{ display:'flex', gap:'10px', marginTop:'8px' }}>
                <button type="button" onClick={()=>setShowNew(false)}
                  style={{ flex:1, background:'#F5F3FC', color:'#666', border:'1px solid #E0DDF0', borderRadius:'9px', padding:'10px', fontSize:'13px', cursor:'pointer', fontWeight:500 }}>
                  Отмена
                </button>
                <button type="submit"
                  style={{ flex:1, background:'#6C5CE7', color:'white', border:'none', borderRadius:'9px', padding:'10px', fontSize:'13px', cursor:'pointer', fontWeight:600 }}>
                  Создать задачу →
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
