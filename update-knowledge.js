const fs = require('fs');
const os = require('os');
const path = os.homedir() + '/employee-tracker/apps/frontend/app/dashboard/knowledge/page.tsx';
let c = fs.readFileSync(path, 'utf8');

// Добавляем импорт usePermissions
c = c.replace(
  `import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';`,
  `import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/usePermissions';`
);

// Добавляем perms и viewArticle state
c = c.replace(
  `  const router = useRouter();
  const [token, setToken] = useState('');`,
  `  const router = useRouter();
  const perms = usePermissions();
  const [token, setToken] = useState('');
  const [viewingArticle, setViewingArticle] = useState<any>(null);`
);

// Добавляем функцию openArticle
c = c.replace(
  `  const inputStyle: any = {`,
  `  const openArticle = async (art: any) => {
    const t = localStorage.getItem('access_token') || token;
    if (!t) return;
    const res = await fetch(\`\${API}/articles/\${art.id}\`, { headers: h(t) });
    const data = await res.json();
    setViewingArticle(data);
    setView('view' as any);
  };

  const inputStyle: any = {`
);

// Обновляем карточки статей — добавляем просмотр и скачивание
c = c.replace(
  `                <div key={art.id}
                style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => { setEditArticle(art); setView('editor'); }}>`,
  `                <div key={art.id}
                style={{ background: 'var(--bg-primary)', border: '0.5px solid var(--border)', borderRadius: '10px', padding: '16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                <div style={{ flex: 1, cursor: 'pointer' }} onClick={() => openArticle(art)}>`
);

// Обновляем кнопки действий в карточке статьи
c = c.replace(
  `                <button onClick={() => deleteArticle(art.id)}
                  style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '16px' }}>🗑</button>`,
  `                <div style={{ display: 'flex', gap: '6px' }}>
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
                </div>`
);

// Скрываем кнопку "+ Статья" для не-админов
c = c.replace(
  `        {view === 'articles' && (
          <button onClick={() => { setEditArticle({ title: '', content: '', categoryId: selectedCategory }); setView('editor'); }}
            style={{ background: '#8b7cf6', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>
            + Статья
          </button>
        )}`,
  `        {view === 'articles' && perms.isAdmin && (
          <button onClick={() => { setEditArticle({ title: '', content: '', categoryId: selectedCategory }); setView('editor'); }}
            style={{ background: '#8b7cf6', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>
            + Статья
          </button>
        )}`
);

// Скрываем кнопку "+ Категория" для не-админов
c = c.replace(
  `        {view === 'categories' && (
          <button onClick={() => setShowCatModal(true)}
            style={{ background: '#8b7cf6', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>
            + Категория
          </button>
        )}`,
  `        {view === 'categories' && perms.isAdmin && (
          <button onClick={() => setShowCatModal(true)}
            style={{ background: '#8b7cf6', color: 'white', border: 'none', borderRadius: '8px', padding: '8px 16px', fontSize: '13px', cursor: 'pointer', fontWeight: 500 }}>
            + Категория
          </button>
        )}`
);

// Добавляем VIEW режим перед EDITOR VIEW
c = c.replace(
  `        {/* EDITOR VIEW */}`,
  `        {/* VIEW ARTICLE */}
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

        {/* EDITOR VIEW */}`
);

fs.writeFileSync(path, c);
console.log('Done');
