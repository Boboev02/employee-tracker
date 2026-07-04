'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { DeleteSectionButton } from '@/components/admin/DeleteSectionButton';

const API = 'https://employee-tracker.ru/api/v1';

const COLORS = ['#7F77DD','#8B5CF6','#3B82F6','#10B981','#F59E0B','#EF4444','#EC4899','#06B6D4','#84CC16','#F97316'];

export default function DictionariesPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'departments' | 'stages'>('departments');
  const [departments, setDepartments] = useState<any[]>([]);
  const [stages, setStages] = useState<any[]>([]);
  const [employees, setEmployees] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState('');
  const [userRoles, setUserRoles] = useState<string[]>([]);
  const [editId, setEditId] = useState<string | null>(null);
  const [editName, setEditName] = useState('');
  const [editColor, setEditColor] = useState('#7F77DD');
  const [editDesc, setEditDesc] = useState('');
  const [editEmployeeIds, setEditEmployeeIds] = useState<string[]>([]);
  const [newName, setNewName] = useState('');
  const [newColor, setNewColor] = useState('#7F77DD');
  const [newDesc, setNewDesc] = useState('');
  const [newEmployeeIds, setNewEmployeeIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [showEmpPicker, setShowEmpPicker] = useState<'new'|'edit'|null>(null);
  const [deleteWarning, setDeleteWarning] = useState<{id:string;name:string;msg:string}|null>(null);

  const h = () => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('access_token') });

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    const u = JSON.parse(localStorage.getItem('user') ?? '{}');
    setUserRoles(u.roles ?? []);
    loadAll();
  }, []);

  const loadAll = async () => {
    setLoading(true);
    const [dRes, sRes, eRes] = await Promise.all([
      fetch(`${API}/dictionaries/departments`, { headers: h() }),
      fetch(`${API}/dictionaries/card-stages`, { headers: h() }),
      fetch(`${API}/employees?limit=200`, { headers: h() }),
    ]);
    setDepartments(await dRes.json().catch(() => []));
    setStages(await sRes.json().catch(() => []));
    const empData = await eRes.json().catch(() => ({}));
    setEmployees(empData.employees ?? (Array.isArray(empData) ? empData : []));
    setLoading(false);
  };

  const createItem = async () => {
    if (!newName.trim()) return;
    setSaving(true);
    const endpoint = tab === 'departments' ? 'departments' : 'card-stages';
    const body: any = { name: newName.trim(), color: newColor };
    if (tab === 'stages') body.description = newDesc;
    if (tab === 'departments') body.employeeIds = newEmployeeIds;
    await fetch(`${API}/dictionaries/${endpoint}`, { method: 'POST', headers: h(), body: JSON.stringify(body) });
    setNewName(''); setNewColor('#7F77DD'); setNewDesc(''); setNewEmployeeIds([]);
    loadAll();
    setSaving(false);
  };

  const updateItem = async (id: string) => {
    setSaving(true);
    const endpoint = tab === 'departments' ? 'departments' : 'card-stages';
    const body: any = { name: editName, color: editColor };
    if (tab === 'stages') body.description = editDesc;
    if (tab === 'departments') body.employeeIds = editEmployeeIds;
    await fetch(`${API}/dictionaries/${endpoint}/${id}`, { method: 'PATCH', headers: h(), body: JSON.stringify(body) });
    setEditId(null);
    loadAll();
    setSaving(false);
  };

  const deleteItem = async (id: string, name: string, force = false) => {
    if (!force && !confirm(`Деактивировать "${name}"?`)) return;
    const endpoint = tab === 'departments' ? 'departments' : 'card-stages';
    const url = `${API}/dictionaries/${endpoint}/${id}${force ? '?force=true' : ''}`;
    const res = await fetch(url, { method: 'DELETE', headers: h() });
    const data = await res.json().catch(() => ({}));
    if (data?.error === 'HAS_DEPENDENCIES' && !force) {
      setDeleteWarning({ id, name, msg: data.message });
      return;
    }
    setDeleteWarning(null);
    loadAll();
  };

  const startEdit = async (item: any) => {
    setEditId(item.id); setEditName(item.name); setEditColor(item.color ?? '#7F77DD'); setEditDesc(item.description ?? '');
    if (tab === 'departments') {
      const r = await fetch(`${API}/dictionaries/departments/${item.id}/employees`, { headers: h() });
      const emps = await r.json().catch(() => []);
      setEditEmployeeIds(Array.isArray(emps) ? emps.map((e: any) => e.id) : []);
    }
  };

  const items = tab === 'departments' ? departments : stages;
  const card: React.CSSProperties = { background: 'white', borderRadius: '16px', padding: '16px 20px', boxShadow: '0 4px 16px rgba(127,119,221,0.08)' };
  const inp: React.CSSProperties = { background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: '10px', padding: '8px 12px', fontSize: '13px', outline: 'none', width: '100%', boxSizing: 'border-box' };

  const EmployeePicker = ({ selected, onChange }: { selected: string[]; onChange: (ids: string[]) => void }) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: 140, overflowY: 'auto', padding: '8px', background: '#F8F7FF', borderRadius: 10, border: '1px solid #EDE9FE' }}>
      {employees.length === 0 && <span style={{ fontSize: 12, color: '#9B97CC' }}>Нет сотрудников</span>}
      {employees.map(e => {
        const isSel = selected.includes(e.id);
        return (
          <button key={e.id} type="button" onClick={() => onChange(isSel ? selected.filter(id => id !== e.id) : [...selected, e.id])}
            style={{ fontSize: 11, padding: '4px 10px', borderRadius: 20, border: '1px solid', cursor: 'pointer', fontWeight: 600,
              borderColor: isSel ? '#7F77DD' : '#EDE9FE', background: isSel ? '#EDE9FE' : 'white', color: isSel ? '#7F77DD' : '#6B7280' }}>
            {e.name}
          </button>
        );
      })}
    </div>
  );

  return (
    <div style={{ minHeight: '100vh', background: '#ECEAF8' }}>
      <div style={{ background: 'white', padding: '16px 28px', position: 'sticky', top: 0, zIndex: 10, boxShadow: '0 4px 16px rgba(127,119,221,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#1a1040', margin: 0 }}>Справочники</h1>
          <p style={{ fontSize: '11px', color: '#9B97CC', margin: '2px 0 0' }}>Управление отделами и стадиями карточек товаров</p>
        </div>
        {tab === 'departments' && token && (
          <DeleteSectionButton section="departments" label="все отделы" token={token} userRoles={userRoles} onDeleted={loadAll} />
        )}
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

        {/* Delete warning modal */}
        {deleteWarning && (
          <div style={{ ...card, background: '#FEF2F2', border: '1px solid #FEE2E2' }}>
            <p style={{ fontSize: 13, color: '#DC2626', margin: '0 0 10px', fontWeight: 600 }}>⚠️ {deleteWarning.msg}</p>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => deleteItem(deleteWarning.id, deleteWarning.name, true)}
                style={{ background: '#DC2626', color: 'white', border: 'none', borderRadius: 8, padding: '7px 16px', fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                Всё равно удалить
              </button>
              <button onClick={() => setDeleteWarning(null)}
                style={{ background: 'white', color: '#6B7280', border: '1px solid #EDE9FE', borderRadius: 8, padding: '7px 16px', fontSize: 12, cursor: 'pointer' }}>
                Отмена
              </button>
            </div>
          </div>
        )}

        {/* Форма добавления */}
        <div style={card}>
          <p style={{ fontSize: '13px', fontWeight: 700, color: '#1a1040', margin: '0 0 12px' }}>
            + Добавить {tab === 'departments' ? 'отдел' : 'стадию'}
          </p>
          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', marginBottom: tab === 'departments' ? 10 : 0 }}>
            <input placeholder="Название *" value={newName} onChange={e => setNewName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && createItem()}
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

          {tab === 'departments' && (
            <div>
              <p style={{ fontSize: 11, color: '#9B97CC', margin: '0 0 6px', fontWeight: 600 }}>Сотрудники отдела ({newEmployeeIds.length})</p>
              <EmployeePicker selected={newEmployeeIds} onChange={setNewEmployeeIds} />
            </div>
          )}
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
                <div key={item.id} style={{ padding: '12px', background: '#F8F7FF', borderRadius: '12px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
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
                          {tab === 'departments' && item._count && (
                            <span style={{ fontSize: '11px', color: '#9B97CC', marginLeft: '8px' }}>
                              {item._count.members ?? 0} сотр. · {item._count.projects ?? 0} проектов · {item._count.tasks ?? 0} задач
                            </span>
                          )}
                          {tab === 'stages' && item._count && (
                            <span style={{ fontSize: '11px', color: '#9B97CC', marginLeft: '8px' }}>({item._count.products ?? 0} карточек)</span>
                          )}
                        </div>
                        <button onClick={() => startEdit(item)}
                          style={{ background: 'white', color: '#7F77DD', border: '1px solid #EDE9FE', borderRadius: '8px', padding: '5px 12px', fontSize: '12px', cursor: 'pointer' }}>✏️</button>
                        <button onClick={() => deleteItem(item.id, item.name)}
                          style={{ background: 'rgba(220,38,38,0.08)', color: '#DC2626', border: 'none', borderRadius: '8px', padding: '5px 10px', fontSize: '12px', cursor: 'pointer' }}>✕</button>
                      </>
                    )}
                  </div>

                  {editId === item.id && tab === 'departments' && (
                    <div style={{ marginTop: 10 }}>
                      <p style={{ fontSize: 11, color: '#9B97CC', margin: '0 0 6px', fontWeight: 600 }}>Сотрудники отдела ({editEmployeeIds.length})</p>
                      <EmployeePicker selected={editEmployeeIds} onChange={setEditEmployeeIds} />
                    </div>
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
