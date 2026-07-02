'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

const API = 'https://employee-tracker.ru/api/v1';

const STAGES = ['NEW','QUALIFIED','PROPOSAL','NEGOTIATION','WON','LOST'];
const STAGE_LABELS: Record<string,string> = { NEW:'Новая', QUALIFIED:'Квалифицирована', PROPOSAL:'Предложение', NEGOTIATION:'Переговоры', WON:'Выиграна', LOST:'Проиграна' };
const STAGE_COLORS: Record<string,string> = { NEW:'#9B97CC', QUALIFIED:'#3B82F6', PROPOSAL:'#F59E0B', NEGOTIATION:'#8B5CF6', WON:'#10B981', LOST:'#EF4444' };
const TASK_STATUS_LABELS: Record<string,string> = { NEW:'Новая', IN_PROGRESS:'В работе', REVIEW:'Проверка', DONE:'Готово', OVERDUE:'Просрочена' };
const TASK_STATUS_COLORS: Record<string,string> = { NEW:'#9B97CC', IN_PROGRESS:'#7F77DD', REVIEW:'#D97706', DONE:'#16A34A', OVERDUE:'#DC2626' };
const ACTIVITY_ICONS: Record<string,string> = { created:'🎯', status_change:'🔄', deal_created:'✅', note:'📝', call:'📞', email:'✉️', meeting:'🤝', task:'✅' };

export default function DealPage() {
  const router = useRouter();
  const { id } = useParams();
  const [deal, setDeal] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [tab, setTab] = useState<'info'|'tasks'|'activity'>('info');
  const [editField, setEditField] = useState<string|null>(null);
  const [editVal, setEditVal] = useState<any>('');
  const [showNote, setShowNote] = useState(false);
  const [note, setNote] = useState('');
  const [showTaskForm, setShowTaskForm] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [taskForm, setTaskForm] = useState({ title:'', priority:'MEDIUM', assigneeId:'', dueDate:'' });

  const h = () => ({ 'Content-Type':'application/json', Authorization:'Bearer '+localStorage.getItem('access_token') });

  useEffect(() => {
    if (!localStorage.getItem('access_token')) { router.push('/login'); return; }
    load();
    fetch(API+'/employees', {headers:h()}).then(r=>r.json()).then(d=>setEmployees(d.employees??d??[])).catch(()=>{});
  }, [id]);

  const load = async () => {
    setLoading(true);
    try {
      const r = await fetch(API+'/crm/deals/'+id, {headers:h()});
      setDeal(await r.json());
    } catch {}
    setLoading(false);
  };

  const updateField = async (field: string, value: any) => {
    setSaving(true);
    await fetch(API+'/crm/deals/'+id, { method:'PATCH', headers:h(), body:JSON.stringify({ [field]: value }) });
    setEditField(null);
    load();
    setSaving(false);
  };

  const moveStage = async (stage: string) => {
    await fetch(API+'/crm/deals/'+id, { method:'PATCH', headers:h(), body:JSON.stringify({ stage }) });
    await fetch(API+'/crm/activity', { method:'POST', headers:h(), body:JSON.stringify({ type:'status_change', content:'Этап изменён: '+STAGE_LABELS[stage], dealId:id }) });
    load();
  };

  const addNote = async () => {
    if (!note.trim()) return;
    await fetch(API+'/crm/activity', { method:'POST', headers:h(), body:JSON.stringify({ type:'note', content:note.trim(), dealId:id }) });
    setNote(''); setShowNote(false);
    load();
  };

  const createTask = async () => {
    if (!taskForm.title.trim()) return;
    setSaving(true);
    await fetch(API+'/tasks', { method:'POST', headers:h(), body:JSON.stringify({ ...taskForm, dealId:id, assigneeId:taskForm.assigneeId||undefined, dueDate:taskForm.dueDate||undefined }) });
    setTaskForm({ title:'', priority:'MEDIUM', assigneeId:'', dueDate:'' });
    setShowTaskForm(false);
    load();
    setSaving(false);
  };

  if (loading) return <div style={{padding:'40px',textAlign:'center',color:'#9B97CC'}}>Загрузка...</div>;
  if (!deal) return <div style={{padding:'40px',textAlign:'center',color:'#9B97CC'}}>Сделка не найдена</div>;

  const stageIdx = STAGES.indexOf(deal.stage);
  const card: React.CSSProperties = { background:'white', borderRadius:'20px', padding:'20px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' };
  const inp: React.CSSProperties = { width:'100%', background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'10px', padding:'8px 12px', fontSize:'13px', outline:'none', boxSizing:'border-box' };

  const EditableField = ({ label, field, value, type='text' }: any) => (
    <div style={{padding:'10px 0', borderBottom:'1px solid #F8F7FF'}}>
      <p style={{fontSize:'11px',color:'#9B97CC',margin:'0 0 4px',fontWeight:600,textTransform:'uppercase',letterSpacing:'0.4px'}}>{label}</p>
      {editField===field ? (
        <div style={{display:'flex',gap:'6px'}}>
          {type==='select-stage' ? (
            <select value={editVal} onChange={e=>setEditVal(e.target.value)} style={{...inp,flex:1}} autoFocus>
              {STAGES.map(s=><option key={s} value={s}>{STAGE_LABELS[s]}</option>)}
            </select>
          ) : (
            <input type={type} value={editVal} onChange={e=>setEditVal(e.target.value)}
              style={{...inp,flex:1}} autoFocus onKeyDown={e=>e.key==='Enter'&&updateField(field,type==='number'?parseFloat(editVal):editVal)} />
          )}
          <button onClick={()=>updateField(field,type==='number'?parseFloat(editVal):editVal)} disabled={saving}
            style={{background:'#10B981',color:'white',border:'none',borderRadius:'8px',padding:'6px 12px',fontSize:'12px',cursor:'pointer',fontWeight:700}}>✓</button>
          <button onClick={()=>setEditField(null)}
            style={{background:'white',color:'#9B97CC',border:'1px solid #EDE9FE',borderRadius:'8px',padding:'6px 10px',fontSize:'12px',cursor:'pointer'}}>✕</button>
        </div>
      ) : (
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',gap:'8px'}}
          onClick={()=>{setEditField(field);setEditVal(value??'');}}>
          <span style={{fontSize:'13px',color:value?'#1a1040':'#C4C0E8',cursor:'text',fontWeight:value?600:400}}>
            {field==='stage'?(STAGE_LABELS[value]??'—'):field==='amount'?((value??0).toLocaleString('ru')+' ₽'):(value||'Нажмите чтобы изменить')}
          </span>
          <span style={{color:'#C4C0E8',fontSize:'12px',cursor:'pointer',flexShrink:0}}>✏️</span>
        </div>
      )}
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:'#ECEAF8'}}>
      <div style={{background:'white',padding:'14px 28px',display:'flex',alignItems:'center',gap:'12px',boxShadow:'0 4px 16px rgba(127,119,221,0.06)',position:'sticky',top:0,zIndex:10}}>
        <Link href="/dashboard/crm" style={{color:'#9B97CC',textDecoration:'none',fontSize:'13px'}}>← CRM</Link>
        <span style={{color:'#EDE9FE'}}>|</span>
        <span style={{fontSize:'14px',fontWeight:700,color:'#1a1040',flex:1}}>{deal.title}</span>
        {deal.amount && <span style={{fontSize:'16px',fontWeight:800,color:'#7F77DD'}}>{deal.amount.toLocaleString('ru')} ₽</span>}
        <span style={{background:(STAGE_COLORS[deal.stage]??'#9B97CC')+'20',color:STAGE_COLORS[deal.stage]??'#9B97CC',borderRadius:'8px',padding:'4px 12px',fontSize:'12px',fontWeight:700}}>
          {STAGE_LABELS[deal.stage]??deal.stage}
        </span>
      </div>

      <div style={{padding:'20px 28px',maxWidth:'1200px'}}>
        <div style={{display:'flex',gap:'6px',marginBottom:'16px',overflowX:'auto',paddingBottom:'4px'}}>
          {STAGES.map((s,i) => (
            <button key={s} onClick={()=>moveStage(s)}
              style={{background:deal.stage===s?(STAGE_COLORS[s]??'#9B97CC'):'white',color:deal.stage===s?'white':(STAGE_COLORS[s]??'#9B97CC'),border:'2px solid '+(STAGE_COLORS[s]??'#9B97CC'),borderRadius:'12px',padding:'8px 16px',fontSize:'12px',fontWeight:700,cursor:'pointer',opacity:i>stageIdx+1&&deal.stage!==s?0.5:1,flexShrink:0,transition:'all 0.15s'}}>
              {i<=stageIdx&&deal.stage!==s?'✓ ':''}{STAGE_LABELS[s]}
            </button>
          ))}
        </div>

        <div style={{display:'grid',gridTemplateColumns:'320px 1fr',gap:'20px'}}>
          <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
            <div style={card}>
              <p style={{fontSize:'11px',color:'#9B97CC',margin:'0 0 4px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.5px'}}>Информация о сделке</p>
              <EditableField label="Название" field="title" value={deal.title} />
              <EditableField label="Сумма (₽)" field="amount" value={deal.amount} type="number" />
              <EditableField label="Этап" field="stage" value={deal.stage} type="select-stage" />
              <EditableField label="Источник" field="source" value={deal.source} />
              {deal.contact && (
                <div style={{padding:'10px 0',borderBottom:'1px solid #F8F7FF'}}>
                  <p style={{fontSize:'11px',color:'#9B97CC',margin:'0 0 4px',fontWeight:600,textTransform:'uppercase'}}>Контакт</p>
                  <p style={{fontSize:'13px',color:'#1a1040',margin:0,fontWeight:600}}>👤 {deal.contact.firstName} {deal.contact.lastName??''}</p>
                </div>
              )}
              {deal.company && (
                <div style={{padding:'10px 0'}}>
                  <p style={{fontSize:'11px',color:'#9B97CC',margin:'0 0 4px',fontWeight:600,textTransform:'uppercase'}}>Компания</p>
                  <p style={{fontSize:'13px',color:'#1a1040',margin:0,fontWeight:600}}>🏢 {deal.company.name}</p>
                </div>
              )}
            </div>

            <div style={card}>
              <p style={{fontSize:'11px',color:'#9B97CC',margin:'0 0 8px',fontWeight:700,textTransform:'uppercase'}}>Даты</p>
              <div style={{display:'flex',flexDirection:'column',gap:'4px',fontSize:'12px',color:'#9B97CC'}}>
                <div style={{display:'flex',justifyContent:'space-between'}}>
                  <span>Создана</span>
                  <span style={{color:'#1a1040',fontWeight:600}}>{new Date(deal.createdAt).toLocaleDateString('ru')}</span>
                </div>
                <div style={{display:'flex',justifyContent:'space-between'}}>
                  <span>Обновлена</span>
                  <span style={{color:'#1a1040',fontWeight:600}}>{new Date(deal.updatedAt).toLocaleDateString('ru')}</span>
                </div>
                {deal.closedAt && (
                  <div style={{display:'flex',justifyContent:'space-between'}}>
                    <span>Закрыта</span>
                    <span style={{color:'#1a1040',fontWeight:600}}>{new Date(deal.closedAt).toLocaleDateString('ru')}</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
            <div style={{display:'flex',gap:'6px',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{display:'flex',gap:'6px'}}>
                {(['info','tasks','activity'] as const).map(t=>(
                  <button key={t} onClick={()=>setTab(t)}
                    style={{background:tab===t?'linear-gradient(135deg,#7F77DD,#5248C5)':'white',color:tab===t?'white':'#7F77DD',border:'1px solid #EDE9FE',borderRadius:'12px',padding:'8px 18px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>
                    {t==='info'?'Детали':t==='tasks'?'Задачи ('+(deal.tasks?.length??0)+')':'История'}
                  </button>
                ))}
              </div>
              {tab==='activity' && (
                <button onClick={()=>setShowNote(true)}
                  style={{background:'linear-gradient(135deg,#7F77DD,#5248C5)',color:'white',border:'none',borderRadius:'12px',padding:'8px 16px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>
                  + Заметка
                </button>
              )}
              {tab==='tasks' && (
                <button onClick={()=>setShowTaskForm(true)}
                  style={{background:'linear-gradient(135deg,#7F77DD,#5248C5)',color:'white',border:'none',borderRadius:'12px',padding:'8px 16px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>
                  + Задача
                </button>
              )}
            </div>

            {tab==='info' && (
              <div style={card}>
                <p style={{fontSize:'13px',fontWeight:700,color:'#1a1040',margin:'0 0 14px'}}>Вероятность закрытия</p>
                <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                  <div style={{flex:1,background:'#F8F7FF',borderRadius:'6px',height:'10px',overflow:'hidden'}}>
                    <div style={{width:(deal.probability??0)+'%',height:'100%',background:'linear-gradient(90deg,#EF4444,#F59E0B,#10B981)',borderRadius:'6px'}} />
                  </div>
                  <span style={{fontSize:'16px',fontWeight:800,color:'#1a1040',flexShrink:0}}>{deal.probability??0}%</span>
                </div>
                <div style={{display:'flex',gap:'8px',marginTop:'10px',flexWrap:'wrap'}}>
                  {[0,25,50,75,90,100].map(p=>(
                    <button key={p} onClick={()=>updateField('probability',p)}
                      style={{background:deal.probability===p?'linear-gradient(135deg,#7F77DD,#5248C5)':'#F8F7FF',color:deal.probability===p?'white':'#7F77DD',border:'none',borderRadius:'8px',padding:'4px 12px',fontSize:'12px',cursor:'pointer',fontWeight:600}}>
                      {p}%
                    </button>
                  ))}
                </div>
                {deal.tags?.length>0 && (
                  <div style={{marginTop:'14px'}}>
                    <p style={{fontSize:'11px',color:'#9B97CC',margin:'0 0 6px',fontWeight:600,textTransform:'uppercase'}}>Теги</p>
                    <div style={{display:'flex',gap:'6px',flexWrap:'wrap'}}>
                      {deal.tags.map((t:string)=>(
                        <span key={t} style={{background:'#EDE9FE',color:'#7F77DD',borderRadius:'8px',padding:'3px 10px',fontSize:'12px',fontWeight:600}}>{t}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {tab==='tasks' && (
              <>
                {showTaskForm && (
                  <div style={card}>
                    <p style={{fontSize:'14px',fontWeight:700,color:'#1a1040',margin:'0 0 12px'}}>Новая задача по сделке</p>
                    <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                      <input placeholder="Название задачи *" value={taskForm.title} onChange={e=>setTaskForm(f=>({...f,title:e.target.value}))} style={inp} autoFocus />
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
                        <input type="date" value={taskForm.dueDate} onChange={e=>setTaskForm(f=>({...f,dueDate:e.target.value}))} style={inp} />
                      </div>
                      <div style={{display:'flex',gap:'8px'}}>
                        <button onClick={createTask} disabled={!taskForm.title.trim()||saving}
                          style={{background:'linear-gradient(135deg,#7F77DD,#5248C5)',color:'white',border:'none',borderRadius:'10px',padding:'9px 20px',fontSize:'13px',fontWeight:700,cursor:'pointer',opacity:(!taskForm.title.trim()||saving)?0.6:1}}>
                          {saving?'Создание...':'Создать'}
                        </button>
                        <button onClick={()=>setShowTaskForm(false)} style={{background:'white',color:'#9B97CC',border:'1px solid #EDE9FE',borderRadius:'10px',padding:'9px 16px',fontSize:'13px',cursor:'pointer'}}>Отмена</button>
                      </div>
                    </div>
                  </div>
                )}
                {(deal.tasks??[]).length===0 && !showTaskForm ? (
                  <div style={{...card,textAlign:'center',padding:'40px'}}>
                    <p style={{color:'#9B97CC',margin:0}}>Задач по сделке нет</p>
                  </div>
                ) : (
                  <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                    {(deal.tasks??[]).map((task:any)=>(
                      <Link key={task.id} href={'/dashboard/tasks/'+task.id} style={{textDecoration:'none'}}>
                        <div style={{...card,padding:'14px 18px',cursor:'pointer',display:'flex',alignItems:'center',gap:'12px'}}>
                          <span style={{background:(TASK_STATUS_COLORS[task.status]??'#9B97CC')+'20',color:TASK_STATUS_COLORS[task.status]??'#9B97CC',borderRadius:'8px',padding:'3px 10px',fontSize:'11px',fontWeight:700,flexShrink:0}}>
                            {TASK_STATUS_LABELS[task.status]??task.status}
                          </span>
                          <span style={{fontSize:'13px',fontWeight:700,color:'#1a1040',flex:1}}>{task.title}</span>
                          {task.assignee && <span style={{fontSize:'11px',color:'#9B97CC'}}>{'👤 '+task.assignee.name}</span>}
                          {task.dueDate && <span style={{fontSize:'11px',color:'#9B97CC'}}>{'📅 '+new Date(task.dueDate).toLocaleDateString('ru')}</span>}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </>
            )}

            {tab==='activity' && (
              <>
                {showNote && (
                  <div style={card}>
                    <p style={{fontSize:'14px',fontWeight:700,color:'#1a1040',margin:'0 0 10px'}}>Добавить заметку</p>
                    <textarea placeholder="Текст заметки..." value={note} onChange={e=>setNote(e.target.value)} rows={3}
                      style={{...inp,resize:'vertical',marginBottom:'8px'}} autoFocus />
                    <div style={{display:'flex',gap:'8px'}}>
                      <button onClick={addNote} disabled={!note.trim()}
                        style={{background:'linear-gradient(135deg,#7F77DD,#5248C5)',color:'white',border:'none',borderRadius:'10px',padding:'8px 18px',fontSize:'13px',fontWeight:700,cursor:'pointer',opacity:!note.trim()?0.6:1}}>
                        Сохранить
                      </button>
                      <button onClick={()=>setShowNote(false)} style={{background:'white',color:'#9B97CC',border:'1px solid #EDE9FE',borderRadius:'10px',padding:'8px 14px',fontSize:'13px',cursor:'pointer'}}>Отмена</button>
                    </div>
                  </div>
                )}
                <div style={card}>
                  <p style={{fontSize:'13px',fontWeight:700,color:'#1a1040',margin:'0 0 14px'}}>История активности</p>
                  {(deal.activities??[]).length===0 ? (
                    <p style={{color:'#9B97CC',fontSize:'13px',margin:0}}>Активности пока нет</p>
                  ) : (
                    <div style={{display:'flex',flexDirection:'column',gap:'0'}}>
                      {(deal.activities??[]).map((a:any,i:number)=>(
                        <div key={a.id} style={{display:'flex',gap:'12px',paddingBottom:'16px',position:'relative'}}>
                          <div style={{display:'flex',flexDirection:'column',alignItems:'center',flexShrink:0}}>
                            <div style={{width:'32px',height:'32px',borderRadius:'50%',background:'#F0EDFF',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px',zIndex:1}}>
                              {ACTIVITY_ICONS[a.type]??'📌'}
                            </div>
                            {i<(deal.activities??[]).length-1 && <div style={{width:'2px',flex:1,background:'#EDE9FE',marginTop:'4px'}} />}
                          </div>
                          <div style={{flex:1,paddingTop:'6px'}}>
                            <p style={{fontSize:'13px',color:'#1a1040',margin:'0 0 2px',fontWeight:600}}>{a.content}</p>
                            <p style={{fontSize:'11px',color:'#9B97CC',margin:0}}>{new Date(a.createdAt).toLocaleString('ru')}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
