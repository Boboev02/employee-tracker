'use client';
import { useIsMobile } from '@/hooks/useIsMobile';
import { useEffect, useState, useRef, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/usePermissions';
import { CustomFieldsPanel } from '@/components/custom-fields/CustomFieldsPanel';
import { useCustomFields } from '@/hooks/useCustomFields';
import { FieldRenderer } from '@/components/custom-fields/FieldRenderer';
import { FilterBuilder } from '@/components/tasks/FilterBuilder';
import { evaluateFilterGroup, filterGroupIsEmpty, EMPTY_FILTER_GROUP, FilterGroupState } from '@/lib/taskFilterEngine';
import { DeleteSectionButton } from '@/components/admin/DeleteSectionButton';

const STATUS_COLS = [
  { id:'NEW',         label:'Новые',          dot:'var(--accent)',  colBg:'var(--bg-app)', accentC:'var(--accent)',  accentBg:'var(--accent-light)', next:'IN_PROGRESS', nextLabel:'В работу' },
  { id:'IN_PROGRESS', label:'В работе',       dot:'var(--blue)',    colBg:'var(--bg-app)', accentC:'var(--blue)',    accentBg:'var(--blue-bg)',      next:'REVIEW',      nextLabel:'На проверку' },
  { id:'REVIEW',      label:'Проверка',       dot:'var(--orange)',  colBg:'var(--bg-app)', accentC:'var(--orange)',  accentBg:'var(--orange-bg)',    next:'DONE',        nextLabel:'Готово' },
  { id:'BLOCKED',     label:'Заблокировано',  dot:'var(--red)',     colBg:'var(--bg-app)', accentC:'var(--red)',     accentBg:'var(--red-bg)',       next:'IN_PROGRESS', nextLabel:'Вернуть в работу' },
  { id:'OVERDUE',     label:'Просрочено',     dot:'var(--red)',     colBg:'var(--bg-app)', accentC:'var(--red)',     accentBg:'var(--red-bg)',       next:'IN_PROGRESS', nextLabel:'Вернуть в работу' },
  { id:'DONE',        label:'Готово',         dot:'var(--green)',   colBg:'var(--bg-app)', accentC:'var(--green)',   accentBg:'var(--green-bg)',     next:null,          nextLabel:'' },
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
  const [newTask, setNewTask]     = useState<any>({ title:'', priority:'MEDIUM', description:'', assigneeIds:[] as string[], dueDate:'', departmentId:'', productId:'', projectId:'' });
  const [formError, setFormError] = useState('');
  const [showProductPicker, setShowProductPicker] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [products, setProducts] = useState<any[]>([]);
  const [productsLoading, setProductsLoading] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<any>(null);
  const [projects, setProjects] = useState<any[]>([]);

  const loadProducts = async (search = '') => {
    if (!token) return;
    setProductsLoading(true);
    try {
      const url = search.length >= 1
        ? `https://employee-tracker.ru/api/v1/products?search=${encodeURIComponent(search)}&limit=50`
        : `https://employee-tracker.ru/api/v1/products?limit=50`;
      const r = await fetch(url, { headers:{ Authorization:'Bearer '+token } });
      const d = await r.json();
      setProducts(Array.isArray(d) ? d : d.products ?? d.data ?? []);
    } catch {}
    setProductsLoading(false);
  };
  const [departments, setDepartments] = useState<any[]>([]);
  const [aiDept, setAiDept]     = useState<{ id: string; name: string; color: string } | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [token, setToken]         = useState('');
  const [currentUserId, setCurrentUserId] = useState('');
  const [mounted, setMounted]     = useState(false);
  const [dragTask, setDragTask]   = useState<{id:string;fromCol:string}|null>(null);
  const [dragOverCol, setDragOverCol] = useState<string|null>(null);
  const [view, setView] = useState<'board'|'list'|'calendar'|'gantt'>('board');
  const [listTasks, setListTasks] = useState<any[]>([]);
  const [sortField, setSortField] = useState<'createdAt'|'dueDate'|'priority'|'title'>('createdAt');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');
  const [calDate, setCalDate] = useState(new Date());

  // Filters
  const [filterAssignee, setFilterAssignee] = useState<string[]>([]);
  const [filterPriority, setFilterPriority] = useState('');
  const [filterSearch,   setFilterSearch]   = useState('');
  const [filterOverdue,  setFilterOverdue]  = useState(false);
  const [hideCompleted, setHideCompleted] = useState(false);
  const [filterRoutine,  setFilterRoutine]  = useState(false);
  const [advFilter, setAdvFilter] = useState<FilterGroupState>(EMPTY_FILTER_GROUP);
  const [showAdvFilter, setShowAdvFilter] = useState(false);
  const [meMode, setMeMode] = useState(false);
  const [showFilters,    setShowFilters]    = useState(false);

  useEffect(()=>setMounted(true),[]);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t); loadKanban(t);
    const u = JSON.parse(localStorage.getItem('user') ?? '{}');
    setCurrentUserId(u.id ?? u.sub ?? '');
    fetch('https://employee-tracker.ru/api/v1/employees', { headers:{ Authorization:'Bearer '+t } })
      .then(r=>r.json()).then(d=>setEmployees(Array.isArray(d)?d:[])).catch(()=>{});
    fetch('https://employee-tracker.ru/api/v1/dictionaries/departments', { headers:{ Authorization:'Bearer '+t } })
      .then(r=>r.json()).then(d=>setDepartments(Array.isArray(d)?d:[])).catch(()=>{});
    fetch('https://employee-tracker.ru/api/v1/projects?limit=50', { headers:{ Authorization:'Bearer '+t } })
      .then(r=>r.json()).then(d=>setProjects(Array.isArray(d)?d:(d.data??[]))).catch(()=>{});
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
          setNewTask((prev: any) => ({ ...prev, departmentId: found.id }));
        } else setAiDept(null);
      } else setAiDept(null);
    } catch { setAiDept(null); }
    setAiLoading(false);
  };

  const handleTitleChange = (title: string) => {
    setNewTask((prev: any) => ({ ...prev, title }));
    setAiDept(null);
    clearTimeout(aiTimerRef.current);
    aiTimerRef.current = setTimeout(() => classifyDepartment(title), 800);
  };

  const [customFieldValues, setCustomFieldValues] = useState<Record<string, any>>({});

  const createTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.projectId)    { setFormError('Поле "Проект" обязательно'); return; }
    if (!newTask.departmentId) { setFormError('Поле "Отдел" обязательно'); return; }
    if (!newTask.assigneeIds || newTask.assigneeIds.length === 0) { setFormError('Поле "Исполнители" обязательно — выберите хотя бы одного'); return; }
    setFormError('');

    const [primaryAssignee, ...coAssignees] = newTask.assigneeIds;

    const res = await fetch('https://employee-tracker.ru/api/v1/tasks', {
      method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+token },
      body: JSON.stringify({
        ...newTask,
        assigneeId: primaryAssignee,
        coAssigneeIds: coAssignees,
        dueDate: newTask.dueDate || undefined,
        departmentId: newTask.departmentId || undefined,
        productId: newTask.productId || undefined,
        projectId: newTask.projectId || undefined,
        customFields: Object.keys(customFieldValues).length > 0 ? customFieldValues : undefined,
      }),
    });
    if (!res.ok) {
      const err = await res.json().catch(()=>({}));
      setFormError(err.message ?? 'Ошибка создания задачи');
      return;
    }
    setNewTask({ title:'', priority:'MEDIUM', description:'', assigneeIds:[], dueDate:'', departmentId:'', productId:'', projectId:'' });
    setCustomFieldValues({});
    setSelectedProduct(null);
    setProductSearch('');
    setAiDept(null);
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
      if (filterAssignee.length > 0 && !filterAssignee.includes(task.assigneeId)) return false;
      if (filterPriority && task.priority !== filterPriority) return false;
      if (filterSearch && !task.title?.toLowerCase().includes(filterSearch.toLowerCase())) return false;
      if (filterOverdue && !(task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE')) return false;
      if (hideCompleted && task.status === 'DONE') return false;
      if (filterRoutine && !task.isRoutine) return false;
      if (meMode && task.assigneeId !== currentUserId) return false;
      if (!filterGroupIsEmpty(advFilter) && !evaluateFilterGroup(task, advFilter)) return false;
      return true;
    });
  };

  const hasActiveFilters = filterAssignee.length > 0 || filterPriority || filterSearch || filterOverdue || filterRoutine || hideCompleted || meMode || !filterGroupIsEmpty(advFilter);

  const clearFilters = () => {
    setFilterAssignee([]); setFilterPriority('');
    setFilterSearch(''); setFilterOverdue(false); setFilterRoutine(false);
    setHideCompleted(false);
    setMeMode(false); setAdvFilter(EMPTY_FILTER_GROUP);
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
          {/* Advanced filter builder */}
          <div style={{ position:'relative' }}>
            <button onClick={()=>setShowAdvFilter(v=>!v)}
              style={{ background: !filterGroupIsEmpty(advFilter) ? '#EDE9FE' : '#F8F7FF', color: !filterGroupIsEmpty(advFilter) ? '#7F77DD' : '#6B7280', border:'1px solid #EDE9FE', borderRadius:'20px', padding:'7px 14px', fontSize:'12px', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}>
              ⚙️ Расширенный{!filterGroupIsEmpty(advFilter) && ` (${advFilter.rules.length})`}
            </button>
            {showAdvFilter && (
              <FilterBuilder value={advFilter} onChange={setAdvFilter} employees={employees} onClose={()=>setShowAdvFilter(false)} />
            )}
          </div>
          {/* Me mode */}
          <button onClick={()=>setMeMode(v=>!v)}
            style={{ background:meMode?'#EDE9FE':'#F8F7FF', color:meMode?'#7F77DD':'#6B7280', border:'1px solid #EDE9FE', borderRadius:'20px', padding:'7px 14px', fontSize:'12px', fontWeight:700, cursor:'pointer' }}>
            👤 Я
          </button>
          {/* Clear filters */}
          {hasActiveFilters && (
            <button onClick={clearFilters}
              style={{ background:'#FEE2E2', color:'#DC2626', border:'none', borderRadius:'20px', padding:'7px 12px', fontSize:'11px', fontWeight:700, cursor:'pointer' }}>
              ✕ Сбросить
            </button>
          )}
          {mounted && perms.isAdmin && (
            <DeleteSectionButton section="tasks" label="все задачи" token={token} userRoles={perms.roles ?? []} onDeleted={()=>window.location.reload()} />
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
          {/* Assignee — multi-select dropdown */}
          <AssigneeMultiSelect employees={employees} selected={filterAssignee} onChange={setFilterAssignee} />
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
            <button onClick={()=>setHideCompleted(!hideCompleted)}
              style={{ padding:'5px 14px', borderRadius:'20px', fontSize:'11px', fontWeight:700, border:'none', cursor:'pointer', background:hideCompleted?'#EDE9FE':'#F8F7FF', color:hideCompleted?'#7F77DD':'#9B97CC', transition:'all 0.15s' }}>
              🙈 Скрыть готовые
            </button>
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
        <ListViewWithCustomFields
          token={token}
          listTasks={listTasks}
          loading={loading}
          filterSearch={filterSearch}
          filterAssignee={filterAssignee}
          filterPriority={filterPriority}
          onRowClick={(id: string) => router.push('/dashboard/tasks/'+id)}
        />
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
                  <span style={{ marginLeft:'auto', fontSize:'11px', fontWeight:600, color:'var(--text-muted)', background:'var(--bg-secondary)', padding:'2px 8px', borderRadius:'20px', border:'1px solid var(--border)' }}>
                    {hasActiveFilters ? `${tasks.length}/${allTasks.length}` : tasks.length}
                  </span>
                </div>
                {/* Tasks area */}
                <div style={{ flex:1, padding:'8px', background:'var(--bg-app)', borderRadius:'0 0 var(--radius-xl) var(--radius-xl)', border:isDragOver?'2px dashed var(--border-focus)':'2px solid transparent', overflowY:'auto', transition:'all 0.15s', display:'flex', flexDirection:'column', gap:'6px' }}>
                  {tasks.length===0 && !isDragOver && (
                    <div style={{ padding:'24px', textAlign:'center', color:'#C4C0E8', fontSize:'12px' }}>
                      {hasActiveFilters && allTasks.length>0 ? 'Не совпадает с фильтром' : 'Нет задач'}
                    </div>
                  )}
                  {isDragOver && tasks.length===0 && (
                    <div style={{ padding:'20px', textAlign:'center', color:'var(--text-muted)', fontSize:'12px', fontWeight:500, background:'var(--bg-secondary)', borderRadius:'var(--radius-md)', border:'1.5px dashed var(--border-strong)' }}>
                      Переместить сюда
                    </div>
                  )}
                  {tasks.map((task:any, taskIdx:number) => {
                    const ps = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.MEDIUM;
                    const isDragging = dragTask?.id===task.id;
                    const overdue = task.dueDate && new Date(task.dueDate)<new Date() && task.status!=='DONE';
                    return (
                      <div key={task.id}
                        className="row-in"
                        draggable={true}
                        onDragStart={e=>handleDragStart(e,task.id,col.id)}
                        onDragEnd={handleDragEnd}
                        onClick={()=>!dragTask&&router.push('/dashboard/tasks/'+task.id)}
                        style={{ background: task.status==='OVERDUE'?'#FFF5F5':'white', borderRadius:'14px', padding:'12px 14px', cursor:'grab', border:overdue?'1.5px solid #FED7D7':'1px solid #F3F0FF', boxShadow:isDragging?'0 8px 24px rgba(127,119,221,0.2)':'0 2px 8px rgba(127,119,221,0.06)', opacity:isDragging?0.5:1, transform:isDragging?'scale(1.02)':'none', transition:'box-shadow 0.15s, transform 0.15s', userSelect:'none', animationDelay:Math.min(taskIdx*0.04,0.3)+'s' }}
                        onMouseEnter={e=>{if(!dragTask){(e.currentTarget as HTMLElement).style.boxShadow='0 6px 18px rgba(127,119,221,0.18)';(e.currentTarget as HTMLElement).style.transform='translateY(-2px)';}}}
                        onMouseLeave={e=>{if(!isDragging){(e.currentTarget as HTMLElement).style.boxShadow='0 2px 8px rgba(127,119,221,0.06)';(e.currentTarget as HTMLElement).style.transform='none';}}}>
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
                              <div style={{ display:'flex', marginLeft: (task.participants?.length>0) ? '10px' : 0 }}>
                                <div title={task.assignee.name} style={{ width:'20px', height:'20px', borderRadius:'50%', background: task.assignee.avatarUrl ? 'transparent' : avatarColor(task.assignee.name), display:'flex', alignItems:'center', justifyContent:'center', border:'1.5px solid white', zIndex:2, overflow:'hidden' }}>
                                  {task.assignee.avatarUrl
                                    ? <img src={task.assignee.avatarUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                    : <span style={{ color:'white', fontSize:'8px', fontWeight:700 }}>{task.assignee.name?.charAt(0)}</span>}
                                </div>
                                {(task.participants??[]).slice(0,2).map((p:any, pi:number) => (
                                  <div key={p.id} title={p.user?.name} style={{ width:'20px', height:'20px', borderRadius:'50%', background: p.user?.avatarUrl ? 'transparent' : avatarColor(p.user?.name??''), display:'flex', alignItems:'center', justifyContent:'center', border:'1.5px solid white', marginLeft:'-8px', zIndex:1-pi, overflow:'hidden' }}>
                                    {p.user?.avatarUrl
                                      ? <img src={p.user.avatarUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                                      : <span style={{ color:'white', fontSize:'8px', fontWeight:700 }}>{p.user?.name?.charAt(0)}</span>}
                                  </div>
                                ))}
                                {(task.participants??[]).length>2 && (
                                  <div style={{ width:'20px', height:'20px', borderRadius:'50%', background:'#E5E7EB', display:'flex', alignItems:'center', justifyContent:'center', border:'1.5px solid white', marginLeft:'-8px' }}>
                                    <span style={{ color:'#6B7280', fontSize:'7px', fontWeight:700 }}>+{(task.participants??[]).length-2}</span>
                                  </div>
                                )}
                              </div>
                              {!(task.participants?.length>0) && <span style={{ fontSize:'10px', color:'#9B97CC' }}>{task.assignee.name?.split(' ')[0]}</span>}
                            </div>
                          )}
                        </div>
                        {mounted && perms.canUpdateAnyTask && col.next && (
                          <div style={{ marginTop:'8px', paddingTop:'8px', borderTop:'1px solid #F3F0FF' }} onClick={e=>e.stopPropagation()}>
                            <button onClick={()=>moveTask(task.id,col.next!)}
                              style={{ fontSize:'11px', fontWeight:500, color:'var(--text-secondary)', background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', padding:'5px 10px', cursor:'pointer', width:'100%', transition:'all var(--transition)' }}>
                              {col.nextLabel} →
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                  {isDragOver && tasks.length>0 && (
                    <div style={{ height:'2px', background:'var(--border)', borderRadius:'2px' }} />
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create Modal */}
      {showForm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(26,16,64,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:50, backdropFilter:'blur(4px)', padding:'16px', overflowY:'auto' }}>
          <div style={{ background:'white', borderRadius:'24px', padding:'28px 32px', width:'460px', maxWidth:'100%', boxShadow:'0 24px 64px rgba(127,119,221,0.2)', maxHeight:'90vh', overflowY:'auto', margin:'auto' }}>
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
                    <button type="button" onClick={() => setNewTask((prev: any) => ({ ...prev, departmentId: aiDept.id }))}
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
                  <label style={{ fontSize:'10px', color:'#9B97CC', display:'block', marginBottom:'5px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px' }}>
                    Отдел * {aiDept && newTask.departmentId !== aiDept.id && <span style={{ color:'#D97706' }}>✨</span>}
                  </label>
                  <select value={newTask.departmentId} onChange={e=>setNewTask({...newTask,departmentId:e.target.value,projectId:''})} style={inp} required>
                    <option value="">— выбрать отдел —</option>
                    {departments.map(d=><option key={d.id} value={d.id}>{d.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:'10px', color:'#9B97CC', display:'block', marginBottom:'5px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px' }}>Исполнители *</label>
                  <div style={{ position:'relative' }}>
                    <select value="" onChange={e=>{ const id=e.target.value; if(!id) return; setNewTask((t: any) =>({...t, assigneeIds: Array.from(new Set([...(t.assigneeIds??[]), id]))})); }} style={inp}>
                      <option value="">+ Добавить исполнителя</option>
                      {employees.filter((emp:any)=>!(newTask.assigneeIds??[]).includes(emp.id)).map((emp:any)=><option key={emp.id} value={emp.id}>{emp.name}</option>)}
                    </select>
                  </div>
                  {(newTask.assigneeIds??[]).length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
                      {(newTask.assigneeIds??[]).map((id:string, idx:number) => {
                        const emp = employees.find((e:any)=>e.id===id);
                        return (
                          <span key={id} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, fontWeight:600, background: idx===0?'#EDE9FE':'#F8F7FF', color: idx===0?'#7F77DD':'#6B7280', padding:'4px 10px', borderRadius:20, border: idx===0?'1px solid #C7BFFF':'1px solid #EDE9FE' }}>
                            {idx===0 && '★ '}{emp?.name}
                            <button type="button" onClick={()=>setNewTask((t: any) =>({...t, assigneeIds:(t.assigneeIds??[]).filter((x:string)=>x!==id)}))}
                              style={{ background:'none', border:'none', cursor:'pointer', color:'inherit', fontSize:12, padding:0, lineHeight:1 }}>✕</button>
                          </span>
                        );
                      })}
                    </div>
                  )}
                  {(newTask.assigneeIds??[]).length > 1 && (
                    <p style={{ fontSize:10, color:'#9B97CC', margin:'6px 0 0' }}>★ — основной исполнитель, остальные — соисполнители</p>
                  )}
                </div>
              </div>

              {/* Project picker — cascades from selected department */}
              <div style={{ marginBottom:'10px' }}>
                <label style={{ fontSize:'10px', color:'#9B97CC', display:'block', marginBottom:'5px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px' }}>
                  Проект *
                </label>
                <select value={newTask.projectId} onChange={e=>setNewTask({...newTask,projectId:e.target.value})} style={inp} required disabled={!newTask.departmentId}>
                  <option value="">{newTask.departmentId ? '— выбрать проект —' : 'Сначала выберите отдел'}</option>
                  {projects.filter((p:any)=>p.departmentId===newTask.departmentId || p.department?.id===newTask.departmentId).map((p:any)=><option key={p.id} value={p.id}>📁 {p.name}</option>)}
                </select>
                {newTask.departmentId && projects.filter((p:any)=>p.departmentId===newTask.departmentId || p.department?.id===newTask.departmentId).length === 0 && (
                  <p style={{ fontSize:11, color:'#D97706', margin:'4px 0 0' }}>В этом отделе нет проектов. Сначала создайте проект.</p>
                )}
              </div>

              {formError && <div style={{ background:'#FEF2F2', color:'#DC2626', padding:'8px 12px', borderRadius:8, fontSize:12, marginBottom:8 }}>{formError}</div>}

              {/* Product picker */}
              <div style={{ marginBottom:'10px' }}>
                <label style={{ fontSize:'10px', color:'#9B97CC', display:'block', marginBottom:'5px', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.4px' }}>
                  Карточка товара
                </label>
                {selectedProduct ? (
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', background:'#F0EDFF', border:'1px solid #EDE9FE', borderRadius:'10px', padding:'8px 12px' }}>
                    {selectedProduct.photoUrl && <img src={selectedProduct.photoUrl} style={{ width:32, height:32, borderRadius:6, objectFit:'cover' }} />}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'12px', fontWeight:700, color:'#1a1040', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{selectedProduct.name}</div>
                      <div style={{ fontSize:'11px', color:'#9B97CC' }}>{selectedProduct.marketplace} · {selectedProduct.articleId}</div>
                    </div>
                    <button type="button" onClick={()=>{ setSelectedProduct(null); setNewTask((t: any) =>({...t,productId:''})); }}
                      style={{ background:'none', border:'none', cursor:'pointer', color:'#9B97CC', fontSize:16 }}>✕</button>
                  </div>
                ) : (
                  <button type="button"
                    onClick={()=>{ setShowProductPicker(true); loadProducts(); }}
                    style={{ width:'100%', background:'#F8F7FF', border:'1px dashed #C4C0E8', borderRadius:'10px', padding:'9px 14px', fontSize:'13px', color:'#9B97CC', cursor:'pointer', textAlign:'left' }}>
                    + Привязать карточку товара
                  </button>
                )}
              </div>

              {/* Product Picker Modal */}
              {showProductPicker && (
                <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
                  <div style={{ background:'white', borderRadius:20, width:'100%', maxWidth:520, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
                    <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid #EDE9FE' }}>
                      <h3 style={{ margin:0, fontSize:15, fontWeight:800, color:'#1a1040' }}>Выбор карточки товара</h3>
                      <button type="button" onClick={()=>setShowProductPicker(false)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9B97CC', fontSize:20 }}>✕</button>
                    </div>
                    <div style={{ padding:'12px 20px', borderBottom:'1px solid #EDE9FE' }}>
                      <input
                        autoFocus
                        placeholder="Поиск по названию или артикулу..."
                        value={productSearch}
                        onChange={e=>{ setProductSearch(e.target.value); loadProducts(e.target.value); }}
                        style={{ width:'100%', background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:10, padding:'9px 14px', fontSize:13, outline:'none', boxSizing:'border-box' as const }}
                      />
                    </div>
                    <div style={{ overflowY:'auto', flex:1 }}>
                      {productsLoading && (
                        <div style={{ textAlign:'center', padding:24, color:'#9B97CC', fontSize:13 }}>Загрузка...</div>
                      )}
                      {!productsLoading && products.length === 0 && (
                        <div style={{ textAlign:'center', padding:24, color:'#9B97CC', fontSize:13 }}>
                          {productSearch ? 'Ничего не найдено' : 'Нет карточек товаров. Синхронизируйте WB или Ozon'}
                        </div>
                      )}
                      {products.map((p:any) => (
                        <div key={p.id}
                          onClick={()=>{ setSelectedProduct(p); setNewTask((t: any) =>({...t,productId:p.id})); setShowProductPicker(false); setProductSearch(''); }}
                          style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 20px', cursor:'pointer', borderBottom:'1px solid #F8F7FF', transition:'background 0.1s' }}
                          onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.background='#F8F7FF'}
                          onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.background='white'}>
                          {p.photoUrl
                            ? <img src={p.photoUrl} style={{ width:40, height:40, borderRadius:8, objectFit:'cover', flexShrink:0 }} />
                            : <div style={{ width:40, height:40, borderRadius:8, background:'#EDE9FE', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, flexShrink:0 }}>📦</div>
                          }
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:600, color:'#1a1040', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.name}</div>
                            <div style={{ fontSize:11, color:'#9B97CC', marginTop:2 }}>
                              <span style={{ background: p.marketplace==='WB'?'#EDE9FE':'#DBEAFE', color: p.marketplace==='WB'?'#7F77DD':'#2563EB', padding:'1px 6px', borderRadius:4, fontWeight:700, marginRight:6 }}>{p.marketplace}</span>
                              Арт: {p.articleId}
                              {p.price && <span style={{ marginLeft:8 }}>₽{Number(p.price).toLocaleString('ru')}</span>}
                              {p.rating && <span style={{ marginLeft:8 }}>★{p.rating}</span>}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
              {/* Custom fields in create form */}
              {token && (
                <div style={{ marginBottom:'10px' }}>
                  <CustomFieldsPanel
                    taskId=""
                    token={token}
                    employees={employees}
                    initialValues={customFieldValues}
                    onChange={setCustomFieldValues}
                  />
                </div>
              )}

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

// ── List view with dynamic custom-field columns ──────────────────────────────
const STATUS_COL_MAP: Record<string,{bg:string;c:string;label:string}> = {
  NEW:         { bg:'#EDE9FE', c:'#7F77DD', label:'Новые' },
  IN_PROGRESS: { bg:'#DBEAFE', c:'#2563EB', label:'В работе' },
  REVIEW:      { bg:'#FEF3C7', c:'#D97706', label:'Проверка' },
  BLOCKED:     { bg:'#FEE2E2', c:'#DC2626', label:'Заблокировано' },
  OVERDUE:     { bg:'#FEE2E2', c:'#DC2626', label:'Просрочено' },
  DONE:        { bg:'#DCFCE7', c:'#16A34A', label:'Готово' },
};

function AssigneeMultiSelect({ employees, selected, onChange }: { employees: any[]; selected: string[]; onChange: (ids: string[]) => void }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter(x=>x!==id) : [...selected, id]);
  const label = selected.length===0 ? 'Все сотрудники' : selected.length===1 ? (employees.find(e=>e.id===selected[0])?.name ?? '1 выбран') : `${selected.length} сотрудников`;

  return (
    <div ref={ref} style={{ position:'relative' }}>
      <button onClick={()=>setOpen(v=>!v)}
        style={{ background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'20px', padding:'6px 14px', fontSize:'12px', outline:'none', display:'flex', alignItems:'center', gap:'6px', cursor:'pointer', color: selected.length>0 ? '#7F77DD' : '#1a1040', fontWeight: selected.length>0 ? 700 : 400, ...(selected.length>0 ? { background:'#EDE9FE' } : {}) }}>
        <i className="ti ti-user" style={{ fontSize:'14px' }} aria-hidden="true"/>
        {label}
        <i className={`ti ti-chevron-${open?'up':'down'}`} style={{ fontSize:'11px', marginLeft:'2px' }} aria-hidden="true"/>
      </button>
      {open && (
        <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:100, background:'white', border:'1px solid #EDE9FE', borderRadius:'14px', boxShadow:'0 8px 24px rgba(127,119,221,0.18)', width:'220px' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderBottom:'1px solid #F3F0FF' }}>
            <span style={{ fontSize:'12px', fontWeight:700, color:'#1a1040' }}>Сотрудники</span>
            {selected.length>0 && <button onClick={()=>onChange([])} style={{ fontSize:'11px', color:'#7F77DD', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>Сбросить</button>}
          </div>
          <div style={{ maxHeight:'260px', overflowY:'auto', padding:'8px' }}>
            {employees.map(e => (
              <label key={e.id} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 8px', borderRadius:'8px', cursor:'pointer', fontSize:'13px', color:'#1a1040' }}
                onMouseEnter={ev=>(ev.currentTarget as HTMLElement).style.background='#F8F7FF'}
                onMouseLeave={ev=>(ev.currentTarget as HTMLElement).style.background='transparent'}>
                <input type="checkbox" checked={selected.includes(e.id)} onChange={()=>toggle(e.id)} style={{ width:'15px', height:'15px', accentColor:'#7F77DD', cursor:'pointer' }} />
                {e.name}
              </label>
            ))}
          </div>
          <div style={{ padding:'8px 14px', borderTop:'1px solid #F3F0FF', display:'flex', justifyContent:'flex-end' }}>
            <button onClick={()=>setOpen(false)} style={{ fontSize:'12px', fontWeight:700, color:'white', background:'linear-gradient(135deg,#7F77DD,#5248C5)', border:'none', borderRadius:'8px', padding:'6px 16px', cursor:'pointer' }}>Готово</button>
          </div>
        </div>
      )}
    </div>
  );
}

function ListViewWithCustomFields({
  token, listTasks, loading, filterSearch, filterAssignee, filterPriority, onRowClick,
}: {
  token: string; listTasks: any[]; loading: boolean;
  filterSearch: string; filterAssignee: string[]; filterPriority: string;
  onRowClick: (id: string) => void;
}) {
  const cf = useCustomFields(token);
  const [hiddenCols, setHiddenCols] = useState<Set<string>>(new Set());
  const [sortField, setSortField] = useState('createdAt');
  const [sortDir, setSortDir]   = useState<'asc'|'desc'>('desc');

  // Only show fields with showInTable = true
  const cfCols = cf.fields.filter(f => f.showInTable && !hiddenCols.has(f.id));

  const toggleSort = (field: string) => {
    if (sortField === field) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortField(field); setSortDir('asc'); }
  };

  const PORD: Record<string,number> = {LOW:0,MEDIUM:1,HIGH:2,CRITICAL:3};
  const PS: Record<string,{bg:string;c:string;l:string}> = {
    LOW:{ bg:'#F3F4F6',c:'#6B7280',l:'Низкий'}, MEDIUM:{bg:'#DBEAFE',c:'#2563EB',l:'Средний'},
    HIGH:{bg:'#FEF3C7',c:'#D97706',l:'Высокий'}, CRITICAL:{bg:'#FEE2E2',c:'#DC2626',l:'Критич.'},
  };

  const filtered = listTasks
    .filter(t => {
      if (filterSearch && !t.title.toLowerCase().includes(filterSearch.toLowerCase())) return false;
      if (filterAssignee.length > 0 && !filterAssignee.includes(t.assigneeId)) return false;
      if (filterPriority && t.priority !== filterPriority) return false;
      return true;
    })
    .sort((a, b) => {
      let av: any = a[sortField] ?? '', bv: any = b[sortField] ?? '';
      if (sortField === 'priority') { av = PORD[a.priority] ?? 0; bv = PORD[b.priority] ?? 0; }
      if (av < bv) return sortDir === 'asc' ? -1 : 1;
      if (av > bv) return sortDir === 'asc' ? 1 : -1;
      return 0;
    });

  const AC = ['#7F77DD','#2563EB','#16A34A','#D97706','#DC2626','#0891B2'];
  const ac = (name: string) => AC[(name?.charCodeAt(0)??0) % AC.length];

  const th = (label: string, field?: string) => (
    <th key={label}
      onClick={() => field && toggleSort(field)}
      style={{ padding:'10px 14px', fontSize:'11px', fontWeight:700, color:'#9B97CC',
        textAlign:'left', textTransform:'uppercase', letterSpacing:'0.5px',
        cursor:field?'pointer':'default', userSelect:'none', whiteSpace:'nowrap' }}>
      {label}{field === sortField ? (sortDir === 'asc' ? ' ↑' : ' ↓') : ''}
    </th>
  );

  const [showColMenu, setShowColMenu] = useState(false);
  const colMenuRef = useRef<HTMLDivElement>(null);

  // ── Группировка ──────────────────────────────────────────────────────────────
  const GROUP_OPTIONS = [
    { v:'none',     l:'Без группировки' },
    { v:'assignee', l:'По исполнителю' },
    { v:'status',   l:'По статусу' },
    { v:'priority', l:'По приоритету' },
  ];
  const [groupBy, setGroupBy] = useState('none');
  const [showGroupMenu, setShowGroupMenu] = useState(false);
  const groupMenuRef = useRef<HTMLDivElement>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => { if (groupMenuRef.current && !groupMenuRef.current.contains(e.target as Node)) setShowGroupMenu(false); };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  const groupKeyOf = (task: any): string => {
    if (groupBy === 'assignee') return task.assignee?.name ?? 'Без исполнителя';
    if (groupBy === 'status')   return STATUS_COL_MAP[task.status]?.label ?? task.status;
    if (groupBy === 'priority') return PS[task.priority]?.l ?? task.priority;
    return '';
  };

  const groups: { key: string; tasks: any[] }[] = groupBy === 'none'
    ? [{ key: '', tasks: filtered }]
    : (() => {
        const map = new Map<string, any[]>();
        filtered.forEach(t => {
          const k = groupKeyOf(t);
          if (!map.has(k)) map.set(k, []);
          map.get(k)!.push(t);
        });
        return Array.from(map.entries()).map(([key, tasks]) => ({ key, tasks }));
      })();

  const toggleGroupCollapse = (key: string) => setCollapsedGroups(prev => {
    const next = new Set(prev);
    next.has(key) ? next.delete(key) : next.add(key);
    return next;
  });

  const colCount = 6 + cfCols.length; // задача, статус, исполнитель, приоритет, дедлайн, создана + кастом поля
  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (colMenuRef.current && !colMenuRef.current.contains(e.target as Node)) setShowColMenu(false);
    };
    document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, []);

  if (loading) return <div style={{ textAlign:'center', padding:'40px', color:'#9B97CC' }}>Загрузка...</div>;

  const toggleableFields = cf.fields.filter(f => f.showInTable);

  return (
    <div style={{ padding:'16px 28px', flex:1 }}>
      {/* Column visibility toggle — collapsed into a dropdown button */}
      {toggleableFields.length > 0 && (
        <div ref={colMenuRef} style={{ position:'relative', marginBottom:'10px', display:'inline-block' }}>
          <button onClick={()=>setShowColMenu(v=>!v)}
            style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', fontWeight:700, padding:'6px 14px', borderRadius:'20px', border:'1px solid #EDE9FE', background: showColMenu || hiddenCols.size>0 ? '#EDE9FE' : 'white', color: showColMenu || hiddenCols.size>0 ? '#7F77DD' : '#6B7280', cursor:'pointer' }}>
            <i className="ti ti-columns-3" style={{ fontSize:'14px' }} aria-hidden="true"/>
            Столбцы
            {hiddenCols.size > 0 && <span style={{ fontSize:'10px', background:'#7F77DD', color:'white', borderRadius:'20px', padding:'1px 6px' }}>{toggleableFields.length - hiddenCols.size}/{toggleableFields.length}</span>}
            <i className={`ti ti-chevron-${showColMenu?'up':'down'}`} style={{ fontSize:'12px' }} aria-hidden="true"/>
          </button>

          {showColMenu && (
            <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:100, background:'white', border:'1px solid #EDE9FE', borderRadius:'14px', boxShadow:'0 8px 24px rgba(127,119,221,0.18)', width:'240px', display:'flex', flexDirection:'column' }}>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'10px 14px', borderBottom:'1px solid #F3F0FF' }}>
                <span style={{ fontSize:'12px', fontWeight:700, color:'#1a1040' }}>Показать поля</span>
                <button onClick={()=>setHiddenCols(new Set())} style={{ fontSize:'11px', color:'#7F77DD', background:'none', border:'none', cursor:'pointer', fontWeight:600 }}>Сбросить</button>
              </div>
              <div style={{ maxHeight:'240px', overflowY:'auto', padding:'8px' }}>
                {toggleableFields.map(f => (
                  <label key={f.id} style={{ display:'flex', alignItems:'center', gap:'8px', padding:'7px 8px', borderRadius:'8px', cursor:'pointer', fontSize:'13px', color:'#1a1040' }}
                    onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#F8F7FF'}
                    onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                    <input type="checkbox" checked={!hiddenCols.has(f.id)} onChange={() => setHiddenCols(prev => {
                      const next = new Set(prev);
                      next.has(f.id) ? next.delete(f.id) : next.add(f.id);
                      return next;
                    })} style={{ width:'15px', height:'15px', accentColor:'#7F77DD', cursor:'pointer' }} />
                    {f.name}
                  </label>
                ))}
              </div>
              <div style={{ padding:'8px 14px', borderTop:'1px solid #F3F0FF', display:'flex', justifyContent:'flex-end' }}>
                <button onClick={()=>setShowColMenu(false)} style={{ fontSize:'12px', fontWeight:700, color:'white', background:'linear-gradient(135deg,#7F77DD,#5248C5)', border:'none', borderRadius:'8px', padding:'6px 16px', cursor:'pointer' }}>Готово</button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Grouping dropdown */}
      <div ref={groupMenuRef} style={{ position:'relative', marginBottom:'10px', marginLeft:'8px', display:'inline-block' }}>
        <button onClick={()=>setShowGroupMenu(v=>!v)}
          style={{ display:'flex', alignItems:'center', gap:'6px', fontSize:'12px', fontWeight:700, padding:'6px 14px', borderRadius:'20px', border:'1px solid #EDE9FE', background: showGroupMenu || groupBy!=='none' ? '#EDE9FE' : 'white', color: showGroupMenu || groupBy!=='none' ? '#7F77DD' : '#6B7280', cursor:'pointer' }}>
          <i className="ti ti-layout-list" style={{ fontSize:'14px' }} aria-hidden="true"/>
          {GROUP_OPTIONS.find(g=>g.v===groupBy)?.l ?? 'Группировка'}
          <i className={`ti ti-chevron-${showGroupMenu?'up':'down'}`} style={{ fontSize:'12px' }} aria-hidden="true"/>
        </button>
        {showGroupMenu && (
          <div style={{ position:'absolute', top:'calc(100% + 6px)', left:0, zIndex:100, background:'white', border:'1px solid #EDE9FE', borderRadius:'14px', boxShadow:'0 8px 24px rgba(127,119,221,0.18)', width:'190px', padding:'6px' }}>
            {GROUP_OPTIONS.map(g => (
              <button key={g.v} onClick={()=>{ setGroupBy(g.v); setShowGroupMenu(false); }}
                style={{ display:'flex', alignItems:'center', gap:'8px', width:'100%', textAlign:'left', padding:'8px 10px', borderRadius:'8px', border:'none', background: groupBy===g.v?'#F0EDFF':'transparent', color: groupBy===g.v?'#7F77DD':'#1a1040', fontSize:'13px', fontWeight: groupBy===g.v?700:400, cursor:'pointer' }}
                onMouseEnter={e=>{ if(groupBy!==g.v) (e.currentTarget as HTMLElement).style.background='#F8F7FF'; }}
                onMouseLeave={e=>{ if(groupBy!==g.v) (e.currentTarget as HTMLElement).style.background='transparent'; }}>
                {groupBy===g.v && '✓ '}{g.l}
              </button>
            ))}
          </div>
        )}
      </div>

      <div style={{ background:'white', borderRadius:'16px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)', overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', minWidth: 600 + cfCols.length * 140 }}>
          <thead>
            <tr style={{ background:'#F8F7FF', borderBottom:'1px solid #EDE9FE' }}>
              {th('Задача', 'title')}
              {th('Статус')}
              {th('Исполнитель')}
              {th('Приоритет', 'priority')}
              {th('Дедлайн', 'dueDate')}
              {cfCols.map(f => th(f.name))}
              {th('Создана', 'createdAt')}
            </tr>
          </thead>
          <tbody>
            {groups.map(group => {
              const isCollapsed = groupBy !== 'none' && collapsedGroups.has(group.key);
              return (
              <Fragment key={group.key || '_all'}>
                {groupBy !== 'none' && (
                  <tr onClick={()=>toggleGroupCollapse(group.key)} style={{ background:'#F0EDFF', cursor:'pointer', borderBottom:'1px solid #EDE9FE' }}>
                    <td colSpan={colCount} style={{ padding:'9px 14px' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <i className={`ti ti-chevron-${isCollapsed?'right':'down'}`} style={{ fontSize:'13px', color:'#7F77DD' }} aria-hidden="true"/>
                        <span style={{ fontSize:'12.5px', fontWeight:800, color:'#1a1040' }}>{group.key}</span>
                        <span style={{ fontSize:'11px', fontWeight:700, color:'#7F77DD', background:'white', borderRadius:'20px', padding:'1px 9px' }}>{group.tasks.length}</span>
                      </div>
                    </td>
                  </tr>
                )}
                {!isCollapsed && group.tasks.map((task, i) => {
              const ps = PS[task.priority] ?? PS.MEDIUM;
              const sc = STATUS_COL_MAP[task.status];
              const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE';
              const cfVals = (task.customFields ?? {}) as Record<string,any>;
              return (
                <tr key={task.id} onClick={() => onRowClick(task.id)}
                  style={{ borderBottom:'1px solid #F8F7FF', cursor:'pointer',
                    background: i%2===0 ? 'white' : '#FAFAFE', transition:'background 0.1s' }}
                  onMouseEnter={e => (e.currentTarget as HTMLElement).style.background='#F0EDFF'}
                  onMouseLeave={e => (e.currentTarget as HTMLElement).style.background=i%2===0?'white':'#FAFAFE'}>
                  <td style={{ padding:'10px 14px', fontSize:'13px', fontWeight:600, color:'#1a1040', maxWidth:280 }}>
                    <div style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.title}</div>
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    <span style={{ background:sc?.bg??'#F8F7FF', color:sc?.c??'#9B97CC', borderRadius:'8px', padding:'3px 10px', fontSize:'11px', fontWeight:700, whiteSpace:'nowrap' }}>
                      {sc?.label ?? task.status}
                    </span>
                  </td>
                  <td style={{ padding:'10px 14px' }}>
                    {task.assignee ? (
                      <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                        <div style={{ width:24, height:24, borderRadius:'50%', background: task.assignee.avatarUrl ? 'transparent' : ac(task.assignee.name), display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, color:'white', fontWeight:700, flexShrink:0, overflow:'hidden' }}>
                          {task.assignee.avatarUrl
                            ? <img src={task.assignee.avatarUrl} alt="" style={{ width:'100%', height:'100%', objectFit:'cover' }} />
                            : task.assignee.name?.charAt(0)?.toUpperCase()}
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
                  {cfCols.map(f => (
                    <td key={f.id} style={{ padding:'8px 14px', maxWidth:180 }}
                      onClick={e => e.stopPropagation()}>
                      <FieldRenderer field={f} value={cfVals[f.id]} onChange={() => {}} readOnly compact />
                    </td>
                  ))}
                  <td style={{ padding:'10px 14px', fontSize:'12px', color:'#9B97CC', whiteSpace:'nowrap' }}>
                    {new Date(task.createdAt).toLocaleDateString('ru')}
                  </td>
                </tr>
              );
            })}
              </Fragment>
              );
            })}
          </tbody>
        </table>
        {filtered.length === 0 && (
          <div style={{ textAlign:'center', padding:'40px', color:'#9B97CC' }}>Задач нет</div>
        )}
      </div>
    </div>
  );
}
