'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/usePermissions';

const API = 'https://employee-tracker.ru/api/v1/knowledge';

const ICONS = ['📁', '📋', '📄', '📚', '📝', '🗂️', '📌', '💡', '🔧', '⚙️', '🎯', '📊'];
const COLORS = ['#8b7cf6', '#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#ec4899', '#6366f1', '#14b8a6'];

export default function KnowledgePage() {
  const router = useRouter();
  const perms = usePermissions();
  const [token, setToken] = useState('');
  const [viewingArticle, setViewingArticle] = useState<any>(null);
  const [categories, setCategories] = useState<any[]>([]);
  const [articles, setArticles] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'categories' | 'articles' | 'editor'>('categories');
  const [editArticle, setEditArticle] = useState<any>(null);
  const [showCatModal, setShowCatModal] = useState(false);
  const [newCat, setNewCat] = useState({ name: '', description: '', icon: '📁', color: '#8b7cf6' });
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    loadCategories(t);
  }, []);

  const h = (t: string) => ({ Authorization: 'Bearer ' + t, 'Content-Type': 'application/json' });

  const loadCategories = async (t: string) => {
    const res = await fetch(API + '/categories', { headers: h(t) });
    const data = await res.json();
    if (Array.isArray(data)) setCategories(data);
  };

  const loadArticles = async (catId?: string, q?: string) => {
    let url = API + '/articles';
    const params = new URLSearchParams();
    if (catId) params.set('categoryId', catId);
    if (q) params.set('search', q);
    if (params.toString()) url += '?' + params.toString();
    const res = await fetch(url, { headers: h(token) });
    const data = await res.json();
    if (Array.isArray(data)) setArticles(data);
  };

  const openCategory = (catId: string) => {
    setSelectedCategory(catId);
    setView('articles');
    loadArticles(catId);
  };

  const handleSearch = (q: string) => {
    setSearch(q);
    if (q.length > 1) {
      setView('articles');
      setSelectedCategory(null);
      loadArticles(undefined, q);
    } else if (!q) {
      setView('categories');
    }
  };

  const createCategory = async () => {
    if (!newCat.name) return;
    await fetch(API + '/categories', { method: 'POST', headers: h(token), body: JSON.stringify(newCat) });
    setShowCatModal(false);
    setNewCat({ name: '', description: '', icon: '📁', color: '#8b7cf6' });
    loadCategories(token);
  };

  const deleteCategory = async (id: string) => {
    if (!confirm('Удалить категорию?')) return;
    await fetch(API + '/categories/' + id, { method: 'DELETE', headers: h(token) });
    loadCategories(token);
    if (selectedCategory === id) setView('categories');
  };

  const saveArticle = async () => {
    if (!editArticle?.title) return;
    const t = localStorage.getItem('access_token') || token;
    if (!t) return;
    setLoading(true);
    try {
      if (editArticle.id) {
        await fetch(API + '/articles/' + editArticle.id, { method: 'PUT', headers: h(t), body: JSON.stringify(editArticle) });
      } else {
        await fetch(API + '/articles', { method: 'POST', headers: h(t), body: JSON.stringify(editArticle) });
      }
      setView('articles');
      loadArticles(selectedCategory ?? undefined);
    } catch(e) {
      console.error('Save error:', e);
    }
    setLoading(false);
  };

  const deleteArticle = async (id: string) => {
    if (!confirm('Удалить статью?')) return;
    await fetch(API + '/articles/' + id, { method: 'DELETE', headers: h(token) });
    loadArticles(selectedCategory ?? undefined);
  };

  const selectedCat = categories.find(c => c.id === selectedCategory);

  const uploadFile = async (file: File) => {
    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/upload/file', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token },
        body: formData,
      });
      const data = await res.json();
      if (data.url) {
        setEditArticle((prev: any) => ({ ...prev, fileUrl: data.url, fileName: data.fileName, fileType: data.fileType }));
      }
    } catch {}
    setUploading(false);
  };

  const openArticle = async (art: any) => {
    const t = localStorage.getItem('access_token') || token;
    if (!t) return;
    const res = await fetch(`${API}/articles/${art.id}`, { headers: h(t) });
    const data = await res.json();
    setViewingArticle(data);
    setView('view' as any);
  };

  const inputStyle: any = {
    width: '100%', background: 'var(--bg-secondary)', border: '0.5px solid var(--border)',
    borderRadius: '8px', padding: '8px 12px', fontSize: '13px', color: 'var(--text-primary)',
    outline: 'none', fontFamily: 'inherit', boxSizing: 'border-box',
  };

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg-tertiary)' }}>
      {/* Header */}
      <div style={{ background: 'var(--bg-primary)', borderBottom: '0.5px solid var(--border)', padding: '16px 24px', display: 'flex', alignItems: 'center', gap: '16px' }}>
        {view !== 'categories' && (
          <button onClick={() => { setView('categories'); setSelectedCategory(null); setSearch(''); }}
            style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            ← Назад
          </button>
        )}
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: '18px', fontWeight: 600, margin: 0, color: 'var(--text-primary)' }}>
            {view === 'categories' ? '📚 База знаний' : view === 'editor' ? (editArticle?.id ? 'Редактировать' : 'Новая статья') : selectedCat ? `${selectedCat.icon} ${selectedCat.name}` : '🔍 Поиск'}
          </h1>
        </div>
        {/* Search */}
        <input
          placeholder="🔍 Поиск по базе знаний..."
          value={search}
          onChange={e => handleSearch(e.target.value)}
          style={{ ...inputStyle, width: '280px' }}
        />
        {view === 'categories' && perms.isAdmin && (
          <button onClick={() => setShowCatModal(true)}
            style={{ background: '#8b7cf6', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>
            + Категория
          </button>
        )}
        {view === 'articles' && perms.isAdmin && (
          <button onClick={() => { setEditArticle({ title: '', content: '', categoryId: selectedCategory }); setView('editor'); }}
            style={{ background: '#8b7cf6', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>
            + Статья
          </button>
        )}
      </div>

      <div style={{ padding: '24px' }}>
        {/* CATEGORIES VIEW */}
        {view === 'categories' && (
          <div>
            {categories.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📚</div>
                <div style={{ fontSize: '16px', marginBottom: '8px' }}>База знаний пуста</div>
                <div style={{ fontSize: '13px' }}>Создайте первую категорию</div>
              </div>
            ) : (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: '16px' }}>
                {categories.map(cat => (
                  <div key={cat.id}
                    onClick={() => openCategory(cat.id)}
                    style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '20px', cursor: 'pointer', transition: 'all 0.15s', position: 'relative' }}
                    onMouseEnter={e => { (e.currentTarget as HTMLElement).style.borderColor = cat.color; (e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'; }}
                    onMouseLeave={e => { (e.currentTarget as HTMLElement).style.borderColor = 'var(--border)'; (e.currentTarget as HTMLElement).style.transform = 'none'; }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '10px' }}>
                      <div style={{ width: '44px', height: '44px', borderRadius: '10px', background: cat.color + '20', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                        {cat.icon}
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{cat.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{cat._count?.articles ?? 0} статей</div>
                      </div>
                      <button onClick={e => { e.stopPropagation(); deleteCategory(cat.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px', opacity: 0.5 }}>🗑</button>
                    </div>
                    {cat.description && <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>{cat.description}</div>}
                    <div style={{ position: 'absolute', bottom: 0, left: '20px', right: '20px', height: '3px', background: cat.color, borderRadius: '0 0 4px 4px', opacity: 0.6 }} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ARTICLES VIEW */}
        {view === 'articles' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {articles.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '60px', color: 'var(--text-muted)' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📄</div>
                <div style={{ fontSize: '14px' }}>Нет статей</div>
              </div>
            ) : articles.map(art => (
              <div key={art.id}
                style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => { setEditArticle(art); setView('editor'); }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                    {art.isPinned && <span style={{ fontSize: '12px' }}>📌</span>}
                    <span style={{ fontWeight: 600, fontSize: '14px', color: 'var(--text-primary)' }}>{art.title}</span>
                    {art.fileUrl && <span style={{ fontSize: '11px', padding: '2px 6px', background: '#eff6ff', color: '#3b82f6', borderRadius: '4px' }}>📎 файл</span>}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '12px' }}>
                    <span>{art.category?.icon} {art.category?.name}</span>
                    <span>👁 {art.views}</span>
                    <span>{new Date(art.updatedAt).toLocaleDateString('ru')}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '6px' }}>
                  {art.fileUrl && (
                    <a href={art.fileUrl} download={art.fileName} target="_blank" rel="noreferrer"
                      onClick={e => e.stopPropagation()}
                      style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: '6px', padding: '4px 10px', fontSize: '12px', color: 'var(--text-primary)', textDecoration: 'none', cursor: 'pointer' }}>
                      ⬇ Скачать
                    </a>
                  )}
                  {perms.isAdmin && (
                    <>
                      <button onClick={e => { e.stopPropagation(); setEditArticle(art); setView('editor'); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px' }}>✏️</button>
                      <button onClick={e => { e.stopPropagation(); deleteArticle(art.id); }}
                        style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px' }}>🗑</button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* VIEW ARTICLE */}
        {(view as any) === 'view' && viewingArticle && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '32px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '24px' }}>
                <div>
                  <h1 style={{ fontSize: '24px', fontWeight: 600, margin: '0 0 8px', color: 'var(--text-primary)' }}>{viewingArticle.title}</h1>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', display: 'flex', gap: '12px' }}>
                    <span>{viewingArticle.category?.icon} {viewingArticle.category?.name}</span>
                    <span>👁 {viewingArticle.views} просмотров</span>
                    <span>{new Date(viewingArticle.updatedAt).toLocaleDateString('ru')}</span>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {viewingArticle.fileUrl && (
                    <a href={viewingArticle.fileUrl} download={viewingArticle.fileName} target="_blank" rel="noreferrer"
                      style={{ background: '#8b7cf6', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', textDecoration: 'none', fontWeight: 500 }}>
                      ⬇ Скачать файл
                    </a>
                  )}
                  {perms.isAdmin && (
                    <button onClick={() => { setEditArticle(viewingArticle); setView('editor'); }}
                      style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                      ✏️ Редактировать
                    </button>
                  )}
                </div>
              </div>
              {viewingArticle.fileUrl && (
                <div style={{ marginBottom: '24px', padding: '12px 16px', background: 'var(--bg-secondary)', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span style={{ fontSize: '24px' }}>
                    {viewingArticle.fileType === 'pdf' ? '📄' : viewingArticle.fileType === 'docx' || viewingArticle.fileType === 'doc' ? '📝' : '📎'}
                  </span>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-primary)' }}>{viewingArticle.fileName}</div>
                    <a href={viewingArticle.fileUrl} target="_blank" rel="noreferrer"
                      style={{ fontSize: '12px', color: '#8b7cf6', textDecoration: 'none' }}>
                      Открыть файл →
                    </a>
                  </div>
                </div>
              )}
              {viewingArticle.content && (
                <div style={{ fontSize: '14px', lineHeight: 1.8, color: 'var(--text-primary)', whiteSpace: 'pre-wrap' }}>
                  {viewingArticle.content}
                </div>
              )}
            </div>
          </div>
        )}

        {/* EDITOR VIEW */}
        {view === 'editor' && editArticle && (
          <div style={{ maxWidth: '800px', margin: '0 auto' }}>
            <div style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: '12px', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <input
                placeholder="Название статьи"
                value={editArticle.title}
                onChange={e => setEditArticle({ ...editArticle, title: e.target.value })}
                style={{ ...inputStyle, fontSize: '20px', fontWeight: 600, border: 'none', borderBottom: '0.5px solid var(--border)', borderRadius: 0, padding: '8px 0', background: 'transparent' }}
              />
              <select
                value={editArticle.categoryId ?? ''}
                onChange={e => setEditArticle({ ...editArticle, categoryId: e.target.value })}
                style={inputStyle}
              >
                <option value="">Выберите категорию</option>
                {categories.map(c => <option key={c.id} value={c.id}>{c.icon} {c.name}</option>)}
              </select>
              <textarea
                placeholder="Содержимое статьи..."
                value={editArticle.content ?? ''}
                onChange={e => setEditArticle({ ...editArticle, content: e.target.value })}
                rows={16}
                style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.7 }}
              />
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                <input
                  placeholder="Ссылка на файл (необязательно)"
                  value={editArticle.fileUrl ?? ''}
                  onChange={e => setEditArticle({ ...editArticle, fileUrl: e.target.value })}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <label style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-primary)', whiteSpace: 'nowrap' }}>
                  {uploading ? '⏳ Загрузка...' : '📎 Загрузить файл'}
                  <input type="file" accept=".pdf,.doc,.docx,.xls,.xlsx,.txt" style={{ display: 'none' }} onChange={e => e.target.files?.[0] && uploadFile(e.target.files[0])} />
                </label>
              </div>
              {editArticle.fileName && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', padding: '6px 10px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                  📎 {editArticle.fileName}
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                <button onClick={() => setView('articles')}
                  style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                  Отмена
                </button>
                <button onClick={saveArticle} disabled={loading}
                  style={{ background: '#8b7cf6', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>
                  {loading ? 'Сохранение...' : 'Сохранить'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Category Modal */}
      {showCatModal && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div style={{ background: 'var(--bg-primary)', borderRadius: '16px', padding: '24px', width: '420px', border: '0.5px solid var(--border)' }}>
            <h3 style={{ margin: '0 0 20px', fontSize: '16px', fontWeight: 600 }}>Новая категория</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <input placeholder="Название" value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })} style={inputStyle} />
              <input placeholder="Описание (необязательно)" value={newCat.description} onChange={e => setNewCat({ ...newCat, description: e.target.value })} style={inputStyle} />
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Иконка</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {ICONS.map(icon => (
                    <button key={icon} onClick={() => setNewCat({ ...newCat, icon })}
                      style={{ width: '36px', height: '36px', border: newCat.icon === icon ? '2px solid #8b7cf6' : '0.5px solid var(--border)', borderRadius: '8px', background: 'var(--bg-secondary)', cursor: 'pointer', fontSize: '18px' }}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '8px' }}>Цвет</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {COLORS.map(color => (
                    <button key={color} onClick={() => setNewCat({ ...newCat, color })}
                      style={{ width: '28px', height: '28px', borderRadius: '50%', background: color, border: newCat.color === color ? '3px solid var(--text-primary)' : 'none', cursor: 'pointer' }} />
                  ))}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button onClick={() => setShowCatModal(false)}
                  style={{ background: 'var(--bg-secondary)', border: '0.5px solid var(--border)', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', cursor: 'pointer', color: 'var(--text-primary)' }}>
                  Отмена
                </button>
                <button onClick={createCategory}
                  style={{ background: '#8b7cf6', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 20px', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>
                  Создать
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
