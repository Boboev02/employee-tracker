'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/usePermissions';

const API = 'https://employee-tracker.ru/api/v1/knowledge';
const ICONS = ['📁','📋','📄','📚','📝','🗂️','📌','💡','🔧','⚙️','🎯','📊'];
const COLORS = ['#7F77DD','#2563EB','#16A34A','#D97706','#DC2626','#0891B2','#7C3AED','#D97706'];

function FilePreviewIcon({ type }: { type: string }) {
  const configs: Record<string,{bg:string;c:string;l:string}> = {
    pdf:  { bg:'#FEE2E2', c:'#DC2626', l:'PDF' },
    docx: { bg:'#DBEAFE', c:'#2563EB', l:'DOC' },
    doc:  { bg:'#DBEAFE', c:'#2563EB', l:'DOC' },
    xlsx: { bg:'#DCFCE7', c:'#16A34A', l:'XLS' },
    xls:  { bg:'#DCFCE7', c:'#16A34A', l:'XLS' },
  };
  const cfg = configs[type] ?? { bg:'#F3F4F6', c:'#6B7280', l:'FILE' };
  return (
    <div style={{ width:'36px', height:'44px', background:cfg.bg, borderRadius:'8px', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
      <span style={{ fontSize:'9px', fontWeight:800, color:cfg.c }}>{cfg.l}</span>
    </div>
  );
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
  const [newCat, setNewCat]         = useState({ name:'', description:'', icon:'📁', color:'#7F77DD' });
  const [loading, setLoading]       = useState(false);
  const [uploading, setUploading]   = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t); loadCategories(t);
  }, []);

  const h  = (t: string) => ({ Authorization:'Bearer '+t, 'Content-Type':'application/json' });
  const loadCategories = async (t: string) => { const r=await fetch(API+'/categories',{headers:h(t)}); const d=await r.json(); if(Array.isArray(d)) setCategories(d); };
  const loadArticles   = async (catId?: string, q?: string) => {
    let url = API+'/articles';
    const p = new URLSearchParams();
    if(catId) p.set('categoryId',catId);
    if(q) p.set('search',q);
    if(p.toString()) url+='?'+p.toString();
    const r=await fetch(url,{headers:h(token)}); const d=await r.json(); if(Array.isArray(d)) setArticles(d);
  };
  const openCategory = (id: string) => { setSelectedCat(id); setView('articles'); loadArticles(id); };
  const handleSearch  = (q: string) => { setSearch(q); if(q.length>1){setView('articles');setSelectedCat(null);loadArticles(undefined,q);}else if(!q) setView('categories'); };
  const createCat     = async () => {
    if(!newCat.name) return;
    await fetch(API+'/categories',{method:'POST',headers:h(token),body:JSON.stringify(newCat)});
    setShowCatModal(false); setNewCat({name:'',description:'',icon:'📁',color:'#7F77DD'}); loadCategories(token);
  };
  const deleteCat = async (id: string) => { if(!confirm('Удалить категорию и все её статьи?')) return; await fetch(API+'/categories/'+id,{method:'DELETE',headers:h(token)}); loadCategories(token); if(selectedCat===id) setView('categories'); };
  const openArticle   = async (art: any) => {
    const t = localStorage.getItem('access_token')||token;
    const r=await fetch(API+'/articles/'+art.id,{headers:h(t)}); const d=await r.json();
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
  const deleteArticle = async (id: string) => { if(!confirm('Удалить статью?')) return; await fetch(API+'/articles/'+id,{method:'DELETE',headers:h(token)}); loadArticles(selectedCat??undefined); };
  const uploadFile    = async (file: File) => {
    setUploading(true);
    const t = localStorage.getItem('access_token')||token;
    const fd=new FormData(); fd.append('file',file);
    try {
      const r=await fetch('https://employee-tracker.ru/api/v1/upload/file',{method:'POST',headers:{Authorization:'Bearer '+t},body:fd});
      const d=await r.json();
      if(d.url) setEditArticle((prev:any)=>({...prev,fileUrl:d.url,fileName:d.fileName,fileType:d.fileType}));
    } catch(e){}
    setUploading(false);
  };

  const catObj = categories.find(c=>c.id===selectedCat);
  const inp: React.CSSProperties = {width:'100%',background:'#F8F7FF',border:'1px solid #EDE9FE',borderRadius:'10px',padding:'9px 14px',fontSize:'13px',color:'#1a1040',outline:'none',boxSizing:'border-box'};
  const card: React.CSSProperties = {background:'white',borderRadius:'20px',boxShadow:'0 4px 16px rgba(127,119,221,0.08)'};

  return (
    <div style={{minHeight:'100vh',background:'#ECEAF8'}}>
      {/* Header */}
      <div style={{background:'white',padding:'16px 28px',display:'flex',alignItems:'center',gap:'12px',position:'sticky',top:0,zIndex:10,boxShadow:'0 4px 16px rgba(127,119,221,0.06)'}}>
        {view!=='categories' && (
          <button onClick={()=>{setView('categories');setSelectedCat(null);setSearch('');}}
            style={{background:'#F8F7FF',border:'1px solid #EDE9FE',color:'#7F77DD',borderRadius:'20px',padding:'6px 14px',fontSize:'12px',fontWeight:700,cursor:'pointer',display:'flex',alignItems:'center',gap:'4px',flexShrink:0}}>
            ← Назад
          </button>
        )}
        <div style={{flex:1}}>
          <h1 style={{fontSize:'18px',fontWeight:800,color:'#1a1040',margin:0,letterSpacing:'-0.5px'}}>
            {view==='categories'?'База знаний':view==='editor'?(editArticle?.id?'Редактировать':'Новая статья'):view==='viewer'&&viewingArticle?viewingArticle.title:catObj?`${catObj.icon} ${catObj.name}`:'Поиск'}
          </h1>
          {view==='categories' && <p style={{fontSize:'11px',color:'#9B97CC',margin:'2px 0 0'}}>{categories.length} категорий · документы и инструкции</p>}
        </div>
        <div style={{position:'relative',flexShrink:0}}>
          <i className="ti ti-search" style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)',fontSize:'13px',color:'#9B97CC'}} aria-hidden="true"/>
          <input placeholder="Поиск по базе знаний..." value={search} onChange={e=>handleSearch(e.target.value)} style={{...inp,width:'220px',paddingLeft:'34px'}}/>
        </div>
        {view==='categories' && perms.isAdmin && (
          <button onClick={()=>setShowCatModal(true)} style={{background:'linear-gradient(135deg,#7F77DD,#5248C5)',color:'white',border:'none',borderRadius:'20px',padding:'9px 20px',fontSize:'13px',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',boxShadow:'0 4px 12px rgba(127,119,221,0.3)'}}>
            + Категория
          </button>
        )}
        {view==='articles' && perms.isAdmin && (
          <button onClick={()=>{setEditArticle({title:'',content:'',categoryId:selectedCat});setView('editor');}} style={{background:'linear-gradient(135deg,#7F77DD,#5248C5)',color:'white',border:'none',borderRadius:'20px',padding:'9px 20px',fontSize:'13px',fontWeight:700,cursor:'pointer',whiteSpace:'nowrap',boxShadow:'0 4px 12px rgba(127,119,221,0.3)'}}>
            + Статья
          </button>
        )}
        {view==='viewer' && viewingArticle && (
          <div style={{display:'flex',gap:'8px',flexShrink:0}}>
            {viewingArticle.fileUrl && (
              <a href={viewingArticle.fileUrl} download={viewingArticle.fileName} target="_blank" rel="noreferrer"
                style={{background:'#F8F7FF',color:'#7F77DD',border:'1px solid #EDE9FE',borderRadius:'20px',padding:'8px 16px',fontSize:'12px',textDecoration:'none',display:'flex',alignItems:'center',gap:'5px',fontWeight:700}}>
                <i className="ti ti-download" style={{fontSize:'13px'}} aria-hidden="true"/> Скачать
              </a>
            )}
            {perms.isAdmin && (
              <button onClick={()=>{setEditArticle(viewingArticle);setView('editor');}} style={{background:'#EDE9FE',color:'#7F77DD',border:'none',borderRadius:'20px',padding:'8px 16px',fontSize:'12px',cursor:'pointer',fontWeight:700}}>
                ✏️ Редактировать
              </button>
            )}
          </div>
        )}
      </div>

      <div style={{padding:'20px 28px'}}>

        {/* CATEGORIES */}
        {view==='categories' && (
          categories.length===0 ? (
            <div style={{...card,padding:'60px',textAlign:'center'}}>
              <div style={{fontSize:'52px',marginBottom:'16px'}}>📚</div>
              <p style={{fontSize:'16px',fontWeight:700,color:'#1a1040',margin:'0 0 6px'}}>База знаний пуста</p>
              <p style={{fontSize:'13px',color:'#9B97CC',margin:0}}>Создайте первую категорию для хранения документов</p>
            </div>
          ) : (
            <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(230px,1fr))',gap:'14px'}}>
              {categories.map(cat=>(
                <div key={cat.id} onClick={()=>openCategory(cat.id)}
                  style={{...card,padding:'20px',cursor:'pointer',transition:'all 0.2s',position:'relative',overflow:'hidden'}}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.transform='translateY(-3px)';(e.currentTarget as HTMLElement).style.boxShadow='0 12px 32px rgba(127,119,221,0.15)';}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.transform='none';(e.currentTarget as HTMLElement).style.boxShadow='0 4px 16px rgba(127,119,221,0.08)';}}>
                  {/* Top color bar */}
                  <div style={{position:'absolute',top:0,left:0,right:0,height:'4px',background:cat.color,borderRadius:'20px 20px 0 0'}}/>
                  <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'14px',marginTop:'4px'}}>
                    <div style={{width:'48px',height:'48px',borderRadius:'14px',background:cat.color+'18',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px'}}>
                      {cat.icon}
                    </div>
                    {perms.isAdmin && (
                      <button onClick={e=>{e.stopPropagation();deleteCat(cat.id);}}
                        style={{background:'none',border:'none',cursor:'pointer',color:'#D4D0F0',fontSize:'14px',padding:'4px',borderRadius:'8px',transition:'all 0.15s'}}
                        onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.color='#DC2626';(e.currentTarget as HTMLElement).style.background='#FEE2E2';}}
                        onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.color='#D4D0F0';(e.currentTarget as HTMLElement).style.background='none';}}>
                        <i className="ti ti-trash" aria-hidden="true"/>
                      </button>
                    )}
                  </div>
                  <p style={{fontSize:'14px',fontWeight:700,color:'#1a1040',margin:'0 0 4px'}}>{cat.name}</p>
                  <p style={{fontSize:'11px',color:'#9B97CC',margin:'0 0 12px',lineHeight:1.4}}>{cat.description||'Нет описания'}</p>
                  <div style={{display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                    <span style={{fontSize:'10px',fontWeight:700,color:cat.color,background:cat.color+'15',padding:'3px 9px',borderRadius:'20px'}}>{cat._count?.articles??0} статей</span>
                    <i className="ti ti-arrow-right" style={{fontSize:'14px',color:'#C4C0E8'}} aria-hidden="true"/>
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* ARTICLES */}
        {view==='articles' && (
          articles.length===0 ? (
            <div style={{...card,padding:'60px',textAlign:'center'}}>
              <div style={{fontSize:'40px',marginBottom:'12px'}}>📄</div>
              <p style={{fontSize:'14px',fontWeight:700,color:'#1a1040',margin:'0 0 4px'}}>Нет статей</p>
              <p style={{fontSize:'12px',color:'#9B97CC',margin:0}}>Создайте первую статью в этой категории</p>
            </div>
          ) : (
            <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
              {articles.map(art=>(
                <div key={art.id} style={{...card,padding:'14px 18px',display:'flex',alignItems:'center',gap:'14px',cursor:'pointer',transition:'all 0.15s'}}
                  onClick={()=>openArticle(art)}
                  onMouseEnter={e=>{(e.currentTarget as HTMLElement).style.transform='translateX(4px)';(e.currentTarget as HTMLElement).style.boxShadow='0 8px 24px rgba(127,119,221,0.12)';}}
                  onMouseLeave={e=>{(e.currentTarget as HTMLElement).style.transform='none';(e.currentTarget as HTMLElement).style.boxShadow='0 4px 16px rgba(127,119,221,0.08)';}}>
                  {art.fileType ? <FilePreviewIcon type={art.fileType}/> : (
                    <div style={{width:'36px',height:'44px',background:'#EDE9FE',borderRadius:'8px',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <i className="ti ti-file-text" style={{fontSize:'18px',color:'#7F77DD'}} aria-hidden="true"/>
                    </div>
                  )}
                  <div style={{flex:1,minWidth:0}}>
                    <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'3px'}}>
                      {art.isPinned&&<span style={{fontSize:'12px'}}>📌</span>}
                      <span style={{fontSize:'14px',fontWeight:700,color:'#1a1040',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{art.title}</span>
                      {art.fileUrl&&<span style={{fontSize:'9px',fontWeight:700,color:'#2563EB',background:'#DBEAFE',padding:'2px 7px',borderRadius:'6px',flexShrink:0}}>{art.fileType?.toUpperCase()||'FILE'}</span>}
                    </div>
                    <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
                      {art.category&&<span style={{fontSize:'11px',color:'#9B97CC'}}>{art.category.icon} {art.category.name}</span>}
                      <span style={{fontSize:'11px',color:'#9B97CC'}}>👁 {art.views}</span>
                      <span style={{fontSize:'11px',color:'#9B97CC'}}>{new Date(art.updatedAt).toLocaleDateString('ru',{day:'numeric',month:'short',year:'numeric'})}</span>
                    </div>
                  </div>
                  <div style={{display:'flex',gap:'6px',flexShrink:0}}>
                    {art.fileUrl&&(
                      <a href={art.fileUrl} download={art.fileName} target="_blank" rel="noreferrer" onClick={e=>e.stopPropagation()}
                        style={{background:'#F8F7FF',border:'1px solid #EDE9FE',borderRadius:'20px',padding:'5px 12px',fontSize:'11px',color:'#7F77DD',textDecoration:'none',display:'flex',alignItems:'center',gap:'4px',fontWeight:600}}>
                        <i className="ti ti-download" style={{fontSize:'12px'}} aria-hidden="true"/> Скачать
                      </a>
                    )}
                    {perms.isAdmin&&(
                      <>
                        <button onClick={e=>{e.stopPropagation();setEditArticle(art);setView('editor');}} style={{background:'#EDE9FE',color:'#7F77DD',border:'none',borderRadius:'20px',padding:'5px 10px',fontSize:'12px',cursor:'pointer',fontWeight:700}}>✏️</button>
                        <button onClick={e=>{e.stopPropagation();deleteArticle(art.id);}} style={{background:'#FEE2E2',color:'#DC2626',border:'none',borderRadius:'20px',padding:'5px 10px',fontSize:'12px',cursor:'pointer',fontWeight:700}}>🗑</button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )
        )}

        {/* VIEWER */}
        {view==='viewer'&&viewingArticle&&(
          <div style={{display:'grid',gridTemplateColumns:'1fr 300px',gap:'16px',alignItems:'start'}}>
            <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
              <div style={{...card,padding:'28px 32px'}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'16px',flexWrap:'wrap'}}>
                  {viewingArticle.category&&<span style={{fontSize:'10px',fontWeight:700,color:'#7F77DD',background:'#EDE9FE',padding:'3px 10px',borderRadius:'20px'}}>{viewingArticle.category.icon} {viewingArticle.category.name}</span>}
                  <span style={{fontSize:'11px',color:'#9B97CC'}}>👁 {viewingArticle.views} просмотров</span>
                  <span style={{fontSize:'11px',color:'#9B97CC'}}>{new Date(viewingArticle.updatedAt).toLocaleDateString('ru',{day:'numeric',month:'long',year:'numeric'})}</span>
                </div>
                {viewingArticle.content&&<div style={{fontSize:'14px',lineHeight:1.8,color:'#374151',whiteSpace:'pre-wrap'}}>{viewingArticle.content}</div>}
                {!viewingArticle.content&&!viewingArticle.fileUrl&&<p style={{color:'#9B97CC',fontSize:'13px',fontStyle:'italic'}}>Нет содержимого</p>}
              </div>

              {viewingArticle.fileUrl&&(
                <div style={{...card,overflow:'hidden'}}>
                  <div style={{padding:'12px 18px',borderBottom:'1px solid #F3F0FF',display:'flex',alignItems:'center',gap:'12px'}}>
                    <FilePreviewIcon type={viewingArticle.fileType||''}/>
                    <div style={{flex:1,minWidth:0}}>
                      <p style={{fontSize:'13px',fontWeight:700,color:'#1a1040',margin:0,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{viewingArticle.fileName}</p>
                      <p style={{fontSize:'11px',color:'#9B97CC',margin:'2px 0 0'}}>{viewingArticle.fileType?.toUpperCase()} документ</p>
                    </div>
                    <div style={{display:'flex',gap:'6px',flexShrink:0}}>
                      <a href={viewingArticle.fileUrl} target="_blank" rel="noreferrer" style={{fontSize:'11px',padding:'4px 10px',borderRadius:'20px',background:'#F8F7FF',color:'#7F77DD',textDecoration:'none',fontWeight:700}}>Открыть ↗</a>
                    </div>
                  </div>
                  {viewingArticle.fileType==='pdf'?(
                    <iframe src={viewingArticle.fileUrl} style={{width:'100%',height:'600px',border:'none',display:'block'}} title={viewingArticle.fileName}/>
                  ):['docx','doc','xlsx','xls'].includes(viewingArticle.fileType)?(
                    <iframe src={`https://docs.google.com/viewer?url=${encodeURIComponent(viewingArticle.fileUrl)}&embedded=true`} style={{width:'100%',height:'600px',border:'none',display:'block'}} title={viewingArticle.fileName}/>
                  ):null}
                </div>
              )}
            </div>

            <div style={{display:'flex',flexDirection:'column',gap:'12px',position:'sticky',top:'80px'}}>
              <div style={{...card,padding:'18px'}}>
                <p style={{fontSize:'10px',fontWeight:700,color:'#9B97CC',textTransform:'uppercase',letterSpacing:'0.5px',margin:'0 0 12px'}}>Информация</p>
                <div style={{display:'flex',flexDirection:'column',gap:'8px'}}>
                  <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontSize:'12px',color:'#9B97CC'}}>Просмотры</span><span style={{fontSize:'12px',fontWeight:700,color:'#1a1040'}}>{viewingArticle.views}</span></div>
                  <div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontSize:'12px',color:'#9B97CC'}}>Обновлено</span><span style={{fontSize:'12px',fontWeight:600,color:'#1a1040'}}>{new Date(viewingArticle.updatedAt).toLocaleDateString('ru',{day:'numeric',month:'short'})}</span></div>
                  {viewingArticle.fileType&&<div style={{display:'flex',justifyContent:'space-between'}}><span style={{fontSize:'12px',color:'#9B97CC'}}>Тип</span><span style={{fontSize:'10px',fontWeight:700,color:'#2563EB',background:'#DBEAFE',padding:'2px 8px',borderRadius:'8px'}}>{viewingArticle.fileType.toUpperCase()}</span></div>}
                </div>
              </div>

              {viewingArticle.fileUrl&&(
                <div style={{...card,padding:'18px'}}>
                  <p style={{fontSize:'10px',fontWeight:700,color:'#9B97CC',textTransform:'uppercase',letterSpacing:'0.5px',margin:'0 0 12px'}}>Файл</p>
                  <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'12px'}}>
                    <FilePreviewIcon type={viewingArticle.fileType||''}/>
                    <p style={{fontSize:'12px',color:'#374151',margin:0,wordBreak:'break-word'}}>{viewingArticle.fileName}</p>
                  </div>
                  <a href={viewingArticle.fileUrl} download={viewingArticle.fileName} target="_blank" rel="noreferrer"
                    style={{display:'flex',alignItems:'center',justifyContent:'center',gap:'6px',background:'linear-gradient(135deg,#7F77DD,#5248C5)',color:'white',borderRadius:'12px',padding:'10px',fontSize:'13px',textDecoration:'none',fontWeight:700,boxShadow:'0 4px 12px rgba(127,119,221,0.3)'}}>
                    <i className="ti ti-download" aria-hidden="true"/> Скачать
                  </a>
                </div>
              )}

              {articles.filter(a=>a.id!==viewingArticle.id).length>0&&(
                <div style={{...card,padding:'18px'}}>
                  <p style={{fontSize:'10px',fontWeight:700,color:'#9B97CC',textTransform:'uppercase',letterSpacing:'0.5px',margin:'0 0 12px'}}>Другие статьи</p>
                  {articles.filter(a=>a.id!==viewingArticle.id).slice(0,4).map(a=>(
                    <div key={a.id} onClick={()=>openArticle(a)}
                      style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 8px',borderRadius:'10px',cursor:'pointer',marginBottom:'2px',transition:'background 0.1s'}}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#F8F7FF'}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
                      <i className="ti ti-file-text" style={{fontSize:'14px',color:'#C4C0E8',flexShrink:0}} aria-hidden="true"/>
                      <span style={{fontSize:'12px',color:'#374151',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{a.title}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* EDITOR */}
        {view==='editor'&&editArticle&&(
          <div style={{maxWidth:'800px',margin:'0 auto'}}>
            <div style={{...card,padding:'32px',display:'flex',flexDirection:'column',gap:'16px'}}>
              <input placeholder="Название статьи" value={editArticle.title} onChange={e=>setEditArticle({...editArticle,title:e.target.value})}
                style={{...inp,fontSize:'20px',fontWeight:800,border:'none',borderBottom:'2px solid #EDE9FE',borderRadius:0,padding:'8px 0',background:'transparent',letterSpacing:'-0.5px',color:'#1a1040'}}/>
              <select value={editArticle.categoryId??''} onChange={e=>setEditArticle({...editArticle,categoryId:e.target.value})} style={inp}>
                <option value="">Выберите категорию</option>
                {categories.map(c=><option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
              <textarea placeholder="Содержимое статьи..." value={editArticle.content??''} onChange={e=>setEditArticle({...editArticle,content:e.target.value})} rows={14} style={{...inp,resize:'vertical',lineHeight:1.7}}/>
              <div style={{display:'flex',gap:'10px',alignItems:'center'}}>
                <input placeholder="Ссылка на файл" value={editArticle.fileUrl??''} onChange={e=>setEditArticle({...editArticle,fileUrl:e.target.value})} style={{...inp,flex:1}}/>
                <label style={{background:'#EDE9FE',color:'#7F77DD',border:'1px solid #D4CFFC',borderRadius:'12px',padding:'9px 16px',fontSize:'12px',cursor:'pointer',fontWeight:700,whiteSpace:'nowrap',flexShrink:0,display:'flex',alignItems:'center',gap:'5px'}}>
                  <i className="ti ti-upload" style={{fontSize:'13px'}} aria-hidden="true"/>
                  {uploading?'Загрузка...':'Загрузить файл'}
                  <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" style={{display:'none'}} onChange={e=>e.target.files?.[0]&&uploadFile(e.target.files[0])}/>
                </label>
              </div>
              {editArticle.fileName&&(
                <div style={{display:'flex',alignItems:'center',gap:'10px',background:'#F8F7FF',borderRadius:'12px',padding:'10px 14px',border:'1px solid #EDE9FE'}}>
                  <FilePreviewIcon type={editArticle.fileType||''}/>
                  <div style={{flex:1}}>
                    <p style={{fontSize:'13px',fontWeight:600,color:'#1a1040',margin:0}}>{editArticle.fileName}</p>
                    <p style={{fontSize:'10px',color:'#9B97CC',margin:0}}>Файл прикреплён</p>
                  </div>
                  <button onClick={()=>setEditArticle({...editArticle,fileUrl:undefined,fileName:undefined,fileType:undefined})} style={{background:'none',border:'none',cursor:'pointer',color:'#C4C0E8',fontSize:'18px'}}>×</button>
                </div>
              )}
              <div style={{display:'flex',gap:'10px',justifyContent:'flex-end',marginTop:'4px'}}>
                <button onClick={()=>setView('articles')} style={{background:'#F8F7FF',color:'#6B7280',border:'1px solid #EDE9FE',borderRadius:'12px',padding:'10px 22px',fontSize:'13px',cursor:'pointer',fontWeight:600}}>Отмена</button>
                <button onClick={saveArticle} disabled={loading} style={{background:'linear-gradient(135deg,#7F77DD,#5248C5)',color:'white',border:'none',borderRadius:'12px',padding:'10px 22px',fontSize:'13px',cursor:'pointer',fontWeight:700,boxShadow:'0 4px 12px rgba(127,119,221,0.3)'}}>
                  {loading?'Сохранение...':'Сохранить →'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Category Modal */}
      {showCatModal&&(
        <div style={{position:'fixed',inset:0,background:'rgba(26,16,64,0.4)',display:'flex',alignItems:'center',justifyContent:'center',zIndex:1000,backdropFilter:'blur(4px)'}}>
          <div style={{background:'white',borderRadius:'24px',padding:'28px 32px',width:'440px',boxShadow:'0 24px 64px rgba(127,119,221,0.2)'}}>
            <h3 style={{fontSize:'18px',fontWeight:800,color:'#1a1040',margin:'0 0 22px',letterSpacing:'-0.5px'}}>Новая категория</h3>
            <div style={{display:'flex',flexDirection:'column',gap:'14px'}}>
              <input placeholder="Название" value={newCat.name} onChange={e=>setNewCat({...newCat,name:e.target.value})} style={inp}/>
              <input placeholder="Описание" value={newCat.description} onChange={e=>setNewCat({...newCat,description:e.target.value})} style={inp}/>
              <div>
                <p style={{fontSize:'10px',color:'#9B97CC',marginBottom:'8px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.4px'}}>Иконка</p>
                <div style={{display:'flex',gap:'7px',flexWrap:'wrap'}}>
                  {ICONS.map(icon=>(
                    <button key={icon} onClick={()=>setNewCat({...newCat,icon})}
                      style={{width:'40px',height:'40px',border:newCat.icon===icon?'2px solid #7F77DD':'1px solid #EDE9FE',borderRadius:'10px',background:newCat.icon===icon?'#EDE9FE':'#F8F7FF',cursor:'pointer',fontSize:'18px',transition:'all 0.15s'}}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p style={{fontSize:'10px',color:'#9B97CC',marginBottom:'8px',fontWeight:700,textTransform:'uppercase',letterSpacing:'0.4px'}}>Цвет</p>
                <div style={{display:'flex',gap:'8px'}}>
                  {COLORS.map(color=>(
                    <button key={color} onClick={()=>setNewCat({...newCat,color})}
                      style={{width:'28px',height:'28px',borderRadius:'50%',background:color,border:newCat.color===color?'3px solid #1a1040':'2px solid transparent',cursor:'pointer',transition:'transform 0.15s'}}
                      onMouseEnter={e=>(e.currentTarget as HTMLElement).style.transform='scale(1.2)'}
                      onMouseLeave={e=>(e.currentTarget as HTMLElement).style.transform='none'}/>
                  ))}
                </div>
              </div>
              <div style={{display:'flex',gap:'10px',marginTop:'6px'}}>
                <button onClick={()=>setShowCatModal(false)} style={{flex:1,background:'#F8F7FF',color:'#6B7280',border:'1px solid #EDE9FE',borderRadius:'12px',padding:'11px',fontSize:'13px',cursor:'pointer',fontWeight:600}}>Отмена</button>
                <button onClick={createCat} style={{flex:1,background:'linear-gradient(135deg,#7F77DD,#5248C5)',color:'white',border:'none',borderRadius:'12px',padding:'11px',fontSize:'13px',cursor:'pointer',fontWeight:700}}>Создать →</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
