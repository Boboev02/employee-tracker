'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = 'https://employee-tracker.ru/api/v1';

const COLORS = ['#7F77DD','#8B5CF6','#3B82F6','#10B981','#F59E0B','#EF4444','#EC4899','#06B6D4','#84CC16','#F97316'];

export default function DictionariesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'departments' | 'stages'>('departments');
  const [departments, setDepartments] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#7F77DD');
  const [editDesc, setEditDesc] = useState('');
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#7F77DD');
  const [newDesc, setNewDesc] = useState('');
  const [saving, setSaving] = useState(false);

  const h = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('access_token') });

  useEffect(() => {
    if (!localStorage.getItem('access_token')) { router.push('/login'); return; }
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [dRes, sRes] = await Promise.all([
      fetch(`${API}/dictionaries/departments`, { headers: h() }),
      fetch(`${API}/dictionaries/card-stages`, { headers: h() }),
    ]);
    setDepartments(await dRes.json().catch(() => []));
    setStages(await sRes.json().catch(() => []));
    setLoading(false);
  };

  const createItem = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const endpoint = tab === 'departments' ? 'departments' : 'card-stages';
    const body: any = { name: newName.trim(), color: newColor };
    if (tab === 'stages') body.description = newDesc;
    await fetch(`${API}/dictionaries/${endpoint}`, { method: 'POST', headers: h(), body: JSON.stringify(body) });
    setNewName(''); setNewColor('#7F77DD'); setNewDesc('');
    loadAll();
    setSaving(false);
  };

  const updateItem = async (id: string) => {
    setSaving(true);
    const endpoint = tab === 'departments' ? 'departments' : 'card-stages';
    const body: any = { name: editName, color: editColor };
    if (tab === 'stages') body.description = editDesc;
    await fetch(`${API}/dictionaries/${endpoint}/${id}`, { method: 'PATCH', headers: h(), body: JSON.stringify(body) });
    setEditId(null);
    loadAll();
    setSaving(false);
  };

  const deleteItem = async (id: string, name: string) => {
    if (!confirm(`Деактивировать "${name}"? Задачи сохранятся.`)) return;
    const endpoint = tab === 'departments' ? 'departments' : 'card-stages';
    await fetch(`${API}/dictionaries/${endpoint}/${id}`, { method: 'DELETE', headers: h() });
    loadAll();
  };

  const startEdit = (item: any) => {
    setEditId(item.id); setEditName(item.name); setEditColor(item.color ?? '#7F77DD'); setEditDesc(item.description ?? '');
  };

  const items = tab === 'departments' ? departments : stages;
  const card: React.CSSProperties = { background: 'white', borderRadius: '16px', padding: '16px 20px', boxShadow: '0 4px 16px rgba(127,119,221,0.08)' };
  const inp: React.CSSProperties = { background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '8px 12px', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' };

  return (
    <div style={{ minHeight: '100vh', background: '#ECEAF8' }}>
      <div style={{ background: 'white', padding: '16px 28px', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 4px 16px rgba(127,119,221,0.06)' }}>
        <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#1a1040', margin: 0 }}>Справочники</h1>
        <p style={{ fontSize: '11px', color: '#9B97CC', margin: '2px 0 0' }}>Управление отделами и стадиями карточек товаров</p>
      </div>

      <div style={{ padding: '20px 28px', maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['departments', 'stages'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              style={{ background: tab === t ? 'linear-gradient(135deg,#7F77DD,#5248C5)' : 'white', color: tab === t ? 'white' : '#7F77DD', border: '1px solid #EDE9FE', borderRadius: '12px', padding: '9px 20px', fontSize: '13px', fontWeight: 700, cursor: 'pointer' }}>
              {t === 'departments' ? `🏢 Отделы (${departments.length})` : `📊 Стадии карточек (${stages.length})`}
            </button>
          ))}
        </div>

        {/* Форма добавления */}
        <div style={card}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a1040', margin: '0 0 12px' }}>
            + Добавить {tab === 'departments' ? 'отдел' : 'стадию'}
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <input placeholder="Название *" value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && createItem()}
              style={{ ...inp, flex: 1, minWidth: '160px' }} />
            {tab === 'stages' && (
              <input placeholder="Описание (необязательно)" value={newDesc} onChange={e => setNewDesc(e.target.value)}
                style={{ ...inp, flex: 2, minWidth: '200px' }} />
            )}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              {COLORS.map(c => (
                <div key={c} onClick={() => setNewColor(c)}
                  style={{ width: '22px', height: '22px', borderRadius: '50%', background: c, cursor: 'pointer', border: newColor === c ? '3px solid #1a1040' : '2px solid white', boxShadow: '0 1px 4px rgba(0,0,0,0.2)' }} />
              ))}
            </div>
            <button onClick={createItem} disabled={!newName.trim() || saving}
              style={{ background: 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white', border: 'none', borderRadius: '10px', padding: '8px 18px', fontSize: '13px', fontWeight: 700, cursor: 'pointer', opacity: (!newName.trim() || saving) ? 0.6 : 1 }}>
              Добавить
            </button>
          </div>
        </div>

        {/* Список */}
        <div style={card}>
          {loading ? (
            <p style={{ color: '#9B97CC', textAlign: 'center', padding: '20px 0', margin: 0 }}>Загрузка...</p>
          ) : items.length === 0 ? (
            <p style={{ color: '#9B97CC', textAlign: 'center', padding: '20px 0', margin: 0 }}>Нет записей</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {items.map(item => (
                <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '12px', background: '#F8F7FF', borderRadius: '12px' }}>
                  <div style={{ width: '12px', height: '12px', borderRadius: '50%', background: item.color ?? '#7F77DD', flexShrink: 0 }} />

                  {editId === item.id ? (
                    <div style={{ flex: 1, display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                      <input value={editName} onChange={e => setEditName(e.target.value)} style={{ ...inp, flex: 1, minWidth: '120px' }} autoFocus />
                      {tab === 'stages' && (
                        <input value={editDesc} onChange={e => setEditDesc(e.target.value)} placeholder="Описание" style={{ ...inp, flex: 2, minWidth: '160px' }} />
                      )}
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {COLORS.map(c => (
                          <div key={c} onClick={() => setEditColor(c)}
                            style={{ width: '18px', height: '18px', borderRadius: '50%', background: c, cursor: 'pointer', border: editColor === c ? '2px solid #1a1040' : '1px solid white' }} />
                        ))}
                      </div>
                      <button onClick={() => updateItem(item.id)} disabled={saving}
                        style={{ background: '#10B981', color: 'white', border: 'none', borderRadius: '8px', padding: '6px 14px', fontSize: '12px', cursor: 'pointer' }}>✓</button>
                      <button onClick={() => setEditId(null)}
                        style={{ background: 'rgba(255,255,255,0.8)', color: '#9B97CC', border: '1px solid #EDE9FE', borderRadius: '8px', padding: '6px 10px', fontSize: '12px', cursor: 'pointer' }}>✕</button>
                    </div>
                  ) : (
                    <>
                      <div style={{ flex: 1 }}>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: '#1a1040' }}>{item.name}</span>
                        {item.description && <span style={{ fontSize: '12px', color: '#9B97CC', marginLeft: '8px' }}>{item.description}</span>}
                        {item._count && <span style={{ fontSize: '11px', color: '#9B97CC', marginLeft: '8px' }}>({item._count.tasks ?? item._count.products ?? 0} {tab === 'departments' ? 'задач' : 'карточек'})</span>}
                      </div>
                      <button onClick={() => startEdit(item)}
                        style={{ background: 'white', color: '#7F77DD', border: '1px solid #EDE9FE', borderRadius: '8px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer' }}>✏️</button>
                      <button onClick={() => deleteItem(item.id, item.name)}
                        style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: 'none', borderRadius: '8px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer' }}>✕</button>
                    </>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
