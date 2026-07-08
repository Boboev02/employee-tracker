'use client';
import { useState, useEffect } from 'react';

const API = 'https://employee-tracker.ru/api/v1';

export function TrashModal({ h, onClose, onRestored }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const r = await fetch(`${API}/subscribers/trash`, { headers: h() });
    setItems(await r.json().catch(() => []));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const restore = async (id: string) => {
    await fetch(`${API}/subscribers/trash/${id}/restore`, { method: 'POST', headers: h() });
    load(); onRestored?.();
  };
  const permanentlyDelete = async (id: string) => {
    if (!confirm('Удалить безвозвратно? Это действие нельзя отменить.')) return;
    await fetch(`${API}/subscribers/trash/${id}`, { method: 'DELETE', headers: h() });
    load();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,16,64,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ background: 'white', borderRadius: 20, width: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(127,119,221,0.25)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F3F0FF', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1a1040', margin: 0 }}>🗑 Корзина</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9B97CC', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <p style={{ color: '#9B97CC', textAlign: 'center', padding: 30 }}>Загрузка...</p>
          ) : items.length === 0 ? (
            <p style={{ color: '#C4C0E8', textAlign: 'center', padding: 30 }}>Корзина пуста</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F8F7FF', borderRadius: 12, padding: '10px 14px' }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: '#1a1040', margin: 0 }}>{s.firstName} {s.lastName}</p>
                    <p style={{ fontSize: 11, color: '#9B97CC', margin: '2px 0 0' }}>Удалён {new Date(s.deletedAt).toLocaleDateString('ru')}</p>
                  </div>
                  <button onClick={() => restore(s.id)} style={{ fontSize: 11, background: '#DCFCE7', color: '#16A34A', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontWeight: 700 }}>↩ Восстановить</button>
                  <button onClick={() => permanentlyDelete(s.id)} style={{ fontSize: 11, background: '#FEE2E2', color: '#DC2626', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontWeight: 700 }}>Удалить навсегда</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
