'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';

const API = 'https://employee-tracker.ru/api/v1';
const EMOJIS = ['🏢','🛍️','📊','🧩','⚙️','🎯','📁','💼','🚀','⭐','🔥','💡','📋','🗂️','🎨'];

export default function SidebarSettingsPage() {
  const router = useRouter();
  const [config, setConfig] = useState<any>(null);
  const [allSections, setAllSections] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [editingGroup, setEditingGroup] = useState<string|null>(null);
  const [newGroupName, setNewGroupName] = useState('');
  const [newGroupEmoji, setNewGroupEmoji] = useState('📁');
  const [showAddGroup, setShowAddGroup] = useState(false);
  const [showEmojiPicker, setShowEmojiPicker] = useState<string|null>(null);
  const dragItem = useRef<{type:'group'|'item'; groupId:string; index:number}|null>(null);
  const dragOverItem = useRef<{type:'group'|'item'; groupId:string; index:number}|null>(null);

  const h = () => ({ 'Content-Type':'application/json', Authorization:'Bearer '+(localStorage.getItem('access_token')||'') });

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    load();
  }, []);

  const load = async () => {
    setLoading(true);
    try {
      const res = await fetch(API+'/users/sidebar', { headers: h() });
      const data = await res.json();
      setConfig(data.config);
      setAllSections(data.allSections ?? []);
    } catch {}
    setLoading(false);
  };

  const save = async () => {
    setSaving(true);
    try {
      await fetch(API+'/users/sidebar', { method:'PUT', headers:h(), body:JSON.stringify({ config }) });
      setSaved(true);
      setTimeout(()=>setSaved(false), 2000);
      // Reload page to apply new sidebar
      window.location.href = '/dashboard';
    } catch {}
    setSaving(false);
  };

  const reset = async () => {
    if (!confirm('Сбросить сайдбар к настройкам по умолчанию?')) return;
    const res = await fetch(API+'/users/sidebar/reset', { headers: h() });
    const data = await res.json();
    setConfig(data.config);
  };

  const addGroup = () => {
    if (!newGroupName.trim()) return;
    const id = 'group_'+Date.now();
    setConfig((c:any) => ({ ...c, groups: [...c.groups, { id, label:newGroupName.trim(), emoji:newGroupEmoji, collapsed:false, items:[] }] }));
    setNewGroupName(''); setShowAddGroup(false);
  };

  const deleteGroup = (groupId: string) => {
    if (!confirm('Удалить группу? Разделы не удалятся.')) return;
    setConfig((c:any) => ({ ...c, groups: c.groups.filter((g:any)=>g.id!==groupId) }));
  };

  const toggleCollapsed = (groupId: string) => {
    setConfig((c:any) => ({ ...c, groups: c.groups.map((g:any)=>g.id===groupId?{...g,collapsed:!g.collapsed}:g) }));
  };

  const renameGroup = (groupId: string, label: string) => {
    setConfig((c:any) => ({ ...c, groups: c.groups.map((g:any)=>g.id===groupId?{...g,label}:g) }));
  };

  const setGroupEmoji = (groupId: string, emoji: string) => {
    setConfig((c:any) => ({ ...c, groups: c.groups.map((g:any)=>g.id===groupId?{...g,emoji}:g) }));
    setShowEmojiPicker(null);
  };

  const removeItem = (groupId: string, itemId: string) => {
    setConfig((c:any) => ({ ...c, groups: c.groups.map((g:any)=>g.id===groupId?{...g,items:g.items.filter((i:string)=>i!==itemId)}:g) }));
  };

  const addItemToGroup = (groupId: string, itemId: string) => {
    setConfig((c:any) => {
      const already = c.groups.some((g:any)=>g.items.includes(itemId));
      if (already) return c;
      return { ...c, groups: c.groups.map((g:any)=>g.id===groupId?{...g,items:[...g.items,itemId]}:g) };
    });
  };

  // Drag handlers for items
  const handleDragStart = (type: 'group'|'item', groupId: string, index: number) => {
    dragItem.current = { type, groupId, index };
  };

  const handleDragOver = (e: React.DragEvent, type: 'group'|'item', groupId: string, index: number) => {
    e.preventDefault();
    dragOverItem.current = { type, groupId, index };
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    if (!dragItem.current || !dragOverItem.current) return;
    const from = dragItem.current;
    const to = dragOverItem.current;

    if (from.type === 'group' && to.type === 'group') {
      setConfig((c:any) => {
        const groups = [...c.groups];
        const [moved] = groups.splice(from.index, 1);
        groups.splice(to.index, 0, moved);
        return { ...c, groups };
      });
    } else if (from.type === 'item' && to.type === 'item' && from.groupId === to.groupId) {
      setConfig((c:any) => ({
        ...c,
        groups: c.groups.map((g:any) => {
          if (g.id !== from.groupId) return g;
          const items = [...g.items];
          const [moved] = items.splice(from.index, 1);
          items.splice(to.index, 0, moved);
          return { ...g, items };
        }),
      }));
    } else if (from.type === 'item' && to.type === 'item' && from.groupId !== to.groupId) {
      setConfig((c:any) => ({
        ...c,
        groups: c.groups.map((g:any) => {
          if (g.id === from.groupId) return { ...g, items: g.items.filter((_:any,i:number)=>i!==from.index) };
          if (g.id === to.groupId) {
            const items = [...g.items];
            const itemId = c.groups.find((x:any)=>x.id===from.groupId)?.items[from.index];
            if (itemId && !items.includes(itemId)) items.splice(to.index, 0, itemId);
            return { ...g, items };
          }
          return g;
        }),
      }));
    }
    dragItem.current = null;
    dragOverItem.current = null;
  };

  const usedItems = config?.groups?.flatMap((g:any)=>g.items) ?? [];
  const unusedSections = allSections.filter(s=>!usedItems.includes(s.id));

  const card: React.CSSProperties = { background:'white', borderRadius:'16px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)' };
  const inp: React.CSSProperties = { background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'10px', padding:'8px 12px', fontSize:'13px', outline:'none', width:'100%', boxSizing:'border-box' };

  if (loading) return <div style={{padding:'40px',textAlign:'center',color:'#9B97CC'}}>Загрузка...</div>;

  return (
    <div style={{minHeight:'100vh',background:'#ECEAF8'}}>
      <div style={{background:'white',padding:'14px 28px',display:'flex',alignItems:'center',justifyContent:'space-between',position:'sticky',top:0,zIndex:10,boxShadow:'0 4px 16px rgba(127,119,221,0.06)'}}>
        <div>
          <h1 style={{fontSize:'18px',fontWeight:800,color:'#1a1040',margin:0}}>Настройка сайдбара</h1>
          <p style={{fontSize:'11px',color:'#9B97CC',margin:'2px 0 0'}}>Создавайте группы и перетаскивайте разделы</p>
        </div>
        <div style={{display:'flex',gap:'8px'}}>
          <button onClick={reset} style={{background:'#F8F7FF',color:'#9B97CC',border:'1px solid #EDE9FE',borderRadius:'10px',padding:'8px 16px',fontSize:'12px',cursor:'pointer',fontWeight:600}}>
            Сбросить
          </button>
          <button onClick={save} disabled={saving}
            style={{background:'linear-gradient(135deg,#7F77DD,#5248C5)',color:'white',border:'none',borderRadius:'10px',padding:'8px 20px',fontSize:'13px',fontWeight:700,cursor:'pointer',opacity:saving?0.7:1}}>
            {saved ? '✓ Сохранено!' : saving ? 'Сохранение...' : 'Сохранить и применить'}
          </button>
        </div>
      </div>

      <div style={{padding:'20px 28px',display:'grid',gridTemplateColumns:'1fr 280px',gap:'20px',maxWidth:'1100px'}}>
        <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <p style={{fontSize:'13px',fontWeight:700,color:'#1a1040',margin:0}}>Группы ({config?.groups?.length??0})</p>
            <button onClick={()=>setShowAddGroup(true)}
              style={{background:'linear-gradient(135deg,#7F77DD,#5248C5)',color:'white',border:'none',borderRadius:'10px',padding:'7px 16px',fontSize:'12px',fontWeight:700,cursor:'pointer'}}>
              + Новая группа
            </button>
          </div>

          {showAddGroup && (
            <div style={{...card,padding:'16px'}}>
              <p style={{fontSize:'13px',fontWeight:700,color:'#1a1040',margin:'0 0 12px'}}>Новая группа</p>
              <div style={{display:'flex',gap:'8px',marginBottom:'10px'}}>
                <button onClick={()=>setShowEmojiPicker('new')} style={{background:'#F8F7FF',border:'1px solid #EDE9FE',borderRadius:'10px',padding:'8px 12px',fontSize:'20px',cursor:'pointer'}}>
                  {newGroupEmoji}
                </button>
                <input placeholder="Название группы..." value={newGroupName} onChange={e=>setNewGroupName(e.target.value)}
                  onKeyDown={e=>e.key==='Enter'&&addGroup()} style={{...inp,flex:1}} autoFocus />
              </div>
              {showEmojiPicker==='new' && (
                <div style={{display:'flex',flexWrap:'wrap',gap:'6px',marginBottom:'10px',background:'#F8F7FF',borderRadius:'10px',padding:'10px'}}>
                  {EMOJIS.map(em=>(
                    <button key={em} onClick={()=>{setNewGroupEmoji(em);setShowEmojiPicker(null);}}
                      style={{background:newGroupEmoji===em?'#EDE9FE':'transparent',border:'none',borderRadius:'8px',padding:'4px 8px',fontSize:'18px',cursor:'pointer'}}>
                      {em}
                    </button>
                  ))}
                </div>
              )}
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={addGroup} disabled={!newGroupName.trim()}
                  style={{background:'linear-gradient(135deg,#7F77DD,#5248C5)',color:'white',border:'none',borderRadius:'10px',padding:'8px 18px',fontSize:'13px',fontWeight:700,cursor:'pointer',opacity:!newGroupName.trim()?0.6:1}}>
                  Создать
                </button>
                <button onClick={()=>{setShowAddGroup(false);setNewGroupName('');}} style={{background:'white',color:'#9B97CC',border:'1px solid #EDE9FE',borderRadius:'10px',padding:'8px 14px',fontSize:'13px',cursor:'pointer'}}>Отмена</button>
              </div>
            </div>
          )}

          {config?.groups?.map((group:any, groupIdx:number) => (
            <div key={group.id} style={{...card,overflow:'hidden'}}
              draggable onDragStart={()=>handleDragStart('group',group.id,groupIdx)}
              onDragOver={e=>handleDragOver(e,'group',group.id,groupIdx)}
              onDrop={handleDrop}>
              <div style={{display:'flex',alignItems:'center',gap:'10px',padding:'12px 16px',borderBottom:'1px solid #F8F7FF',cursor:'grab',background:'#FAFAFE'}}>
                <span style={{fontSize:'16px',cursor:'pointer'}} onClick={()=>setShowEmojiPicker(showEmojiPicker===group.id?null:group.id)}>
                  {group.emoji??'📁'}
                </span>
                {editingGroup===group.id ? (
                  <input value={group.label} onChange={e=>renameGroup(group.id,e.target.value)}
                    onBlur={()=>setEditingGroup(null)} onKeyDown={e=>e.key==='Enter'&&setEditingGroup(null)}
                    style={{...inp,flex:1,padding:'4px 8px',fontSize:'13px'}} autoFocus />
                ) : (
                  <span style={{fontSize:'13px',fontWeight:700,color:'#1a1040',flex:1,cursor:'text'}} onDoubleClick={()=>setEditingGroup(group.id)}>
                    {group.label}
                  </span>
                )}
                <button onClick={()=>toggleCollapsed(group.id)} style={{background:'none',border:'none',color:'#9B97CC',cursor:'pointer',fontSize:'13px'}}>
                  {group.collapsed?'▶':'▼'}
                </button>
                <button onClick={()=>deleteGroup(group.id)} style={{background:'none',border:'none',color:'#EF4444',cursor:'pointer',fontSize:'14px'}}>🗑️</button>
              </div>

              {showEmojiPicker===group.id && (
                <div style={{display:'flex',flexWrap:'wrap',gap:'6px',padding:'10px 16px',borderBottom:'1px solid #F8F7FF',background:'#F8F7FF'}}>
                  {EMOJIS.map(em=>(
                    <button key={em} onClick={()=>setGroupEmoji(group.id,em)}
                      style={{background:group.emoji===em?'#EDE9FE':'transparent',border:'none',borderRadius:'8px',padding:'4px 8px',fontSize:'18px',cursor:'pointer'}}>
                      {em}
                    </button>
                  ))}
                </div>
              )}

              <div style={{padding:'8px 16px',minHeight:'48px'}}>
                {!group.collapsed && group.items.map((itemId:string, itemIdx:number) => {
                  const section = allSections.find(s=>s.id===itemId);
                  if (!section) return null;
                  return (
                    <div key={itemId} draggable
                      onDragStart={()=>handleDragStart('item',group.id,itemIdx)}
                      onDragOver={e=>handleDragOver(e,'item',group.id,itemIdx)}
                      onDrop={handleDrop}
                      style={{display:'flex',alignItems:'center',gap:'10px',padding:'7px 10px',borderRadius:'10px',marginBottom:'4px',background:'#F8F7FF',cursor:'grab'}}>
                      <span style={{color:'#C4C0E8',fontSize:'13px'}}>⠿</span>
                      <i className={'ti '+section.icon} style={{fontSize:'14px',color:'#7F77DD'}} />
                      <span style={{fontSize:'13px',color:'#1a1040',fontWeight:600,flex:1}}>{section.label}</span>
                      {section.adminOnly && <span style={{fontSize:'10px',color:'#F59E0B',background:'#FEF3C7',borderRadius:'6px',padding:'2px 6px',fontWeight:700}}>ADMIN</span>}
                      <button onClick={()=>removeItem(group.id,itemId)} style={{background:'none',border:'none',color:'#9B97CC',cursor:'pointer',fontSize:'14px',padding:0}}>✕</button>
                    </div>
                  );
                })}
                {!group.collapsed && group.items.length===0 && (
                  <p style={{color:'#C4C0E8',fontSize:'12px',textAlign:'center',padding:'8px 0',margin:0}}>Перетащите разделы сюда</p>
                )}
              </div>
            </div>
          ))}
        </div>

        <div>
          <div style={{...card,padding:'16px',position:'sticky',top:'80px'}}>
            <p style={{fontSize:'13px',fontWeight:700,color:'#1a1040',margin:'0 0 12px'}}>Доступные разделы</p>
            <p style={{fontSize:'11px',color:'#9B97CC',margin:'0 0 12px'}}>Нажмите чтобы добавить в группу или перетащите</p>
            {unusedSections.length === 0 ? (
              <p style={{color:'#16A34A',fontSize:'12px',fontWeight:600,textAlign:'center',padding:'10px 0'}}>✓ Все разделы добавлены</p>
            ) : unusedSections.map(section => (
              <div key={section.id} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 10px',borderRadius:'10px',marginBottom:'4px',background:'#F8F7FF',cursor:'pointer'}}
                onMouseEnter={e=>(e.currentTarget as HTMLDivElement).style.background='#EDE9FE'}
                onMouseLeave={e=>(e.currentTarget as HTMLDivElement).style.background='#F8F7FF'}
                onClick={()=>{
                  const firstGroup = config?.groups?.[0];
                  if (firstGroup) addItemToGroup(firstGroup.id, section.id);
                }}>
                <i className={'ti '+section.icon} style={{fontSize:'14px',color:'#9B97CC'}} />
                <span style={{fontSize:'12px',color:'#1a1040',fontWeight:600,flex:1}}>{section.label}</span>
                {section.adminOnly && <span style={{fontSize:'10px',color:'#F59E0B',background:'#FEF3C7',borderRadius:'6px',padding:'2px 6px',fontWeight:700}}>ADMIN</span>}
                <span style={{fontSize:'12px',color:'#9B97CC'}}>+</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
