'use client';
import { useState, useEffect } from 'react';

const API = 'https://employee-tracker.ru/api/v1';

export function CrmSettingsModal({ h, onClose }: any) {
  const [sub, setSub] = useState<'statuses' | 'tags' | 'reasons'>('statuses');
  const [statuses, setStatuses] = useState<any[]>([]);
  const [tags, setTags] = useState<any[]>([]);
  const [reasons, setReasons] = useState<any[]>([]);
  const [newLabel, setNewLabel] = useState('');
  const [newColor, setNewColor] = useState('#7F77DD');

  const load = async () => {
    const [sRes, tRes, rRes] = await Promise.all([
      fetch(`${API}/subscriber-settings/statuses`, { headers: h() }),
      fetch(`${API}/subscriber-settings/tags`, { headers: h() }),
      fetch(`${API}/subscriber-settings/cancel-reasons`, { headers: h() }),
    ]);
    setStatuses(await sRes.json().catch(() => []));
    setTags(await tRes.json().catch(() => []));
    setReasons(await rRes.json().catch(() => []));
  };
  useEffect(() => { load(); }, []);

  const addItem = async () => {
    if (!newLabel.trim()) return;
    if (sub === 'statuses') await fetch(`${API}/subscriber-settings/statuses`, { method: 'POST', headers: h(), body: JSON.stringify({ key: newLabel, label: newLabel, color: newColor }) });
    if (sub === 'tags') await fetch(`${API}/subscriber-settings/tags`, { method: 'POST', headers: h(), body: JSON.stringify({ name: newLabel, color: newColor }) });
    if (sub === 'reasons') await fetch(`${API}/subscriber-settings/cancel-reasons`, { method: 'POST', headers: h(), body: JSON.stringify({ label: newLabel }) });
    setNewLabel(''); load();
  };

  const deleteItem = async (id: string) => {
    const path = sub === 'statuses' ? 'statuses' : sub === 'tags' ? 'tags' : 'cancel-reasons';
    await fetch(`${API}/subscriber-settings/${path}/${id}`, { method: 'DELETE', headers: h() });
    load();
  };

  const items = sub === 'statuses' ? statuses : sub === 'tags' ? tags : reasons;

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,16,64,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.15s ease-out' }}>
      <div style={{ background: 'white', borderRadius: 20, width: 440, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(127,119,221,0.25)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F3F0FF', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1a1040', margin: 0 }}>⚙️ Настройки CRM</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9B97CC', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ display: 'flex', gap: 4, padding: '12px 24px 0', flexShrink: 0 }}>
          <button onClick={() => setSub('statuses')} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: sub === 'statuses' ? '#EDE9FE' : '#F8F7FF', color: sub === 'statuses' ? '#7F77DD' : '#9B97CC' }}>Статусы</button>
          <button onClick={() => setSub('tags')} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: sub === 'tags' ? '#EDE9FE' : '#F8F7FF', color: sub === 'tags' ? '#7F77DD' : '#9B97CC' }}>Теги</button>
          <button onClick={() => setSub('reasons')} style={{ padding: '7px 14px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 700, cursor: 'pointer', background: sub === 'reasons' ? '#EDE9FE' : '#F8F7FF', color: sub === 'reasons' ? '#7F77DD' : '#9B97CC' }}>Причины отказа</button>
        </div>

        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
            <input value={newLabel} onChange={e => setNewLabel(e.target.value)} placeholder={sub === 'statuses' ? 'Название статуса' : sub === 'tags' ? 'Название тега' : 'Причина отказа'}
              style={{ flex: 1, background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: 10, padding: '8px 12px', fontSize: 13, outline: 'none' }} />
            {sub !== 'reasons' && <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)} style={{ width: 40, height: 36, border: '1px solid #EDE9FE', borderRadius: 10, cursor: 'pointer' }} />}
            <button onClick={addItem} style={{ background: 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white', border: 'none', borderRadius: 10, padding: '8px 16px', fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>+</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {items.length === 0 && <p style={{ color: '#C4C0E8', textAlign: 'center', padding: 20, fontSize: 12.5 }}>Список пуст</p>}
            {items.map((item: any) => (
              <div key={item.id} style={{ display: 'flex', alignItems: 'center', gap: 8, background: '#F8F7FF', borderRadius: 10, padding: '8px 12px' }}>
                {item.color && <span style={{ width: 12, height: 12, borderRadius: '50%', background: item.color, flexShrink: 0 }} />}
                <span style={{ fontSize: 12.5, color: '#1a1040', flex: 1 }}>{item.label ?? item.name}</span>
                <button onClick={() => deleteItem(item.id)} style={{ background: 'none', border: 'none', color: '#DC2626', cursor: 'pointer', fontSize: 13 }}>✕</button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
