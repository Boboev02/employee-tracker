'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';

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
  const [tab, setTab] = useState<'tasks' | 'info'>('tasks');
  const [showNewTask, setShowNewTask] = useState(false);
  const [employees, setEmployees] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: '', description: '', priority: 'MEDIUM', assigneeId: '', dueDate: '' });
  const [filterStatus, setFilterStatus] = useState('');

  const h = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('access_token') });

  useEffect(() => {
    if (!localStorage.getItem('access_token')) { router.push('/login'); return; }
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
  const filteredTasks = filterStatus ? tasks.filter((t: any) => t.status === filterStatus) : tasks;
  const doneTasks = tasks.filter((t: any) => t.status === 'DONE').length;
  const progress = tasks.length ? Math.round((doneTasks / tasks.length) * 100) : 0;

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
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              <button onClick={() => setFilterStatus('')} style={{ background: !filterStatus ? 'linear-gradient(135deg,#7F77DD,#5248C5)' : 'white', color: !filterStatus ? 'white' : '#7F77DD', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '6px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>Все ({tasks.length})</button>
              {Object.entries(STATUS_LABELS).map(([key, label]) => {
                const count = tasks.filter((t: any) => t.status === key).length;
                if (!count) return null;
                return (
                  <button key={key} onClick={() => setFilterStatus(filterStatus === key ? '' : key)}
                    style={{ background: filterStatus === key ? STATUS_COLORS[key] : 'white', color: filterStatus === key ? 'white' : STATUS_COLORS[key], border: `1px solid ${STATUS_COLORS[key]}40`, borderRadius: '10px', padding: '6px 12px', fontSize: '11px', fontWeight: 600, cursor: 'pointer' }}>
                    {label} ({count})
                  </button>
                );
              })}
            </div>
          )}

          {filteredTasks.length === 0 ? (
            <div style={{ ...card, textAlign: 'center', padding: '40px' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>✅</div>
              <p style={{ color: '#9B97CC', fontSize: '13px', margin: 0 }}>
                {tasks.length === 0 ? 'По этой карточке задач пока нет. Нажмите "+ Добавить задачу"' : 'Нет задач с таким статусом'}
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {filteredTasks.map((task: any) => (
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
          )}
        </div>
      </div>
    </div>
  );
}
