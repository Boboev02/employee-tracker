'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

const STATUS_STYLE: Record<string,{bg:string;c:string;label:string}> = {
  NEW:         { bg:'#EDE9FE', c:'#7F77DD', label:'Новая' },
  IN_PROGRESS: { bg:'#DBEAFE', c:'#2563EB', label:'В работе' },
  REVIEW:      { bg:'#FEF3C7', c:'#D97706', label:'Проверка' },
  DONE:        { bg:'#DCFCE7', c:'#16A34A', label:'Готово' },
  BLOCKED:     { bg:'#FEE2E2', c:'#DC2626', label:'Заблокирована' },
  OVERDUE:     { bg:'#FEE2E2', c:'#DC2626', label:'Просрочена' },
};
const PRIORITY_STYLE: Record<string,{bg:string;c:string;label:string}> = {
  LOW:      { bg:'#F3F4F6', c:'#6B7280', label:'Низкий' },
  MEDIUM:   { bg:'#DBEAFE', c:'#2563EB', label:'Средний' },
  HIGH:     { bg:'#FEF3C7', c:'#D97706', label:'Высокий' },
  CRITICAL: { bg:'#FEE2E2', c:'#DC2626', label:'Критический' },
};
const AVATAR_COLORS = ['#7F77DD','#2563EB','#16A34A','#D97706','#DC2626','#0891B2'];
const avatarColor = (name: string) => AVATAR_COLORS[(name?.charCodeAt(0)??0) % AVATAR_COLORS.length];

function timeAgo(dateStr: string) {
  const d = Math.floor((Date.now()-new Date(dateStr).getTime())/60000);
  if (d<1) return 'только что';
  if (d<60) return d+'м назад';
  if (d<1440) return Math.floor(d/60)+'ч назад';
  return new Date(dateStr).toLocaleDateString('ru',{day:'numeric',month:'short'});
}

export default function TaskDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [token, setToken]       = useState('');
  const [user, setUser]         = useState<any>(null);

  const [task, setTask]         = useState<any>(null);

  // Может ли текущий пользователь редактировать эту задачу:
  // ADMIN/MANAGER (есть роль с правом на все задачи) — всегда;
  // EMPLOYEE — только если он автор или назначенный исполнитель
  const canEdit = (() => {
    if (!user || !task) return false;
    const privilegedRoles = ['ADMIN', 'SUPER_ADMIN', 'OWNER', 'MANAGER'];
    if (user.roles?.some((r: string) => privilegedRoles.includes(r))) return true;
    return task.createdById === user.id || task.assigneeId === user.id;
  })();
  const [comments, setComments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [userMap, setUserMap]   = useState<Record<string,string>>({});
  const [loading, setLoading]   = useState(true);
  const [comment, setComment]   = useState('');
  const [posting, setPosting]   = useState(false);
  const [saving, setSaving]     = useState(false);
  const [editTitle, setEditTitle] = useState(false);
  const [titleVal, setTitleVal] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    const u = localStorage.getItem('user');
    if (!t) { router.push('/login'); return; }
    setToken(t); if (u) setUser(JSON.parse(u));
    loadTask(t);
    fetch('https://employee-tracker.ru/api/v1/employees', { headers:{ Authorization:'Bearer '+t } })
      .then(r=>r.json()).then(data => {
        if (Array.isArray(data)) {
          const map: Record<string,string> = {};
          data.forEach((e:any)=>{ map[e.id]=e.name; });
          setUserMap(map); setEmployees(data);
        }
      });
  }, [id]);

  const loadTask = async (t: string) => {
    setLoading(true);
    try {
      const res  = await fetch('https://employee-tracker.ru/api/v1/tasks/'+id, { headers:{ Authorization:'Bearer '+t } });
      const data = await res.json();
      setTask(data); setTitleVal(data.title ?? '');
      setComments(Array.isArray(data.comments)?data.comments:[]);
    } finally { setLoading(false); }
  };

  const updateField = async (field: string, value: any) => {
    setSaving(true);
    try {
      await fetch('https://employee-tracker.ru/api/v1/tasks/'+id, {
        method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+token },
        body: JSON.stringify({ [field]: value||null }),
      });
      loadTask(token);
    } finally { setSaving(false); }
  };

  const moveTask = async (status: string) => {
    await fetch('https://employee-tracker.ru/api/v1/tasks/'+id+'/move', {
      method:'PATCH', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+token },
      body: JSON.stringify({ status }),
    });
    loadTask(token);
  };

  const postComment = async () => {
    if (!comment.trim()) return;
    setPosting(true);
    try {
      await fetch('https://employee-tracker.ru/api/v1/tasks/'+id+'/comments', {
        method:'POST', headers:{ 'Content-Type':'application/json', Authorization:'Bearer '+token },
        body: JSON.stringify({ content: comment.trim() }),
      });
      setComment(''); loadTask(token);
    } finally { setPosting(false); }
  };

  if (loading) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'200px', color:'#9B97CC', fontSize:'13px' }}>
      Загрузка...
    </div>
  );
  if (!task) return (
    <div style={{ padding:'24px', color:'#9B97CC', fontSize:'13px' }}>Задача не найдена</div>
  );

  const ss = STATUS_STYLE[task.status] ?? STATUS_STYLE.NEW;
  const ps = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.MEDIUM;
  const overdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== 'DONE';
  const card: React.CSSProperties = { background:'white', borderRadius:'20px', padding:'20px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' };
  const inp: React.CSSProperties  = { width:'100%', background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'10px', padding:'8px 12px', fontSize:'13px', color:'#1a1040', outline:'none', boxSizing:'border-box', fontFamily:'inherit', opacity:saving?0.6:1 };

  const MOVE_ACTIONS: Record<string,{to:string;label:string;bg:string;c:string}[]> = {
    NEW:         [{ to:'IN_PROGRESS', label:'▶ Взять в работу',   bg:'#DBEAFE', c:'#2563EB' }],
    IN_PROGRESS: [{ to:'REVIEW',      label:'👁 На проверку',     bg:'#FEF3C7', c:'#D97706' }, { to:'DONE', label:'✓ Завершить', bg:'#DCFCE7', c:'#16A34A' }],
    REVIEW:      [{ to:'IN_PROGRESS', label:'↩ Вернуть',          bg:'#DBEAFE', c:'#2563EB' }, { to:'DONE', label:'✓ Завершить', bg:'#DCFCE7', c:'#16A34A' }],
    BLOCKED:     [{ to:'IN_PROGRESS', label:'▶ Вернуть в работу', bg:'#DBEAFE', c:'#2563EB' }],
    OVERDUE:     [{ to:'IN_PROGRESS', label:'▶ Вернуть в работу', bg:'#DBEAFE', c:'#2563EB' }, { to:'DONE', label:'✓ Завершить', bg:'#DCFCE7', c:'#16A34A' }],
    DONE:        [{ to:'IN_PROGRESS', label:'↩ Переоткрыть',      bg:'#DBEAFE', c:'#2563EB' }],
  };
  const canBlock = !['NEW','DONE','BLOCKED','OVERDUE'].includes(task.status);

  return (
    <div style={{ minHeight:'100vh', background:'#ECEAF8' }}>
      {/* Header */}
      <div style={{ background:'white', padding:'14px 28px', display:'flex', alignItems:'center', gap:'12px', position:'sticky', top:0, zIndex:10, boxShadow:'0 4px 16px rgba(127,119,221,0.06)' }}>
        <button onClick={()=>router.push('/dashboard/tasks')}
          style={{ background:'#F8F7FF', border:'1px solid #EDE9FE', color:'#7F77DD', borderRadius:'20px', padding:'6px 14px', fontSize:'12px', fontWeight:700, cursor:'pointer', flexShrink:0 }}>
          ← Назад
        </button>
        {editTitle ? (
          <input autoFocus value={titleVal} onChange={e=>setTitleVal(e.target.value)}
            onBlur={()=>{ setEditTitle(false); if(titleVal.trim()&&titleVal!==task.title) updateField('title',titleVal.trim()); }}
            onKeyDown={e=>{ if(e.key==='Enter'){ setEditTitle(false); updateField('title',titleVal.trim()); } if(e.key==='Escape') setEditTitle(false); }}
            style={{ flex:1, fontSize:'16px', fontWeight:700, color:'#1a1040', border:'1px solid #7F77DD', borderRadius:'10px', padding:'6px 12px', outline:'none', background:'#F8F7FF' }}/>
        ) : (
          <h1 onClick={()=>canEdit && setEditTitle(true)}
            title={canEdit ? "Нажмите для редактирования" : "У вас нет прав на редактирование этой задачи"}
            style={{ fontSize:'16px', fontWeight:800, color:'#1a1040', margin:0, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', cursor: canEdit ? 'text' : 'default', letterSpacing:'-0.3px' }}>
            {task.title}
            {task.isRoutine && <span style={{ fontSize:'10px', fontWeight:700, color:'#7F77DD', background:'#EDE9FE', padding:'2px 7px', borderRadius:'8px', marginLeft:'8px' }}>🔄 Рутина</span>}
          </h1>
        )}
        <span style={{ fontSize:'11px', fontWeight:700, padding:'4px 12px', borderRadius:'20px', background:ss.bg, color:ss.c, flexShrink:0 }}>{ss.label}</span>
      </div>

      <div style={{ padding:'20px 28px', display:'grid', gridTemplateColumns:'1fr 280px', gap:'16px', alignItems:'start' }}>

        {/* Left — description + comments */}
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

          {/* Description */}
          <div style={card}>
            <p style={{ fontSize:'11px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 12px' }}>Описание</p>
            {task.description ? (
              <p style={{ fontSize:'13px', color:'#1a1040', lineHeight:1.7, whiteSpace:'pre-wrap', margin:0 }}>{task.description}</p>
            ) : (
              <p style={{ fontSize:'13px', color:'#C4C0E8', fontStyle:'italic', margin:0 }}>Описание не добавлено</p>
            )}
          </div>

          {/* Comments */}
          <div style={card}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'16px' }}>
              <p style={{ fontSize:'11px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px', margin:0 }}>
                Комментарии
                {comments.length>0 && <span style={{ fontWeight:500, color:'#C4C0E8', marginLeft:'4px' }}>({comments.length})</span>}
              </p>
            </div>

            {/* Comments list */}
            {comments.length>0 && (
              <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'20px' }}>
                {comments.map((c:any,i:number) => {
                  const authorName = userMap[c.authorId] ?? c.author?.name ?? 'Пользователь';
                  const isMe = c.authorId === user?.id;
                  return (
                    <div key={c.id??i} style={{ display:'flex', gap:'10px', alignItems:'flex-start' }}>
                      <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:avatarColor(authorName), display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                        <span style={{ color:'white', fontSize:'12px', fontWeight:700 }}>{authorName.charAt(0)}</span>
                      </div>
                      <div style={{ flex:1 }}>
                        <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'5px' }}>
                          <span style={{ fontSize:'13px', fontWeight:600, color:'#1a1040' }}>{authorName}</span>
                          {isMe && <span style={{ fontSize:'10px', color:'#7F77DD', background:'#EDE9FE', padding:'1px 6px', borderRadius:'6px' }}>Вы</span>}
                          <span style={{ fontSize:'11px', color:'#C4C0E8', marginLeft:'auto' }}>{timeAgo(c.createdAt)}</span>
                        </div>
                        <div style={{ background:'#F8F7FF', borderRadius:'12px', padding:'10px 14px', fontSize:'13px', color:'#1a1040', lineHeight:1.6, border:'1px solid #F3F0FF' }}>
                          {c.content}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {comments.length===0 && (
              <div style={{ padding:'20px', textAlign:'center', color:'#C4C0E8', fontSize:'13px', marginBottom:'16px' }}>
                <i className="ti ti-message" style={{ fontSize:'24px', display:'block', marginBottom:'8px', opacity:0.5 }} aria-hidden="true"/>
                Комментариев пока нет
              </div>
            )}

            {/* New comment */}
            <div style={{ display:'flex', gap:'10px', alignItems:'flex-start' }}>
              <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:avatarColor(user?.name??''), display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:'1px' }}>
                <span style={{ color:'white', fontSize:'12px', fontWeight:700 }}>{user?.name?.charAt(0)??'U'}</span>
              </div>
              <div style={{ flex:1 }}>
                <textarea value={comment} onChange={e=>setComment(e.target.value)}
                  onKeyDown={e=>{ if(e.key==='Enter'&&(e.metaKey||e.ctrlKey)) postComment(); }}
                  placeholder="Написать комментарий... (Cmd+Enter для отправки)"
                  rows={3}
                  style={{ ...inp, resize:'none', borderRadius:'12px', padding:'10px 14px', lineHeight:1.6 }}/>
                <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'8px' }}>
                  <button onClick={postComment} disabled={posting||!comment.trim()}
                    style={{ background:posting||!comment.trim()?'#EDE9FE':'linear-gradient(135deg,#7F77DD,#5248C5)', color:posting||!comment.trim()?'#C4C0E8':'white', border:'none', padding:'8px 20px', borderRadius:'12px', fontSize:'13px', fontWeight:700, cursor:posting||!comment.trim()?'not-allowed':'pointer', transition:'all 0.2s', display:'flex', alignItems:'center', gap:'6px' }}>
                    <i className="ti ti-send" style={{ fontSize:'14px' }} aria-hidden="true"/>
                    {posting ? 'Отправляю...' : 'Отправить'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* History */}
          {task.history?.length>0 && (
            <div style={card}>
              <p style={{ fontSize:'11px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 12px' }}>История изменений</p>
              <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                {task.history.slice(0,10).map((h:any,i:number)=>(
                  <div key={i} style={{ display:'flex', alignItems:'center', gap:'8px', fontSize:'12px', color:'#9B97CC', padding:'4px 0', borderBottom:'1px solid #F9F8FF' }}>
                    <i className="ti ti-history" style={{ fontSize:'13px', flexShrink:0 }} aria-hidden="true"/>
                    <span style={{ flex:1 }}><b style={{ color:'#6B7280' }}>{userMap[h.actorId]??'Система'}</b> изменил {h.field}: {h.oldValue||'—'} → {h.newValue||'—'}</span>
                    <span style={{ flexShrink:0, fontSize:'10px' }}>{timeAgo(h.createdAt)}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Right sidebar */}
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>

          {/* Status actions */}
          <div style={card}>
            <p style={{ fontSize:'11px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 12px' }}>Действия</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'7px' }}>
              {(MOVE_ACTIONS[task.status]??[]).map(a=>(
                <button key={a.to} onClick={()=>moveTask(a.to)}
                  style={{ padding:'9px', borderRadius:'12px', border:'none', background:a.bg, color:a.c, fontSize:'13px', fontWeight:700, cursor:'pointer', transition:'all 0.15s', width:'100%' }}
                  onMouseEnter={e=>(e.currentTarget as HTMLElement).style.opacity='0.8'}
                  onMouseLeave={e=>(e.currentTarget as HTMLElement).style.opacity='1'}>
                  {a.label}
                </button>
              ))}
              {canBlock && (
                <button onClick={()=>moveTask('BLOCKED')}
                  style={{ padding:'9px', borderRadius:'12px', border:'none', background:'#FEE2E2', color:'#DC2626', fontSize:'13px', fontWeight:700, cursor:'pointer', width:'100%' }}>
                  🚫 Заблокировать
                </button>
              )}
            </div>
          </div>

          {/* Details */}
          <div style={card}>
            <p style={{ fontSize:'11px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 14px' }}>Детали</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>

              {/* Priority */}
              <div>
                <p style={{ fontSize:'10px', color:'#9B97CC', margin:'0 0 6px', fontWeight:600 }}>Приоритет</p>
                <span style={{ fontSize:'11px', fontWeight:700, padding:'3px 10px', borderRadius:'20px', background:ps.bg, color:ps.c }}>{ps.label}</span>
              </div>

              {/* Assignee */}
              <div>
                <p style={{ fontSize:'10px', color:'#9B97CC', margin:'0 0 6px', fontWeight:600 }}>Исполнитель</p>
                <select value={task.assigneeId??''} onChange={e=>updateField('assigneeId',e.target.value)} disabled={saving || !canEdit} style={inp}>
                  <option value="">Не назначен</option>
                  {employees.map((e:any)=><option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>

              {/* Due date */}
              <div>
                <p style={{ fontSize:'10px', color:'#9B97CC', margin:'0 0 6px', fontWeight:600 }}>Дедлайн</p>
                <input type="date" value={task.dueDate?task.dueDate.slice(0,10):''} onChange={e=>updateField('dueDate',e.target.value)} disabled={saving || !canEdit} style={inp}/>
                {task.dueDate && (
                  <p style={{ fontSize:'11px', margin:'5px 0 0', fontWeight:600, color:overdue?'#DC2626':new Date(task.dueDate)<new Date(Date.now()+3*864e5)?'#D97706':'#16A34A' }}>
                    {overdue ? '⚠ Просрочено' : new Date(task.dueDate)<new Date(Date.now()+3*864e5) ? '⏰ Скоро дедлайн' : '✓ '+new Date(task.dueDate).toLocaleDateString('ru',{day:'numeric',month:'long'})}
                  </p>
                )}
              </div>

              {/* Meta */}
              <div style={{ paddingTop:'12px', borderTop:'1px solid #F3F0FF', display:'flex', flexDirection:'column', gap:'6px' }}>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px' }}>
                  <span style={{ color:'#9B97CC' }}>Создана</span>
                  <span style={{ color:'#6B7280' }}>{new Date(task.createdAt).toLocaleDateString('ru',{day:'numeric',month:'short'})}</span>
                </div>
                {task.startedAt && (
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px' }}>
                    <span style={{ color:'#9B97CC' }}>Начата</span>
                    <span style={{ color:'#6B7280' }}>{new Date(task.startedAt).toLocaleDateString('ru',{day:'numeric',month:'short'})}</span>
                  </div>
                )}
                {task.completedAt && (
                  <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px' }}>
                    <span style={{ color:'#9B97CC' }}>Завершена</span>
                    <span style={{ color:'#16A34A', fontWeight:600 }}>{new Date(task.completedAt).toLocaleDateString('ru',{day:'numeric',month:'short'})}</span>
                  </div>
                )}
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px' }}>
                  <span style={{ color:'#9B97CC' }}>Комментариев</span>
                  <span style={{ color:'#6B7280', fontWeight:600 }}>{comments.length}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
