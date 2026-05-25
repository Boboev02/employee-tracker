'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

const STATUS_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  NEW:         { bg:'var(--bg-secondary)', color:'var(--text-muted)',   label:'Новая' },
  IN_PROGRESS: { bg:'var(--blue-bg)',      color:'var(--blue)',          label:'В работе' },
  REVIEW:      { bg:'var(--orange-bg)',    color:'var(--orange)',        label:'Проверка' },
  DONE:        { bg:'var(--green-bg)',     color:'var(--green)',         label:'Готово' },
  BLOCKED:     { bg:'var(--red-bg)',       color:'var(--red)',           label:'Заблокирована' },
};
const PRIORITY_STYLE: Record<string, { bg: string; color: string; label: string }> = {
  LOW:      { bg:'var(--bg-secondary)', color:'var(--text-muted)',  label:'Низкий' },
  MEDIUM:   { bg:'var(--blue-bg)',      color:'var(--blue)',         label:'Средний' },
  HIGH:     { bg:'var(--orange-bg)',    color:'var(--orange)',       label:'Высокий' },
  CRITICAL: { bg:'var(--red-bg)',       color:'var(--red)',          label:'Критический' },
};

export default function TaskDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [token, setToken]       = useState('');
  const [user, setUser]         = useState<any>(null);
  const [task, setTask]         = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [userMap, setUserMap]   = useState<Record<string, string>>({});
  const [loading, setLoading]   = useState(true);
  const [comment, setComment]   = useState('');
  const [posting, setPosting]   = useState(false);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    const u = localStorage.getItem('user');
    if (!t) { router.push('/login'); return; }
    setToken(t); if (u) setUser(JSON.parse(u));
    loadTask(t);
    fetch('http://localhost:3001/api/v1/employees', { headers: { Authorization: 'Bearer ' + t } })
      .then(r => r.json()).then(data => {
        if (Array.isArray(data)) {
          const map: Record<string,string> = {};
          data.forEach((e: any) => { map[e.id] = e.name; });
          setUserMap(map); setEmployees(data);
        }
      });
  }, [id]);

  const loadTask = async (t: string) => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/v1/tasks/' + id, { headers: { Authorization: 'Bearer ' + t } });
      const data = await res.json(); setTask(data);
      setComments(Array.isArray(data.comments) ? data.comments : []);
    } finally { setLoading(false); }
  };

  const updateField = async (field: string, value: any) => {
    setSaving(true);
    try {
      await fetch('http://localhost:3001/api/v1/tasks/' + id, {
        method:'PATCH', headers:{'Content-Type':'application/json', Authorization:'Bearer '+token},
        body: JSON.stringify({ [field]: value || null }),
      });
      loadTask(token);
    } finally { setSaving(false); }
  };

  const moveTask = async (status: string) => {
    await fetch('http://localhost:3001/api/v1/tasks/' + id + '/move', {
      method:'PATCH', headers:{'Content-Type':'application/json', Authorization:'Bearer '+token},
      body: JSON.stringify({ status }),
    });
    loadTask(token);
  };

  const postComment = async () => {
    if (!comment.trim()) return;
    setPosting(true);
    try {
      await fetch('http://localhost:3001/api/v1/tasks/' + id + '/comments', {
        method:'POST', headers:{'Content-Type':'application/json', Authorization:'Bearer '+token},
        body: JSON.stringify({ content: comment.trim() }),
      });
      setComment(''); loadTask(token);
    } finally { setPosting(false); }
  };

  if (loading) return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'200px', color:'var(--text-muted)', fontSize:'13px' }}>Загрузка...</div>;
  if (!task)   return <div style={{ padding:'24px', color:'var(--text-muted)', fontSize:'13px' }}>Задача не найдена</div>;

  const ss = STATUS_STYLE[task.status] ?? STATUS_STYLE.NEW;
  const ps = PRIORITY_STYLE[task.priority] ?? PRIORITY_STYLE.MEDIUM;
  const card: React.CSSProperties = { background:'var(--bg-primary)', border:'0.5px solid var(--border)', borderRadius:'var(--radius)', padding:'18px' };
  const inputStyle: React.CSSProperties = { width:'100%', background:'var(--bg-secondary)', border:'0.5px solid var(--border)', borderRadius:'8px', padding:'7px 10px', fontSize:'12px', color:'var(--text-primary)', outline:'none', opacity: saving ? 0.6 : 1 };

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-tertiary)' }}>
      {/* Header */}
      <div style={{ background:'var(--bg-primary)', borderBottom:'0.5px solid var(--border)', padding:'14px 24px', display:'flex', alignItems:'center', gap:'12px', position:'sticky', top:0, zIndex:10 }}>
        <button onClick={() => router.push('/dashboard/tasks')} style={{ background:'none', border:'none', cursor:'pointer', fontSize:'13px', color:'var(--text-muted)', padding:'4px 8px', borderRadius:'6px' }}>← Назад</button>
        <h1 style={{ fontSize:'15px', fontWeight:600, color:'var(--text-primary)', margin:0, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{task.title}</h1>
        <span style={{ fontSize:'11px', fontWeight:500, padding:'3px 8px', borderRadius:'20px', background:ss.bg, color:ss.color, flexShrink:0 }}>{ss.label}</span>
      </div>

      <div style={{ padding:'20px 24px', display:'grid', gridTemplateColumns:'1fr 280px', gap:'16px' }}>

        {/* Main */}
        <div style={{ display:'flex', flexDirection:'column', gap:'14px' }}>
          <div style={card}>
            <p style={{ fontSize:'12px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', margin:'0 0 10px' }}>Описание</p>
            {task.description ? (
              <p style={{ fontSize:'13px', color:'var(--text-secondary)', lineHeight:1.6, whiteSpace:'pre-wrap' }}>{task.description}</p>
            ) : (
              <p style={{ fontSize:'13px', color:'var(--text-muted)', fontStyle:'italic' }}>Описание не добавлено</p>
            )}
          </div>

          {/* Comments */}
          <div style={card}>
            <p style={{ fontSize:'12px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', margin:'0 0 14px' }}>
              Комментарии {comments.length > 0 && <span style={{ fontWeight:400, color:'var(--text-muted)' }}>({comments.length})</span>}
            </p>
            <div style={{ display:'flex', flexDirection:'column', gap:'12px', marginBottom:'16px' }}>
              {comments.length === 0 ? (
                <p style={{ textAlign:'center', fontSize:'13px', color:'var(--text-muted)', padding:'12px' }}>Комментариев пока нет</p>
              ) : comments.map((c: any, i: number) => (
                <div key={c.id ?? i} style={{ display:'flex', gap:'10px' }}>
                  <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
                    <span style={{ color:'white', fontSize:'11px', fontWeight:600 }}>{(userMap[c.authorId] ?? c.author?.name ?? '?').charAt(0)}</span>
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', alignItems:'baseline', gap:'8px', marginBottom:'4px' }}>
                      <span style={{ fontSize:'13px', fontWeight:500, color:'var(--text-primary)' }}>{userMap[c.authorId] ?? c.author?.name ?? 'Пользователь'}</span>
                      <span style={{ fontSize:'11px', color:'var(--text-muted)' }}>{new Date(c.createdAt).toLocaleString('ru',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'})}</span>
                    </div>
                    <div style={{ background:'var(--bg-secondary)', borderRadius:'8px', padding:'10px 12px', fontSize:'13px', color:'var(--text-secondary)', lineHeight:1.5 }}>{c.content}</div>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display:'flex', gap:'10px' }}>
              <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, marginTop:'2px' }}>
                <span style={{ color:'white', fontSize:'11px', fontWeight:600 }}>{user?.name?.charAt(0) ?? 'U'}</span>
              </div>
              <div style={{ flex:1 }}>
                <textarea value={comment} onChange={e => setComment(e.target.value)}
                  onKeyDown={e => { if (e.key==='Enter' && (e.metaKey||e.ctrlKey)) postComment(); }}
                  placeholder="Написать комментарий... (Cmd+Enter)" rows={3}
                  style={{ width:'100%', background:'var(--bg-secondary)', border:'0.5px solid var(--border)', borderRadius:'8px', padding:'10px 12px', fontSize:'13px', color:'var(--text-primary)', outline:'none', resize:'none', fontFamily:'inherit' }} />
                <div style={{ display:'flex', justifyContent:'flex-end', marginTop:'6px' }}>
                  <button onClick={postComment} disabled={posting || !comment.trim()}
                    style={{ background:'var(--accent)', color:'white', border:'none', padding:'7px 14px', borderRadius:'8px', fontSize:'12px', fontWeight:500, cursor:'pointer', opacity: posting||!comment.trim() ? 0.5 : 1 }}>
                    {posting ? 'Отправляю...' : 'Отправить'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>

          {/* Status actions */}
          <div style={card}>
            <p style={{ fontSize:'12px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', margin:'0 0 10px' }}>Статус</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
              {task.status==='NEW' && <button onClick={() => moveTask('IN_PROGRESS')} style={{ padding:'8px', borderRadius:'8px', border:'none', background:'var(--blue-bg)', color:'var(--blue)', fontSize:'12px', fontWeight:500, cursor:'pointer' }}>▶ Взять в работу</button>}
              {task.status==='IN_PROGRESS' && <button onClick={() => moveTask('REVIEW')} style={{ padding:'8px', borderRadius:'8px', border:'none', background:'var(--orange-bg)', color:'var(--orange)', fontSize:'12px', fontWeight:500, cursor:'pointer' }}>👁 На проверку</button>}
              {task.status==='REVIEW' && <button onClick={() => moveTask('DONE')} style={{ padding:'8px', borderRadius:'8px', border:'none', background:'var(--green-bg)', color:'var(--green)', fontSize:'12px', fontWeight:500, cursor:'pointer' }}>✓ Завершить</button>}
              {task.status!=='NEW' && task.status!=='DONE' && <button onClick={() => moveTask('BLOCKED')} style={{ padding:'8px', borderRadius:'8px', border:'none', background:'var(--red-bg)', color:'var(--red)', fontSize:'12px', fontWeight:500, cursor:'pointer' }}>🚫 Заблокировать</button>}
            </div>
          </div>

          {/* Details */}
          <div style={card}>
            <p style={{ fontSize:'12px', fontWeight:600, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.05em', margin:'0 0 12px' }}>Детали</p>
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              <div>
                <p style={{ fontSize:'11px', color:'var(--text-muted)', margin:'0 0 5px' }}>Приоритет</p>
                <span style={{ fontSize:'11px', fontWeight:500, padding:'3px 8px', borderRadius:'12px', background:ps.bg, color:ps.color }}>{ps.label}</span>
              </div>
              <div>
                <p style={{ fontSize:'11px', color:'var(--text-muted)', margin:'0 0 5px' }}>Исполнитель</p>
                <select value={task.assigneeId ?? ''} onChange={e => updateField('assigneeId', e.target.value)} disabled={saving} style={inputStyle}>
                  <option value="">Не назначен</option>
                  {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              </div>
              <div>
                <p style={{ fontSize:'11px', color:'var(--text-muted)', margin:'0 0 5px' }}>Дедлайн</p>
                <input type="date" value={task.dueDate ? task.dueDate.slice(0,10) : ''} onChange={e => updateField('dueDate', e.target.value)} disabled={saving} style={inputStyle} />
                {task.dueDate && (
                  <p style={{ fontSize:'11px', margin:'4px 0 0', color: new Date(task.dueDate)<new Date() ? 'var(--red)' : new Date(task.dueDate)<new Date(Date.now()+3*864e5) ? 'var(--yellow)' : 'var(--green)' }}>
                    {new Date(task.dueDate)<new Date() ? '⚠ Просрочено' : new Date(task.dueDate)<new Date(Date.now()+3*864e5) ? '⏰ Скоро' : '✓ '+new Date(task.dueDate).toLocaleDateString('ru',{day:'numeric',month:'long'})}
                  </p>
                )}
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', fontSize:'12px', paddingTop:'8px', borderTop:'0.5px solid var(--border)' }}>
                <span style={{ color:'var(--text-muted)' }}>Создана</span>
                <span style={{ color:'var(--text-secondary)' }}>{new Date(task.createdAt).toLocaleDateString('ru')}</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
