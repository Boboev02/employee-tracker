'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/usePermissions';

const API = 'https://employee-tracker.ru/api/v1/knowledge';
const ICONS = ['📁','📋','📄','📚','📝','🗂️','📌','💡','🔧','⚙️','🎯','📊'];
const COLORS = ['#8b7cf6','#3b82f6','#10b981','#f59e0b','#ef4444','#ec4899','#6366f1','#14b8a6'];

function FileIcon({ type }: { type: string }) {
  if (type === 'pdf') return <svg width="32" height="40" viewBox="0 0 32 40" fill="none"><rect width="32" height="40" rx="4" fill="#fee2e2"/><rect x="2" y="2" width="28" height="36" rx="3" fill="#fef2f2" stroke="#fca5a5" strokeWidth="0.5"/><text x="16" y="26" textAnchor="middle" fontSize="9" fontWeight="700" fill="#ef4444">PDF</text></svg>;
  if (type === 'docx' || type === 'doc') return <svg width="32" height="40" viewBox="0 0 32 40" fill="none"><rect width="32" height="40" rx="4" fill="#dbeafe"/><rect x="2" y="2" width="28" height="36" rx="3" fill="#eff6ff" stroke="#93c5fd" strokeWidth="0.5"/><text x="16" y="26" textAnchor="middle" fontSize="8" fontWeight="700" fill="#3b82f6">DOCX</text></svg>;
  if (type === 'xlsx' || type === 'xls') return <svg width="32" height="40" viewBox="0 0 32 40" fill="none"><rect width="32" height="40" rx="4" fill="#dcfce7"/><rect x="2" y="2" width="28" height="36" rx="3" fill="#f0fdf4" stroke="#86efac" strokeWidth="0.5"/><text x="16" y="26" textAnchor="middle" fontSize="8" fontWeight="700" fill="#16a34a">XLSX</text></svg>;
  return <svg width="32" height="40" viewBox="0 0 32 40" fill="none"><rect width="32" height="40" rx="4" fill="#f3f4f6"/><rect x="2" y="2" width="28" height="36" rx="3" fill="#f9fafb" stroke="#d1d5db" strokeWidth="0.5"/><text x="16" y="26" textAnchor="middle" fontSize="9" fontWeight="700" fill="#6b7280">FILE</text></svg>;
}

export default function KnowledgePage() {
  const router = useRouter();
  const perms  = usePermissions();
  const [token, setToken]           = useState('');
  const [categories, setCategories] = useState<any[]>([]);
  const [articles, setArticles]     = useState<any[]>([]);
  const [selectedCat, setSelectedCat] = useState<string|null>(null);
  const [search, setSearch]         = useState('');
  const [view, setView]             = useState<'categories'|'articles'|'editor'|'viewer'>('categories');
  const [editArticle, setEditArticle] = useState<any>(null);
  const [viewingArticle, setViewingArticle] = useState<any>(null);
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCat, setNewCat]         = useState({ name:'', description:'', icon:'📁', color:'#8b7cf6' });
  const [loading, setLoading]       = useState(false);
  const [uploading, setUploading]   = useState(false);
  const [previewMode, setPreviewMode] = useState<'inline'|'google'>('google');

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t); loadCategories(t);
  }, []);

  const h  = (t: string) => ({ Authorization:'Bearer '+t, 'Content-Type':'application/json' });
  const loadCategories = async (t: string) => { const r = await fetch(API+'/categories',{headers:h(t)}); const d = await r.json(); if(Array.isArray(d)) setCategories(d); };
  const loadArticles   = async (catId?: string, q?: string) => {
    let url = API+'/articles';
    const p = new URLSearchParams();
    if (catId) p.set('categoryId',catId);
    if (q) p.set('search',q);
    if (p.toString()) url += '?'+p.toString();
    const r = await fetch(url,{headers:h(token)}); const d = await r.json(); if(Array.isArray(d)) setArticles(d);
  };
  const openCategory = (id: string) => { setSelectedCat(id); setView('articles'); loadArticles(id); };
  const handleSearch  = (q: string) => { setSearch(q); if(q.length>1){setView('articles');setSelectedCat(null);loadArticles(undefined,q);}else if(!q) setView('categories'); };
  const createCat     = async () => {
    if(!newCat.name) return;
    await fetch(API+'/categories',{method:'POST',headers:h(token),body:JSON.stringify(newCat)});
    setShowCatModal(false); setNewCat({name:'',description:'',icon:'📁',color:'#8b7cf6'}); loadCategories(token);
  };
  const deleteCat = async (id: string) => { if(!confirm('Удалить категорию?')) return; await fetch(API+'/categories/'+id,{method:'DELETE',headers:h(token)}); loadCategories(token); if(selectedCat===id) setView('categories'); };
  const openArticle   = async (art: any) => {
    const t = localStorage.getItem('access_token')||token;
    const r = await fetch(API+'/articles/'+art.id,{headers:h(t)}); const d = await r.json();
    setViewingArticle(d); setView('viewer');
  };
  const saveArticle   = async () => {
    if(!editArticle?.title) return;
    const t = localStorage.getItem('access_token')||token;
    setLoading(true);
    try {
      if(editArticle.id) await fetch(API+'/articles/'+editArticle.id,{method:'PUT',headers:h(t),body:JSON.stringify(editArticle)});
      else await fetch(API+'/articles',{method:'POST',headers:h(t),body:JSON.stringify(editArticle)});
      setView('articles'); loadArticles(selectedCat??undefined);
    } catch(e){}
    setLoading(false);
  };
  const deleteArticle = async (id: string) => { if(!confirm('Удалить?')) return; await fetch(API+'/articles/'+id,{method:'DELETE',headers:h(token)}); loadArticles(selectedCat??undefined); };
  const uploadFile    = async (file: File) => {
    setUploading(true);
    const t = localStorage.getItem('access_token')||token;
    const fd = new FormData(); fd.append('file',file);
    try {
      const r = await fetch('https://employee-tracker.ru/api/v1/upload/file',{method:'POST',headers:{Authorization:'Bearer '+t},body:fd});
      const d = await r.json();
      if(d.url) setEditArticle((prev:any)=>({...prev,fileUrl:d.url,fileName:d.fileName,fileType:d.fileType}));
    } catch(e){}
    setUploading(false);
  };

  const catObj = categories.find(c=>c.id===selectedCat);
  const inp: React.CSSProperties = {width:'100%',background:'var(--bg-secondary)',border:'0.5px solid var(--border)',borderRadius:'8px',padding:'8px 12px',fontSize:'13px',color:'var(--text-primary)',outline:'none',boxSizing:'border-box'};

  return (
    <div style={{minHeight:'100vh',background:'var(--bg-tertiary)'}}>

      {/* ── Header ── */}
      <div style={{background:'var(--bg-primary)',borderBottom:'0.5px solid var(--border)',padding:'14px 24px',display:'flex',alignItems:'center',gap:'12px',position:'sticky',top:0,zIndex:10}}>
        {view!=='categories' && (
          <button onClick={()=>{setView('categories');setSelectedCat(null);setSearch('');}}
            style={{background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:'13px',display:'flex',alignItems:'center',gap:'4px',padding:'6px 10px',borderRadius:'7px',transition:'background 0.15s'}}
            onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--bg-secondary)'}
            onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='none'}>
            ← Назад
          </button>
        )}
        <div style={{flex:1}}>
          <h1 style={{fontSize:'16px',fontWeight:600,color:'var(--text-primary)',margin:0}}>
            {view==='categories'?'📚 База знаний':view==='editor'?(editArticle?.id?'Редактировать статью':'Новая статья'):view==='viewer'&&viewingArticle?viewingArticle.title:catObj?`${catObj.icon} ${catObj.name}`:'🔍 Поиск'}
          </h1>
          {view==='categories' && <p style={{fontSize:'11px',color:'var(--text-muted)',margin:'2px 0 0'}}>{categories.length} категорий · хранилище документов и знаний</p>}
        </div>
        <input placeholder="🔍 Поиск по базе знаний..." value={search} onChange={e=>handleSearch(e.target.value)}
          style={{...inp,width:'260px'}} />
        {view==='categories' && perms.isAdmin && (
          <button onClick={()=>setShowCatModal(true)}
            style={{background:'var(--accent)',color:'white',border:'none',borderRadius:'8px',padding:'8px 16px',fontSize:'13px',fontWeight:500,cursor:'pointer',whiteSpace:'nowrap'}}>
            + Категория
          </button>
        )}
        {view==='articles' && perms.isAdmin && (
          <button onClick={()=>{setEditArticle({title:'',content:'',categoryId:selectedCat});setView('editor');}}
            style={{background:'var(--accent)',color:'white',border:'none',borderRadius:'8px',padding:'8px 16px',fontSize:'13px',fontWeight:500,cursor:'pointer',whiteSpace:'nowrap'}}>
            + Статья
          </button>
        )}
        {view==='viewer' && viewingArticle && (
          <div style={{display:'flex',gap:'8px'}}>
            {viewingArticle.fileUrl && (
              <a href={viewingArticle.fileUrl} download={viewingArticle.fileName} target="_blank" rel="noreferrer"
                style={{background:'var(--bg-secondary)',color:'var(--text-primary)',border:'0.5px solid var(--border)',borderRadius:'8px',padding:'7px 14px',fontSize:'13px',textDecoration:'none',display:'flex',alignItems:'center',gap:'5px'}}>
                <i className="ti ti-download" style={{fontSize:'14px'}} aria-hidden="true" /> Скачать
              </a>
            )}
            {perms.isAdmin && (
              <button onClick={()=>{setEditArticle(viewingArticle);setView('editor');}}
                style={{background:'var(--accent-bg)',color:'var(--accent)',border:'0.5px solid var(--accent-border)',borderRadius:'8px',padding:'7px 14px',fontSize:'13px',cursor:'pointer',display:'flex',alignItems:'center',gap:'5px'}}>
                <i className="ti ti-edit" style={{fontSize:'14px'}} aria-hidden="true" /> Редактировать
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{padding:'20px 24px'}}>

        {/* ── CATEGORIES ── */}
        {view==='categories' && (
          categories.length===0 ? (
            <div style={{background:'var(--bg-primary)',border:'0.5px solid var(--border)',borderRadius:'12px',padding:'60px',textAlign:'center'}}>
              <div style={{fontSize:'48px',marginBottom:'16px'}}>📚</div>
              <p style={{fontSize:'15px',fontWeight:500,color:'var(--text-primary)',margin:'0 0 6px'}}>База знаний пуста</p>
              <p style={{fontSize:'13px',color:'var(--text-muted)',margin:0}}>Создайте первую категорию для хранения документов и статей</p>
            </div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))',gap:'14px'}}>
              {categories.map(cat=>(
                <div key={cat.id} onClick={()=>openCategory(cat.id)}
                  style={{background:'var(--bg-primary)',border:'0.5px solid var(--border)',borderRadius:'14px',padding:'20px',cursor:'pointer',transition:'all 0.2s',position:'relative',overflow:'hidden'}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.transform='translateY(-2px)';(e.currentTarget as HTMLElement).style.boxShadow='0 8px 24px rgba(0,0,0,0.08)';(e.currentTarget as HTMLElement).style.borderColor=cat.color+'60';}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.transform='none';(e.currentTarget as HTMLElement).style.boxShadow='none';(e.currentTarget as HTMLElement).style.borderColor='var(--border)';}}>
                  <div style={{position:'absolute',top:0,left:0,right:0,height:'3px',background:cat.color,opacity:0.7}}/>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'14px'}}>
                    <div style={{width:'48px',height:'48px',borderRadius:'12px',background:cat.color+'18',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px'}}>
                      {cat.icon}
                    </div>
                    {perms.isAdmin && (
                      <button onClick={e=>{e.stopPropagation();deleteCat(cat.id);}}
                        style={{background:'none',border:'none',cursor:'pointer',color:'var(--border-strong)',fontSize:'15px',padding:'4px',borderRadius:'6px',transition:'all 0.15s'}}
                        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color='var(--red)';(e.currentTarget as HTMLElement).style.background='var(--red-bg)';}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color='var(--border-strong)';(e.currentTarget as HTMLElement).style.background='none';}}>
                        <i className="ti ti-trash" aria-hidden="true"/>
                      </button>
                    )}
                  </div>
                  <p style={{fontSize:'14px',fontWeight:600,color:'var(--text-primary)',margin:'0 0 4px'}}>{cat.name}</p>
                  <p style={{fontSize:'12px',color:'var(--text-muted)',margin:'0 0 12px',lineHeight:1.4}}>{cat.description||'Нет описания'}</p>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <span style={{fontSize:'11px',color:cat.color,background:cat.color+'15',padding:'3px 8px',borderRadius:'6px',fontWeight:500}}>{cat._count?.articles??0} статей</span>
                    <span style={{fontSize:'12px',color:'var(--text-muted)'}}>→</span>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── ARTICLES ── */}
        {view==='articles' && (
          articles.length===0 ? (
            <div style={{background:'var(--bg-primary)',border:'0.5px solid var(--border)',borderRadius:'12px',padding:'60px',textAlign:'center'}}>
              <div style={{fontSize:'40px',marginBottom:'12px'}}>📄</div>
              <p style={{fontSize:'14px',color:'var(--text-primary)',margin:'0 0 4px',fontWeight:500}}>Нет статей</p>
              <p style={{fontSize:'13px',color:'var(--text-muted)',margin:0}}>Создайте первую статью в этой категории</p>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
              {articles.map(art=>(
                <div key={art.id}
                  style={{background:'var(--bg-primary)',border:'0.5px solid var(--border)',borderRadius:'12px',padding:'14px 18px',display:'flex',alignItems:'center',gap:'14px',cursor:'pointer',transition:'all 0.15s'}}
                  onClick={()=>openArticle(art)}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.borderColor='rgba(139,124,246,0.35)';(e.currentTarget as HTMLElement).style.background='var(--bg-secondary)';}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.borderColor='var(--border)';(e.currentTarget as HTMLElement).style.background='var(--bg-primary)';}}>
                  {art.fileType && (
                    <div style={{flexShrink:0}}>
                      <FileIcon type={art.fileType}/>
                    </div>
                  )}
                  {!art.fileType && (
                    <div style={{width:'32px',height:'40px',background:'var(--accent-bg)',borderRadius:'6px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <i className="ti ti-file-text" style={{fontSize:'18px',color:'var(--accent)'}} aria-hidden="true"/>
                    </div>
                  )}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'4px'}}>
                      {art.isPinned && <span style={{fontSize:'12px'}}>📌</span>}
                      <span style={{fontSize:'14px',fontWeight:500,color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{art.title}</span>
                      {art.fileUrl && <span style={{fontSize:'10px',fontWeight:600,color:'var(--blue)',background:'var(--blue-bg)',padding:'2px 7px',borderRadius:'5px',flexShrink:0}}>{art.fileType?.toUpperCase()||'FILE'}</span>}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                      {art.category && <span style={{fontSize:'11px',color:'var(--text-muted)'}}>{art.category.icon} {art.category.name}</span>}
                      <span style={{fontSize:'11px',color:'var(--text-muted)'}}>👁 {art.views}</span>
                      <span style={{fontSize:'11px',color:'var(--text-muted)'}}>{new Date(art.updatedAt).toLocaleDateString('ru',{day:'numeric',month:'short',year:'numeric'})}</span>
                      {art.content && <span style={{fontSize:'11px',color:'var(--text-muted)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap',maxWidth:'200px'}}>{art.content.slice(0,60)}…</span>}
                    </div>
                  </div>
                  <div style={{display:'flex',gap:'6px',flexShrink:0}}>
                    {art.fileUrl && (
                      <a href={art.fileUrl} download={art.fileName} target="_blank" rel="noreferrer"
                        onClick={e=>e.stopPropagation()}
                        style={{background:'var(--bg-secondary)',border:'0.5px solid var(--border)',borderRadius:'7px',padding:'5px 10px',fontSize:'12px',color:'var(--text-secondary)',textDecoration:'none',display:'flex',alignItems:'center',gap:'4px'}}>
                        <i className="ti ti-download" style={{fontSize:'13px'}} aria-hidden="true"/> Скачать
                      </a>
                    )}
                    {perms.isAdmin && (
                      <>
                        <button onClick={e=>{e.stopPropagation();setEditArticle(art);setView('editor');}}
                          style={{background:'var(--accent-bg)',color:'var(--accent)',border:'none',borderRadius:'7px',padding:'5px 12px',fontSize:'12px',cursor:'pointer',fontWeight:500}}>
                          ✏️
                        </button>
                        <button onClick={e=>{e.stopPropagation();deleteArticle(art.id);}}
                          style={{background:'var(--red-bg)',color:'var(--red)',border:'none',borderRadius:'7px',padding:'5px 12px',fontSize:'12px',cursor:'pointer',fontWeight:500}}>
                          🗑
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ── VIEWER ── */}
        {view==='viewer' && viewingArticle && (
          <div style={{display:'grid',gridTemplateColumns:'1fr 320px',gap:'16px',alignItems:'start'}}>
            {/* Main content */}
            <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
              {/* Article meta */}
              <div style={{background:'var(--bg-primary)',border:'0.5px solid var(--border)',borderRadius:'12px',padding:'20px 24px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'16px',flexWrap:'wrap'}}>
                  {viewingArticle.category && (
                    <span style={{fontSize:'11px',fontWeight:600,color:'var(--accent)',background:'var(--accent-bg)',padding:'3px 10px',borderRadius:'6px'}}>
                      {viewingArticle.category.icon} {viewingArticle.category.name}
                    </span>
                  )}
                  <span style={{fontSize:'11px',color:'var(--text-muted)'}}>👁 {viewingArticle.views} просмотров</span>
                  <span style={{fontSize:'11px',color:'var(--text-muted)'}}>{new Date(viewingArticle.updatedAt).toLocaleDateString('ru',{day:'numeric',month:'long',year:'numeric'})}</span>
                </div>
                {viewingArticle.content && (
                  <div style={{fontSize:'14px',lineHeight:1.8,color:'var(--text-primary)',whiteSpace:'pre-wrap'}}>
                    {viewingArticle.content}
                  </div>
                )}
                {!viewingArticle.content && !viewingArticle.fileUrl && (
                  <p style={{color:'var(--text-muted)',fontSize:'13px',fontStyle:'italic'}}>Нет содержимого</p>
                )}
              </div>

              {/* File preview */}
              {viewingArticle.fileUrl && (
                <div style={{background:'var(--bg-primary)',border:'0.5px solid var(--border)',borderRadius:'12px',overflow:'hidden'}}>
                  {/* File header */}
                  <div style={{padding:'12px 18px',borderBottom:'0.5px solid var(--border)',display:'flex',alignItems:'center',gap:'12px'}}>
                    <FileIcon type={viewingArticle.fileType||''}/>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontSize:'13px',fontWeight:500,color:'var(--text-primary)',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{viewingArticle.fileName}</p>
                      <p style={{fontSize:'11px',color:'var(--text-muted)',margin:'2px 0 0'}}>{viewingArticle.fileType?.toUpperCase()} документ</p>
                    </div>
                    <div style={{display:'flex',gap:'6px',flexShrink:0}}>
                      {['docx','doc','xlsx','xls'].includes(viewingArticle.fileType) && (
                        <>
                          <button onClick={()=>setPreviewMode('google')} style={{fontSize:'11px',padding:'4px 10px',borderRadius:'6px',border:'none',background:previewMode==='google'?'var(--accent)':'var(--bg-secondary)',color:previewMode==='google'?'white':'var(--text-secondary)',cursor:'pointer',fontWeight:500}}>Google Docs</button>
                          <button onClick={()=>setPreviewMode('inline')} style={{fontSize:'11px',padding:'4px 10px',borderRadius:'6px',border:'none',background:previewMode==='inline'?'var(--accent)':'var(--bg-secondary)',color:previewMode==='inline'?'white':'var(--text-secondary)',cursor:'pointer',fontWeight:500}}>Прямой</button>
                        </>
                      )}
                      <a href={viewingArticle.fileUrl} target="_blank" rel="noreferrer"
                        style={{fontSize:'11px',padding:'4px 10px',borderRadius:'6px',background:'var(--bg-secondary)',color:'var(--text-secondary)',textDecoration:'none',fontWeight:500}}>
                        Открыть ↗
                      </a>
                    </div>
                  </div>
                  {/* Preview area */}
                  {viewingArticle.fileType==='pdf' && (
                    <iframe src={viewingArticle.fileUrl} style={{width:'100%',height:'680px',border:'none',display:'block'}} title={viewingArticle.fileName}/>
                  )}
                  {['docx','doc','xlsx','xls'].includes(viewingArticle.fileType) && previewMode==='google' && (
                    <iframe src={`https://docs.google.com/viewer?url=${encodeURIComponent(viewingArticle.fileUrl)}&embedded=true`} style={{width:'100%',height:'680px',border:'none',display:'block'}} title={viewingArticle.fileName}/>
                  )}
                  {['docx','doc','xlsx','xls'].includes(viewingArticle.fileType) && previewMode==='inline' && (
                    <div style={{padding:'24px',textAlign:'center'}}>
                      <div style={{fontSize:'48px',marginBottom:'12px'}}>📄</div>
                      <p style={{fontSize:'13px',color:'var(--text-muted)',marginBottom:'14px'}}>Прямой предпросмотр недоступен для этого формата</p>
                      <a href={viewingArticle.fileUrl} download={viewingArticle.fileName} target="_blank" rel="noreferrer"
                        style={{background:'var(--accent)',color:'white',borderRadius:'8px',padding:'9px 18px',fontSize:'13px',textDecoration:'none',fontWeight:500}}>
                        ⬇ Скачать файл
                      </a>
                    </div>
                  )}
                  {!['pdf','docx','doc','xlsx','xls'].includes(viewingArticle.fileType||'') && viewingArticle.fileUrl && (
                    <div style={{padding:'32px',textAlign:'center'}}>
                      <a href={viewingArticle.fileUrl} download={viewingArticle.fileName} target="_blank" rel="noreferrer"
                        style={{background:'var(--accent)',color:'white',borderRadius:'8px',padding:'10px 20px',fontSize:'13px',textDecoration:'none',fontWeight:500,display:'inline-flex',alignItems:'center',gap:'6px'}}>
                        <i className="ti ti-download" aria-hidden="true"/> Скачать файл
                      </a>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Sidebar info */}
            <div style={{display:'flex',flexDirection:'column',gap:'12px',position:'sticky',top:'70px'}}>
              <div style={{background:'var(--bg-primary)',border:'0.5px solid var(--border)',borderRadius:'12px',padding:'16px'}}>
                <p style={{fontSize:'11px',fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',margin:'0 0 12px'}}>Информация</p>
                <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:'12px',color:'var(--text-muted)'}}>Просмотры</span>
                    <span style={{fontSize:'13px',fontWeight:500,color:'var(--text-primary)'}}>{viewingArticle.views}</span>
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{fontSize:'12px',color:'var(--text-muted)'}}>Обновлено</span>
                    <span style={{fontSize:'12px',color:'var(--text-primary)'}}>{new Date(viewingArticle.updatedAt).toLocaleDateString('ru',{day:'numeric',month:'short'})}</span>
                  </div>
                  {viewingArticle.fileType && (
                    <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                      <span style={{fontSize:'12px',color:'var(--text-muted)'}}>Тип файла</span>
                      <span style={{fontSize:'11px',fontWeight:600,color:'var(--blue)',background:'var(--blue-bg)',padding:'2px 7px',borderRadius:'5px'}}>{viewingArticle.fileType.toUpperCase()}</span>
                    </div>
                  )}
                </div>
              </div>

              {viewingArticle.fileUrl && (
                <div style={{background:'var(--bg-primary)',border:'0.5px solid var(--border)',borderRadius:'12px',padding:'16px'}}>
                  <p style={{fontSize:'11px',fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',margin:'0 0 12px'}}>Файл</p>
                  <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'12px'}}>
                    <FileIcon type={viewingArticle.fileType||''}/>
                    <p style={{fontSize:'12px',color:'var(--text-primary)',margin:0,wordBreak:'break-word'}}>{viewingArticle.fileName}</p>
                  </div>
                  <a href={viewingArticle.fileUrl} download={viewingArticle.fileName} target="_blank" rel="noreferrer"
                    style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',background:'var(--accent)',color:'white',borderRadius:'8px',padding:'9px',fontSize:'13px',textDecoration:'none',fontWeight:500}}>
                    <i className="ti ti-download" aria-hidden="true"/> Скачать
                  </a>
                </div>
              )}

              {/* Other articles in category */}
              {articles.filter(a=>a.id!==viewingArticle.id).length>0 && (
                <div style={{background:'var(--bg-primary)',border:'0.5px solid var(--border)',borderRadius:'12px',padding:'16px'}}>
                  <p style={{fontSize:'11px',fontWeight:600,color:'var(--text-muted)',textTransform:'uppercase',letterSpacing:'0.5px',margin:'0 0 12px'}}>Другие статьи</p>
                  {articles.filter(a=>a.id!==viewingArticle.id).slice(0,4).map(a=>(
                    <div key={a.id} onClick={()=>openArticle(a)}
                      style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',borderRadius:'8px',cursor:'pointer',marginBottom:'2px',transition:'background 0.1s'}}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='var(--bg-secondary)'}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                      <i className="ti ti-file-text" style={{fontSize:'14px',color:'var(--text-muted)',flexShrink:0}} aria-hidden="true"/>
                      <span style={{fontSize:'12px',color:'var(--text-primary)',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── EDITOR ── */}
        {view==='editor' && editArticle && (
          <div style={{maxWidth:'800px',margin:'0 auto'}}>
            <div style={{background:'var(--bg-primary)',border:'0.5px solid var(--border)',borderRadius:'14px',padding:'28px 32px',display:'flex',flexDirection:'column',gap:'16px'}}>
              <input placeholder="Название статьи" value={editArticle.title} onChange={e=>setEditArticle({...editArticle,title:e.target.value})}
                style={{...inp,fontSize:'20px',fontWeight:600,border:'none',borderBottom:'1.5px solid var(--border)',borderRadius:0,padding:'8px 0',background:'transparent'}}/>
              <select value={editArticle.categoryId??''} onChange={e=>setEditArticle({...editArticle,categoryId:e.target.value})} style={inp}>
                <option value="">Выберите категорию</option>
                {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
              <textarea placeholder="Содержимое статьи..." value={editArticle.content??''} onChange={e=>setEditArticle({...editArticle,content:e.target.value})} rows={14} style={{...inp,resize:'vertical',lineHeight:1.7}}/>
              <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
                <input placeholder="Ссылка на файл (необязательно)" value={editArticle.fileUrl??''} onChange={e=>setEditArticle({...editArticle,fileUrl:e.target.value})} style={{...inp,flex:1}}/>
                <label style={{background:'var(--accent-bg)',color:'var(--accent)',border:'0.5px solid var(--accent-border)',borderRadius:'8px',padding:'8px 16px',fontSize:'13px',cursor:'pointer',fontWeight:500,whiteSpace:'nowrap',flexShrink:0,display:'flex',alignItems:'center',gap:'6px'}}>
                  <i className="ti ti-upload" style={{fontSize:'14px'}} aria-hidden="true"/>
                  {uploading?'Загрузка...':'Загрузить файл'}
                  <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" style={{display:'none'}} onChange={e=>e.target.files?.[0]&&uploadFile(e.target.files[0])}/>
                </label>
              </div>
              {editArticle.fileName && (
                <div style={{display:'flex',alignItems:'center',gap:'10px',background:'var(--bg-secondary)',borderRadius:'8px',padding:'10px 14px'}}>
                  <FileIcon type={editArticle.fileType||''}/>
                  <div>
                    <p style={{fontSize:'13px',fontWeight:500,color:'var(--text-primary)',margin:0}}>{editArticle.fileName}</p>
                    <p style={{fontSize:'11px',color:'var(--text-muted)',margin:0}}>Файл прикреплён</p>
                  </div>
                  <button onClick={()=>setEditArticle({...editArticle,fileUrl:undefined,fileName:undefined,fileType:undefined})}
                    style={{marginLeft:'auto',background:'none',border:'none',cursor:'pointer',color:'var(--text-muted)',fontSize:'16px'}}>×</button>
                </div>
              )}
              <div style={{display:'flex',gap:'10px',justifyContent:'flex-end',marginTop:'4px'}}>
                <button onClick={()=>setView('articles')} style={{background:'var(--bg-secondary)',color:'var(--text-primary)',border:'0.5px solid var(--border)',borderRadius:'8px',padding:'9px 20px',fontSize:'13px',cursor:'pointer',fontWeight:500}}>Отмена</button>
                <button onClick={saveArticle} disabled={loading} style={{background:'var(--accent)',color:'white',border:'none',borderRadius:'8px',padding:'9px 20px',fontSize:'13px',cursor:'pointer',fontWeight:500}}>
                  {loading?'Сохранение...':'Сохранить →'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── CATEGORY MODAL ── */}
      {showCatModal && (
        <div style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.5)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,backdropFilter:'blur(2px)'}}>
          <div style={{background:'var(--bg-primary)',borderRadius:'16px',padding:'28px 32px',width:'420px',border:'0.5px solid var(--border)',boxShadow:'0 16px 48px rgba(0,0,0,0.15)'}}>
            <h3 style={{fontSize:'16px',fontWeight:600,color:'var(--text-primary)',margin:'0 0 22px'}}>Новая категория</h3>
            <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
              <input placeholder="Название" value={newCat.name} onChange={e=>setNewCat({...newCat,name:e.target.value})} style={inp}/>
              <input placeholder="Описание (необязательно)" value={newCat.description} onChange={e=>setNewCat({...newCat,description:e.target.value})} style={inp}/>
              <div>
                <p style={{fontSize:'11px',color:'var(--text-muted)',marginBottom:'8px',fontWeight:600,letterSpacing:'0.3px'}}>ИКОНКА</p>
                <div style={{display:'flex',gap:'8px',flexWrap:'wrap'}}>
                  {ICONS.map(icon=>(
                    <button key={icon} onClick={()=>setNewCat({...newCat,icon})}
                      style={{width:'38px',height:'38px',border:newCat.icon===icon?'2px solid var(--accent)':'1px solid var(--border)',borderRadius:'8px',background:newCat.icon===icon?'var(--accent-bg)':'var(--bg-secondary)',cursor:'pointer',fontSize:'18px',transition:'all 0.15s'}}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p style={{fontSize:'11px',color:'var(--text-muted)',marginBottom:'8px',fontWeight:600,letterSpacing:'0.3px'}}>ЦВЕТ</p>
                <div style={{display:'flex',gap:'8px'}}>
                  {COLORS.map(color=>(
                    <button key={color} onClick={()=>setNewCat({...newCat,color})}
                      style={{width:'28px',height:'28px',borderRadius:'50%',background:color,border:newCat.color===color?'3px solid var(--text-primary)':'2px solid transparent',cursor:'pointer',transition:'transform 0.15s'}}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.transform='scale(1.15)'}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.transform='none'}/>
                  ))}
                </div>
              </div>
              <div style={{display:'flex',gap:'10px',marginTop:'6px'}}>
                <button onClick={()=>setShowCatModal(false)} style={{flex:1,background:'var(--bg-secondary)',color:'var(--text-primary)',border:'0.5px solid var(--border)',borderRadius:'8px',padding:'10px',fontSize:'13px',cursor:'pointer',fontWeight:500}}>Отмена</button>
                <button onClick={createCat} style={{flex:1,background:'var(--accent)',color:'white',border:'none',borderRadius:'8px',padding:'10px',fontSize:'13px',cursor:'pointer',fontWeight:500}}>Создать →</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
