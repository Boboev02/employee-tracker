'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { ChatPanel } from './ChatPanel';
import { useChat } from '@/hooks/useChat';

export function ChatWidget() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState('');
  const [userId, setUserId] = useState('');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) return;
    setToken(t);
    const u = JSON.parse(localStorage.getItem('user') ?? '{}');
    setUserId(u.id ?? u.sub ?? '');
    setMounted(true);
  }, []);

  // Poll unread count via lightweight hook even when widget closed (for badge)
  const chat = useChat(mounted ? token : null);

  if (!mounted) return null;

  return (
    <>
      {/* Floating bubble */}
      {!open && (
        <button onClick={()=>setOpen(true)}
          style={{ position:'fixed', bottom:24, right:88, width:56, height:56, borderRadius:'50%', background:'linear-gradient(135deg,#7F77DD,#5248C5)', border:'none', boxShadow:'0 8px 24px rgba(127,119,221,0.4)', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', zIndex:998, transition:'transform 0.2s' }}
          onMouseEnter={e=>(e.currentTarget as HTMLElement).style.transform='scale(1.08)'}
          onMouseLeave={e=>(e.currentTarget as HTMLElement).style.transform='scale(1)'}>
          <span style={{ fontSize:24 }}>💬</span>
          {chat.totalUnread > 0 && (
            <span style={{ position:'absolute', top:-2, right:-2, background:'#DC2626', color:'white', fontSize:10, fontWeight:700, borderRadius:20, minWidth:18, height:18, display:'flex', alignItems:'center', justifyContent:'center', padding:'0 4px', border:'2px solid white' }}>
              {chat.totalUnread > 9 ? '9+' : chat.totalUnread}
            </span>
          )}
        </button>
      )}

      {/* Expanded panel */}
      {open && (
        <div style={{ position:'fixed', bottom:24, right:88, width:360, height:520, borderRadius:20, boxShadow:'0 24px 64px rgba(127,119,221,0.3)', zIndex:998, overflow:'hidden', display:'flex', flexDirection:'column', background:'white' }}>
          <div style={{ padding:'12px 16px', background:'linear-gradient(135deg,#7F77DD,#5248C5)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
            <span style={{ color:'white', fontWeight:700, fontSize:14 }}>💬 Чаты</span>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={()=>{ router.push('/dashboard/chat'); setOpen(false); }} title="Открыть в полный экран"
                style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'white', width:26, height:26, borderRadius:8, cursor:'pointer', fontSize:13, display:'flex', alignItems:'center', justifyContent:'center' }}>⤢</button>
              <button onClick={()=>setOpen(false)}
                style={{ background:'rgba(255,255,255,0.2)', border:'none', color:'white', width:26, height:26, borderRadius:8, cursor:'pointer', fontSize:14, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
            </div>
          </div>
          <div style={{ flex:1, overflow:'hidden' }}>
            <ChatPanel token={token} currentUserId={userId} compact />
          </div>
        </div>
      )}
    </>
  );
}
