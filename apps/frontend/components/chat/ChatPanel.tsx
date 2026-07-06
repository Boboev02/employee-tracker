'use client';
import { useState, useEffect, useRef } from 'react';
import { useChat, ChatChannel } from '@/hooks/useChat';

const AVATAR_COLORS = ['#7F77DD','#2563EB','#16A34A','#D97706','#DC2626','#0891B2','#7C3AED','#DB2777'];
const avatarColor = (name?: string) => AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'сейчас';
  if (m < 60) return `${m} мин`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} дн`;
  return new Date(dateStr).toLocaleDateString('ru', { day:'numeric', month:'short' });
}

function formatTime(dateStr: string): string {
  return new Date(dateStr).toLocaleTimeString('ru', { hour:'2-digit', minute:'2-digit' });
}

interface Props {
  token: string;
  currentUserId: string;
  compact?: boolean;         // widget mode: smaller, single-pane at a time
  onOpenFullPage?: () => void;
}

export function ChatPanel({ token, currentUserId, compact = false, onOpenFullPage }: Props) {
  const chat = useChat(token);
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
  const [messageText, setMessageText] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [uploading, setUploading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const messages = activeChannel ? (chat.messagesByChannel[activeChannel.id] ?? []) : [];
  const typingUser = activeChannel ? chat.typingByChannel[activeChannel.id] : null;

  useEffect(() => {
    if (!activeChannel) return;
    chat.joinChannel(activeChannel.id);
    chat.loadMessages(activeChannel.id);
    chat.markRead(activeChannel.id);
    return () => chat.leaveChannel(activeChannel.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannel?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const send = async () => {
    if (!activeChannel || !messageText.trim()) return;
    const text = messageText;
    setMessageText('');
    await chat.sendMessage(activeChannel.id, { content: text });
  };

  const handleFileUpload = async (file: File) => {
    if (!activeChannel) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const r = await fetch('https://employee-tracker.ru/api/v1/upload/file', {
        method: 'POST', headers: { Authorization: 'Bearer ' + token }, body: formData,
      });
      if (r.ok) {
        const data = await r.json();
        const isImage = ['png','jpg','jpeg','gif','webp'].includes(data.fileType);
        await chat.sendMessage(activeChannel.id, {
          attachmentUrl: data.url, attachmentName: data.fileName,
          attachmentType: isImage ? 'image' : 'file',
        });
      }
    } finally { setUploading(false); }
  };

  const cardBg = compact ? 'white' : '#f7f7fb';

  return (
    <div style={{ display:'flex', height:'100%', background:cardBg, borderRadius: compact ? 16 : 0, overflow:'hidden' }}>
      {/* Channel list */}
      <div style={{ width: compact ? (activeChannel ? 0 : '100%') : 300, borderRight: compact ? 'none' : '1px solid #EDE9FE', display:'flex', flexDirection:'column', overflow:'hidden', transition:'width 0.2s' }}>
        <div style={{ padding:'14px 16px', borderBottom:'1px solid #EDE9FE', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h3 style={{ fontSize:15, fontWeight:800, color:'#1a1040', margin:0 }}>Чаты</h3>
          <div style={{ display:'flex', gap:6 }}>
            {!compact && onOpenFullPage === undefined && null}
            <button onClick={()=>setShowNewChat(true)} style={{ width:28, height:28, borderRadius:8, background:'#EDE9FE', border:'none', color:'#7F77DD', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
          </div>
        </div>

        <div style={{ flex:1, overflowY:'auto' }}>
          {chat.loadingChannels && <div style={{ padding:20, textAlign:'center', color:'#9B97CC', fontSize:12 }}>Загрузка...</div>}
          {!chat.loadingChannels && chat.channels.length===0 && (
            <div style={{ padding:'30px 16px', textAlign:'center', color:'#C4C0E8', fontSize:12 }}>
              <div style={{ fontSize:28, marginBottom:8 }}>💬</div>
              Нет чатов. Нажмите «+» чтобы начать
            </div>
          )}
          {chat.channels.map(ch => (
            <div key={ch.id} onClick={()=>setActiveChannel(ch)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', cursor:'pointer', background: activeChannel?.id===ch.id ? '#F8F7FF' : 'transparent', borderBottom:'1px solid #FAF9FF' }}
              onMouseEnter={e=>{ if(activeChannel?.id!==ch.id) (e.currentTarget as HTMLElement).style.background='#FAF9FF'; }}
              onMouseLeave={e=>{ if(activeChannel?.id!==ch.id) (e.currentTarget as HTMLElement).style.background='transparent'; }}>
              <div style={{ width:40, height:40, borderRadius:'50%', background: ch.type==='GROUP' ? '#7F77DD' : avatarColor(ch.name??''), display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0, fontSize:16 }}>
                {ch.type==='GROUP' ? '👥' : <span style={{ color:'white', fontSize:14, fontWeight:700 }}>{ch.name?.charAt(0)??'?'}</span>}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'#1a1040', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ch.name}</span>
                  {ch.lastMessage && <span style={{ fontSize:10, color:'#C4C0E8', flexShrink:0, marginLeft:6 }}>{timeAgo(ch.lastMessage.createdAt)}</span>}
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:11.5, color:'#9B97CC', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {ch.lastMessage ? (ch.lastMessage.content ?? (ch.lastMessage.attachmentType==='image' ? '📷 Фото' : '📎 Файл')) : 'Нет сообщений'}
                  </span>
                  {ch.unreadCount > 0 && (
                    <span style={{ background:'#7F77DD', color:'white', fontSize:10, fontWeight:700, borderRadius:20, padding:'1px 6px', minWidth:16, textAlign:'center', flexShrink:0, marginLeft:6 }}>{ch.unreadCount}</span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Message thread */}
      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        {!activeChannel ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#C4C0E8', flexDirection:'column', gap:8 }}>
            <div style={{ fontSize:36 }}>💬</div>
            <p style={{ fontSize:13 }}>Выберите чат</p>
          </div>
        ) : (
          <>
            {/* Thread header */}
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #EDE9FE', display:'flex', alignItems:'center', gap:10 }}>
              {compact && (
                <button onClick={()=>setActiveChannel(null)} style={{ background:'none', border:'none', color:'#9B97CC', fontSize:18, cursor:'pointer' }}>←</button>
              )}
              <div style={{ width:32, height:32, borderRadius:'50%', background: activeChannel.type==='GROUP' ? '#7F77DD' : avatarColor(activeChannel.name??''), display:'flex', alignItems:'center', justifyContent:'center', fontSize:14 }}>
                {activeChannel.type==='GROUP' ? '👥' : <span style={{ color:'white', fontSize:12, fontWeight:700 }}>{activeChannel.name?.charAt(0)}</span>}
              </div>
              <div>
                <p style={{ fontSize:13, fontWeight:700, color:'#1a1040', margin:0 }}>{activeChannel.name}</p>
                <p style={{ fontSize:11, color:'#9B97CC', margin:0 }}>
                  {typingUser ? <span style={{ color:'#7F77DD' }}>печатает...</span> : activeChannel.type==='GROUP' ? `${activeChannel.memberCount} участников` : 'Личный чат'}
                </p>
              </div>
            </div>

            {/* Messages */}
            <div ref={scrollRef} style={{ flex:1, overflowY:'auto', padding:'14px 16px', display:'flex', flexDirection:'column', gap:10 }}>
              {messages.map((m, i) => {
                const isMe = m.senderId === currentUserId;
                const showSender = activeChannel.type==='GROUP' && !isMe && (i===0 || messages[i-1].senderId !== m.senderId);
                return (
                  <div key={m.id} style={{ display:'flex', flexDirection:'column', alignItems: isMe ? 'flex-end' : 'flex-start' }}>
                    {showSender && <span style={{ fontSize:10.5, color:'#9B97CC', marginBottom:2, marginLeft:2 }}>{m.sender?.name}</span>}
                    <div style={{ maxWidth:'75%', display:'flex', flexDirection:'column', gap:4 }}>
                      {m.attachmentUrl && m.attachmentType==='image' && (
                        <img src={m.attachmentUrl} alt={m.attachmentName??''} style={{ maxWidth:220, borderRadius:12, border:'1px solid #EDE9FE' }} />
                      )}
                      {m.attachmentUrl && m.attachmentType==='file' && (
                        <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer" style={{ display:'flex', alignItems:'center', gap:8, background: isMe?'#EDE9FE':'#F8F7FF', padding:'8px 12px', borderRadius:12, textDecoration:'none' }}>
                          <span style={{ fontSize:18 }}>📎</span>
                          <span style={{ fontSize:12, color:'#1a1040', fontWeight:600 }}>{m.attachmentName}</span>
                        </a>
                      )}
                      {m.content && (
                        <div style={{ background: isMe ? 'linear-gradient(135deg,#7F77DD,#5248C5)' : '#F8F7FF', color: isMe ? 'white' : '#1a1040', padding:'8px 14px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px', fontSize:13, lineHeight:1.5, border: isMe ? 'none' : '1px solid #F3F0FF' }}>
                          {m.content}
                        </div>
                      )}
                    </div>
                    <span style={{ fontSize:9.5, color:'#C4C0E8', marginTop:2 }}>{formatTime(m.createdAt)}</span>
                  </div>
                );
              })}
              {messages.length===0 && (
                <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#C4C0E8', fontSize:12 }}>Нет сообщений — начните переписку</div>
              )}
            </div>

            {/* Composer */}
            <div style={{ padding:'10px 14px', borderTop:'1px solid #EDE9FE', display:'flex', alignItems:'flex-end', gap:8 }}>
              <input type="file" ref={fileInputRef} style={{ display:'none' }} onChange={e=>{ const f=e.target.files?.[0]; if(f) handleFileUpload(f); e.target.value=''; }} />
              <button onClick={()=>fileInputRef.current?.click()} disabled={uploading}
                style={{ width:36, height:36, borderRadius:10, background:'#F8F7FF', border:'1px solid #EDE9FE', color:'#9B97CC', cursor:'pointer', fontSize:16, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {uploading ? '⏳' : '📎'}
              </button>
              <textarea value={messageText}
                onChange={e=>{ setMessageText(e.target.value); if(activeChannel) chat.sendTyping(activeChannel.id); }}
                onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); } }}
                placeholder="Напишите сообщение..." rows={1}
                style={{ flex:1, background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:12, padding:'9px 14px', fontSize:13, resize:'none', outline:'none', maxHeight:100, fontFamily:'inherit' }} />
              <button onClick={send} disabled={!messageText.trim()}
                style={{ width:36, height:36, borderRadius:10, background: messageText.trim() ? 'linear-gradient(135deg,#7F77DD,#5248C5)' : '#EDE9FE', border:'none', color:'white', cursor: messageText.trim()?'pointer':'not-allowed', fontSize:15, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                ➤
              </button>
            </div>
          </>
        )}
      </div>

      {/* New chat modal */}
      {showNewChat && (
        <NewChatModal token={token} chat={chat} onClose={()=>setShowNewChat(false)}
          onSelect={(ch: ChatChannel)=>{ setActiveChannel(ch); setShowNewChat(false); }} />
      )}
    </div>
  );
}

function NewChatModal({ token, chat, onClose, onSelect }: any) {
  const [mode, setMode] = useState<'direct'|'group'>('direct');
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [groupName, setGroupName] = useState('');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const search = async (q: string) => {
    setQuery(q);
    if (q.length >= 1) setResults(await chat.searchUsers(q));
    else setResults([]);
  };

  const startDirect = async (userId: string) => {
    const ch = await chat.openDirectChat(userId);
    if (ch) onSelect(ch);
  };

  const createGroup = async () => {
    if (!groupName.trim() || selectedIds.length===0) return;
    const ch = await chat.createGroup({ name: groupName, memberIds: selectedIds });
    if (ch) onSelect(ch);
  };

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,16,64,0.4)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'white', borderRadius:20, width:360, maxHeight:'70vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(127,119,221,0.2)' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #EDE9FE', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h3 style={{ fontSize:15, fontWeight:800, color:'#1a1040', margin:0 }}>Новый чат</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#9B97CC', fontSize:18, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ display:'flex', gap:4, padding:'10px 16px 0' }}>
          <button onClick={()=>setMode('direct')} style={{ flex:1, padding:'7px', borderRadius:8, border:'none', background: mode==='direct'?'#7F77DD':'#F8F7FF', color: mode==='direct'?'white':'#9B97CC', fontSize:12, fontWeight:700, cursor:'pointer' }}>Личное</button>
          <button onClick={()=>setMode('group')} style={{ flex:1, padding:'7px', borderRadius:8, border:'none', background: mode==='group'?'#7F77DD':'#F8F7FF', color: mode==='group'?'white':'#9B97CC', fontSize:12, fontWeight:700, cursor:'pointer' }}>Группа</button>
        </div>
        <div style={{ padding:16, overflowY:'auto', flex:1 }}>
          {mode==='group' && (
            <input value={groupName} onChange={e=>setGroupName(e.target.value)} placeholder="Название группы"
              style={{ width:'100%', background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:10, padding:'9px 12px', fontSize:13, marginBottom:10, outline:'none', boxSizing:'border-box' }} />
          )}
          <input value={query} onChange={e=>search(e.target.value)} placeholder="Поиск сотрудника..."
            style={{ width:'100%', background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:10, padding:'9px 12px', fontSize:13, marginBottom:10, outline:'none', boxSizing:'border-box' }} />
          <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
            {results.map(u => {
              const isSelected = selectedIds.includes(u.id);
              return (
                <div key={u.id} onClick={()=> mode==='direct' ? startDirect(u.id) : setSelectedIds(p => isSelected ? p.filter(id=>id!==u.id) : [...p, u.id])}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 10px', borderRadius:10, cursor:'pointer', background: isSelected ? '#EDE9FE' : 'transparent' }}
                  onMouseEnter={e=>{ if(!isSelected) (e.currentTarget as HTMLElement).style.background='#F8F7FF'; }}
                  onMouseLeave={e=>{ if(!isSelected) (e.currentTarget as HTMLElement).style.background='transparent'; }}>
                  <div style={{ width:32, height:32, borderRadius:'50%', background:avatarColor(u.name), display:'flex', alignItems:'center', justifyContent:'center' }}>
                    <span style={{ color:'white', fontSize:12, fontWeight:700 }}>{u.name?.charAt(0)}</span>
                  </div>
                  <span style={{ fontSize:13, fontWeight:600, color:'#1a1040' }}>{u.name}</span>
                  {mode==='group' && isSelected && <span style={{ marginLeft:'auto', color:'#7F77DD' }}>✓</span>}
                </div>
              );
            })}
          </div>
        </div>
        {mode==='group' && (
          <div style={{ padding:16, borderTop:'1px solid #EDE9FE' }}>
            <button onClick={createGroup} disabled={!groupName.trim() || selectedIds.length===0}
              style={{ width:'100%', padding:'10px', borderRadius:10, border:'none', background: (!groupName.trim()||selectedIds.length===0) ? '#EDE9FE' : 'linear-gradient(135deg,#7F77DD,#5248C5)', color: (!groupName.trim()||selectedIds.length===0) ? '#C4C0E8' : 'white', fontSize:13, fontWeight:700, cursor: (!groupName.trim()||selectedIds.length===0) ? 'not-allowed' : 'pointer' }}>
              Создать группу ({selectedIds.length})
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
