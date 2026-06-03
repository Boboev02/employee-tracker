'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/usePermissions';

const PRIORITY_STYLES: Record<string,{c:string;bg:string;l:string}> = {
  LOW:      { c:'#6B7280', bg:'#F3F4F6', l:'Низкий' },
  MEDIUM:   { c:'#2563EB', bg:'#DBEAFE', l:'Средний' },
  HIGH:     { c:'#D97706', bg:'#FEF3C7', l:'Высокий' },
  CRITICAL: { c:'#DC2626', bg:'#FEE2E2', l:'Критич.' },
};

const SCHEDULE_LABELS: Record<string,string> = {
  DAILY:'Каждый день', WEEKDAYS:'По будням', CUSTOM:'Выбранные дни',
};

const DAYS_RU = ['','Пн','Вт','Ср','Чт','Пт','Сб','Вс'];
const AVATAR_COLORS = ['#7F77DD','#2563EB','#16A34A','#D97706','#DC2626','#0891B2'];
const avatarColor = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0)??0) % AVATAR_COLORS.length];

const EXAMPLES = [
  'Ответить на отзывы WB',
  'Ответить на отзывы Ozon',
  'Проверить рекламные кампании',
  'Проверить остатки товаров',
  'Обработать обращения покупателей',
  'Проверить новые вопросы',
  'Сформировать отчёт по продажам',
];

const emptyForm = { title:'', description:'', assigneeId:'', priority:'MEDIUM', dueTime:'', schedule:'DAILY', daysOfWeek:[] as number[], isActive:true, startDate:'', endDate:'' };

export default function RoutinesPage() {
  const router  = useRouter();
  const perms   = usePermissions();
  const [templates, setTemplates] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [stats, setStats]         = useState<any>(null);
  const [loading, setLoading]     = useState(true);
  const [showForm, setShowForm]   = useState(false);
  const [form, setForm]           = useState({ ...emptyForm });
  const [editId, setEditId]       = useState<string|null>(null);
  const [saving, setSaving]       = useState(false);
  const [spawning, setSpawning]   = useState(false);
  const [spawnResult, setSpawnResult] = useState<any>(null);

  const token = () => localStorage.getItem('access_token') || '';

  useEffect(() => {
    const t = token();
    if (!t) { router.push('/login'); return; }
    loadAll(t);
  }, []);

  const loadAll = async (t: string) => {
    setLoading(true);
    try {
      const [tpl, emps, st] = await Promise.all([
        fetch('https://employee-tracker.ru/api/v1/routine-tasks',        { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
        fetch('https://employee-tracker.ru/api/v1/employees',            { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
        fetch('https://employee-tracker.ru/api/v1/routine-tasks/stats',  { headers:{ Authorization:'Bearer '+t } }).then(r=>r.json()),
      ]);
      if (Array.isArray(tpl)) setTemplates(tpl);
      if (Array.isArray(emps)) setEmployees(emps);
      if (st && !st.error) setStats(st);
    } catch(e) {} finally { setLoading(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    const t = token();
    try {
      const url = editId ? `https://employee-tracker.ru/api/v1/routine-tasks/${editId}` : 'https://employee-tracker.ru/api/v1/routine-tasks';
      const method = editId ? 'PUT' : 'POST';
      await fetch(url, { method, headers:{ Authorization:'Bearer '+t, 'Content-Type':'application/json' }, body:JSON.stringify({ ...form, assigneeId:form.assigneeId||undefined, dueTime:form.dueTime||undefined, startDate:form.startDate||undefined, endDate:form.endDate||undefined }) });
      setShowForm(false); setForm({...emptyForm}); setEditId(null); loadAll(t);
    } catch(e) {} finally { setSaving(false); }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Удалить шаблон?')) return;
    await fetch(`https://employee-tracker.ru/api/v1/routine-tasks/${id}`, { method:'DELETE', headers:{ Authorization:'Bearer '+token() } });
    loadAll(token());
  };

  const handleToggle = async (id: string) => {
    await fetch(`https://employee-tracker.ru/api/v1/routine-tasks/${id}/toggle`, { method:'PATCH', headers:{ Authorization:'Bearer '+token() } });
    loadAll(token());
  };

  const handleSpawn = async () => {
    setSpawning(true); setSpawnResult(null);
    const res = await fetch('https://employee-tracker.ru/api/v1/routine-tasks/spawn', { method:'POST', headers:{ Authorization:'Bearer '+token() } });
    const data = await res.json();
    setSpawnResult(data); setSpawning(false); loadAll(token());
  };

  const openEdit = (tpl: any) => {
    setForm({ title:tpl.title, description:tpl.description||'', assigneeId:tpl.assigneeId||'', priority:tpl.priority, dueTime:tpl.dueTime||'', schedule:tpl.schedule, daysOfWeek:tpl.daysOfWeek||[], isActive:tpl.isActive, startDate:tpl.startDate||'', endDate:tpl.endDate||'' });
    setEditId(tpl.id); setShowForm(true);
  };

  const toggleDay = (d: number) => {
    setForm(prev => ({ ...prev, daysOfWeek: prev.daysOfWeek.includes(d) ? prev.daysOfWeek.filter(x=>x!==d) : [...prev.daysOfWeek,d].sort() }));
  };

  const card: React.CSSProperties  = { background:'white', borderRadius:'20px', padding:'18px 20px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' };
  const inp: React.CSSProperties   = { width:'100%', background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'10px', padding:'9px 14px', fontSize:'13px', color:'#1a1040', outline:'none', boxSizing:'border-box' };
  const modal: React.CSSProperties = { position:'fixed', inset:0, background:'rgba(26,16,64,0.4)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(4px)' };

  return (
    <div style={{ minHeight:'100vh', background:'#ECEAF8' }}>
      {/* Header */}
      <div style={{ background:'white', padding:'16px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', position:'sticky', top:0, zIndex:10, boxShadow:'0 4px 16px rgba(127,119,221,0.06)' }}>
        <div>
          <h1 style={{ fontSize:'18px', fontWeight:800, color:'#1a1040', margin:0 }}>Рутинные задачи</h1>
          <p style={{ fontSize:'11px', color:'#9B97CC', margin:'2px 0 0' }}>Автоматические ежедневные задачи для сотрудников</p>
        </div>
        <div style={{ display:'flex', gap:'8px', alignItems:'center' }}>
          <button onClick={handleSpawn} disabled={spawning}
            style={{ background:'#DCFCE7', color:'#16A34A', border:'none', borderRadius:'20px', padding:'9px 18px', fontSize:'13px', fontWeight:700, cursor:'pointer', display:'flex', alignItems:'center', gap:'6px' }}>
            <i className="ti ti-refresh" style={{ fontSize:'15px' }} aria-hidden="true"/>
            {spawning ? 'Создаю...' : 'Создать на сегодня'}
          </button>
          {perms.isAdmin && (
            <button onClick={()=>{ setForm({...emptyForm}); setEditId(null); setShowForm(true); }}
              style={{ background:'linear-gradient(135deg,#7F77DD,#5248C5)', color:'white', border:'none', borderRadius:'20px', padding:'9px 20px', fontSize:'13px', fontWeight:700, cursor:'pointer', boxShadow:'0 4px 12px rgba(127,119,221,0.3)', display:'flex', alignItems:'center', gap:'6px' }}>
              <i className="ti ti-plus" style={{ fontSize:'15px' }} aria-hidden="true"/>
              Новый шаблон
            </button>
          )}
        </div>
      </div>

      <div style={{ padding:'20px 28px', display:'flex', flexDirection:'column', gap:'16px' }}>
        {/* Spawn result */}
        {spawnResult && (
          <div style={{ background:spawnResult.created>0?'#DCFCE7':'#F8F7FF', border:`1px solid ${spawnResult.created>0?'#86EFAC':'#EDE9FE'}`, borderRadius:'16px', padding:'14px 18px', display:'flex', alignItems:'center', gap:'10px' }}>
            <i className={`ti ${spawnResult.created>0?'ti-circle-check':'ti-info-circle'}`} style={{ fontSize:'18px', color:spawnResult.created>0?'#16A34A':'#9B97CC' }} aria-hidden="true"/>
            <p style={{ fontSize:'13px', fontWeight:600, color:spawnResult.created>0?'#166534':'#6B7280', margin:0 }}>
              {spawnResult.created>0 ? `✓ Создано ${spawnResult.created} задач на ${spawnResult.date}` : `Задачи на сегодня уже созданы`}
            </p>
            <button onClick={()=>setSpawnResult(null)} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'#9B97CC', fontSize:'16px' }}>×</button>
          </div>
        )}

        {/* Stats */}
        {stats && (
          <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'12px' }}>
            {[
              { l:'Шаблонов',  v:stats.templates, icon:'ti-template',     accent:'#7F77DD', accBg:'#EDE9FE' },
              { l:'Создано',   v:stats.total,     icon:'ti-calendar',     accent:'#2563EB', accBg:'#DBEAFE' },
              { l:'Выполнено', v:stats.done,      icon:'ti-circle-check', accent:'#16A34A', accBg:'#DCFCE7' },
              { l:'Просрочено',v:stats.overdue,   icon:'ti-clock',        accent:'#DC2626', accBg:'#FEE2E2' },
              { l:'Выполнение',v:stats.pct+'%',   icon:'ti-chart-pie',    accent:'#D97706', accBg:'#FEF3C7' },
            ].map((k,i)=>(
              <div key={i} style={{ ...card, display:'flex', alignItems:'center', gap:'12px' }}>
                <div style={{ width:'38px', height:'38px', borderRadius:'12px', background:k.accBg, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                  <i className={'ti '+k.icon} style={{ fontSize:'18px', color:k.accent }} aria-hidden="true"/>
                </div>
                <div>
                  <p style={{ fontSize:'20px', fontWeight:800, color:'#1a1040', margin:0, letterSpacing:'-0.5px' }}>{k.v}</p>
                  <p style={{ fontSize:'10px', color:'#9B97CC', margin:0 }}>{k.l}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Templates */}
        <div style={card}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
            <h2 style={{ fontSize:'15px', fontWeight:700, color:'#1a1040', margin:0 }}>Шаблоны задач</h2>
            <span style={{ fontSize:'11px', color:'#9B97CC' }}>{templates.filter(t=>t.isActive).length} активных из {templates.length}</span>
          </div>
          {loading ? (
            <div style={{ padding:'40px', textAlign:'center', color:'#9B97CC' }}>Загрузка...</div>
          ) : templates.length===0 ? (
            <div style={{ padding:'40px', textAlign:'center' }}>
              <div style={{ fontSize:'40px', marginBottom:'12px' }}>🔄</div>
              <p style={{ fontSize:'14px', fontWeight:700, color:'#1a1040', margin:'0 0 6px' }}>Нет шаблонов</p>
              <p style={{ fontSize:'12px', color:'#9B97CC', margin:'0 0 16px' }}>Создайте первый шаблон рутинной задачи</p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'6px', justifyContent:'center', maxWidth:'480px', margin:'0 auto' }}>
                {EXAMPLES.map(ex=>(
                  <button key={ex} onClick={()=>{ setForm({...emptyForm,title:ex}); setShowForm(true); }}
                    style={{ fontSize:'11px', color:'#7F77DD', background:'#EDE9FE', border:'none', borderRadius:'20px', padding:'5px 12px', cursor:'pointer', fontWeight:500 }}>
                    + {ex}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
              {templates.map(tpl=>{
                const ps = PRIORITY_STYLES[tpl.priority] ?? PRIORITY_STYLES.MEDIUM;
                return (
                  <div key={tpl.id} style={{ display:'flex', alignItems:'center', gap:'14px', padding:'12px 16px', background:tpl.isActive?'#F8F7FF':'#F9FAFB', borderRadius:'14px', border:`1px solid ${tpl.isActive?'#EDE9FE':'#E5E7EB'}`, opacity:tpl.isActive?1:0.7, transition:'all 0.15s' }}>
                    {/* Toggle */}
                    <div onClick={()=>perms.isAdmin&&handleToggle(tpl.id)}
                      style={{ width:'40px', height:'22px', borderRadius:'11px', background:tpl.isActive?'#7F77DD':'#E5E7EB', position:'relative', cursor:perms.isAdmin?'pointer':'default', transition:'background 0.2s', flexShrink:0 }}>
                      <div style={{ position:'absolute', top:'3px', left:tpl.isActive?'21px':'3px', width:'16px', height:'16px', borderRadius:'50%', background:'white', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
                    </div>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px' }}>
                        <span style={{ fontSize:'14px', fontWeight:700, color:'#1a1040' }}>{tpl.title}</span>
                        <span style={{ fontSize:'9px', fontWeight:700, color:ps.c, background:ps.bg, padding:'2px 7px', borderRadius:'8px' }}>{ps.l}</span>
                        <span style={{ fontSize:'9px', fontWeight:600, color:'#7F77DD', background:'#EDE9FE', padding:'2px 7px', borderRadius:'8px' }}>{SCHEDULE_LABELS[tpl.schedule]}</span>
                        {tpl.schedule==='CUSTOM' && tpl.daysOfWeek?.length>0 && (
                          <span style={{ fontSize:'10px', color:'#9B97CC' }}>{tpl.daysOfWeek.map((d:number)=>DAYS_RU[d]).join(', ')}</span>
                        )}
                        {tpl.dueTime && <span style={{ fontSize:'10px', color:'#9B97CC' }}>до {tpl.dueTime}</span>}
                      </div>
                      <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        {tpl.assignee ? (
                          <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                            <div style={{ width:'18px', height:'18px', borderRadius:'50%', background:avatarColor(tpl.assignee.name), display:'flex', alignItems:'center', justifyContent:'center' }}>
                              <span style={{ color:'white', fontSize:'8px', fontWeight:700 }}>{tpl.assignee.name?.charAt(0)}</span>
                            </div>
                            <span style={{ fontSize:'11px', color:'#6B7280' }}>{tpl.assignee.name}</span>
                          </div>
                        ) : <span style={{ fontSize:'11px', color:'#C4C0E8' }}>Без исполнителя</span>}
                        {tpl.description && <span style={{ fontSize:'11px', color:'#9B97CC', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:'200px' }}>{tpl.description}</span>}
                      </div>
                    </div>
                    {perms.isAdmin && (
                      <div style={{ display:'flex', gap:'6px', flexShrink:0 }}>
                        <button onClick={()=>openEdit(tpl)}
                          style={{ width:'30px', height:'30px', background:'#EDE9FE', border:'none', borderRadius:'8px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <i className="ti ti-pencil" style={{ fontSize:'14px', color:'#7F77DD' }} aria-hidden="true"/>
                        </button>
                        <button onClick={()=>handleDelete(tpl.id)}
                          style={{ width:'30px', height:'30px', background:'#FEE2E2', border:'none', borderRadius:'8px', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center' }}>
                          <i className="ti ti-trash" style={{ fontSize:'14px', color:'#DC2626' }} aria-hidden="true"/>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Examples hint */}
        {templates.length>0 && templates.length<3 && (
          <div style={{ background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'16px', padding:'16px 18px' }}>
            <p style={{ fontSize:'12px', fontWeight:600, color:'#7F77DD', margin:'0 0 8px' }}>💡 Примеры рутинных задач</p>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'6px' }}>
              {EXAMPLES.filter(ex=>!templates.find(t=>t.title===ex)).map(ex=>(
                <button key={ex} onClick={()=>{ setForm({...emptyForm,title:ex}); setShowForm(true); }}
                  style={{ fontSize:'11px', color:'#7F77DD', background:'#EDE9FE', border:'none', borderRadius:'20px', padding:'5px 12px', cursor:'pointer', fontWeight:500 }}>
                  + {ex}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div style={modal}>
          <div style={{ background:'white', borderRadius:'24px', padding:'28px 32px', width:'520px', maxHeight:'90vh', overflowY:'auto', boxShadow:'0 24px 64px rgba(127,119,221,0.2)' }}>
            <h3 style={{ fontSize:'18px', fontWeight:800, color:'#1a1040', margin:'0 0 22px', letterSpacing:'-0.5px' }}>
              {editId ? 'Редактировать шаблон' : 'Новый шаблон'}
            </h3>
            <form onSubmit={handleSave} style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
              <div>
                <label style={{ fontSize:'10px', fontWeight:700, color:'#9B97CC', display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.4px' }}>Название *</label>
                <input placeholder="Например: Ответить на отзывы WB" value={form.title} onChange={e=>setForm({...form,title:e.target.value})} required style={inp}/>
              </div>
              <div>
                <label style={{ fontSize:'10px', fontWeight:700, color:'#9B97CC', display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.4px' }}>Описание</label>
                <textarea placeholder="Описание задачи (необязательно)" value={form.description} onChange={e=>setForm({...form,description:e.target.value})} rows={2} style={{ ...inp, resize:'none' }}/>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <div>
                  <label style={{ fontSize:'10px', fontWeight:700, color:'#9B97CC', display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.4px' }}>Исполнитель</label>
                  <select value={form.assigneeId} onChange={e=>setForm({...form,assigneeId:e.target.value})} style={inp}>
                    <option value="">Без исполнителя</option>
                    {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:'10px', fontWeight:700, color:'#9B97CC', display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.4px' }}>Приоритет</label>
                  <select value={form.priority} onChange={e=>setForm({...form,priority:e.target.value})} style={inp}>
                    <option value="LOW">Низкий</option>
                    <option value="MEDIUM">Средний</option>
                    <option value="HIGH">Высокий</option>
                    <option value="CRITICAL">Критичный</option>
                  </select>
                </div>
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <div>
                  <label style={{ fontSize:'10px', fontWeight:700, color:'#9B97CC', display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.4px' }}>Расписание</label>
                  <select value={form.schedule} onChange={e=>setForm({...form,schedule:e.target.value})} style={inp}>
                    <option value="DAILY">Каждый день</option>
                    <option value="WEEKDAYS">По будням (Пн-Пт)</option>
                    <option value="CUSTOM">Выбранные дни</option>
                  </select>
                </div>
                <div>
                  <label style={{ fontSize:'10px', fontWeight:700, color:'#9B97CC', display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.4px' }}>Срок (время)</label>
                  <input type="time" value={form.dueTime} onChange={e=>setForm({...form,dueTime:e.target.value})} style={inp}/>
                </div>
              </div>
              {form.schedule==='CUSTOM' && (
                <div>
                  <label style={{ fontSize:'10px', fontWeight:700, color:'#9B97CC', display:'block', marginBottom:'8px', textTransform:'uppercase', letterSpacing:'0.4px' }}>Дни недели</label>
                  <div style={{ display:'flex', gap:'6px' }}>
                    {[1,2,3,4,5,6,7].map(d=>(
                      <button key={d} type="button" onClick={()=>toggleDay(d)}
                        style={{ flex:1, padding:'8px 0', borderRadius:'10px', border:'none', fontWeight:700, fontSize:'12px', cursor:'pointer', background:form.daysOfWeek.includes(d)?'linear-gradient(135deg,#7F77DD,#5248C5)':'#F8F7FF', color:form.daysOfWeek.includes(d)?'white':'#9B97CC', transition:'all 0.15s' }}>
                        {DAYS_RU[d]}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'10px' }}>
                <div>
                  <label style={{ fontSize:'10px', fontWeight:700, color:'#9B97CC', display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.4px' }}>Дата начала</label>
                  <input type="date" value={form.startDate} onChange={e=>setForm({...form,startDate:e.target.value})} style={inp}/>
                </div>
                <div>
                  <label style={{ fontSize:'10px', fontWeight:700, color:'#9B97CC', display:'block', marginBottom:'6px', textTransform:'uppercase', letterSpacing:'0.4px' }}>Дата окончания</label>
                  <input type="date" value={form.endDate} onChange={e=>setForm({...form,endDate:e.target.value})} style={inp}/>
                </div>
              </div>
              <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'12px 14px', background:'#F8F7FF', borderRadius:'12px' }}>
                <span style={{ fontSize:'13px', fontWeight:600, color:'#1a1040' }}>Активен</span>
                <div onClick={()=>setForm({...form,isActive:!form.isActive})}
                  style={{ width:'44px', height:'24px', borderRadius:'12px', background:form.isActive?'#7F77DD':'#E5E7EB', position:'relative', cursor:'pointer', transition:'background 0.2s' }}>
                  <div style={{ position:'absolute', top:'3px', left:form.isActive?'23px':'3px', width:'18px', height:'18px', borderRadius:'50%', background:'white', transition:'left 0.2s', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}/>
                </div>
              </div>
              <div style={{ display:'flex', gap:'10px', marginTop:'6px' }}>
                <button type="button" onClick={()=>{ setShowForm(false); setEditId(null); setForm({...emptyForm}); }}
                  style={{ flex:1, background:'#F8F7FF', color:'#6B7280', border:'1px solid #EDE9FE', borderRadius:'12px', padding:'11px', fontSize:'13px', cursor:'pointer', fontWeight:600 }}>
                  Отмена
                </button>
                <button type="submit" disabled={saving}
                  style={{ flex:1, background:'linear-gradient(135deg,#7F77DD,#5248C5)', color:'white', border:'none', borderRadius:'12px', padding:'11px', fontSize:'13px', cursor:'pointer', fontWeight:700 }}>
                  {saving ? 'Сохранение...' : editId ? 'Сохранить' : 'Создать →'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
