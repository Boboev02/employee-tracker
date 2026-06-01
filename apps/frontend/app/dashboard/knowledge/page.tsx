'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/usePermissions';

const API = 'https://employee-tracker.ru/api/v1/knowledge';
const ICONS = ['📁','📋','📄','📚','📝','🗂️','📌','💡','🔧','⚙️','🎯','📊'];
const COLORS = ['#6C5CE7','#4A90E2','#43A047','#FB8C00','#E53935','#00ACC1','#8E24AA','#F9A825'];

export default function KnowledgePage() {
  const router = useRouter();
  const perms = usePermissions();
  const [token, setToken]       = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string|null>(null);
  const [search, setSearch]     = useState('');
  const [view, setView]         = useState<'categories'|'articles'|'editor'|'viewer'>('categories');
  const [editArticle, setEditArticle] = useState<any>(null);
  const [viewingArticle, setViewingArticle] = useState<any>(null);
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCat, setNewCat]     = useState({ name:'', description:'', icon:'📁', color:'#6C5CE7' });
  const [loading, setLoading]   = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t); loadCategories(t);
  }, []);

  const h = (t: string) => ({ Authorization:'Bearer '+t, 'Content-Type':'application/json' });
  const loadCategories = async (t: string) => {
    const res = await fetch(API+'/categories', { headers: h(t) });
    const d = await res.json();
    if (Array.isArray(d)) setCategories(d);
  };
  const loadArticles = async (catId?: string, q?: string) => {
    let url = API+'/articles';
    const p = new URLSearchParams();
    if (catId) p.set('categoryId',catId);
    if (q) p.set('search',q);
    if (p.toString()) url += '?'+p.toString();
    const res = await fetch(url, { headers: h(token) });
    const d = await res.json();
    if (Array.isArray(d)) setArticles(d);
  };
  const openCategory = (catId: string) => { setSelectedCategory(catId); setView('articles'); loadArticles(catId); };
  const handleSearch = (q: string) => { setSearch(q); if (q.length>1) { setView('articles'); setSelectedCategory(null); loadArticles(undefined,q); } else if (!q) setView('categories'); };
  const createCategory = async () => {
    if (!newCat.name) return;
    await fetch(API+'/categories', { method:'POST', headers: h(token), body: JSON.stringify(newCat) });
    setShowCatModal(false); setNewCat({ name:'', description:'', icon:'📁', color:'#6C5CE7' }); loadCategories(token);
  };
  const deleteCategory = async (id: string) => {
    if (!confirm('Удалить категорию?')) return;
    await fetch(API+'/categories/'+id, { method:'DELETE', headers: h(token) }); loadCategories(token);
    if (selectedCategory===id) setView('categories');
  };
  const openArticle = async (art: any) => {
    const t = localStorage.getItem('access_token')||token;
    const res = await fetch(API+'/articles/'+art.id, { headers: h(t) });
    const d = await res.json(); setViewingArticle(d); setView('viewer');
  };
  const saveArticle = async () => {
    if (!editArticle?.title) return;
    const t = localStorage.getItem('access_token')||token;
    setLoading(true);
    try {
      if (editArticle.id) await fetch(API+'/articles/'+editArticle.id, { method:'PUT', headers: h(t), body: JSON.stringify(editArticle) });
      else await fetch(API+'/articles', { method:'POST', headers: h(t), body: JSON.stringify(editArticle) });
      setView('articles'); loadArticles(selectedCategory??undefined);
    } catch(e) { console.error(e); }
    setLoading(false);
  };
  const deleteArticle = async (id: string) => {
    if (!confirm('Удалить статью?')) return;
    await fetch(API+'/articles/'+id, { method:'DELETE', headers: h(token) }); loadArticles(selectedCategory??undefined);
  };
  const uploadFile = async (file: File) => {
    setUploading(true);
    const t = localStorage.getItem('access_token')||token;
    const fd = new FormData(); fd.append('file',file);
    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/upload/file', { method:'POST', headers:{ Authorization:'Bearer '+t }, body:fd });
      const d = await res.json();
      if (d.url) setEditArticle((prev:any)=>({...prev, fileUrl:d.url, fileName:d.fileName, fileType:d.fileType}));
    } catch(e) {} setUploading(false);
  };

  const selectedCat = categories.find(c=>c.id===selectedCategory);
  const inp: React.CSSProperties = { width:'100%', background:'#F5F3FC', border:'1.5px solid #E0DDF0', borderRadius:'8px', padding:'9px 12px', fontSize:'13px', color:'#1a1a2e', outline:'none', boxSizing:'border-box' };
  const card: React.CSSProperties = { background:'#fff', borderRadius:'12px', boxShadow:'0 2px 8px rgba(0,0,0,0.06)', border:'1px solid #eee' };

  return (
    <div style={{ minHeight:'100vh', background:'#EBE8F6' }}>
      {/* Header */}
      <div style={{ background:'#fff', borderBottom:'1px solid #eee', padding:'16px 28px', display:'flex', alignItems:'center', gap:'12px', position:'sticky', top:0, zIndex:10, boxShadow:'0 2px 8px rgba(108,92,231,0.06)' }}>
        {view !== 'categories' && (
          <button onClick={()=>{setView('categories');setSelectedCategory(null);setSearch('');}}
            style={{ background:'none', border:'none', cursor:'pointer', color:'#aaa', fontSize:'13px', display:'flex', alignItems:'center', gap:'4px', flexShrink:0 }}>
            ← Назад
          </button>
        )}
        <div style={{ flex:1 }}>
          <h1 style={{ fontSize:'18px', fontWeight:700, color:'#1a1a2e', margin:0 }}>
            {view==='categories'?'📚 База знаний':view==='editor'?(editArticle?.id?'Редактировать':'Новая статья'):view==='viewer'?viewingArticle?.title:selectedCat?`${selectedCat.icon} ${selectedCat.name}`:'Поиск'}
          </h1>
        </div>
        <input placeholder="🔍 Поиск..." value={search} onChange={e=>handleSearch(e.target.value)} style={{ ...inp, width:'220px' }} />
        {view==='categories' && perms.isAdmin && (
          <button onClick={()=>setShowCatModal(true)} style={{ background:'#6C5CE7', color:'white', border:'none', borderRadius:'9px', padding:'8px 16px', fontSize:'13px', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
            + Категория
          </button>
        )}
        {view==='articles' && perms.isAdmin && (
          <button onClick={()=>{setEditArticle({title:'',content:'',categoryId:selectedCategory});setView('editor');}} style={{ background:'#6C5CE7', color:'white', border:'none', borderRadius:'9px', padding:'8px 16px', fontSize:'13px', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' }}>
            + Статья
          </button>
        )}
      </div>

      <div style={{ padding:'24px 28px' }}>
        {/* CATEGORIES */}
        {view==='categories' && (
          categories.length===0 ? (
            <div style={{ ...card, padding:'60px', textAlign:'center' }}>
              <div style={{ fontSize:'48px', marginBottom:'16px' }}>📚</div>
              <p style={{ color:'#aaa', fontSize:'14px' }}>База знаний пуста. Создайте первую категорию.</p>
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:'14px' }}>
              {categories.map(cat => (
                <div key={cat.id} onClick={()=>openCategory(cat.id)}
                  style={{ ...card, padding:'18px 20px', cursor:'pointer', transition:'all 0.15s', position:'relative', overflow:'hidden' }}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.transform='translateY(-2px)';(e.currentTarget as HTMLElement).style.boxShadow='0 8px 24px rgba(108,92,231,0.15)';}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.transform='none';(e.currentTarget as HTMLElement).style.boxShadow='0 2px 8px rgba(0,0,0,0.06)';}}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'10px' }}>
                    <div style={{ width:'44px', height:'44px', borderRadius:'12px', background:cat.color+'18', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'22px', flexShrink:0 }}>
                      {cat.icon}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:'14px', color:'#1a1a2e' }}>{cat.name}</div>
                      <div style={{ fontSize:'12px', color:'#aaa' }}>{cat._count?.articles??0} статей</div>
                    </div>
                    {perms.isAdmin && (
                      <button onClick={e=>{e.stopPropagation();deleteCategory(cat.id);}} style={{ background:'none', border:'none', cursor:'pointer', color:'#ddd', fontSize:'16px', padding:'4px' }}>🗑</button>
                    )}
                  </div>
                  {cat.description && <p style={{ fontSize:'12px', color:'#888', margin:0, lineHeight:1.5 }}>{cat.description}</p>}
                  <div style={{ position:'absolute', bottom:0, left:'20px', right:'20px', height:'3px', background:cat.color, borderRadius:'0 0 2px 2px', opacity:0.5 }} />
                </div>
              ))}
            </div>
          )
        )}

        {/* ARTICLES */}
        {view==='articles' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'8px' }}>
            {articles.length===0 ? (
              <div style={{ ...card, padding:'60px', textAlign:'center' }}>
                <div style={{ fontSize:'40px', marginBottom:'12px' }}>📄</div>
                <p style={{ color:'#aaa', fontSize:'13px' }}>Нет статей в этой категории</p>
              </div>
            ) : articles.map(art => (
              <div key={art.id} style={{ ...card, padding:'14px 18px', display:'flex', alignItems:'center', gap:'12px', cursor:'pointer', transition:'all 0.15s' }}
                onClick={()=>openArticle(art)}
                onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.background='#F5F3FC';(e.currentTarget as HTMLElement).style.borderColor='#E0DDF0';}}
                onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.background='#fff';(e.currentTarget as HTMLElement).style.borderColor='#eee';}}>
                <div style={{ flex:1 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px' }}>
                    {art.isPinned && <span>📌</span>}
                    <span style={{ fontWeight:600, fontSize:'14px', color:'#1a1a2e' }}>{art.title}</span>
                    {art.fileUrl && <span style={{ fontSize:'11px', background:'#E3F2FD', color:'#1565C0', padding:'2px 7px', borderRadius:'6px' }}>📎 файл</span>}
                  </div>
                  <div style={{ fontSize:'12px', color:'#aaa', display:'flex', gap:'12px' }}>
                    <span>{art.category?.icon} {art.category?.name}</span>
                    <span>👁 {art.views}</span>
                    <span>{new Date(art.updatedAt).toLocaleDateString('ru')}</span>
                  </div>
                </div>
                <div style={{ display:'flex', gap:'6px' }}>
                  {art.fileUrl && (
                    <a href={art.fileUrl} download={art.fileName} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                      style={{ background:'#E3F2FD', color:'#1565C0', border:'none', borderRadius:'7px', padding:'5px 12px', fontSize:'12px', textDecoration:'none', fontWeight:500 }}>
                      ⬇ Скачать
                    </a>
                  )}
                  {perms.isAdmin && <>
                    <button onClick={e=>{e.stopPropagation();setEditArticle(art);setView('editor');}} style={{ background:'#EDE9FF', color:'#6C5CE7', border:'none', borderRadius:'7px', padding:'5px 10px', fontSize:'13px', cursor:'pointer' }}>✏️</button>
                    <button onClick={e=>{e.stopPropagation();deleteArticle(art.id);}} style={{ background:'#FFEBEE', color:'#C62828', border:'none', borderRadius:'7px', padding:'5px 10px', fontSize:'13px', cursor:'pointer' }}>🗑</button>
                  </>}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* VIEWER */}
        {view==='viewer' && viewingArticle && (
          <div style={{ maxWidth:'800px', margin:'0 auto' }}>
            <div style={{ ...card, padding:'32px' }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'24px' }}>
                <div>
                  <h2 style={{ fontSize:'22px', fontWeight:700, color:'#1a1a2e', margin:'0 0 8px' }}>{viewingArticle.title}</h2>
                  <div style={{ fontSize:'12px', color:'#aaa', display:'flex', gap:'12px' }}>
                    <span>{viewingArticle.category?.icon} {viewingArticle.category?.name}</span>
                    <span>👁 {viewingArticle.views} просмотров</span>
                    <span>{new Date(viewingArticle.updatedAt).toLocaleDateString('ru')}</span>
                  </div>
                </div>
                <div style={{ display:'flex', gap:'8px' }}>
                  {viewingArticle.fileUrl && (
                    <a href={viewingArticle.fileUrl} download={viewingArticle.fileName} target="_blank" rel="noreferrer"
                      style={{ background:'#6C5CE7', color:'white', border:'none', borderRadius:'9px', padding:'8px 16px', fontSize:'13px', textDecoration:'none', fontWeight:500 }}>
                      ⬇ Скачать
                    </a>
                  )}
                  {perms.isAdmin && (
                    <button onClick={()=>{setEditArticle(viewingArticle);setView('editor');}} style={{ background:'#EDE9FF', color:'#6C5CE7', border:'none', borderRadius:'9px', padding:'8px 16px', fontSize:'13px', cursor:'pointer', fontWeight:500 }}>
                      ✏️ Редактировать
                    </button>
                  )}
                </div>
              </div>
              {viewingArticle.fileUrl && (
                <div style={{ marginBottom:'24px', background:'#F5F3FC', borderRadius:'10px', overflow:'hidden' }}>
                  <div style={{ padding:'10px 14px', display:'flex', alignItems:'center', gap:'10px', borderBottom:'1px solid #eee' }}>
                    <span style={{ fontSize:'20px' }}>{viewingArticle.fileType==='pdf'?'📄':['docx','doc'].includes(viewingArticle.fileType)?'📝':'📎'}</span>
                    <span style={{ fontSize:'13px', fontWeight:500, flex:1 }}>{viewingArticle.fileName}</span>
                    <a href={viewingArticle.fileUrl} target="_blank" rel="noreferrer" style={{ fontSize:'12px', color:'#6C5CE7', textDecoration:'none' }}>Открыть →</a>
                  </div>
                  {viewingArticle.fileType==='pdf' ? (
                    <iframe src={viewingArticle.fileUrl} style={{ width:'100%', height:'500px', border:'none' }} title={viewingArticle.fileName} />
                  ) : ['docx','doc','xlsx','xls'].includes(viewingArticle.fileType) ? (
                    <iframe src={`https://docs.google.com/viewer?url=${encodeURIComponent(viewingArticle.fileUrl)}&embedded=true`} style={{ width:'100%', height:'500px', border:'none' }} title={viewingArticle.fileName} />
                  ) : null}
                </div>
              )}
              {viewingArticle.content && (
                <div style={{ fontSize:'14px', lineHeight:1.8, color:'#333', whiteSpace:'pre-wrap' }}>{viewingArticle.content}</div>
              )}
            </div>
          </div>
        )}

        {/* EDITOR */}
        {view==='editor' && editArticle && (
          <div style={{ maxWidth:'800px', margin:'0 auto' }}>
            <div style={{ ...card, padding:'28px 32px', display:'flex', flexDirection:'column', gap:'14px' }}>
              <input placeholder="Название статьи" value={editArticle.title} onChange={e=>setEditArticle({...editArticle,title:e.target.value})}
                style={{ ...inp, fontSize:'18px', fontWeight:600, border:'none', borderBottom:'2px solid #EDE9FF', borderRadius:0, padding:'8px 0', background:'transparent' }} />
              <select value={editArticle.categoryId??''} onChange={e=>setEditArticle({...editArticle,categoryId:e.target.value})} style={inp}>
                <option value="">Выберите категорию</option>
                {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
              <textarea placeholder="Содержимое статьи..." value={editArticle.content??''} onChange={e=>setEditArticle({...editArticle,content:e.target.value})} rows={14} style={{ ...inp, resize:'vertical', lineHeight:1.7 }} />
              <div style={{ display:'flex', gap:'10px', alignItems:'center' }}>
                <input placeholder="Ссылка на файл" value={editArticle.fileUrl??''} onChange={e=>setEditArticle({...editArticle,fileUrl:e.target.value})} style={{ ...inp, flex:1 }} />
                <label style={{ background:'#EDE9FF', color:'#6C5CE7', border:'1px solid rgba(108,92,231,0.2)', borderRadius:'9px', padding:'9px 16px', fontSize:'13px', cursor:'pointer', fontWeight:500, whiteSpace:'nowrap', flexShrink:0 }}>
                  {uploading?'⏳ Загрузка...':'📎 Загрузить'}
                  <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" style={{ display:'none' }} onChange={e=>e.target.files?.[0]&&uploadFile(e.target.files[0])} />
                </label>
              </div>
              {editArticle.fileName && <div style={{ fontSize:'12px', color:'#888', background:'#F5F3FC', borderRadius:'7px', padding:'6px 12px' }}>📎 {editArticle.fileName}</div>}
              <div style={{ display:'flex', gap:'10px', justifyContent:'flex-end', marginTop:'4px' }}>
                <button onClick={()=>setView('articles')} style={{ background:'#F5F3FC', color:'#666', border:'1px solid #E0DDF0', borderRadius:'9px', padding:'9px 20px', fontSize:'13px', cursor:'pointer', fontWeight:500 }}>Отмена</button>
                <button onClick={saveArticle} disabled={loading} style={{ background:'#6C5CE7', color:'white', border:'none', borderRadius:'9px', padding:'9px 20px', fontSize:'13px', cursor:'pointer', fontWeight:600 }}>
                  {loading?'Сохранение...':'Сохранить →'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Category modal */}
      {showCatModal && (
        <div style={{ position:'fixed', inset:0, background:'rgba(26,26,46,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, backdropFilter:'blur(2px)' }}>
          <div style={{ background:'#fff', borderRadius:'16px', padding:'28px 32px', width:'420px', boxShadow:'0 16px 48px rgba(108,92,231,0.2)' }}>
            <h3 style={{ fontSize:'16px', fontWeight:700, color:'#1a1a2e', margin:'0 0 20px' }}>Новая категория</h3>
            <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
              <input placeholder="Название" value={newCat.name} onChange={e=>setNewCat({...newCat,name:e.target.value})} style={inp} />
              <input placeholder="Описание (необязательно)" value={newCat.description} onChange={e=>setNewCat({...newCat,description:e.target.value})} style={inp} />
              <div>
                <div style={{ fontSize:'11px', color:'#aaa', marginBottom:'8px', fontWeight:600 }}>ИКОНКА</div>
                <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
                  {ICONS.map(icon => (
                    <button key={icon} onClick={()=>setNewCat({...newCat,icon})}
                      style={{ width:'38px', height:'38px', border:newCat.icon===icon?'2px solid #6C5CE7':'1px solid #eee', borderRadius:'9px', background:newCat.icon===icon?'#EDE9FF':'#F5F3FC', cursor:'pointer', fontSize:'18px' }}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize:'11px', color:'#aaa', marginBottom:'8px', fontWeight:600 }}>ЦВЕТ</div>
                <div style={{ display:'flex', gap:'8px' }}>
                  {COLORS.map(color => (
                    <button key={color} onClick={()=>setNewCat({...newCat,color})}
                      style={{ width:'28px', height:'28px', borderRadius:'50%', background:color, border:newCat.color===color?'3px solid #1a1a2e':'2px solid transparent', cursor:'pointer', transition:'transform 0.15s' }} />
                  ))}
                </div>
              </div>
              <div style={{ display:'flex', gap:'10px', marginTop:'8px' }}>
                <button onClick={()=>setShowCatModal(false)} style={{ flex:1, background:'#F5F3FC', color:'#666', border:'1px solid #E0DDF0', borderRadius:'9px', padding:'10px', fontSize:'13px', cursor:'pointer', fontWeight:500 }}>Отмена</button>
                <button onClick={createCategory} style={{ flex:1, background:'#6C5CE7', color:'white', border:'none', borderRadius:'9px', padding:'10px', fontSize:'13px', cursor:'pointer', fontWeight:600 }}>Создать →</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
