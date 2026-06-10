'use client';
import { useEffect, useState, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = 'https://employee-tracker.ru';

type NoteStatus = 'ACTIVE' | 'DONE' | 'DEFERRED' | 'ARCHIVED';
type NotePriority = 'LOW' | 'MEDIUM' | 'HIGH';

interface Note {
  id: string; title: string; content: string;
  status: NoteStatus; priority: NotePriority;
  isPinned: boolean; remindAt: string | null;
  createdAt: string; updatedAt: string;
}

const PRIORITY_LABEL: Record<NotePriority, string> = { LOW: 'Низкий', MEDIUM: 'Средний', HIGH: 'Высокий' };
const PRIORITY_COLOR: Record<NotePriority, string> = { LOW: '#9B97CC', MEDIUM: '#D97706', HIGH: '#DC2626' };
const PRIORITY_BG:    Record<NotePriority, string> = { LOW: '#F3F4F6', MEDIUM: '#FEF3C7', HIGH: '#FEE2E2' };
const STATUS_LABEL:   Record<NoteStatus, string>   = { ACTIVE: 'Активно', DONE: 'Выполнено', DEFERRED: 'Отложено', ARCHIVED: 'Архив' };

function fmtDate(s: string) {
  const d = new Date(s);
  return d.toLocaleDateString('ru', { day: 'numeric', month: 'short' }) + ' ' + d.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' });
}
function isToday(s: string | null) {
  if (!s) return false;
  const d = new Date(s), now = new Date();
  return d.getDate() === now.getDate() && d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

export default function NotebookPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [tab, setTab] = useState<'active' | 'done' | 'archived'>('active');
  const [search, setSearch] = useState('');
  const [quickInput, setQuickInput] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editData, setEditData] = useState<Partial<Note>>({});
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState<Partial<Note>>({ status: 'ACTIVE', priority: 'MEDIUM', isPinned: false });
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    load(t);
  }, []);

  const load = useCallback(async (t?: string) => {
    const tk = t || token;
    if (!tk) return;
    try {
      const statusParam = tab === 'active' ? '' : tab === 'done' ? '&status=DONE' : '&status=ARCHIVED';
      const q = search ? `&search=${encodeURIComponent(search)}` : '';
      const res = await fetch(`${API}/api/v1/notes?${statusParam}${q}`, { headers: { Authorization: `Bearer ${tk}` } });
      if (res.ok) setNotes(await res.json());
    } catch {}
  }, [token, tab, search]);

  useEffect(() => { if (token) load(); }, [tab, search]);

  const quickAdd = async (e: React.KeyboardEvent) => {
    if (e.key !== 'Enter' || !quickInput.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({ title: quickInput.trim(), status: 'ACTIVE', priority: 'MEDIUM' }),
      });
      if (res.ok) { setQuickInput(''); load(); }
    } finally { setLoading(false); }
  };

  const saveNote = async () => {
    if (!formData.title?.trim()) return;
    setLoading(true);
    try {
      const res = await fetch(`${API}/api/v1/notes`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(formData),
      });
      if (res.ok) { setShowForm(false); setFormData({ status: 'ACTIVE', priority: 'MEDIUM', isPinned: false }); load(); }
    } finally { setLoading(false); }
  };

  const updateNote = async (id: string, data: Partial<Note>) => {
    try {
      const res = await fetch(`${API}/api/v1/notes/${id}`, {
        method: 'PATCH', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify(data),
      });
      if (res.ok) load();
    } catch {}
  };

  const deleteNote = async (id: string) => {
    if (!confirm('Удалить заметку?')) return;
    try {
      await fetch(`${API}/api/v1/notes/${id}`, { method: 'DELETE', headers: { Authorization: `Bearer ${token}` } });
      load();
    } catch {}
  };

  const saveEdit = async () => {
    if (!editId) return;
    await updateNote(editId, editData);
    setEditId(null); setEditData({});
  };

  // Группировка заметок
  const pinned   = notes.filter(n => n.isPinned && n.status !== 'ARCHIVED');
  const remindToday = notes.filter(n => !n.isPinned && isToday(n.remindAt) && n.status !== 'ARCHIVED');
  const rest     = notes.filter(n => !n.isPinned && !isToday(n.remindAt));

  const card: React.CSSProperties = { background: 'white', borderRadius: '20px', boxShadow: '0 4px 16px rgba(127,119,221,0.08)' };
  const tabBtn = (id: typeof tab, lbl: string) => (
    <button onClick={() => setTab(id)} style={{ padding: '7px 18px', borderRadius: '20px', fontSize: '12px', fontWeight: tab===id?700:500, border: 'none', cursor: 'pointer', background: tab===id?'linear-gradient(135deg,#7F77DD,#5248C5)':'transparent', color: tab===id?'white':'#9B97CC', transition: 'all 0.2s', boxShadow: tab===id?'0 4px 10px rgba(127,119,221,0.3)':'none' }}>{lbl}</button>
  );

  const NoteCard = ({ note }: { note: Note }) => {
    const isEditing = editId === note.id;
    return (
      <div style={{ ...card, padding: '16px', marginBottom: '10px', border: note.isPinned ? '1px solid #EDE9FE' : '0.5px solid #F3F0FF', position: 'relative' }}>
        {note.isPinned && <span style={{ position: 'absolute', top: '12px', right: '12px', fontSize: '16px' }}>📌</span>}
        {isToday(note.remindAt) && !note.isPinned && <span style={{ position: 'absolute', top: '12px', right: '12px', fontSize: '16px' }}>⏰</span>}

        {isEditing ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <input value={editData.title ?? note.title} onChange={e => setEditData(p => ({...p, title: e.target.value}))}
              style={{ fontSize: '14px', fontWeight: 700, border: '1px solid #EDE9FE', borderRadius: '10px', padding: '8px 12px', outline: 'none', color: '#1a1040' }}/>
            <textarea value={editData.content ?? note.content ?? ''} onChange={e => setEditData(p => ({...p, content: e.target.value}))}
              rows={3} style={{ fontSize: '13px', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '8px 12px', outline: 'none', resize: 'vertical', color: '#6B7280', fontFamily: 'inherit' }}/>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <select value={editData.status ?? note.status} onChange={e => setEditData(p => ({...p, status: e.target.value as NoteStatus}))}
                style={{ flex: 1, border: '1px solid #EDE9FE', borderRadius: '8px', padding: '6px 8px', fontSize: '12px', outline: 'none' }}>
                {(['ACTIVE','DONE','DEFERRED','ARCHIVED'] as NoteStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
              </select>
              <select value={editData.priority ?? note.priority} onChange={e => setEditData(p => ({...p, priority: e.target.value as NotePriority}))}
                style={{ flex: 1, border: '1px solid #EDE9FE', borderRadius: '8px', padding: '6px 8px', fontSize: '12px', outline: 'none' }}>
                {(['LOW','MEDIUM','HIGH'] as NotePriority[]).map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
              </select>
              <input type="datetime-local" value={editData.remindAt ? editData.remindAt.slice(0,16) : note.remindAt?.slice(0,16) ?? ''}
                onChange={e => setEditData(p => ({...p, remindAt: e.target.value || null}))}
                style={{ flex: 1, border: '1px solid #EDE9FE', borderRadius: '8px', padding: '6px 8px', fontSize: '12px', outline: 'none' }}/>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#6B7280', cursor: 'pointer' }}>
              <input type="checkbox" checked={editData.isPinned ?? note.isPinned} onChange={e => setEditData(p => ({...p, isPinned: e.target.checked}))}/>
              Закрепить
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button onClick={saveEdit} style={{ flex: 1, background: 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white', border: 'none', borderRadius: '10px', padding: '8px', fontSize: '13px', fontWeight: 600, cursor: 'pointer' }}>Сохранить</button>
              <button onClick={() => { setEditId(null); setEditData({}); }} style={{ flex: 1, background: '#F8F7FF', color: '#9B97CC', border: 'none', borderRadius: '10px', padding: '8px', fontSize: '13px', cursor: 'pointer' }}>Отмена</button>
            </div>
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', marginBottom: '8px' }}>
              <input type="checkbox" checked={note.status === 'DONE'} onChange={e => updateNote(note.id, { status: e.target.checked ? 'DONE' : 'ACTIVE' })}
                style={{ marginTop: '3px', accentColor: '#7F77DD', width: '16px', height: '16px', cursor: 'pointer', flexShrink: 0 }}/>
              <p style={{ fontSize: '14px', fontWeight: 700, color: note.status === 'DONE' ? '#9B97CC' : '#1a1040', margin: 0, textDecoration: note.status === 'DONE' ? 'line-through' : 'none', flex: 1, paddingRight: '24px' }}>{note.title}</p>
            </div>
            {note.content && <p style={{ fontSize: '13px', color: '#6B7280', margin: '0 0 10px 26px', lineHeight: 1.5 }}>{note.content}</p>}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginLeft: '26px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '10px', fontWeight: 600, color: PRIORITY_COLOR[note.priority], background: PRIORITY_BG[note.priority], padding: '2px 8px', borderRadius: '20px' }}>{PRIORITY_LABEL[note.priority]}</span>
              {note.remindAt && <span style={{ fontSize: '10px', color: isToday(note.remindAt) ? '#DC2626' : '#9B97CC', background: isToday(note.remindAt) ? '#FEE2E2' : '#F8F7FF', padding: '2px 8px', borderRadius: '20px' }}>⏰ {fmtDate(note.remindAt)}</span>}
              <span style={{ fontSize: '10px', color: '#C4C0E8', marginLeft: 'auto' }}>{fmtDate(note.updatedAt)}</span>
            </div>
            <div style={{ display: 'flex', gap: '6px', marginTop: '12px', marginLeft: '26px' }}>
              <button onClick={() => { setEditId(note.id); setEditData({}); }} style={{ fontSize: '11px', color: '#7F77DD', background: '#EDE9FE', border: 'none', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer' }}>✏️ Редактировать</button>
              <button onClick={() => updateNote(note.id, { isPinned: !note.isPinned })} style={{ fontSize: '11px', color: '#6B7280', background: '#F8F7FF', border: 'none', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer' }}>{note.isPinned ? '📌 Открепить' : '📌 Закрепить'}</button>
              {note.status !== 'ARCHIVED' && <button onClick={() => updateNote(note.id, { status: 'ARCHIVED' })} style={{ fontSize: '11px', color: '#6B7280', background: '#F8F7FF', border: 'none', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer' }}>📦 В архив</button>}
              <button onClick={() => deleteNote(note.id)} style={{ fontSize: '11px', color: '#DC2626', background: '#FEE2E2', border: 'none', borderRadius: '8px', padding: '4px 10px', cursor: 'pointer' }}>🗑</button>
            </div>
          </>
        )}
      </div>
    );
  };

  const Section = ({ emoji, title, items }: { emoji: string; title: string; items: Note[] }) =>
    items.length === 0 ? null : (
      <div style={{ marginBottom: '20px' }}>
        <p style={{ fontSize: '12px', fontWeight: 700, color: '#9B97CC', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.4px' }}>{emoji} {title} · {items.length}</p>
        {items.map(n => <NoteCard key={n.id} note={n}/>)}
      </div>
    );

  return (
    <div style={{ minHeight: '100vh', background: '#ECEAF8' }}>
      {/* Header */}
      <div style={{ background: 'white', padding: '16px 28px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 4px 16px rgba(127,119,221,0.06)' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#1a1040', margin: 0 }}>📓 Мой блокнот</h1>
          <p style={{ fontSize: '11px', color: '#9B97CC', margin: '2px 0 0' }}>Личное пространство — только вы видите свои заметки</p>
        </div>
        <div style={{ display: 'flex', gap: '4px', background: '#F8F7FF', borderRadius: '20px', padding: '3px' }}>
          {tabBtn('active', '📝 Активные')}
          {tabBtn('done', '✅ Выполненные')}
          {tabBtn('archived', '📦 Архив')}
        </div>
      </div>

      <div style={{ padding: '20px 28px', maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>

        {/* Быстрый ввод */}
        <div style={{ ...card, padding: '16px 20px' }}>
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginBottom: showForm ? '16px' : '0' }}>
            <input ref={inputRef} value={quickInput} onChange={e => setQuickInput(e.target.value)} onKeyDown={quickAdd}
              placeholder="Не забыть отправить документы поставщику... (Enter для сохранения)"
              style={{ flex: 1, border: '1.5px solid #EDE9FE', borderRadius: '12px', padding: '10px 16px', fontSize: '14px', outline: 'none', color: '#1a1040', background: '#F8F7FF' }}/>
            <button onClick={() => setShowForm(!showForm)} style={{ background: 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white', border: 'none', borderRadius: '12px', padding: '10px 18px', fontSize: '13px', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', boxShadow: '0 4px 10px rgba(127,119,221,0.3)' }}>
              {showForm ? '✕ Закрыть' : '+ Новая заметка'}
            </button>
          </div>

          {showForm && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', borderTop: '1px solid #F3F0FF', paddingTop: '16px' }}>
              <input value={formData.title ?? ''} onChange={e => setFormData(p => ({...p, title: e.target.value}))} placeholder="Заголовок заметки *"
                style={{ border: '1px solid #EDE9FE', borderRadius: '10px', padding: '10px 14px', fontSize: '14px', fontWeight: 600, outline: 'none', color: '#1a1040' }}/>
              <textarea value={formData.content ?? ''} onChange={e => setFormData(p => ({...p, content: e.target.value}))} placeholder="Текст заметки (необязательно)"
                rows={3} style={{ border: '1px solid #EDE9FE', borderRadius: '10px', padding: '10px 14px', fontSize: '13px', outline: 'none', resize: 'vertical', color: '#6B7280', fontFamily: 'inherit' }}/>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                <select value={formData.status} onChange={e => setFormData(p => ({...p, status: e.target.value as NoteStatus}))}
                  style={{ border: '1px solid #EDE9FE', borderRadius: '8px', padding: '8px', fontSize: '12px', outline: 'none' }}>
                  {(['ACTIVE','DONE','DEFERRED'] as NoteStatus[]).map(s => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
                </select>
                <select value={formData.priority} onChange={e => setFormData(p => ({...p, priority: e.target.value as NotePriority}))}
                  style={{ border: '1px solid #EDE9FE', borderRadius: '8px', padding: '8px', fontSize: '12px', outline: 'none' }}>
                  {(['LOW','MEDIUM','HIGH'] as NotePriority[]).map(p => <option key={p} value={p}>{PRIORITY_LABEL[p]}</option>)}
                </select>
                <input type="datetime-local" value={formData.remindAt?.slice(0,16) ?? ''} onChange={e => setFormData(p => ({...p, remindAt: e.target.value || null}))}
                  style={{ border: '1px solid #EDE9FE', borderRadius: '8px', padding: '8px', fontSize: '12px', outline: 'none' }}/>
              </div>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px', color: '#6B7280', cursor: 'pointer' }}>
                <input type="checkbox" checked={formData.isPinned ?? false} onChange={e => setFormData(p => ({...p, isPinned: e.target.checked}))}/> 📌 Закрепить заметку
              </label>
              <button onClick={saveNote} disabled={loading} style={{ background: 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white', border: 'none', borderRadius: '12px', padding: '12px', fontSize: '14px', fontWeight: 700, cursor: 'pointer', opacity: loading ? 0.7 : 1 }}>Сохранить заметку</button>
            </div>
          )}
        </div>

        {/* Поиск */}
        <div style={{ ...card, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <i className="ti ti-search" style={{ fontSize: '16px', color: '#9B97CC' }} aria-hidden="true"/>
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по заметкам..."
            style={{ flex: 1, border: 'none', outline: 'none', fontSize: '14px', color: '#1a1040', background: 'transparent' }}/>
          {search && <button onClick={() => setSearch('')} style={{ background: 'none', border: 'none', color: '#9B97CC', cursor: 'pointer', fontSize: '16px' }}>✕</button>}
        </div>

        {/* Список заметок */}
        {tab === 'active' && (
          <>
            <Section emoji="📌" title="Закреплённые" items={pinned}/>
            <Section emoji="⏰" title="Напоминания сегодня" items={remindToday}/>
            <Section emoji="📝" title="Активные" items={rest}/>
            {notes.length === 0 && (
              <div style={{ ...card, padding: '60px', textAlign: 'center' }}>
                <div style={{ fontSize: '48px', marginBottom: '16px' }}>📓</div>
                <p style={{ fontSize: '16px', fontWeight: 700, color: '#1a1040', margin: '0 0 8px' }}>Блокнот пуст</p>
                <p style={{ fontSize: '13px', color: '#9B97CC', margin: 0 }}>Нажмите «+ Новая заметка» или напишите и нажмите Enter</p>
              </div>
            )}
          </>
        )}
        {tab === 'done' && (
          <>
            <Section emoji="✅" title="Выполненные" items={notes}/>
            {notes.length === 0 && <div style={{ ...card, padding: '40px', textAlign: 'center' }}><p style={{ color: '#9B97CC', fontSize: '14px', margin: 0 }}>Нет выполненных заметок</p></div>}
          </>
        )}
        {tab === 'archived' && (
          <>
            <Section emoji="📦" title="Архив" items={notes}/>
            {notes.length === 0 && <div style={{ ...card, padding: '40px', textAlign: 'center' }}><p style={{ color: '#9B97CC', fontSize: '14px', margin: 0 }}>Архив пуст</p></div>}
          </>
        )}
      </div>
    </div>
  );
}
