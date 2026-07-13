'use client';
import { useState, useEffect } from 'react';

const API = 'https://employee-tracker.ru/api/v1';

export function ArchiveModal({ h, onClose, onRestored, onSelectSubscriber }: any) {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const r = await fetch(`${API}/subscribers/archived`, { headers: h() });
    setItems(await r.json().catch(() => []));
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const restore = async (id: string) => {
    await fetch(`${API}/subscribers/${id}`, { method: 'PATCH', headers: h(), body: JSON.stringify({ crmStatus: 'NEW' }) });
    load(); onRestored?.();
  };

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(26,16,64,0.4)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', animation: 'fadeIn 0.15s ease-out' }}>
      <div style={{ background: 'white', borderRadius: 20, width: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 64px rgba(127,119,221,0.25)' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid #F3F0FF', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <h3 style={{ fontSize: 16, fontWeight: 800, color: '#1a1040', margin: 0 }}>📥 Архив</h3>
            <p style={{ fontSize: 11.5, color: '#9B97CC', margin: '2px 0 0' }}>Подписчики со статусом «В архиве» — скрыты из основного списка</p>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#9B97CC', fontSize: 20, cursor: 'pointer' }}>✕</button>
        </div>
        <div style={{ padding: '16px 24px', overflowY: 'auto', flex: 1 }}>
          {loading ? (
            <p style={{ color: '#9B97CC', textAlign: 'center', padding: 30 }}>Загрузка...</p>
          ) : items.length === 0 ? (
            <p style={{ color: '#C4C0E8', textAlign: 'center', padding: 30 }}>Архив пуст</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {items.map(s => (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F8F7FF', borderRadius: 12, padding: '10px 14px' }}>
                  <div onClick={() => onSelectSubscriber?.(s)} style={{ flex: 1, cursor: onSelectSubscriber ? 'pointer' : 'default' }}>
                    <p style={{ fontSize: 12.5, fontWeight: 700, color: '#1a1040', margin: 0 }}>{s.firstName} {s.lastName}</p>
                    <p style={{ fontSize: 11, color: '#9B97CC', margin: '2px 0 0' }}>{s.email} · менеджер: {s.manager?.name ?? '—'}</p>
                  </div>
                  <button onClick={() => restore(s.id)} style={{ fontSize: 11, background: '#DCFCE7', color: '#16A34A', border: 'none', borderRadius: 8, padding: '5px 10px', cursor: 'pointer', fontWeight: 700, whiteSpace: 'nowrap' }}>↩ Вернуть в работу</button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
