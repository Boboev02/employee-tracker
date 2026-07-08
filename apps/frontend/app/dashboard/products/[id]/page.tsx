'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { RelationsBlock } from '@/components/relations/RelationsBlock';
import { ActivityLogBlock } from '@/components/relations/ActivityLogBlock';

const API = 'https://employee-tracker.ru/api/v1';

const STATUS_LABELS: Record<string, string> = { NEW: 'Новая', IN_PROGRESS: 'В работе', REVIEW: 'Проверка', BLOCKED: 'Заблокировано', DONE: 'Готово', OVERDUE: 'Просрочена' };
const STATUS_COLORS: Record<string, string> = { NEW: '#9B97CC', IN_PROGRESS: '#7F77DD', REVIEW: '#D97706', BLOCKED: '#DC2626', DONE: '#16A34A', OVERDUE: '#DC2626' };
const PRIORITY_LABELS: Record<string, string> = { LOW: 'Низкий', MEDIUM: 'Средний', HIGH: 'Высокий', CRITICAL: 'Критичный' };
const PRIORITY_COLORS: Record<string, string> = { LOW: '#9B97CC', MEDIUM: '#D97706', HIGH: '#DC2626', CRITICAL: '#7F1D1D' };

export default function ProductDetailPage() {
  const router = useRouter();
  const { id } = useParams();
  const [product, setProduct] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [tab, setTab] = useState<'tasks' | 'info'>('tasks');
  const [showNewTask, setShowNewTask] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', assigneeId: '', dueDate: '' });
  const [filterStatus, setFilterStatus] = useState('');
  const [filterAssignee, setFilterAssignee] = useState('');
  const [filterPriority, setFilterPriority] = useState('');
  const [search, setSearch] = useState('');
  const [sortBy, setSortBy] = useState<'dueDate' | 'priority' | 'createdAt'>('dueDate');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [groupBy, setGroupBy] = useState<'none' | 'status' | 'assignee' | 'priority'>('none');
  const [view, setView] = useState<'list' | 'board' | 'calendar'>('list');

  const h = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('access_token') });

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    loadProduct();
    fetch(`${API}/employees`, { headers: h() }).then(r => r.json()).then(d => setEmployees(d.employees ?? d ?? [])).catch(() => {});
  }, [id]);

  const loadProduct = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API}/products/${id}`, { headers: h() });
      const data = await res.json();
      setProduct(data);
    } catch {}
    setLoading(false);
  };

  const createTask = async () => {
    if (!form.title.trim()) return;
    setSaving(true);
    try {
      await fetch(`${API}/products/${id}/tasks`, {
        method: 'POST', headers: h(),
        body: JSON.stringify({ ...form, assigneeId: form.assigneeId || undefined, dueDate: form.dueDate || undefined }),
      });
      setForm({ title: '', description: '', priority: 'MEDIUM', assigneeId: '', dueDate: '' });
      setShowNewTask(false);
      loadProduct();
    } catch {}
    setSaving(false);
  };

  if (loading) return <div style={{ minHeight: '100vh', background: '#ECEAF8', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#9B97CC' }}>Загрузка...</div>;
  if (!product) return <div style={{ minHeight: '100vh', background: '#ECEAF8', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><p>Карточка не найдена</p></div>;

  const tasks = product.tasks ?? [];
  const doneTasks = tasks.filter((t: any) => t.status === 'DONE').length;
  const progress = tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0;

  const assigneeOptions = Array.from(new Map(tasks.filter((t: any) => t.assignee).map((t: any) => [t.assignee.id, t.assignee])).values());

  let filteredTasks = tasks.filter((t: any) => {
    if (filterStatus && t.status !== filterStatus) return false;
    if (filterAssignee && t.assignee?.id !== filterAssignee) return false;
    if (filterPriority && t.priority !== filterPriority) return false;
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const PRIORITY_ORDER: Record<string, number> = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
  filteredTasks = [...filteredTasks].sort((a: any, b: any) => {
    let cmp = 0;
    if (sortBy === 'dueDate') cmp = (a.dueDate ? new Date(a.dueDate).getTime() : Infinity) - (b.dueDate ? new Date(b.dueDate).getTime() : Infinity);
    else if (sortBy === 'priority') cmp = (PRIORITY_ORDER[a.priority] ?? 9) - (PRIORITY_ORDER[b.priority] ?? 9);
    else cmp = new Date(a.createdAt ?? 0).getTime() - new Date(b.createdAt ?? 0).getTime();
    return sortDir === 'asc' ? cmp : -cmp;
  });

  const groups: { key: string; label: string; items: any[] }[] = groupBy === 'none'
    ? [{ key: '_all', label: '', items: filteredTasks }]
    : (() => {
        const map = new Map<string, { label: string; items: any[] }>();
        for (const t of filteredTasks) {
          let key: string, label: string;
          if (groupBy === 'status') { key = t.status; label = STATUS_LABELS[t.status] ?? t.status; }
          else if (groupBy === 'priority') { key = t.priority; label = PRIORITY_LABELS[t.priority] ?? t.priority; }
          else { key = t.assignee?.id ?? 'unassigned'; label = t.assignee?.name ?? 'Без исполнителя'; }
          if (!map.has(key)) map.set(key, { label, items: [] });
          map.get(key)!.items.push(t);
        }
        return Array.from(map.entries()).map(([key, v]) => ({ key, ...v }));
      })();

  const STATUS_ORDER = ['NEW', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'DONE'];

  const card: React.CSSProperties = { background: 'white', borderRadius: '20px', padding: '20px', boxShadow: '0 4px 16px rgba(127,119,221,0.08)' };
  const inp: React.CSSProperties = { width: '100%', background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '8px 12px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' };

  return (
    <div style={{ minHeight: '100vh', background: '#ECEAF8' }}>
      <div style={{ background: 'white', padding: '14px 28px', display: 'flex', alignItems: 'center', gap: '12px', boxShadow: '0 4px 16px rgba(127,119,221,0.06)', position: 'sticky', top: 0, zIndex: 10 }}>
        <Link href="/dashboard/products" style={{ color: '#9B97CC', textDecoration: 'none', fontSize: '13px' }}>← Карточки</Link>
        <span style={{ color: '#EDE9FE' }}>|</span>
        <span style={{ background: product.marketplace === 'WB' ? '#8B2FC9' : '#005BFF', color: 'white', borderRadius: '8px', padding: '2px 10px', fontSize: '11px', fontWeight: 700 }}>{product.marketplace}</span>
        <span style={{ fontSize: '14px', fontWeight: 700, color: '#1a1040', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{product.name}</span>
        {product.url && (
          <a href={product.url} target="_blank" rel="noopener noreferrer"
            style={{ background: '#F8F7FF', color: '#7F77DD', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '7px 14px', fontSize: '12px', textDecoration: 'none', fontWeight: 600 }}>
            Открыть на {product.marketplace} ↗
          </a>
        )}
      </div>

      <div style={{ padding: '20px 28px', display: 'grid', gridTemplateColumns: '300px 1fr', gap: '20px', maxWidth: '1200px' }}>
        {/* Левая колонка — фото + инфо */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ background: 'white', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 4px 16px rgba(127,119,221,0.08)', aspectRatio: '1' }}>
            {product.photoUrl ? (
              <img src={product.photoUrl} alt={product.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '64px', background: '#F8F7FF' }}>📦</div>
            )}
          </div>

          <div style={card}>
            <p style={{ fontSize: '11px', color: '#9B97CC', margin: '0 0 8px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Информация</p>
            {[
              { label: 'Артикул', value: product.articleId },
              { label: 'Бренд', value: product.brand },
              { label: 'Категория', value: product.categoryName },
              { label: 'Цена', value: product.price ? `${product.price.toLocaleString('ru')} ₽` : null },
              { label: 'Рейтинг', value: product.rating ? `⭐ ${product.rating}` : null },
              { label: 'Отзывов', value: product.reviewCount ? String(product.reviewCount) : null },
              { label: 'Остаток', value: product.stockCount != null ? `${product.stockCount} шт.` : null },
            ].filter(i => i.value).map(item => (
              <div key={item.label} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #F8F7FF' }}>
                <span style={{ fontSize: '12px', color: '#9B97CC' }}>{item.label}</span>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#1a1040' }}>{item.value}</span>
              </div>
            ))}
          </div>

          {tasks.length > 0 && (
            <div style={card}>
              <p style={{ fontSize: '11px', color: '#9B97CC', margin: '0 0 8px', fontWeight: 700 }}>ПРОГРЕСС ЗАДАЧ</p>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#1a1040', marginBottom: '8px' }}>{progress}%</div>
              <div style={{ background: '#F8F7FF', borderRadius: '6px', height: '8px', overflow: 'hidden' }}>
                <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg,#7F77DD,#16A34A)', borderRadius: '6px', transition: 'width 0.3s' }} />
              </div>
              <p style={{ fontSize: '11px', color: '#9B97CC', margin: '8px 0 0' }}>{doneTasks} из {tasks.length} выполнено</p>
            </div>
          )}
        </div>

        {/* Правая колонка — задачи */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button onClick={() => setTab('tasks')} style={{ background: tab === 'tasks' ? 'linear-gradient(135deg,#7F77DD,#5248C5)' : 'white', color: tab === 'tasks' ? 'white' : '#7F77DD', border: '1px solid #EDE9FE', borderRadius: '12px', padding: '8px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>
                Задачи ({tasks.length})
              </button>
            </div>
            <button onClick={() => setShowNewTask(true)}
              style={{ background: 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white', border: 'none', borderRadius: '14px', padding: '9px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              + Добавить задачу
            </button>
          </div>

          {showNewTask && (
            <div style={card}>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#1a1040', margin: '0 0 14px' }}>Новая задача по карточке</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                <input placeholder="Название задачи *" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} style={inp} />
                <textarea placeholder="Описание (необязательно)" value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2} style={{ ...inp, resize: 'vertical' }} />
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  <select value={form.priority} onChange={e => setForm(f => ({ ...f, priority: e.target.value }))} style={inp}>
                    <option value="LOW">Низкий</option>
                    <option value="MEDIUM">Средний</option>
                    <option value="HIGH">Высокий</option>
                    <option value="CRITICAL">Критичный</option>
                  </select>
                  <select value={form.assigneeId} onChange={e => setForm(f => ({ ...f, assigneeId: e.target.value }))} style={inp}>
                    <option value="">Исполнитель</option>
                    {employees.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                  </select>
                  <input type="date" value={form.dueDate} onChange={e => setForm(f => ({ ...f, dueDate: e.target.value }))} style={inp} />
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={createTask} disabled={!form.title.trim() || saving}
                    style={{ background: 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white', border: 'none', borderRadius: '10px', padding: '9px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: saving ? 0.7 : 1 }}>
                    {saving ? 'Сохранение...' : 'Создать задачу'}
                  </button>
                  <button onClick={() => setShowNewTask(false)} style={{ background: 'white', color: '#9B97CC', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '9px 16px', fontSize: '13px', cursor: 'pointer' }}>Отмена</button>
                </div>
              </div>
            </div>
          )}

          {tasks.length > 0 && (
            <>
              {/* Toolbar: search, filters, sort, group, view switcher */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
                <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по названию..."
                  style={{ ...inp, width: 180 }} />
                <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} style={{ ...inp, width: 140 }}>
                  <option value="">Все статусы</option>
                  {Object.entries(STATUS_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <select value={filterAssignee} onChange={e => setFilterAssignee(e.target.value)} style={{ ...inp, width: 150 }}>
                  <option value="">Все исполнители</option>
                  {assigneeOptions.map((e: any) => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
                <select value={filterPriority} onChange={e => setFilterPriority(e.target.value)} style={{ ...inp, width: 130 }}>
                  <option value="">Все приоритеты</option>
                  {Object.entries(PRIORITY_LABELS).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
                </select>
                <select value={groupBy} onChange={e => setGroupBy(e.target.value as any)} style={{ ...inp, width: 150 }}>
                  <option value="none">Без группировки</option>
                  <option value="status">По статусу</option>
                  <option value="assignee">По исполнителю</option>
                  <option value="priority">По приоритету</option>
                </select>
                <select value={sortBy} onChange={e => setSortBy(e.target.value as any)} style={{ ...inp, width: 130 }}>
                  <option value="dueDate">По сроку</option>
                  <option value="priority">По приоритету</option>
                  <option value="createdAt">По дате создания</option>
                </select>
                <button onClick={() => setSortDir(d => d === 'asc' ? 'desc' : 'asc')} title="Направление сортировки"
                  style={{ background: 'white', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '8px 10px', fontSize: '12px', cursor: 'pointer', color: '#7F77DD' }}>
                  {sortDir === 'asc' ? '↑' : '↓'}
                </button>

                <div style={{ display: 'flex', gap: '4px', marginLeft: 'auto', background: '#F8F7FF', borderRadius: '10px', padding: '3px' }}>
                  {([['list', '📋'], ['board', '🗂'], ['calendar', '📅']] as const).map(([v, icon]) => (
                    <button key={v} onClick={() => setView(v)}
                      style={{ background: view === v ? 'white' : 'transparent', boxShadow: view === v ? '0 2px 6px rgba(127,119,221,0.15)' : 'none', border: 'none', borderRadius: '8px', padding: '6px 12px', fontSize: '14px', cursor: 'pointer' }}>
                      {icon}
                    </button>
                  ))}
                </div>
              </div>

              {(search || filterStatus || filterAssignee || filterPriority) && (
                <p style={{ fontSize: '11px', color: '#9B97CC', margin: 0 }}>Найдено: {filteredTasks.length} из {tasks.length}</p>
              )}
            </>
          )}

          {filteredTasks.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>✅</div>
              <p style={{ color: '#9B97CC', fontSize: '13px', margin: 0 }}>
                {tasks.length === 0 ? 'По этой карточке задач пока нет. Нажмите "+ Добавить задачу"' : 'Нет задач по заданным фильтрам'}
              </p>
            </div>
          ) : view === 'list' ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {groups.map(g => (
                <div key={g.key}>
                  {groupBy !== 'none' && (
                    <p style={{ fontSize: '11px', fontWeight: 700, color: '#7F77DD', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
                      {g.label} <span style={{ color: '#C4C0E8' }}>({g.items.length})</span>
                    </p>
                  )}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {g.items.map((task: any) => (
                      <Link key={task.id} href={`/dashboard/tasks/${task.id}`} style={{ textDecoration: 'none' }}>
                        <div style={{ ...card, padding: '14px 18px', cursor: 'pointer', borderLeft: '4px solid ' + (PRIORITY_COLORS[task.priority] ?? '#9B97CC'), transition: 'transform 0.1s' }}
                          onMouseEnter={e => { (e.currentTarget as HTMLDivElement).style.transform = 'translateX(2px)'; }}
                          onMouseLeave={e => { (e.currentTarget as HTMLDivElement).style.transform = 'none'; }}>
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px' }}>
                            <span style={{ background: (STATUS_COLORS[task.status] ?? '#9B97CC') + '20', color: STATUS_COLORS[task.status], borderRadius: '8px', padding: '3px 10px', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                              {STATUS_LABELS[task.status] ?? task.status}
                            </span>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a1040', margin: '0 0 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</p>
                              {task.description && <p style={{ fontSize: '12px', color: '#9B97CC', margin: '0 0 6px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.description}</p>}
                              <div style={{ display: 'flex', gap: '12px', fontSize: '11px', color: '#9B97CC' }}>
                                {task.assignee && <span>👤 {task.assignee.name}</span>}
                                {task.dueDate && <span>📅 {new Date(task.dueDate).toLocaleDateString('ru')}</span>}
                                <span style={{ color: PRIORITY_COLORS[task.priority] }}>● {PRIORITY_LABELS[task.priority] ?? task.priority}</span>
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : view === 'board' ? (
            <div style={{ display: 'flex', gap: '12px', overflowX: 'auto', paddingBottom: '8px' }}>
              {STATUS_ORDER.map(status => {
                const colTasks = filteredTasks.filter((t: any) => t.status === status);
                return (
                  <div key={status} style={{ minWidth: '240px', flex: '1 0 240px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
                      <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: STATUS_COLORS[status] }} />
                      <p style={{ fontSize: '12px', fontWeight: 700, color: '#1a1040', margin: 0 }}>{STATUS_LABELS[status]}</p>
                      <span style={{ fontSize: '11px', color: '#9B97CC' }}>({colTasks.length})</span>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {colTasks.map((task: any) => (
                        <Link key={task.id} href={`/dashboard/tasks/${task.id}`} style={{ textDecoration: 'none' }}>
                          <div style={{ ...card, padding: '12px 14px', cursor: 'pointer', borderTop: '3px solid ' + (PRIORITY_COLORS[task.priority] ?? '#9B97CC') }}>
                            <p style={{ fontSize: '12.5px', fontWeight: 700, color: '#1a1040', margin: '0 0 6px' }}>{task.title}</p>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '10.5px', color: '#9B97CC' }}>
                              <span>{task.assignee ? `👤 ${task.assignee.name}` : '—'}</span>
                              {task.dueDate && <span>{new Date(task.dueDate).toLocaleDateString('ru')}</span>}
                            </div>
                          </div>
                        </Link>
                      ))}
                      {colTasks.length === 0 && <p style={{ fontSize: '11px', color: '#C4C0E8', textAlign: 'center', padding: '10px 0' }}>Пусто</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <CalendarView tasks={filteredTasks} />
          )}

          {/* Relations */}
          {token && product && (
            <div style={card}>
              <p style={{ fontSize:'11px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 12px' }}>Связи</p>
              <RelationsBlock entityType="PRODUCT" entityId={product.id} token={token} />
            </div>
          )}

          {/* Activity Log */}
          {token && product && (
            <div style={card}>
              <p style={{ fontSize:'11px', fontWeight:700, color:'#9B97CC', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 12px' }}>История изменений</p>
              <ActivityLogBlock entityType="PRODUCT" entityId={product.id} token={token} />
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

function CalendarView({ tasks }: { tasks: any[] }) {
  const [monthOffset, setMonthOffset] = useState(0);
  const now = new Date();
  const viewDate = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const year = viewDate.getFullYear(), month = viewDate.getMonth();

  const firstDay = new Date(year, month, 1);
  const startOffset = (firstDay.getDay() + 6) % 7; // понедельник = 0
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const tasksByDay = new Map<number, any[]>();
  for (const t of tasks) {
    if (!t.dueDate) continue;
    const d = new Date(t.dueDate);
    if (d.getFullYear() === year && d.getMonth() === month) {
      const day = d.getDate();
      if (!tasksByDay.has(day)) tasksByDay.set(day, []);
      tasksByDay.get(day)!.push(t);
    }
  }

  const cells = [];
  for (let i = 0; i < startOffset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);

  const monthLabel = viewDate.toLocaleDateString('ru', { month: 'long', year: 'numeric' });
  const card: React.CSSProperties = { background: 'white', borderRadius: '20px', padding: '20px', boxShadow: '0 4px 16px rgba(127,119,221,0.08)' };

  return (
    <div style={card}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
        <button onClick={() => setMonthOffset(m => m - 1)} style={{ background: '#F8F7FF', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', color: '#7F77DD' }}>←</button>
        <p style={{ fontSize: '14px', fontWeight: 700, color: '#1a1040', margin: 0, textTransform: 'capitalize' }}>{monthLabel}</p>
        <button onClick={() => setMonthOffset(m => m + 1)} style={{ background: '#F8F7FF', border: 'none', borderRadius: '8px', padding: '6px 12px', cursor: 'pointer', color: '#7F77DD' }}>→</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px', marginBottom: '6px' }}>
        {['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map(d => (
          <div key={d} style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, color: '#9B97CC', padding: '4px 0' }}>{d}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: '4px' }}>
        {cells.map((day, i) => {
          if (day === null) return <div key={i} />;
          const dayTasks = tasksByDay.get(day) ?? [];
          const isToday = day === now.getDate() && month === now.getMonth() && year === now.getFullYear();
          return (
            <div key={i} style={{ minHeight: '70px', border: '1px solid #F3F0FF', borderRadius: '8px', padding: '4px', background: isToday ? '#F0EDFF' : 'white' }}>
              <p style={{ fontSize: '10px', fontWeight: isToday ? 800 : 600, color: isToday ? '#7F77DD' : '#9B97CC', margin: '0 0 4px' }}>{day}</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                {dayTasks.slice(0, 2).map((t: any) => (
                  <Link key={t.id} href={`/dashboard/tasks/${t.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ fontSize: '9.5px', color: '#1a1040', background: '#F8F7FF', borderRadius: '4px', padding: '2px 4px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.title}>
                      {t.title}
                    </div>
                  </Link>
                ))}
                {dayTasks.length > 2 && <span style={{ fontSize: '9px', color: '#9B97CC' }}>+{dayTasks.length - 2}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
