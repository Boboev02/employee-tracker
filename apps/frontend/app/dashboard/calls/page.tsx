'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';

const API = 'https://employee-tracker.ru/api/v1';

export default function CallsLobbyPage() {
  const router = useRouter();
  const [joinRoomId, setJoinRoomId] = useState('');
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('access_token')) router.push('/login');
  }, []);

  const createCall = async () => {
    setCreating(true);
    const token = localStorage.getItem('access_token');
    const res = await fetch(API + '/calls/create', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    const data = await res.json();
    router.push(`/dashboard/calls/${data.roomId}`);
  };

  const joinCall = () => {
    if (!joinRoomId.trim()) return;
    // Поддержка вставки полной ссылки или просто ID
    const match = joinRoomId.match(/calls\/([a-f0-9-]+)/);
    const id = match ? match[1] : joinRoomId.trim();
    router.push(`/dashboard/calls/${id}`);
  };

  const card: React.CSSProperties = { background: 'white', borderRadius: '20px', padding: '24px', boxShadow: '0 4px 16px rgba(127,119,221,0.08)' };

  return (
    <div style={{ minHeight: '100vh', background: '#ECEAF8', padding: '40px 28px' }}>
      <div style={{ maxWidth: '600px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '16px' }}>
        <div>
          <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#1a1040', margin: 0 }}>📹 Видеозвонки</h1>
          <p style={{ fontSize: '13px', color: '#9B97CC', margin: '4px 0 0' }}>Групповые видеоконференции до 10 человек</p>
        </div>

        <div style={card}>
          <p style={{ fontSize: '14px', fontWeight: 700, color: '#1a1040', margin: '0 0 14px' }}>🎥 Начать новый звонок</p>
          <button onClick={createCall} disabled={creating}
            style={{ width: '100%', background: 'linear-gradient(135deg,#7F77DD,#5248C5)', color: 'white', border: 'none', borderRadius: '14px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: 'pointer', opacity: creating ? 0.7 : 1 }}>
            {creating ? 'Создание...' : '+ Создать звонок'}
          </button>
        </div>

        <div style={card}>
          <p style={{ fontSize: '14px', fontWeight: 700, color: '#1a1040', margin: '0 0 14px' }}>🔗 Присоединиться к звонку</p>
          <div style={{ display: 'flex', gap: '10px' }}>
            <input
              placeholder="Вставьте ссылку или ID звонка..."
              value={joinRoomId}
              onChange={e => setJoinRoomId(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && joinCall()}
              style={{ flex: 1, background: '#F8F7FF', border: '1px solid #EDE9FE', borderRadius: '12px', padding: '12px 16px', fontSize: '14px', outline: 'none' }}
            />
            <button onClick={joinCall}
              style={{ background: '#EDE9FE', color: '#7F77DD', border: 'none', borderRadius: '12px', padding: '12px 24px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
              Войти
            </button>
          </div>
        </div>

        <div style={{ ...card, background: '#F8F7FF' }}>
          <p style={{ fontSize: '12px', color: '#9B97CC', margin: 0, lineHeight: '1.6' }}>
            💡 После создания звонка скопируйте ссылку и отправьте коллегам — они смогут подключиться напрямую. Поддерживается видео, аудио и демонстрация экрана.
          </p>
        </div>
      </div>
    </div>
  );
}
