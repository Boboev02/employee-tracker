const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

write('app/dashboard/tasks/[id]/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-gray-100 text-gray-600',
  IN_PROGRESS: 'bg-blue-100 text-blue-700',
  REVIEW: 'bg-yellow-100 text-yellow-700',
  DONE: 'bg-green-100 text-green-700',
  BLOCKED: 'bg-red-100 text-red-600',
};
const STATUS_LABELS: Record<string, string> = {
  NEW: 'Новая', IN_PROGRESS: 'В работе', REVIEW: 'Проверка', DONE: 'Готово', BLOCKED: 'Заблокирована',
};
const PRIORITY_COLORS: Record<string, string> = {
  CRITICAL: 'bg-red-100 text-red-600',
  HIGH: 'bg-orange-100 text-orange-600',
  MEDIUM: 'bg-blue-100 text-blue-600',
  LOW: 'bg-gray-100 text-gray-500',
};

export default function TaskDetailPage() {
  const router = useRouter();
  const { id } = useParams<{ id: string }>();
  const [token, setToken]     = useState('');
  const [user, setUser]       = useState<any>(null);
  const [task, setTask]       = useState<any>(null);
  const [comments, setComments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [comment, setComment] = useState('');
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    const u = localStorage.getItem('user');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    setUser(u ? JSON.parse(u) : null);
    loadTask(t);
  }, [id]);

  const loadTask = async (t: string) => {
    setLoading(true);
    try {
      const res = await fetch('http://localhost:3001/api/v1/tasks/' + id, {
        headers: { Authorization: 'Bearer ' + t },
      });
      const data = await res.json();
      setTask(data);
      setComments(Array.isArray(data.comments) ? data.comments : []);
    } finally { setLoading(false); }
  };

  const postComment = async () => {
    if (!comment.trim()) return;
    setPosting(true);
    try {
      const res = await fetch('http://localhost:3001/api/v1/tasks/' + id + '/comments', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body:    JSON.stringify({ content: comment.trim() }),
      });
      if (res.ok) {
        setComment('');
        loadTask(token);
      }
    } finally { setPosting(false); }
  };

  const moveTask = async (status: string) => {
    await fetch('http://localhost:3001/api/v1/tasks/' + id + '/move', {
      method:  'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
      body:    JSON.stringify({ status }),
    });
    loadTask(token);
  };

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Загрузка...</div>;
  if (!task)   return <div className="flex items-center justify-center h-64 text-gray-400">Задача не найдена</div>;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex items-center gap-4">
        <button onClick={() => router.push('/dashboard/tasks')}
          className="text-gray-400 hover:text-gray-600 text-sm">← Назад</button>
        <h1 className="text-lg font-bold text-gray-900 truncate flex-1">{task.title}</h1>
        <span className={"text-xs px-2 py-1 rounded-full font-medium " + (STATUS_COLORS[task.status] ?? 'bg-gray-100 text-gray-600')}>
          {STATUS_LABELS[task.status] ?? task.status}
        </span>
      </div>

      <div className="p-6 grid grid-cols-1 lg:grid-cols-3 gap-6">

        {/* Main content */}
        <div className="lg:col-span-2 flex flex-col gap-4">

          {/* Description */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Описание</h3>
            {task.description ? (
              <p className="text-sm text-gray-600 whitespace-pre-wrap">{task.description}</p>
            ) : (
              <p className="text-sm text-gray-400 italic">Описание не добавлено</p>
            )}
          </div>

          {/* Comments */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-4">
              Комментарии {comments.length > 0 && <span className="text-gray-400 font-normal">({comments.length})</span>}
            </h3>

            {/* Comment list */}
            <div className="flex flex-col gap-4 mb-5">
              {comments.length === 0 ? (
                <p className="text-sm text-gray-400 text-center py-4">Комментариев пока нет</p>
              ) : comments.map((c: any, i: number) => (
                <div key={c.id ?? i} className="flex gap-3">
                  <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                    {(c.author?.name ?? c.authorName ?? '?').charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2 mb-1">
                      <span className="text-sm font-semibold text-gray-900">
                        {c.author?.name ?? c.authorName ?? 'Пользователь'}
                      </span>
                      <span className="text-xs text-gray-400">
                        {new Date(c.createdAt).toLocaleString('ru', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </div>
                    <div className="bg-gray-50 rounded-lg px-3 py-2 text-sm text-gray-700 whitespace-pre-wrap">
                      {c.content}
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* New comment */}
            <div className="flex gap-3">
              <div className="w-7 h-7 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-1">
                {user?.name?.charAt(0) ?? 'U'}
              </div>
              <div className="flex-1">
                <textarea
                  value={comment}
                  onChange={e => setComment(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) postComment(); }}
                  placeholder="Написать комментарий... (Cmd+Enter для отправки)"
                  rows={3}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 resize-none" />
                <div className="flex justify-end mt-2">
                  <button onClick={postComment} disabled={posting || !comment.trim()}
                    className="px-4 py-1.5 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                    {posting ? 'Отправляю...' : 'Отправить'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="flex flex-col gap-4">

          {/* Status actions */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Статус</h3>
            <div className="flex flex-col gap-2">
              {task.status === 'NEW' && (
                <button onClick={() => moveTask('IN_PROGRESS')}
                  className="w-full py-2 bg-blue-50 text-blue-700 rounded-lg text-sm font-medium hover:bg-blue-100">
                  ▶ Взять в работу
                </button>
              )}
              {task.status === 'IN_PROGRESS' && (
                <button onClick={() => moveTask('REVIEW')}
                  className="w-full py-2 bg-yellow-50 text-yellow-700 rounded-lg text-sm font-medium hover:bg-yellow-100">
                  👁 Отправить на проверку
                </button>
              )}
              {task.status === 'REVIEW' && (
                <button onClick={() => moveTask('DONE')}
                  className="w-full py-2 bg-green-50 text-green-700 rounded-lg text-sm font-medium hover:bg-green-100">
                  ✓ Завершить задачу
                </button>
              )}
              {task.status !== 'NEW' && task.status !== 'DONE' && (
                <button onClick={() => moveTask('BLOCKED')}
                  className="w-full py-2 bg-red-50 text-red-600 rounded-lg text-sm font-medium hover:bg-red-100">
                  🚫 Заблокировать
                </button>
              )}
            </div>
          </div>

          {/* Details */}
          <div className="bg-white rounded-xl border border-gray-200 p-5">
            <h3 className="text-sm font-semibold text-gray-700 mb-3">Детали</h3>
            <div className="flex flex-col gap-3 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Приоритет</span>
                <span className={"text-xs px-2 py-0.5 rounded font-medium " + (PRIORITY_COLORS[task.priority] ?? 'bg-gray-100 text-gray-500')}>
                  {task.priority}
                </span>
              </div>
              {task.assignee && (
                <div className="flex justify-between items-center">
                  <span className="text-gray-500">Исполнитель</span>
                  <div className="flex items-center gap-1.5">
                    <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center text-white text-xs font-bold">
                      {task.assignee.name.charAt(0)}
                    </div>
                    <span className="text-gray-700">{task.assignee.name}</span>
                  </div>
                </div>
              )}
              {task.dueDate && (
                <div className="flex justify-between">
                  <span className="text-gray-500">Дедлайн</span>
                  <span className="text-gray-700">{new Date(task.dueDate).toLocaleDateString('ru')}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-gray-500">Создана</span>
                <span className="text-gray-700">{new Date(task.createdAt).toLocaleDateString('ru')}</span>
              </div>
              {task.tags?.length > 0 && (
                <div>
                  <span className="text-gray-500 block mb-1">Теги</span>
                  <div className="flex gap-1 flex-wrap">
                    {task.tags.map((tag: string) => (
                      <span key={tag} className="text-xs px-2 py-0.5 bg-indigo-50 text-indigo-600 rounded-full">{tag}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
`);

// Update tasks kanban to be clickable
let tasksPage = fs.readFileSync('app/dashboard/tasks/page.tsx', 'utf8');
if (!tasksPage.includes("router.push('/dashboard/tasks/")) {
  tasksPage = tasksPage.replace(
    `import { useRouter } from 'next/navigation';`,
    `import { useRouter } from 'next/navigation';`
  );
  // Make task cards clickable
  tasksPage = tasksPage.replace(
    `                  <div key={task.id} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow">`,
    `                  <div key={task.id} onClick={() => router.push('/dashboard/tasks/' + task.id)} className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm hover:shadow-md transition-shadow cursor-pointer">`
  );
  fs.writeFileSync('app/dashboard/tasks/page.tsx', tasksPage);
  console.log('✓ tasks kanban updated - cards are clickable');
}

console.log('\n✅ Task comments page created');
