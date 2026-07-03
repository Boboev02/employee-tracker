'use client';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/usePermissions';

const STATUS_COLS = [
  { id:'NEW',         label:'Новые',          dot:'#9B97CC', colBg:'#F8F7FF', accentC:'#7F77DD', accentBg:'#EDE9FE', next:'IN_PROGRESS', nextLabel:'В работу' },
  { id:'IN_PROGRESS', label:'В работе',       dot:'#2563EB', colBg:'#F0F7FF', accentC:'#2563EB', accentBg:'#DBEAFE', next:'REVIEW',      nextLabel:'На проверку' },
  { id:'REVIEW',      label:'Проверка',       dot:'#D97706', colBg:'#FFFBF0', accentC:'#D97706', accentBg:'#FEF3C7', next:'DONE',        nextLabel:'Готово' },
  { id:'BLOCKED',     label:'Заблокировано',  dot:'#DC2626', colBg:'#FFF5F5', accentC:'#DC2626', accentBg:'#FEE2E2', next:'IN_PROGRESS', nextLabel:'Вернуть в работу' },
  { id:'OVERDUE',     label:'Просрочено',     dot:'#DC2626', colBg:'#FFF0F0', accentC:'#DC2626', accentBg:'#FEE2E2', next:'IN_PROGRESS', nextLabel:'Вернуть в работу' },
  { id:'DONE',        label:'Готово',         dot:'#16A34A', colBg:'#F0FDF4', accentC:'#16A34A', accentBg:'#DCFCE7', next:null,          nextLabel:'' },
];

const PRIORITY_STYLE: Record<string,{c:string;bg:string;l:string}> = {
  LOW:      { c:'#6B7280', bg:'#F3F4F6', l:'Низкий' },
  MEDIUM:   { c:'#2563EB', bg:'#DBEAFE', l:'Средний' },
  HIGH:     { c:'#D97706', bg:'#FEF3C7', l:'Высокий' },
  CRITICAL: { c:'#DC2626', bg:'#FEE2E2', l:'Критич.' },
};

const AVATAR_COLORS = ['#7F77DD','#2563EB','#16A34A','#D97706','#DC2626','#0891B2'];
const avatarColor = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0)??0) % AVATAR_COLORS.length];

export default function TasksPage() {
  const router  = useRouter();
  const perms   = usePermissions();
  const isMobile = useIsMobile();
  const [columns, setColumns]     = useState<Record<string,any[]>>({});
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [newTask, setNewTask]     = useState({ title:'', priority:'MEDIUM', description:'', assigneeId:'', dueDate:'', departmentId:'', productId:'' });
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [productList, setProductList] = useState<any[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [pendingFiles, setPendingFiles] = useState<File[]>([]);
  const [tagInput, setTagInput] = useState('');
  const [pendingTags, setPendingTags] = useState<string[]>([]);
  const [pendingSubtasks, setPendingSubtasks] = useState<string[]>([]);
  const [subtaskInput, setSubtaskInput] = useState('');
  const [departments, setDepartments] = useState<any[]>([]);
  const [aiDept, setAiDept]     = useState<{ id: string; name: string; color: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [token, setToken]         = useState('');
  const [mounted, setMounted]     = useState(false);
  const [dragTask, setDragTask]   = useState<{id:string;fromCol:string}|null>(null);
  const [dragOverCol, setDragOverCol] = useState<string|null>(null);
  const [view, setView] = useState<'board'|'list'|'calendar'|'gantt'>('board');
  const [listTasks, setListTasks] = useState<any[]>([]);
  const [sortField, setSortField] = useState<'createdAt'|'dueDate'|'priority'|'title'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');
  const [calDate, setCalDate] = useState(new Date());

  // Filters
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [filterSearch,   setFilterSearch]   = useState('');
  const [filterOverdue,  setFilterOverdue]  = useState(false);
  const [filterRoutine,  setFilterRoutine]  = useState(false);
  const [showFilters,    setShowFilters]    = useState(false);

  useEffect(()=>setMounted(true),[]);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t); loadKanban(t);
    fetch('https://employee-tracker.ru/api/v1/employees', { headers:{ Authorization:'Bearer '+t } })
      .then(r=>r.json()).then(d=>setEmployees(Array.isArray(d)?d:[])).catch(()=>{});
    fetch('https://employee-tracker.ru/api/v1/dictionaries/departments', { headers:{ Authorization:'Bearer '+t } })
      .then(r=>r.json()).then(d=>setDepartments(Array.isArray(d)?d:[])).catch(()=>{});
  }, []);

  const loadList = async (t: string) => {
    setLoading(true);
    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/tasks', { headers:{ Authorization:'Bearer '+t } });
      const data = await res.json();
      setListTasks(Array.isArray(data) ? data : data.tasks ?? []);
    } catch {}
    setLoading(false);
  };

  const loadKanban = async (t: string) => {
    setLoading(true);
    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/tasks/kanban', { headers:{ Authorization:'Bearer '+t } });
      const data = await res.json(); setColumns(data);
    } finally { setLoading(false); }
  };

  // AI-классификация через backend (избегаем CORS)
  const aiTimerRef = { current: null as any };
  const classifyDepartment = async (title: string) => {
    if (!title.trim() || title.length < 5 || departments.length === 0) { setAiDept(null); return; }
    setAiLoading(true);
    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/ai/classify-department', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({ title }),
      });
      const data = await res.json();
      if (data.departmentId) {
        const found = departments.find(d => d.id === data.departmentId);
        if (found) {
          setAiDept(found);
          setNewTask(prev => ({ ...prev, departmentId: found.id }));
        } else setAiDept(null);
      } else setAiDept(null);
    } catch { setAiDept(null); }
    setAiLoading(false);
  };

  const searchProducts = async (q: string) => {
    setProductSearch(q);
    if (q.length < 1) { setProductList([]); return; }
    setLoadingProducts(true);
    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/products?search='+encodeURIComponent(q)+'&limit=10', {
        headers: { Authorization: 'Bearer '+token }
      });
      const data = await res.json();
      setProductList(data.products ?? []);
    } catch {}
    setLoadingProducts(false);
  };

  const selectProduct = (product: any) => {
    setSelectedProduct(product);
    setNewTask(prev => ({ ...prev, productId: product.id }));
    setShowProductPicker(false);
    setProductSearch('');
    setProductList([]);
  };

  const clearProduct = () => {
    setSelectedProduct(null);
    setNewTask(prev => ({ ...prev, productId: '' }));
  };

  const handleTitleChange = (title: string) => {
    setNewTask(prev => ({ ...prev, title }));
    setAiDept(null);
    clearTimeout(aiTimerRef.current);
    aiTimerRef.current = setTimeout(() => classifyDepartment(title), 800);
  };

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    const taskRes = await fetch('https://employee-tracker.ru/api/v1/tasks', {
      method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+token },
      body: JSON.stringify({ ...newTask, assigneeId:newTask.assigneeId||undefined, dueDate:newTask.dueDate||undefined, departmentId:newTask.departmentId||undefined, productId:newTask.productId||undefined, tags:pendingTags }),
    });
    const createdTask = await taskRes.json();
    // Create pending subtasks
    if (createdTask.id && pendingSubtasks.length > 0) {
      await Promise.all(pendingSubtasks.map(title =>
        fetch('https://employee-tracker.ru/api/v1/tasks', {
          method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+token },
          body: JSON.stringify({ title, parentId: createdTask.id, priority: newTask.priority }),
        })
      ));
    }
    // Upload pending files
    if (createdTask.id && pendingFiles.length > 0) {
      await Promise.all(pendingFiles.map(file => {
        const fd = new FormData();
        fd.append('file', file);
        return fetch('https://employee-tracker.ru/api/v1/tasks/'+createdTask.id+'/attachments', {
          method:'POST', headers:{ Authorization:'Bearer '+token }, body: fd,
        });
      }));
    }
    setNewTask({ title:'', priority:'MEDIUM', description:'', assigneeId:'', dueDate:'', departmentId:'', productId:'' });
    setAiDept(null);
    setSelectedProduct(null);
    setPendingFiles([]);
    setPendingTags([]);
    setPendingSubtasks([]);
    setTagInput('');
    setSubtaskInput('');
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

  // Apply filters
  const applyFilters = (tasks: any[]) => {
    return tasks.filter(task => {
      if (filterAssignee && task.assigneeId !== filterAssignee) return false;
      if (filterPriority && task.priority !== filterPriority) return false;
      if (filterSearch && !task.title?.toLowerCase().includes(filterSearch.toLowerCase())) return false;
      if (filterOverdue && !(task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE')) return false;
      if (filterRoutine && !task.isRoutine) return false;
      return true;
    });
  };

  const hasActiveFilters = filterAssignee || filterPriority || filterSearch || filterOverdue || filterRoutine;

  const clearFilters = () => {
    setFilterAssignee(''); setFilterPriority('');
    setFilterSearch(''); setFilterOverdue(false); setFilterRoutine(false);
  };

  const totalTasks = Object.values(columns).reduce((s,arr)=>s+arr.length, 0);
  const filteredTotal = Object.values(columns).reduce((s,arr)=>s+applyFilters(arr).length, 0);
  const inp: React.CSSProperties = { width:'100%', background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'10px', padding:'9px 14px', fontSize:'13px', color:'#1a1040', outline:'none', boxSizing:'border-box', fontFamily:'inherit' };
  const sel: React.CSSProperties = { background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'20px', padding:'6px 14px', fontSize:'12px', color:'#1a1040', outline:'none' };

  return (
    <div style={{ minHeight:'100vh', background:'#ECEAF8', display:'flex', flexDirection:'column' }}>
      {/* Header */}
      <div style={{ background:'white', padding:'14px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10, boxShadow:'0 4px 16px rgba(127,119,221,0.06)' }}>
        <div>
          <h1 style={{ fontSize:'18px', fontWeight:800, color:'#1a1040', margin:0 }}>Задачи</h1>
          <p style={{ fontSize:'11px', color:'#9B97CC', margin:'2px 0 0' }}>
            {hasActiveFilters ? `${filteredTotal} из ${totalTasks}` : totalTasks} задач
            {dragTask && <span style={{ color:'#7F77DD', fontWeight:600 }}> · перетащите в колонку</span>}
          </p>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          {/* View toggle */}
          <div style={{ display:'flex', background:'#F8F7FF', borderRadius:'10px', padding:'3px', border:'1px solid #EDE9FE' }}>
            <button onClick={()=>{ setView('board'); }} title="Канбан"
              style={{ background:view==='board'?'white':'transparent', border:'none', borderRadius:'8px', padding:'5px 10px', cursor:'pointer', fontSize:'14px', color:view==='board'?'#7F77DD':'#9B97CC', boxShadow:view==='board'?'0 1px 4px rgba(0,0,0,0.1)':'none' }}>
              ⊞
            </button>
            <button onClick={()=>{ setView('list'); if(token) loadList(token); }} title="Список"
              style={{ background:view==='list'?'white':'transparent', border:'none', borderRadius:'8px', padding:'5px 10px', cursor:'pointer', fontSize:'14px', color:view==='list'?'#7F77DD':'#9B97CC', boxShadow:view==='list'?'0 1px 4px rgba(0,0,0,0.1)':'none' }}>
              ☰
            </button>
            <button onClick={()=>{ setView('calendar'); if(token) loadList(token); }} title="Календарь"
              style={{ background:view==='calendar'?'white':'transparent', border:'none', borderRadius:'8px', padding:'5px 10px', cursor:'pointer', fontSize:'14px', color:view==='calendar'?'#7F77DD':'#9B97CC', boxShadow:view==='calendar'?'0 1px 4px rgba(0,0,0,0.1)':'none' }}>
              📅
            </button>
            <button onClick={()=>{ setView('gantt'); if(token) loadList(token); }} title="Гантт"
              style={{ background:view==='gantt'?'white':'transparent', border:'none', borderRadius:'8px', padding:'5px 10px', cursor:'pointer', fontSize:'14px', color:view==='gantt'?'#7F77DD':'#9B97CC', boxShadow:view==='gantt'?'0 1px 4px rgba(0,0,0,0.1)':'none' }}>
              📊
            </button>
          </div>
          {/* Search */}
          <div style={{ position:'relative' }}>
            <i className="ti ti-search" style={{ position:'absolute', left:'12px', top:'50%', transform:'translateY(-50%)', fontSize:'14px', color:'#9B97CC' }} aria-hidden="true"/>
            <input placeholder="Поиск задач..." value={filterSearch} onChange={e=>setFilterSearch(e.target.value)}
              style={{ ...sel, paddingLeft:'34px', width:'200px', borderRadius:'20px' }}/>
          </div>
          {/* Filter toggle */}
          <button onClick={()=>setShowFilters(!showFilters)}
            style={{ background:showFilters||hasActiveFilters?'#EDE9FE':'#F8F7FF', color:showFilters||hasActiveFilters?'#7F77DD':'#6B7280', border:'1px solid #EDE9FE', borderRadius:'20px', padding:'7px 14px', fontSize:'12px', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:'6px', position:'relative' }}>
            <i className="ti ti-adjustments-horizontal" style={{ fontSize:'14px' }} aria-hidden="true"/>
            Фильтры
            {hasActiveFilters && <span style={{ width:'7px', height:'7px', borderRadius:'50%', background:'#DC2626', position:'absolute', top:'5px', right:'5px' }}/>}
          </button>
          {/* Clear filters */}
          {hasActiveFilters && (
            <button onClick={clearFilters}
              style={{ background:'#FEE2E2', color:'#DC2626', border:'none', borderRadius:'20px', padding:'7px 12px', fontSize:'11px', fontWeight:700, cursor:'pointer' }}>
              ✕ Сбросить
            </button>
          )}
          {mounted && perms.canCreateTasks && (
            <button onClick={()=>setShowForm(true)}
              style={{ background:'linear-gradient(135deg,#7F77DD,#5248C5)', color:'white', border:'none', borderRadius:'20px', padding:'9px 22px', fontSize:'13px', fontWeight:700, cursor:'pointer', boxShadow:'0 4px 12px rgba(127,119,221,0.3)' }}>
              + Новая задача
            </button>
          )}
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div style={{ background:'white', borderBottom:'1px solid #F3F0FF', padding:'12px 28px', display:'flex', gap:'12px', alignItems:'center', flexWrap:'wrap' }}>
          {/* Assignee */}
          <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
            <i className="ti ti-user" style={{ fontSize:'14px', color:'#9B97CC' }} aria-hidden="true"/>
            <select value={filterAssignee} onChange={e=>setFilterAssignee(e.target.value)} style={sel}>
              <option value="">Все сотрудники</option>
              {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
            </select>
          </div>
          {/* Priority */}
          <div style={{ display:'flex', gap:'4px' }}>
            {[{v:'',l:'Все'},{v:'LOW',l:'Низкий'},{v:'MEDIUM',l:'Средний'},{v:'HIGH',l:'Высокий'},{v:'CRITICAL',l:'Критич.'}].map(p=>{
              const ps = p.v ? PRIORITY_STYLE[p.v] : null;
              return (
                <button key={p.v} onClick={()=>setFilterPriority(p.v)}
                  style={{ padding:'5px 12px', borderRadius:'20px', fontSize:'11px', fontWeight:filterPriority===p.v?700:500, border:'none', cursor:'pointer', background:filterPriority===p.v?(ps?ps.bg:'#EDE9FE'):'#F8F7FF', color:filterPriority===p.v?(ps?ps.c:'#7F77DD'):'#9B97CC', transition:'all 0.15s' }}>
                  {p.l}
                </button>
              );
            })}
          </div>
          {/* Toggles */}
          <div style={{ display:'flex', gap:'8px', marginLeft:'auto' }}>
            <button onClick={()=>setFilterOverdue(!filterOverdue)}
              style={{ padding:'5px 14px', borderRadius:'20px', fontSize:'11px', fontWeight:700, border:'none', cursor:'pointer', background:filterOverdue?'#FEE2E2':'#F8F7FF', color:filterOverdue?'#DC2626':'#9B97CC', transition:'all 0.15s' }}>
              ⚠️ Просроченные
            </button>
            <button onClick={()=>setFilterRoutine(!filterRoutine)}
              style={{ padding:'5px 14px', borderRadius:'20px', fontSize:'11px', fontWeight:700, border:'none', cursor:'pointer', background:filterRoutine?'#EDE9FE':'#F8F7FF', color:filterRoutine?'#7F77DD':'#9B97CC', transition:'all 0.15s' }}>
              🔄 Рутинные
            </button>
          </div>
        </div>
      )}

      {/* List View */}
      {view==='list' && (
        <div style={{ padding:'16px 28px', flex:1 }}>
          {loading ? (
            <div style={{ textAlign:'center', padding:'40px', color:'#9B97CC' }}>Загрузка...</div>
          ) : (
            <div style={{ background:'white', borderRadius:'16px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)', overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ background:'#F8F7FF', borderBottom:'1px solid #EDE9FE' }}>
                    {[
                      {label:'Задача', field:'title'},
                      {label:'Статус', field:null},
                      {label:'Исполнитель', field:null},
                      {label:'Приоритет', field:'priority'},
                      {label:'Дедлайн', field:'dueDate'},
                      {label:'Создана', field:'createdAt'},
                    ].map(col => (
                      <th key={col.label} onClick={()=>{ if(col.field){ setSortField(col.field as any); setSortDir(d=>d==='asc'?'desc':'asc'); }}}
                        style={{ padding:'10px 14px', fontSize:'11px', fontWeight:700, color:'#9B97CC', textAlign:'left', textTransform:'uppercase', letterSpacing:'0.5px', cursor:col.field?'pointer':'default', userSelect:'none', whiteSpace:'nowrap' }}>
                        {col.label} {col.field===sortField ? (sortDir==='asc'?'↑':'↓') : ''}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {[...listTasks]
                    .filter(t => {
                      if (filterSearch && !t.title.toLowerCase().includes(filterSearch.toLowerCase())) return false;
                      if (filterAssignee && t.assigneeId !== filterAssignee) return false;
                      if (filterPriority && t.priority !== filterPriority) return false;
                      return true;
                    })
                    .sort((a, b) => {
                      const PORD: Record<string,number> = {LOW:0,MEDIUM:1,HIGH:2,CRITICAL:3};
                      let av: any = a[sortField], bv: any = b[sortField];
                      if (sortField==='priority') { av=PORD[a.priority]??0; bv=PORD[b.priority]??0; }
                      if (av < bv) return sortDir==='asc' ? -1 : 1;
                      if (av > bv) return sortDir==='asc' ? 1 : -1;
                      return 0;
                    })
                    .map((task, i) => {
                      const ps = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.MEDIUM;
                      const sc = STATUS_COLS.find(s=>s.id===task.status);
                      const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE';
                      return (
                        <tr key={task.id}
                          onClick={()=>router.push('/dashboard/tasks/'+task.id)}
                          style={{ borderBottom:'1px solid #F8F7FF', cursor:'pointer', background: i%2===0?'white':'#FAFAFE', transition:'background 0.1s' }}
                          onMouseEnter={e=>(e.currentTarget as HTMLTableRowElement).style.background='#F0EDFF'}
                          onMouseLeave={e=>(e.currentTarget as HTMLTableRowElement).style.background=i%2===0?'white':'#FAFAFE'}>
                          <td style={{ padding:'10px 14px', fontSize:'13px', fontWeight:600, color:'#1a1040', maxWidth:'300px' }}>
                            <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.title}</div>
                          </td>
                          <td style={{ padding:'10px 14px' }}>
                            <span style={{ background:(sc?.accentBg??'#F8F7FF'), color:(sc?.accentC??'#9B97CC'), borderRadius:'8px', padding:'3px 10px', fontSize:'11px', fontWeight:700, whiteSpace:'nowrap' }}>
                              {sc?.label??task.status}
                            </span>
                          </td>
                          <td style={{ padding:'10px 14px' }}>
                            {task.assignee ? (
                              <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                                <div style={{ width:'24px', height:'24px', borderRadius:'50%', background:avatarColor(task.assignee.name), display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', color:'white', fontWeight:700, flexShrink:0 }}>
                                  {task.assignee.name?.charAt(0)?.toUpperCase()}
                                </div>
                                <span style={{ fontSize:'12px', color:'#1a1040', whiteSpace:'nowrap' }}>{task.assignee.name}</span>
                              </div>
                            ) : <span style={{ fontSize:'12px', color:'#C4C0E8' }}>—</span>}
                          </td>
                          <td style={{ padding:'10px 14px' }}>
                            <span style={{ background:ps.bg, color:ps.c, borderRadius:'8px', padding:'3px 10px', fontSize:'11px', fontWeight:700 }}>{ps.l}</span>
                          </td>
                          <td style={{ padding:'10px 14px', fontSize:'12px', color:isOverdue?'#DC2626':'#9B97CC', fontWeight:isOverdue?700:400, whiteSpace:'nowrap' }}>
                            {task.dueDate ? new Date(task.dueDate).toLocaleDateString('ru') : '—'}
                          </td>
                          <td style={{ padding:'10px 14px', fontSize:'12px', color:'#9B97CC', whiteSpace:'nowrap' }}>
                            {new Date(task.createdAt).toLocaleDateString('ru')}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
              {listTasks.length === 0 && (
                <div style={{ textAlign:'center', padding:'40px', color:'#9B97CC' }}>Задач нет</div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Calendar View */}
      {view==='calendar' && (() => {
        const year = calDate.getFullYear();
        const month = calDate.getMonth();
        const firstDay = new Date(year, month, 1).getDay();
        const daysInMonth = new Date(year, month+1, 0).getDate();
        const startOffset = firstDay === 0 ? 6 : firstDay - 1;
        const MONTHS = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
        const DAYS = ['Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
        const today = new Date();

        const getTasksForDay = (day: number) => {
          const date = new Date(year, month, day);
          return listTasks.filter(t => {
            if (!t.dueDate) return false;
            const d = new Date(t.dueDate);
            return d.getFullYear()===year && d.getMonth()===month && d.getDate()===day;
          });
        };

        const cells = [];
        for (let i=0; i<startOffset; i++) cells.push(null);
        for (let d=1; d<=daysInMonth; d++) cells.push(d);

        return (
          <div style={{ padding:'16px 28px', flex:1 }}>
            <div style={{ background:'white', borderRadius:'16px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)', overflow:'hidden' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid #EDE9FE' }}>
                <button onClick={()=>setCalDate(new Date(year, month-1, 1))}
                  style={{ background:'#F8F7FF', border:'none', borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontSize:'14px', color:'#7F77DD' }}>←</button>
                <h3 style={{ margin:0, fontSize:'16px', fontWeight:800, color:'#1a1040' }}>{MONTHS[month]} {year}</h3>
                <div style={{ display:'flex', gap:'8px' }}>
                  <button onClick={()=>setCalDate(new Date())}
                    style={{ background:'#EDE9FE', border:'none', borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontSize:'12px', color:'#7F77DD', fontWeight:700 }}>Сегодня</button>
                  <button onClick={()=>setCalDate(new Date(year, month+1, 1))}
                    style={{ background:'#F8F7FF', border:'none', borderRadius:'8px', padding:'6px 12px', cursor:'pointer', fontSize:'14px', color:'#7F77DD' }}>→</button>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)' }}>
                {DAYS.map(d => (
                  <div key={d} style={{ padding:'8px', textAlign:'center', fontSize:'11px', fontWeight:700, color:'#9B97CC', borderBottom:'1px solid #EDE9FE', background:'#F8F7FF' }}>
                    {d}
                  </div>
                ))}
                {cells.map((day, i) => {
                  const isToday = day && today.getDate()===day && today.getMonth()===month && today.getFullYear()===year;
                  const tasks = day ? getTasksForDay(day) : [];
                  return (
                    <div key={i} style={{ minHeight:'100px', padding:'6px', borderRight:'1px solid #EDE9FE', borderBottom:'1px solid #EDE9FE', background:day?'white':'#F8F7FF', verticalAlign:'top' }}>
                      {day && (
                        <>
                          <div style={{ width:'24px', height:'24px', borderRadius:'50%', background:isToday?'#7F77DD':'transparent', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'12px', fontWeight:isToday?700:400, color:isToday?'white':'#1a1040', marginBottom:'4px' }}>
                            {day}
                          </div>
                          {tasks.slice(0,3).map(t => {
                            const ps = PRIORITY_STYLE[t.priority]??PRIORITY_STYLE.MEDIUM;
                            return (
                              <div key={t.id} onClick={()=>router.push('/dashboard/tasks/'+t.id)}
                                style={{ background:ps.bg, color:ps.c, borderRadius:'4px', padding:'2px 6px', fontSize:'10px', fontWeight:600, marginBottom:'2px', cursor:'pointer', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                                title={t.title}>
                                {t.title}
                              </div>
                            );
                          })}
                          {tasks.length > 3 && (
                            <div style={{ fontSize:'10px', color:'#9B97CC', fontWeight:600 }}>+{tasks.length-3} ещё</div>
                          )}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        );
      })()}

      {/* Gantt View */}
      {view==='gantt' && (() => {
        const now = new Date();
        const tasks = listTasks.filter(t => t.dueDate || t.createdAt);

        // Определяем диапазон дат
        const dates = tasks.flatMap(t => [
          t.createdAt ? new Date(t.createdAt) : null,
          t.dueDate   ? new Date(t.dueDate)   : null,
        ]).filter(Boolean) as Date[];

        let minDate = dates.length ? new Date(Math.min(...dates.map(d=>d.getTime()))) : new Date();
        let maxDate = dates.length ? new Date(Math.max(...dates.map(d=>d.getTime()))) : new Date();

        // Добавляем буфер по 3 дня с каждой стороны
        minDate = new Date(minDate.getTime() - 3*24*60*60*1000);
        maxDate = new Date(maxDate.getTime() + 3*24*60*60*1000);

        const totalDays = Math.ceil((maxDate.getTime() - minDate.getTime()) / (24*60*60*1000));
        const DAY_W = 36; // ширина одного дня в px
        const ROW_H = 40;

        const days: Date[] = [];
        for (let i=0; i<totalDays; i++) {
          days.push(new Date(minDate.getTime() + i*24*60*60*1000));
        }

        const getX = (date: Date) => Math.floor((date.getTime() - minDate.getTime()) / (24*60*60*1000)) * DAY_W;

        const MONTHS_RU = ['Янв','Фев','Мар','Апр','Май','Июн','Июл','Авг','Сен','Окт','Ноя','Дек'];
        const DAYS_RU = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

        return (
          <div style={{ padding:'16px 28px', flex:1, overflow:'hidden' }}>
            <div style={{ background:'white', borderRadius:'16px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)', overflow:'hidden' }}>
              <div style={{ overflowX:'auto' }}>
                <div style={{ minWidth: totalDays*DAY_W + 220 + 'px' }}>
                  <div style={{ display:'flex', borderBottom:'1px solid #EDE9FE' }}>
                    <div style={{ width:'220px', flexShrink:0, padding:'10px 14px', fontSize:'11px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', background:'#F8F7FF', borderRight:'1px solid #EDE9FE' }}>
                      Задача
                    </div>
                    <div style={{ position:'relative', flex:1 }}>
                      <div style={{ display:'flex', background:'#F8F7FF' }}>
                        {days.map((d,i) => {
                          const isToday = d.toDateString() === now.toDateString();
                          const isWeekend = d.getDay()===0 || d.getDay()===6;
                          return (
                            <div key={i} style={{ width:DAY_W+'px', flexShrink:0, textAlign:'center', padding:'4px 0', borderRight:'1px solid #EDE9FE', background:isToday?'#EDE9FE':isWeekend?'#F0F0F8':'#F8F7FF' }}>
                              {i===0 || d.getDate()===1 ? (
                                <div style={{ fontSize:'9px', fontWeight:700, color:'#7F77DD' }}>{MONTHS_RU[d.getMonth()]}</div>
                              ) : <div style={{ height:'13px' }} />}
                              <div style={{ fontSize:'10px', fontWeight:isToday?700:400, color:isToday?'#7F77DD':isWeekend?'#9B97CC':'#1a1040' }}>
                                {d.getDate()}
                              </div>
                              <div style={{ fontSize:'9px', color:'#C4C0E8' }}>{DAYS_RU[d.getDay()]}</div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {tasks.length === 0 ? (
                    <div style={{ textAlign:'center', padding:'40px', color:'#9B97CC' }}>Нет задач с дедлайнами</div>
                  ) : tasks.map((task, idx) => {
                    const ps = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.MEDIUM;
                    const sc = STATUS_COLS.find(s=>s.id===task.status);
                    const startDate = new Date(task.createdAt);
                    const endDate = task.dueDate ? new Date(task.dueDate) : new Date(startDate.getTime() + 24*60*60*1000);
                    const x = getX(startDate);
                    const w = Math.max(DAY_W, getX(endDate) - x + DAY_W);
                    const isOverdue = task.dueDate && endDate < now && task.status !== 'DONE';

                    return (
                      <div key={task.id} style={{ display:'flex', borderBottom:'1px solid #F8F7FF', height:ROW_H+'px' }}
                        onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.background='#FAFAFE'}
                        onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.background='white'}>
                        <div style={{ width:'220px', flexShrink:0, padding:'0 14px', display:'flex', alignItems:'center', gap:'8px', borderRight:'1px solid #EDE9FE', cursor:'pointer' }}
                          onClick={()=>router.push('/dashboard/tasks/'+task.id)}>
                          <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:sc?.accentC??'#9B97CC', flexShrink:0 }} />
                          <span style={{ fontSize:'12px', fontWeight:600, color:'#1a1040', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.title}</span>
                        </div>
                        <div style={{ position:'relative', flex:1, overflow:'hidden' }}>
                          {days.map((d,i) => {
                            const isWeekend = d.getDay()===0||d.getDay()===6;
                            const isToday = d.toDateString()===now.toDateString();
                            return (
                              <div key={i} style={{ position:'absolute', left:i*DAY_W+'px', top:0, width:DAY_W+'px', height:'100%', background:isToday?'rgba(127,119,221,0.05)':isWeekend?'rgba(0,0,0,0.02)':'transparent', borderRight:'1px solid #F8F7FF' }} />
                            );
                          })}
                          <div style={{ position:'absolute', left:x+'px', top:'8px', width:w+'px', height:'24px', background:isOverdue?'#FEE2E2':ps.bg, borderRadius:'6px', display:'flex', alignItems:'center', paddingLeft:'8px', cursor:'pointer', border:'1px solid '+(isOverdue?'#FCA5A5':ps.c)+'40', zIndex:1 }}
                            onClick={()=>router.push('/dashboard/tasks/'+task.id)}
                            title={task.title}>
                            <span style={{ fontSize:'11px', fontWeight:600, color:isOverdue?'#DC2626':ps.c, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.title}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Kanban */}
      {view==='board' && loading ? (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'center', flex:1, color:'#9B97CC', fontSize:'13px' }}>Загрузка...</div>
      ) : view==='board' && (
        <div style={{ display:'flex', flex:1, overflowX:'auto', height:`calc(100vh - ${showFilters?'115px':'65px'})`, padding:'16px', gap:'12px' }}>
          {STATUS_COLS.map(col => {
            const allTasks = columns[col.id] ?? [];
            const tasks = applyFilters(allTasks);
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
                  <span style={{ marginLeft:'auto', fontSize:'10px', fontWeight:700, color:col.accentC, background:col.accentBg, padding:'2px 8px', borderRadius:'10px' }}>
                    {hasActiveFilters ? `${tasks.length}/${allTasks.length}` : tasks.length}
                  </span>
                </div>
                {/* Tasks area */}
                <div style={{ flex:1, padding:'8px', background:isDragOver?col.accentBg:col.colBg, borderRadius:'0 0 16px 16px', border:isDragOver?`2px dashed ${col.accentC}40`:'2px solid transparent', overflowY:'auto', transition:'all 0.15s', display:'flex', flexDirection:'column', gap:'8px', boxShadow:'0 4px 16px rgba(127,119,221,0.04)' }}>
                  {tasks.length===0 && !isDragOver && (
                    <div style={{ padding:'24px', textAlign:'center', color:'#C4C0E8', fontSize:'12px' }}>
                      {hasActiveFilters && allTasks.length>0 ? 'Не совпадает с фильтром' : 'Нет задач'}
                    </div>
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
                        style={{ background: task.status==='OVERDUE'?'#FFF5F5':'white', borderRadius:'14px', padding:'12px 14px', cursor:'grab', border:overdue?'1.5px solid #FED7D7':'1px solid #F3F0FF', boxShadow:isDragging?'0 8px 24px rgba(127,119,221,0.2)':'0 2px 8px rgba(127,119,221,0.06)', opacity:isDragging?0.5:1, transform:isDragging?'scale(1.02)':'none', transition:'all 0.15s', userSelect:'none' }}
                        onMouseEnter={e=>{if(!dragTask)(e.currentTarget as HTMLElement).style.boxShadow='0 4px 16px rgba(127,119,221,0.15)';}}
                        onMouseLeave={e=>{if(!isDragging)(e.currentTarget as HTMLElement).style.boxShadow='0 2px 8px rgba(127,119,221,0.06)';}}>
                        {/* Top row */}
                        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:'8px' }}>
                          <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                            <span style={{ fontSize:'9px', fontWeight:700, color:ps.c, background:ps.bg, padding:'2px 7px', borderRadius:'8px' }}>{ps.l}</span>
                            {task.isRoutine && <span style={{ fontSize:'9px', fontWeight:700, color:'#7F77DD', background:'#EDE9FE', padding:'2px 7px', borderRadius:'8px' }}>🔄</span>}
                          </div>
                          <i className="ti ti-grip-horizontal" style={{ fontSize:'14px', color:'#D4D0F0' }} aria-hidden="true"/>
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
                              <div style={{ width:'20px', height:'20px', borderRadius:'50%', background:avatarColor(task.assignee.name), display:'flex', alignItems:'center', justifyContent:'center' }}>
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
              <div>
                <input autoFocus placeholder="Название задачи" value={newTask.title}
                  onChange={e => handleTitleChange(e.target.value)} required style={inp}/>
                {/* AI подсказка отдела */}
                {aiLoading && (
                  <div style={{ display:'flex', alignItems:'center', gap:'6px', marginTop:'6px', fontSize:'11px', color:'#9B97CC' }}>
                    <span style={{ animation:'spin 1s linear infinite', display:'inline-block' }}>⟳</span> ИИ определяет отдел...
                  </div>
                )}
                {aiDept && !aiLoading && (
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginTop:'6px', background:'#F0FDF4', border:'1px solid #86EFAC', borderRadius:'10px', padding:'7px 12px' }}>
                    <span style={{ fontSize:'11px', color:'#16A34A', fontWeight:600 }}>✨ ИИ предлагает:</span>
                    <span style={{ width:'10px', height:'10px', borderRadius:'50%', background: aiDept.color ?? '#7F77DD', flexShrink:0 }} />
                    <span style={{ fontSize:'12px', fontWeight:700, color:'#1a1040', flex:1 }}>{aiDept.name}</span>
                    <button type="button" onClick={() => setNewTask(prev => ({ ...prev, departmentId: aiDept.id }))}
                      style={{ background: newTask.departmentId === aiDept.id ? '#16A34A' : 'white', color: newTask.departmentId === aiDept.id ? 'white' : '#16A34A', border:'1px solid #86EFAC', borderRadius:'8px', padding:'3px 10px', fontSize:'11px', cursor:'pointer', fontWeight:600 }}>
                      {newTask.departmentId === aiDept.id ? '✓ Принято' : 'Принять'}
                    </button>
                  </div>
                )}
              </div>
              <textarea placeholder="Описание (необязательно)" value={newTask.description} onChange={e=>setNewTask({...newTask,description:e.target.value})} rows={3} style={{ ...inp, resize:'none' }}/>
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
                  <input type="date" value={newTask.dueDate} onChange={e=>setNewTask({...newTask,dueDate:e.target.value})} min={new Date().toISOString().slice(0,10)} style={inp}/>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <div>
                  <label style={{ fontSize:'10px', color:'#9B97CC', display:'block', marginBottom:'5px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px' }}>Исполнитель</label>
                  <select value={newTask.assigneeId} onChange={e=>setNewTask({...newTask,assigneeId:e.target.value})} style={inp}>
                    <option value="">Не назначен</option>
                    {employees.map(emp=><option key={emp.id} value={emp.id}>{emp.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:'10px', color:'#9B97CC', display:'block', marginBottom:'5px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px' }}>
                    Отдел {aiDept && newTask.departmentId !== aiDept.id && <span style={{ color:'#D97706' }}>✨</span>}
                  </label>
                  <select value={newTask.departmentId} onChange={e=>setNewTask({...newTask,departmentId:e.target.value})} style={inp}>
                    <option value="">Не выбран</option>
                    {departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
              </div>
              {/* Product picker */}
              <div style={{ position:'relative' }}>
                <label style={{ fontSize:'10px', color:'#9B97CC', display:'block', marginBottom:'5px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px' }}>
                  📦 Карточка товара
                </label>
                {selectedProduct ? (
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', background:'#F0EDFF', border:'1px solid #EDE9FE', borderRadius:'12px', padding:'8px 12px' }}>
                    {selectedProduct.photoUrl && <img src={selectedProduct.photoUrl} alt="" style={{ width:'28px', height:'28px', borderRadius:'6px', objectFit:'cover', flexShrink:0 }} />}
                    <div style={{ flex:1, minWidth:0 }}>
                      <p style={{ fontSize:'12px', fontWeight:700, color:'#1a1040', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{selectedProduct.name}</p>
                      <p style={{ fontSize:'11px', color:'#9B97CC', margin:0 }}>{selectedProduct.articleId} · {selectedProduct.marketplace}</p>
                    </div>
                    <button type="button" onClick={clearProduct} style={{ background:'none', border:'none', color:'#DC2626', cursor:'pointer', fontSize:'16px', padding:0, flexShrink:0 }}>✕</button>
                  </div>
                ) : (
                  <button type="button" onClick={()=>setShowProductPicker(true)}
                    style={{ width:'100%', background:'#F8F7FF', border:'1px dashed #EDE9FE', borderRadius:'12px', padding:'10px', fontSize:'13px', color:'#9B97CC', cursor:'pointer', textAlign:'left' }}>
                    🔍 Выбрать карточку товара...
                  </button>
                )}

                {/* Product picker popup */}
                {showProductPicker && (
                  <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.3)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center' }}
                    onClick={e=>{ if(e.target===e.currentTarget){ setShowProductPicker(false); setProductSearch(''); setProductList([]); }}}>
                    <div style={{ background:'white', borderRadius:'20px', padding:'20px', width:'420px', maxHeight:'500px', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
                      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'14px' }}>
                        <p style={{ fontSize:'15px', fontWeight:800, color:'#1a1040', margin:0 }}>Выбор карточки товара</p>
                        <button type="button" onClick={()=>{ setShowProductPicker(false); setProductSearch(''); setProductList([]); }}
                          style={{ background:'none', border:'none', fontSize:'18px', cursor:'pointer', color:'#9B97CC' }}>✕</button>
                      </div>
                      <input
                        placeholder="Поиск по названию или артикулу..."
                        value={productSearch}
                        onChange={e=>searchProducts(e.target.value)}
                        autoFocus
                        style={{ width:'100%', background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'12px', padding:'10px 14px', fontSize:'13px', outline:'none', boxSizing:'border-box', marginBottom:'10px' }}
                      />
                      <div style={{ overflowY:'auto', flex:1 }}>
                        {loadingProducts && <p style={{ textAlign:'center', color:'#9B97CC', padding:'20px 0' }}>Поиск...</p>}
                        {!loadingProducts && productSearch.length > 0 && productList.length === 0 && (
                          <p style={{ textAlign:'center', color:'#9B97CC', padding:'20px 0' }}>Ничего не найдено</p>
                        )}
                        {!loadingProducts && productSearch.length === 0 && (
                          <p style={{ textAlign:'center', color:'#C4C0E8', padding:'20px 0', fontSize:'13px' }}>Начните вводить название или артикул</p>
                        )}
                        {productList.map(p => (
                          <div key={p.id} onClick={()=>selectProduct(p)}
                            style={{ display:'flex', alignItems:'center', gap:'10px', padding:'10px', borderRadius:'12px', cursor:'pointer', marginBottom:'4px' }}
                            onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.background='#F8F7FF'}
                            onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.background='transparent'}>
                            {p.photoUrl ? (
                              <img src={p.photoUrl} alt="" style={{ width:'40px', height:'40px', borderRadius:'8px', objectFit:'cover', flexShrink:0 }} />
                            ) : (
                              <div style={{ width:'40px', height:'40px', borderRadius:'8px', background:'#F8F7FF', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'18px', flexShrink:0 }}>📦</div>
                            )}
                            <div style={{ flex:1, minWidth:0 }}>
                              <p style={{ fontSize:'13px', fontWeight:700, color:'#1a1040', margin:'0 0 2px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</p>
                              <p style={{ fontSize:'11px', color:'#9B97CC', margin:0 }}>Арт: {p.articleId} · {p.marketplace}</p>
                            </div>
                            <span style={{ background:p.marketplace==='WB'?'#8B2FC920':'#005BFF20', color:p.marketplace==='WB'?'#8B2FC9':'#005BFF', borderRadius:'6px', padding:'2px 8px', fontSize:'10px', fontWeight:700, flexShrink:0 }}>
                              {p.marketplace}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Tags */}
              <div>
                <label style={{ fontSize:'10px', color:'#9B97CC', display:'block', marginBottom:'5px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px' }}>
                  🏷️ Теги {pendingTags.length > 0 && <span style={{ color:'#7F77DD' }}>({pendingTags.length})</span>}
                </label>
                {pendingTags.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'8px' }}>
                    {pendingTags.map((tag, i) => (
                      <span key={i} style={{ display:'flex', alignItems:'center', gap:'4px', background:'#EDE9FE', color:'#7F77DD', borderRadius:'20px', padding:'3px 10px', fontSize:'12px', fontWeight:600 }}>
                        #{tag}
                        <button type="button" onClick={()=>setPendingTags(prev=>prev.filter((_,j)=>j!==i))}
                          style={{ background:'none', border:'none', color:'#9B97CC', cursor:'pointer', fontSize:'12px', padding:0, lineHeight:1 }}>✕</button>
                      </span>
                    ))}
                  </div>
                )}
                <div style={{ display:'flex', gap:'6px' }}>
                  <input placeholder="Добавить тег..." value={tagInput}
                    onChange={e=>setTagInput(e.target.value.replace(/\s/g,''))}
                    onKeyDown={e=>{ if((e.key==='Enter'||e.key===',')&&tagInput.trim()){ e.preventDefault(); if(!pendingTags.includes(tagInput.trim())) setPendingTags(prev=>[...prev,tagInput.trim()]); setTagInput(''); }}}
                    style={{ flex:1, background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'10px', padding:'7px 12px', fontSize:'12px', outline:'none' }} />
                  <button type="button" onClick={()=>{ if(tagInput.trim()&&!pendingTags.includes(tagInput.trim())){ setPendingTags(prev=>[...prev,tagInput.trim()]); setTagInput(''); }}}
                    style={{ background:'#EDE9FE', color:'#7F77DD', border:'none', borderRadius:'10px', padding:'7px 14px', fontSize:'12px', cursor:'pointer', fontWeight:700 }}>
                    +
                  </button>
                </div>
              </div>

              {/* Subtasks */}
              <div>
                <label style={{ fontSize:'10px', color:'#9B97CC', display:'block', marginBottom:'5px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px' }}>
                  ✅ Подзадачи {pendingSubtasks.length > 0 && <span style={{ color:'#7F77DD' }}>({pendingSubtasks.length})</span>}
                </label>
                {pendingSubtasks.length > 0 && (
                  <div style={{ display:'flex', flexDirection:'column', gap:'4px', marginBottom:'8px' }}>
                    {pendingSubtasks.map((st, i) => (
                      <div key={i} style={{ display:'flex', alignItems:'center', gap:'8px', background:'#F8F7FF', borderRadius:'8px', padding:'6px 10px' }}>
                        <div style={{ width:'14px', height:'14px', borderRadius:'50%', border:'2px solid #EDE9FE', flexShrink:0 }} />
                        <span style={{ fontSize:'12px', color:'#1a1040', flex:1 }}>{st}</span>
                        <button type="button" onClick={()=>setPendingSubtasks(prev=>prev.filter((_,j)=>j!==i))}
                          style={{ background:'none', border:'none', color:'#9B97CC', cursor:'pointer', fontSize:'14px', padding:0 }}>✕</button>
                      </div>
                    ))}
                  </div>
                )}
                <div style={{ display:'flex', gap:'6px' }}>
                  <input placeholder="Добавить подзадачу..." value={subtaskInput}
                    onChange={e=>setSubtaskInput(e.target.value)}
                    onKeyDown={e=>{ if(e.key==='Enter'&&subtaskInput.trim()){ e.preventDefault(); setPendingSubtasks(prev=>[...prev,subtaskInput.trim()]); setSubtaskInput(''); }}}
                    style={{ flex:1, background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'10px', padding:'7px 12px', fontSize:'12px', outline:'none' }} />
                  <button type="button" onClick={()=>{ if(subtaskInput.trim()){ setPendingSubtasks(prev=>[...prev,subtaskInput.trim()]); setSubtaskInput(''); }}}
                    style={{ background:'#EDE9FE', color:'#7F77DD', border:'none', borderRadius:'10px', padding:'7px 14px', fontSize:'12px', cursor:'pointer', fontWeight:700 }}>
                    +
                  </button>
                </div>
              </div>

              {/* File attachments */}
              <div>
                <label style={{ fontSize:'10px', color:'#9B97CC', display:'block', marginBottom:'5px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px' }}>
                  📎 Вложения {pendingFiles.length > 0 && <span style={{ color:'#7F77DD' }}>({pendingFiles.length})</span>}
                </label>
                {pendingFiles.length > 0 && (
                  <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', marginBottom:'8px' }}>
                    {pendingFiles.map((f, i) => {
                      const isImage = f.type.startsWith('image/');
                      const icon = f.type.includes('pdf') ? '📄' : isImage ? '🖼️' : f.type.includes('word') ? '📝' : f.type.includes('excel') || f.type.includes('sheet') ? '📊' : '📎';
                      return (
                        <div key={i} style={{ display:'flex', alignItems:'center', gap:'6px', background:'#F0EDFF', borderRadius:'8px', padding:'4px 10px', fontSize:'12px' }}>
                          <span>{icon}</span>
                          <span style={{ color:'#7F77DD', fontWeight:600, maxWidth:'120px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{f.name}</span>
                          <span style={{ color:'#9B97CC' }}>{Math.round(f.size/1024)}KB</span>
                          <button type="button" onClick={()=>setPendingFiles(prev=>prev.filter((_,j)=>j!==i))}
                            style={{ background:'none', border:'none', color:'#DC2626', cursor:'pointer', fontSize:'14px', padding:0, lineHeight:1 }}>✕</button>
                        </div>
                      );
                    })}
                  </div>
                )}
                <label style={{ display:'flex', alignItems:'center', gap:'8px', background:'#F8F7FF', border:'1px dashed #EDE9FE', borderRadius:'10px', padding:'8px 14px', cursor:'pointer', fontSize:'12px', color:'#9B97CC', fontWeight:600 }}>
                  + Добавить файлы (фото, PDF, документы)
                  <input type="file" multiple style={{ display:'none' }}
                    onChange={e=>{ if(e.target.files) setPendingFiles(prev=>[...prev, ...Array.from(e.target.files!)]); e.target.value=''; }} />
                </label>
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
