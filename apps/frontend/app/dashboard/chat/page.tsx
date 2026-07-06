'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ChatPanel } from '@/components/chat/ChatPanel';

export default function ChatPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [userId, setUserId] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    const u = JSON.parse(localStorage.getItem('user') ?? '{}');
    setUserId(u.id ?? u.sub ?? '');
  }, []);

  if (!token) return null;

  return (
    <div style={{ height:'100vh', display:'flex', flexDirection:'column', background:'#EEECFA' }}>
      <div style={{ padding:'16px 24px 4px' }}>
        <h1 style={{ fontSize:18, fontWeight:800, color:'#1a1040', margin:0 }}>💬 Чаты</h1>
        <p style={{ fontSize:12, color:'#9B97CC', margin:'2px 0 0' }}>Личные и групповые сообщения команды</p>
      </div>
      <div style={{ flex:1, overflow:'hidden' }}>
        <ChatPanel token={token} currentUserId={userId} />
      </div>
    </div>
  );
}
