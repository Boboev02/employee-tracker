'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = 'https://employee-tracker.ru';
type NoteStatus   = 'ACTIVE' | 'DONE' | 'DEFERRED' | 'ARCHIVED';
type NotePriority = 'LOW' | 'MEDIUM' | 'HIGH';
interface Note {
  id: string; title: string; content: string;
  status: NoteStatus; priority: NotePriority;
  isPinned: boolean; remindAt: string | null;
  color?: string;
  createdAt: string; updatedAt: string;
}

const COLORS = ['#ffffff','#EDE9FE','#DCFCE7','#FEF3C7','#FEE2E2','#DBEAFE','#FCE7F3','#F3F4F6'];
const COLOR_NAMES: Record<string,string> = {
  '#ffffff':'Белый','#EDE9FE':'Фиолетовый','#DCFCE7':'Зелёный',
  '#FEF3C7':'Жёлтый','#FEE2E2':'Красный','#DBEAFE':'Синий',
  '#FCE7F3':'Розовый','#F3F4F6':'Серый',
};
const PRIORITY_COLOR: Record<NotePriority,string> = { LOW:'#9B97CC', MEDIUM:'#D97706', HIGH:'#DC2626' };
const PRIORITY_LABEL: Record<NotePriority,string> = { LOW:'Низкий', MEDIUM:'Средний', HIGH:'Высокий' };
const PRIORITY_BG:    Record<NotePriority,string> = { LOW:'#EDE9FE', MEDIUM:'#FEF3C7', HIGH:'#FEE2E2' };

function fmtDate(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString('ru', { day:'numeric', month:'short' });
}
function isToday(s: string | null) {
  if (!s) return false;
  const d = new Date(s), n = new Date();
  return d.getDate()===n.getDate() && d.getMonth()===n.getMonth() && d.getFullYear()===n.getFullYear();
}

export default function NotebookPage() {
  const router = useRouter();
  const [token, setToken]       = useState('');
  const [notes, setNotes]       = useState<Note[]>([]);
  const [tab, setTab]           = useState<'active'|'done'|'archived'>('active');
  const [search, setSearch]     = useState('');
  const [editId, setEditId]     = useState<string|null>(null);
  const [editData, setEditData] = useState<Partial<Note>>({});
  const [newNote, setNewNote]   = useState({ title:'', content:'', priority:'MEDIUM' as NotePriority, color:'#ffffff', remindAt:'' });
  const [showNew, setShowNew]   = useState(false);
  const [hoverId, setHoverId]   = useState<string|null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t); load(t);
  }, []);

  useEffect(() => { if (token) load(); }, [tab, search]);

  const load = async (t?: string) => {
    const tk = t || token; if (!tk) return;
    try {
      const params = tab === 'done' ? '?status=DONE' : tab === 'archived' ? '?status=ARCHIVED' : '';
      const q = search ? (params ? '&' : '?') + `search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`${API}/api/v1/notes${params}${q}`, { headers:{ Authorization:`Bearer ${tk}` }});
      if (res.ok) setNotes(await res.json());
    } catch {}
  };

  const create = async () => {
    if (!newNote.title.trim()) return;
    try {
      const res = await fetch(`${API}/api/v1/notes`, {
        method:'POST', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
        body: JSON.stringify({ title:newNote.title, content:newNote.content, priority:newNote.priority,
          status:'ACTIVE', isPinned:false, color:newNote.color,
          remindAt: newNote.remindAt || null }),
      });
      if (res.ok) { setNewNote({title:'',content:'',priority:'MEDIUM',color:'#ffffff',remindAt:''}); setShowNew(false); load(); }
    } catch {}
  };

  const update = async (id: string, data: Partial<Note>) => {
    try {
      const res = await fetch(`${API}/api/v1/notes/${id}`, {
        method:'PATCH', headers:{'Content-Type':'application/json', Authorization:`Bearer ${token}`},
        body: JSON.stringify(data),
      });
      if (res.ok) load();
    } catch {}
  };

  const del = async (id: string) => {
    if (!confirm('Удалить заметку?')) return;
    try { await fetch(`${API}/api/v1/notes/${id}`, { method:'DELETE', headers:{ Authorization:`Bearer ${token}` }}); load(); } catch {}
  };

  const saveEdit = async () => {
    if (!editId) return;
    await update(editId, editData);
    setEditId(null); setEditData({});
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key==='Enter' && (e.metaKey || e.ctrlKey)) create();
    if (e.key==='Escape') { setShowNew(false); setNewNote({title:'',content:'',priority:'MEDIUM',color:'#ffffff',remindAt:''}); }
  };

  // Группировка
  const pinned  = notes.filter(n => n.isPinned);
  const remind  = notes.filter(n => !n.isPinned && isToday(n.remindAt));
  const rest    = notes.filter(n => !n.isPinned && !isToday(n.remindAt));

  const card: React.CSSProperties = { background:'white', borderRadius:'20px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' };

  // Pinterest card component
  const PinCard = ({ note }: { note: Note }) => {
    const isEdit = editId === note.id;
    const bg = note.color || '#ffffff';
    const isHover = hoverId === note.id;

    return (
      <div onMouseEnter={() => setHoverId(note.id)} onMouseLeave={() => setHoverId(null)}
        style={{ background: bg, borderRadius:'16px', padding:'16px', marginBottom:'12px', boxShadow: isHover ? '0 8px 24px rgba(127,119,221,0.16)' : '0 2px 8px rgba(0,0,0,0.06)', transition:'all 0.2s', border: note.isPinned ? '2px solid #7F77DD' : '1.5px solid rgba(0,0,0,0.06)', cursor:'pointer', breakInside:'avoid' }}>

        {isEdit ? (
          <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
            <input value={editData.title ?? note.title} onChange={e=>setEditData(p=>({...p,title:e.target.value}))}
              style={{fontSize:'14px',fontWeight:700,border:'1.5px solid #EDE9FE',borderRadius:'10px',padding:'8px 12px',outline:'none',color:'#1a1040',background:'rgba(255,255,255,0.8)'}}/>
            <textarea value={editData.content ?? note.content ?? ''} onChange={e=>setEditData(p=>({...p,content:e.target.value}))}
              rows={4} style={{fontSize:'13px',border:'1.5px solid #EDE9FE',borderRadius:'10px',padding:'8px 12px',outline:'none',resize:'vertical',color:'#6B7280',fontFamily:'inherit',background:'rgba(255,255,255,0.8)'}}
              placeholder="Текст заметки..."/>
            <div style={{display:'flex',gap:'6px'}}>
              {(['LOW','MEDIUM','HIGH'] as NotePriority[]).map(p => (
                <button key={p} onClick={()=>setEditData(x=>({...x,priority:p}))}
                  style={{flex:1,padding:'6px',borderRadius:'8px',fontSize:'11px',fontWeight:(editData.priority??note.priority)===p?700:400,border:'none',cursor:'pointer',background:(editData.priority??note.priority)===p?PRIORITY_BG[p]:'#F8F7FF',color:(editData.priority??note.priority)===p?PRIORITY_COLOR[p]:'#9B97CC'}}>
                  {PRIORITY_LABEL[p]}
                </button>
              ))}
            </div>
            <div style={{display:'flex',gap:'4px',flexWrap:'wrap'}}>
              {COLORS.map(c=>(
                <div key={c} onClick={()=>setEditData(p=>({...p,color:c}))}
                  style={{width:'24px',height:'24px',borderRadius:'50%',background:c,border:(editData.color??note.color??'#ffffff')===c?'2.5px solid #7F77DD':'1.5px solid rgba(0,0,0,0.1)',cursor:'pointer',transition:'transform 0.1s',transform:(editData.color??note.color??'#ffffff')===c?'scale(1.2)':'scale(1)'}}/>
              ))}
            </div>
            <input type="datetime-local" value={editData.remindAt!==undefined ? (editData.remindAt?.slice(0,16)??'') : (note.remindAt?.slice(0,16)??'')}
              onChange={e=>setEditData(p=>({...p,remindAt:e.target.value||null}))}
              style={{border:'1.5px solid #EDE9FE',borderRadius:'8px',padding:'6px 10px',fontSize:'12px',outline:'none'}}/>
            <div style={{display:'flex',gap:'8px'}}>
              <button onClick={saveEdit} style={{flex:1,background:'linear-gradient(135deg,#7F77DD,#5248C5)',color:'white',border:'none',borderRadius:'10px',padding:'10px',fontSize:'13px',fontWeight:700,cursor:'pointer'}}>Сохранить</button>
              <button onClick={()=>{setEditId(null);setEditData({});}} style={{padding:'10px 14px',background:'#F8F7FF',color:'#9B97CC',border:'none',borderRadius:'10px',fontSize:'13px',cursor:'pointer'}}>✕</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'8px'}}>
              <div style={{display:'flex',alignItems:'center',gap:'8px',flex:1}}>
                <input type="checkbox" checked={note.status==='DONE'}
                  onChange={e=>update(note.id,{status:e.target.checked?'DONE':'ACTIVE'})}
                  style={{width:'16px',height:'16px',accentColor:'#7F77DD',cursor:'pointer',flexShrink:0}}/>
                <p style={{fontSize:'14px',fontWeight:700,color:note.status==='DONE'?'#9B97CC':'#1a1040',margin:0,textDecoration:note.status==='DONE'?'line-through':'none',lineHeight:1.3}}>
                  {note.isPinned && <span style={{marginRight:'4px'}}>📌</span>}
                  {note.title}
                </p>
              </div>
            </div>

            {note.content && <p style={{fontSize:'13px',color:'#6B7280',margin:'0 0 10px 24px',lineHeight:1.6,whiteSpace:'pre-wrap'}}>{note.content}</p>}

            <div style={{display:'flex',alignItems:'center',gap:'6px',flexWrap:'wrap',marginLeft:'24px',marginBottom:'10px'}}>
              <span style={{fontSize:'10px',fontWeight:600,color:PRIORITY_COLOR[note.priority],background:PRIORITY_BG[note.priority],padding:'2px 8px',borderRadius:'20px'}}>{PRIORITY_LABEL[note.priority]}</span>
              {note.remindAt && <span style={{fontSize:'10px',color:isToday(note.remindAt)?'#DC2626':'#9B97CC',background:isToday(note.remindAt)?'#FEE2E2':'rgba(0,0,0,0.05)',padding:'2px 8px',borderRadius:'20px'}}>⏰ {fmtDate(note.remindAt)}</span>}
              <span style={{fontSize:'10px',color:'#C4C0E8',marginLeft:'auto'}}>{fmtDate(note.updatedAt)}</span>
            </div>

            <div style={{display:'flex',gap:'4px',opacity:isHover?1:0,transition:'opacity 0.2s',marginLeft:'24px'}}>
              <button onClick={()=>{setEditId(note.id);setEditData({});}} title="Редактировать"
                style={{padding:'5px 8px',borderRadius:'8px',border:'none',background:'rgba(127,119,221,0.1)',color:'#7F77DD',cursor:'pointer',fontSize:'12px'}}>✏️</button>
              <button onClick={()=>update(note.id,{isPinned:!note.isPinned})} title={note.isPinned?'Открепить':'Закрепить'}
                style={{padding:'5px 8px',borderRadius:'8px',border:'none',background:'rgba(0,0,0,0.05)',color:'#6B7280',cursor:'pointer',fontSize:'12px'}}>📌</button>
              <button onClick={()=>update(note.id,{status:'ARCHIVED'})} title="В архив"
                style={{padding:'5px 8px',borderRadius:'8px',border:'none',background:'rgba(0,0,0,0.05)',color:'#6B7280',cursor:'pointer',fontSize:'12px'}}>📦</button>
              <button onClick={()=>del(note.id)} title="Удалить"
                style={{padding:'5px 8px',borderRadius:'8px',border:'none',background:'rgba(220,38,38,0.1)',color:'#DC2626',cursor:'pointer',fontSize:'12px'}}>🗑</button>
            </div>
          </>
        )}
      </div>
    );
  };

  const MasonryGrid = ({ items }: { items: Note[] }) => (
    <div style={{ columns:'3 280px', columnGap:'12px' }}>
      {items.map(n => <PinCard key={n.id} note={n}/>)}
    </div>
  );

  return (
    <div style={{minHeight:'100vh',background:'#ECEAF8'}}>

      {/* Header */}
      <div style={{background:'white',padding:'14px 28px',display:'flex',alignItems:'center',gap:'16px',position:'sticky',top:0,zIndex:10,boxShadow:'0 4px 16px rgba(127,119,221,0.06)'}}>
        <div style={{flex:1}}>
          <h1 style={{fontSize:'18px',fontWeight:800,color:'#1a1040',margin:0}}>📓 Мой блокнот</h1>
          <p style={{fontSize:'11px',color:'#9B97CC',margin:'2px 0 0'}}>{notes.length} заметок · только вы видите это пространство</p>
        </div>

        {/* Поиск */}
        <div style={{display:'flex',alignItems:'center',gap:'8px',background:'#F8F7FF',borderRadius:'20px',padding:'8px 16px',flex:1,maxWidth:'320px'}}>
          <i className="ti ti-search" style={{fontSize:'14px',color:'#9B97CC'}} aria-hidden="true"/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск..."
            style={{border:'none',outline:'none',fontSize:'13px',color:'#1a1040',background:'transparent',flex:1}}/>
          {search && <button onClick={()=>setSearch('')} style={{background:'none',border:'none',color:'#9B97CC',cursor:'pointer',padding:0,fontSize:'14px'}}>✕</button>}
        </div>

        {/* Табы */}
        <div style={{display:'flex',gap:'3px',background:'#F8F7FF',borderRadius:'20px',padding:'3px'}}>
          {([['active','📝 Активные'],['done','✅ Выполненные'],['archived','📦 Архив']] as const).map(([id,lbl])=>(
            <button key={id} onClick={()=>setTab(id)} style={{padding:'7px 14px',borderRadius:'18px',fontSize:'12px',fontWeight:tab===id?700:500,border:'none',cursor:'pointer',background:tab===id?'linear-gradient(135deg,#7F77DD,#5248C5)':'transparent',color:tab===id?'white':'#9B97CC',transition:'all 0.2s'}}>{lbl}</button>
          ))}
        </div>
      </div>

      <div style={{padding:'20px 28px'}}>

        {/* Быстрое создание — Pinterest стиль */}
        {!showNew ? (
          <div onClick={()=>{setShowNew(true);setTimeout(()=>titleRef.current?.focus(),50);}}
            style={{background:'white',borderRadius:'20px',padding:'16px 20px',boxShadow:'0 2px 8px rgba(0,0,0,0.06)',border:'1.5px dashed #EDE9FE',cursor:'pointer',display:'flex',alignItems:'center',gap:'12px',marginBottom:'20px',transition:'all 0.2s',maxWidth:'600px',margin:'0 auto 20px'}}>
            <div style={{width:'36px',height:'36px',borderRadius:'12px',background:'linear-gradient(135deg,#7F77DD,#5248C5)',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,boxShadow:'0 4px 10px rgba(127,119,221,0.3)'}}>
              <i className="ti ti-plus" style={{fontSize:'18px',color:'white'}} aria-hidden="true"/>
            </div>
            <span style={{fontSize:'14px',color:'#9B97CC'}}>Создать заметку... <span style={{fontSize:'11px',color:'#C4C0E8'}}>(⌘+Enter для сохранения)</span></span>
          </div>
        ) : (
          <div style={{background:'white',borderRadius:'20px',padding:'20px',boxShadow:'0 8px 32px rgba(127,119,221,0.16)',border:'1.5px solid #7F77DD',marginBottom:'20px',maxWidth:'600px',margin:'0 auto 20px'}} onKeyDown={handleKey}>
            <div style={{display:'flex',gap:'8px',marginBottom:'12px',flexWrap:'wrap'}}>
              {COLORS.map(c=>(
                <div key={c} onClick={()=>setNewNote(p=>({...p,color:c}))}
                  style={{width:'26px',height:'26px',borderRadius:'50%',background:c,border:newNote.color===c?'3px solid #7F77DD':'1.5px solid rgba(0,0,0,0.1)',cursor:'pointer',transition:'transform 0.1s',transform:newNote.color===c?'scale(1.2)':'scale(1)'}}/>
              ))}
            </div>
            <input ref={titleRef} value={newNote.title} onChange={e=>setNewNote(p=>({...p,title:e.target.value}))}
              placeholder="Заголовок заметки *"
              style={{width:'100%',fontSize:'16px',fontWeight:700,border:'none',outline:'none',color:'#1a1040',background:'transparent',marginBottom:'10px',boxSizing:'border-box'}}/>
            <textarea value={newNote.content} onChange={e=>setNewNote(p=>({...p,content:e.target.value}))}
              placeholder="Добавить текст... (необязательно)" rows={3}
              style={{width:'100%',fontSize:'14px',border:'none',outline:'none',resize:'none',color:'#6B7280',fontFamily:'inherit',background:'transparent',marginBottom:'12px',boxSizing:'border-box'}}/>
            <div style={{display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap'}}>
              <div style={{display:'flex',gap:'4px'}}>
                {(['LOW','MEDIUM','HIGH'] as NotePriority[]).map(p=>(
                  <button key={p} onClick={()=>setNewNote(x=>({...x,priority:p}))}
                    style={{padding:'5px 10px',borderRadius:'20px',fontSize:'11px',fontWeight:newNote.priority===p?700:400,border:'none',cursor:'pointer',background:newNote.priority===p?PRIORITY_BG[p]:'#F8F7FF',color:newNote.priority===p?PRIORITY_COLOR[p]:'#9B97CC',transition:'all 0.15s'}}>
                    {PRIORITY_LABEL[p]}
                  </button>
                ))}
              </div>
              <input type="datetime-local" value={newNote.remindAt} onChange={e=>setNewNote(p=>({...p,remindAt:e.target.value}))}
                style={{border:'1px solid #EDE9FE',borderRadius:'8px',padding:'5px 8px',fontSize:'12px',outline:'none',color:'#6B7280'}}/>
              <div style={{marginLeft:'auto',display:'flex',gap:'8px'}}>
                <button onClick={()=>{setShowNew(false);setNewNote({title:'',content:'',priority:'MEDIUM',color:'#ffffff',remindAt:''});}}
                  style={{padding:'8px 14px',borderRadius:'10px',border:'none',background:'#F8F7FF',color:'#9B97CC',cursor:'pointer',fontSize:'13px'}}>Отмена</button>
                <button onClick={create} disabled={!newNote.title.trim()}
                  style={{padding:'8px 20px',borderRadius:'10px',border:'none',background:'linear-gradient(135deg,#7F77DD,#5248C5)',color:'white',cursor:'pointer',fontSize:'13px',fontWeight:700,opacity:newNote.title.trim()?1:0.5,boxShadow:'0 4px 10px rgba(127,119,221,0.3)'}}>Сохранить ⌘↵</button>
              </div>
            </div>
          </div>
        )}

        {/* Сетка заметок Pinterest */}
        {tab === 'active' && (
          <>
            {pinned.length > 0 && (
              <div style={{marginBottom:'24px'}}>
                <p style={{fontSize:'11px',fontWeight:700,color:'#9B97CC',textTransform:'uppercase',letterSpacing:'0.5px',margin:'0 0 12px',display:'flex',alignItems:'center',gap:'6px'}}>
                  📌 Закреплённые · {pinned.length}
                </p>
                <MasonryGrid items={pinned}/>
              </div>
            )}
            {remind.length > 0 && (
              <div style={{marginBottom:'24px'}}>
                <p style={{fontSize:'11px',fontWeight:700,color:'#DC2626',textTransform:'uppercase',letterSpacing:'0.5px',margin:'0 0 12px',display:'flex',alignItems:'center',gap:'6px'}}>
                  ⏰ Напоминания сегодня · {remind.length}
                </p>
                <MasonryGrid items={remind}/>
              </div>
            )}
            {rest.length > 0 && (
              <div>
                {(pinned.length > 0 || remind.length > 0) && (
                  <p style={{fontSize:'11px',fontWeight:700,color:'#9B97CC',textTransform:'uppercase',letterSpacing:'0.5px',margin:'0 0 12px',display:'flex',alignItems:'center',gap:'6px'}}>
                    📝 Остальные · {rest.length}
                  </p>
                )}
                <MasonryGrid items={rest}/>
              </div>
            )}
            {notes.length === 0 && (
              <div style={{textAlign:'center',padding:'80px 20px'}}>
                <div style={{fontSize:'64px',marginBottom:'16px'}}>📓</div>
                <p style={{fontSize:'18px',fontWeight:700,color:'#1a1040',margin:'0 0 8px'}}>Блокнот пуст</p>
                <p style={{fontSize:'14px',color:'#9B97CC',margin:'0 0 20px'}}>Нажмите на поле выше чтобы создать первую заметку</p>
                <button onClick={()=>{setShowNew(true);setTimeout(()=>titleRef.current?.focus(),50);}}
                  style={{background:'linear-gradient(135deg,#7F77DD,#5248C5)',color:'white',border:'none',borderRadius:'20px',padding:'12px 28px',fontSize:'14px',fontWeight:700,cursor:'pointer',boxShadow:'0 4px 16px rgba(127,119,221,0.3)'}}>
                  + Создать первую заметку
                </button>
              </div>
            )}
          </>
        )}
        {(tab === 'done' || tab === 'archived') && (
          notes.length === 0
            ? <div style={{textAlign:'center',padding:'60px'}}><p style={{color:'#9B97CC',fontSize:'14px'}}>Нет записей</p></div>
            : <MasonryGrid items={notes}/>
        )}
      </div>

      {/* Floating button */}
      {!showNew && (
        <button onClick={()=>{setShowNew(true);setTimeout(()=>titleRef.current?.focus(),50);}}
          style={{position:'fixed',bottom:'28px',right:'28px',width:'56px',height:'56px',borderRadius:'50%',background:'linear-gradient(135deg,#7F77DD,#5248C5)',color:'white',border:'none',fontSize:'24px',cursor:'pointer',boxShadow:'0 8px 24px rgba(127,119,221,0.4)',display:'flex',alignItems:'center',justifyContent:'center',transition:'transform 0.2s',zIndex:100}}
          onMouseEnter={e=>(e.currentTarget.style.transform='scale(1.1)')}
          onMouseLeave={e=>(e.currentTarget.style.transform='scale(1)')}>
          <i className="ti ti-plus" style={{fontSize:'22px'}} aria-hidden="true"/>
        </button>
      )}
    </div>
  );
}
