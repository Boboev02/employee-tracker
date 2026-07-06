'use client';
import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useChat, ChatChannel, ChatMessage } from '@/hooks/useChat';
import { useSocket } from '@/lib/useSocket';

const AVATAR_COLORS = ['#7F77DD','#2563EB','#16A34A','#D97706','#DC2626','#0891B2','#7C3AED','#DB2777'];
const avatarColor = (name?: string) => AVATAR_COLORS[(name?.charCodeAt(0) ?? 0) % AVATAR_COLORS.length];
const QUICK_REACTIONS = ['👍','❤️','😂','😮','😢','🙏'];
const TASK_LINK_RE = /https?:\/\/[^\s]*\/dashboard\/tasks\/([a-f0-9-]{20,})/i;

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
function dateLabel(dateStr: string): string {
  const d = new Date(dateStr); const today = new Date(); const yest = new Date(Date.now()-864e5);
  if (d.toDateString()===today.toDateString()) return 'Сегодня';
  if (d.toDateString()===yest.toDateString()) return 'Вчера';
  return d.toLocaleDateString('ru', { day:'numeric', month:'long', year: d.getFullYear()!==today.getFullYear()?'numeric':undefined });
}

interface Props {
  token: string;
  currentUserId: string;
  compact?: boolean;
  onOpenFullPage?: () => void;
}

export function ChatPanel({ token, currentUserId, compact = false }: Props) {
  const router = useRouter();

  const onIncomingMessage = (channelId: string, message: ChatMessage) => {
    if (message.senderId === currentUserId) return;
    if (document.hidden) {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification(message.sender?.name ?? 'Новое сообщение', { body: message.content ?? '📎 Вложение', icon:'/favicon.ico' });
      }
    }
  };

  const chat = useChat(token, onIncomingMessage);
  const { getStatus } = useSocket(token);
  const [activeChannel, setActiveChannel] = useState<ChatChannel | null>(null);
  const [messageText, setMessageText] = useState('');
  const [showNewChat, setShowNewChat] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [editingMsg, setEditingMsg] = useState<ChatMessage | null>(null);
  const [hoveredMsgId, setHoveredMsgId] = useState<string | null>(null);
  const [showReactionsFor, setShowReactionsFor] = useState<string | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatMessage[]>([]);
  const [forwardMsg, setForwardMsg] = useState<ChatMessage | null>(null);
  const [mentionQuery, setMentionQuery] = useState<string | null>(null);
  const [recording, setRecording] = useState(false);
  const [creatingCall, setCreatingCall] = useState(false);

  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);

  const messages = activeChannel ? (chat.messagesByChannel[activeChannel.id] ?? []) : [];
  const typingUser = activeChannel ? chat.typingByChannel[activeChannel.id] : null;
  const otherMember = activeChannel?.type==='DIRECT' ? activeChannel.members.find(m=>m.id!==currentUserId) : null;
  const otherStatus = otherMember ? getStatus(otherMember.id) : null;

  useEffect(() => {
    if (typeof Notification !== 'undefined' && Notification.permission === 'default') {
      Notification.requestPermission().catch(()=>{});
    }
  }, []);

  useEffect(() => {
    if (!activeChannel) return;
    chat.joinChannel(activeChannel.id);
    chat.loadMessages(activeChannel.id);
    chat.markRead(activeChannel.id);
    setShowSearch(false); setReplyingTo(null); setEditingMsg(null);
    return () => chat.leaveChannel(activeChannel.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeChannel?.id]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages.length]);

  const pinnedMessage = activeChannel?.pinnedMessageId ? messages.find(m=>m.id===activeChannel.pinnedMessageId) : null;

  // ── Mentions parsing ─────────────────────────────────────────────────────────
  const memberSuggestions = activeChannel?.type==='GROUP' && mentionQuery !== null
    ? activeChannel.members.filter(m => m.id!==currentUserId && m.name.toLowerCase().includes(mentionQuery.toLowerCase()))
    : [];

  const onComposerChange = (val: string) => {
    setMessageText(val);
    if (activeChannel) chat.sendTyping(activeChannel.id);
    const atMatch = val.match(/@([^\s@]*)$/);
    setMentionQuery(atMatch ? atMatch[1] : null);
  };

  const insertMention = (name: string) => {
    setMessageText(prev => prev.replace(/@([^\s@]*)$/, `@${name} `));
    setMentionQuery(null);
    textareaRef.current?.focus();
  };

  const extractMentionedIds = (text: string): string[] => {
    if (!activeChannel) return [];
    const ids: string[] = [];
    for (const m of activeChannel.members) {
      if (text.includes(`@${m.name}`)) ids.push(m.id);
    }
    return ids;
  };

  const renderContent = (text: string) => {
    const taskMatch = text.match(TASK_LINK_RE);
    if (taskMatch) {
      const before = text.slice(0, taskMatch.index);
      const after = text.slice((taskMatch.index??0) + taskMatch[0].length);
      return (
        <>
          {before}
          <a onClick={e=>{e.preventDefault(); router.push('/dashboard/tasks/'+taskMatch[1]);}} href={taskMatch[0]}
            style={{ display:'inline-flex', alignItems:'center', gap:4, background:'rgba(127,119,221,0.15)', color:'inherit', padding:'2px 8px', borderRadius:8, textDecoration:'none', fontWeight:600, cursor:'pointer' }}>
            📋 Открыть задачу
          </a>
          {after}
        </>
      );
    }
    const parts = text.split(/(@[^\s@]+)/g);
    return parts.map((p, i) => p.startsWith('@')
      ? <span key={i} style={{ fontWeight:700, color:'#7F77DD' }}>{p}</span>
      : p);
  };

  const send = async () => {
    if (!activeChannel || !messageText.trim()) return;
    if (editingMsg) {
      await chat.editMessage(editingMsg.id, messageText);
      setEditingMsg(null); setMessageText('');
      return;
    }
    const text = messageText;
    const mentionedIds = extractMentionedIds(text);
    setMessageText(''); setReplyingTo(null);
    await chat.sendMessage(activeChannel.id, { content: text, replyToId: replyingTo?.id, mentionedIds });
  };

  const startEdit = (m: ChatMessage) => { setEditingMsg(m); setMessageText(m.content ?? ''); setReplyingTo(null); textareaRef.current?.focus(); };
  const startReply = (m: ChatMessage) => { setReplyingTo(m); setEditingMsg(null); textareaRef.current?.focus(); };

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
        const isAudio = ['webm','ogg','mp3','wav','m4a'].includes(data.fileType);
        await chat.sendMessage(activeChannel.id, {
          attachmentUrl: data.url, attachmentName: data.fileName,
          attachmentType: isImage ? 'image' : isAudio ? 'audio' : 'file',
        });
      }
    } finally { setUploading(false); }
  };

  const toggleRecording = async () => {
    if (recording) {
      mediaRecorderRef.current?.stop();
      setRecording(false);
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];
      recorder.ondataavailable = e => audioChunksRef.current.push(e.data);
      recorder.onstop = async () => {
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const file = new File([blob], `voice-${Date.now()}.webm`, { type: 'audio/webm' });
        stream.getTracks().forEach(t => t.stop());
        await handleFileUpload(file);
      };
      mediaRecorderRef.current = recorder;
      recorder.start();
      setRecording(true);
    } catch {
      alert('Не удалось получить доступ к микрофону');
    }
  };

  const startCall = async () => {
    if (!activeChannel) return;
    setCreatingCall(true);
    try {
      const r = await fetch('https://employee-tracker.ru/api/v1/calls/create', {
        method: 'POST', headers: { 'Content-Type':'application/json', Authorization:'Bearer '+token },
        body: JSON.stringify({ title: activeChannel.name ?? 'Звонок' }),
      });
      if (r.ok) {
        const data = await r.json();
        const url = `https://employee-tracker.ru${data.url}`;
        await chat.sendMessage(activeChannel.id, { content: `📞 Видеозвонок: ${url}` });
        window.open(data.url, '_blank');
      }
    } finally { setCreatingCall(false); }
  };

  const runSearch = async (q: string) => {
    setSearchQuery(q);
    if (!activeChannel || q.length < 2) { setSearchResults([]); return; }
    setSearchResults(await chat.searchInChannel(activeChannel.id, q));
  };

  const handleAvatarUpload = async (file: File) => {
    if (!activeChannel) return;
    const formData = new FormData();
    formData.append('file', file);
    const r = await fetch('https://employee-tracker.ru/api/v1/upload/file', { method:'POST', headers:{ Authorization:'Bearer '+token }, body: formData });
    if (r.ok) {
      const data = await r.json();
      await chat.updateChannelAvatar(activeChannel.id, data.url);
      setActiveChannel(prev => prev ? { ...prev, avatarUrl: data.url } : prev);
    }
  };

  const cardBg = compact ? 'white' : '#f7f7fb';
  let lastDate = '';

  return (
    <div style={{ display:'flex', height:'100%', background:cardBg, borderRadius: compact ? 16 : 0, overflow:'hidden', position:'relative' }}>
      <div style={{ width: compact ? (activeChannel ? 0 : '100%') : 300, borderRight: compact ? 'none' : '1px solid #EDE9FE', display:'flex', flexDirection:'column', overflow:'hidden', transition:'width 0.2s' }}>
        <div style={{ padding:'14px 16px', borderBottom:'1px solid #EDE9FE', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h3 style={{ fontSize:15, fontWeight:800, color:'#1a1040', margin:0 }}>Чаты</h3>
          <button onClick={()=>setShowNewChat(true)} style={{ width:28, height:28, borderRadius:8, background:'#EDE9FE', border:'none', color:'#7F77DD', cursor:'pointer', fontSize:16, display:'flex', alignItems:'center', justifyContent:'center' }}>+</button>
        </div>

        <div style={{ flex:1, overflowY:'auto' }}>
          {chat.loadingChannels && <div style={{ padding:20, textAlign:'center', color:'#9B97CC', fontSize:12 }}>Загрузка...</div>}
          {!chat.loadingChannels && chat.channels.length===0 && (
            <div style={{ padding:'30px 16px', textAlign:'center', color:'#C4C0E8', fontSize:12 }}>
              <div style={{ fontSize:28, marginBottom:8 }}>💬</div>
              Нет чатов. Нажмите «+» чтобы начать
            </div>
          )}
          {chat.channels.map(ch => {
            const chOther = ch.type==='DIRECT' ? ch.members.find(m=>m.id!==currentUserId) : null;
            const chOnline = chOther ? getStatus(chOther.id)==='ONLINE' : false;
            return (
            <div key={ch.id} onClick={()=>setActiveChannel(ch)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', cursor:'pointer', background: activeChannel?.id===ch.id ? '#F8F7FF' : 'transparent', borderBottom:'1px solid #FAF9FF' }}
              onMouseEnter={e=>{ if(activeChannel?.id!==ch.id) (e.currentTarget as HTMLElement).style.background='#FAF9FF'; }}
              onMouseLeave={e=>{ if(activeChannel?.id!==ch.id) (e.currentTarget as HTMLElement).style.background='transparent'; }}>
              <div style={{ position:'relative', flexShrink:0 }}>
                <div style={{ width:40, height:40, borderRadius:'50%', background: ch.avatarUrl ? `url(${ch.avatarUrl}) center/cover` : (ch.type==='GROUP' ? '#7F77DD' : avatarColor(ch.name??'')), display:'flex', alignItems:'center', justifyContent:'center', fontSize:16 }}>
                  {!ch.avatarUrl && (ch.type==='GROUP' ? '👥' : <span style={{ color:'white', fontSize:14, fontWeight:700 }}>{ch.name?.charAt(0)??'?'}</span>)}
                </div>
                {ch.type==='DIRECT' && chOnline && <span style={{ position:'absolute', bottom:0, right:0, width:10, height:10, borderRadius:'50%', background:'#22c55e', border:'2px solid white' }} />}
              </div>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline' }}>
                  <span style={{ fontSize:13, fontWeight:600, color:'#1a1040', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{ch.name}</span>
                  {ch.lastMessage && <span style={{ fontSize:10, color:'#C4C0E8', flexShrink:0, marginLeft:6 }}>{timeAgo(ch.lastMessage.createdAt)}</span>}
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <span style={{ fontSize:11.5, color:'#9B97CC', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {ch.lastMessage ? (ch.lastMessage.content ?? (ch.lastMessage.attachmentType==='image' ? '📷 Фото' : ch.lastMessage.attachmentType==='audio' ? '🎤 Голосовое' : '📎 Файл')) : 'Нет сообщений'}
                  </span>
                  {ch.unreadCount > 0 && (
                    <span style={{ background:'#7F77DD', color:'white', fontSize:10, fontWeight:700, borderRadius:20, padding:'1px 6px', minWidth:16, textAlign:'center', flexShrink:0, marginLeft:6 }}>{ch.unreadCount}</span>
                  )}
                </div>
              </div>
            </div>
          );})}
        </div>
      </div>

      <div style={{ flex:1, display:'flex', flexDirection:'column', minWidth:0 }}>
        {!activeChannel ? (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#C4C0E8', flexDirection:'column', gap:8 }}>
            <div style={{ fontSize:36 }}>💬</div>
            <p style={{ fontSize:13 }}>Выберите чат</p>
          </div>
        ) : (
          <>
            <div style={{ padding:'12px 16px', borderBottom:'1px solid #EDE9FE', display:'flex', alignItems:'center', gap:10 }}>
              {compact && (
                <button onClick={()=>setActiveChannel(null)} style={{ background:'none', border:'none', color:'#9B97CC', fontSize:18, cursor:'pointer' }}>←</button>
              )}
              <div style={{ position:'relative' }}>
                <div onClick={()=> activeChannel.type==='GROUP' && avatarInputRef.current?.click()}
                  style={{ width:32, height:32, borderRadius:'50%', background: activeChannel.avatarUrl ? `url(${activeChannel.avatarUrl}) center/cover` : (activeChannel.type==='GROUP' ? '#7F77DD' : avatarColor(activeChannel.name??'')), display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, cursor: activeChannel.type==='GROUP' ? 'pointer' : 'default' }}>
                  {!activeChannel.avatarUrl && (activeChannel.type==='GROUP' ? '👥' : <span style={{ color:'white', fontSize:12, fontWeight:700 }}>{activeChannel.name?.charAt(0)}</span>)}
                </div>
                {activeChannel.type==='DIRECT' && otherStatus==='ONLINE' && <span style={{ position:'absolute', bottom:0, right:0, width:8, height:8, borderRadius:'50%', background:'#22c55e', border:'2px solid white' }} />}
              </div>
              <input type="file" accept="image/*" ref={avatarInputRef} style={{ display:'none' }} onChange={e=>{ const f=e.target.files?.[0]; if(f) handleAvatarUpload(f); e.target.value=''; }} />
              <div style={{ flex:1, minWidth:0 }}>
                <p style={{ fontSize:13, fontWeight:700, color:'#1a1040', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{activeChannel.name}</p>
                <p style={{ fontSize:11, color:'#9B97CC', margin:0 }}>
                  {typingUser ? <span style={{ color:'#7F77DD' }}>печатает...</span>
                    : activeChannel.type==='GROUP' ? `${activeChannel.memberCount} участников`
                    : otherStatus==='ONLINE' ? <span style={{ color:'#22c55e' }}>в сети</span> : 'не в сети'}
                </p>
              </div>
              <div style={{ display:'flex', gap:4, flexShrink:0 }}>
                <button onClick={()=>setShowSearch(v=>!v)} title="Поиск" style={{ width:30, height:30, borderRadius:8, background: showSearch?'#EDE9FE':'none', border:'none', color:'#9B97CC', cursor:'pointer', fontSize:14 }}>🔍</button>
                <button onClick={startCall} disabled={creatingCall} title="Видеозвонок" style={{ width:30, height:30, borderRadius:8, background:'none', border:'none', color:'#9B97CC', cursor:'pointer', fontSize:14 }}>{creatingCall?'⏳':'📞'}</button>
              </div>
            </div>

            {showSearch && (
              <div style={{ padding:'8px 16px', borderBottom:'1px solid #EDE9FE' }}>
                <input value={searchQuery} onChange={e=>runSearch(e.target.value)} placeholder="Поиск по сообщениям..." autoFocus
                  style={{ width:'100%', background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:10, padding:'7px 12px', fontSize:12.5, outline:'none', boxSizing:'border-box' }} />
                {searchResults.length>0 && (
                  <div style={{ marginTop:6, maxHeight:160, overflowY:'auto' }}>
                    {searchResults.map(m => (
                      <div key={m.id} style={{ padding:'6px 8px', fontSize:12, color:'#1a1040', borderBottom:'1px solid #FAF9FF' }}>{m.content}</div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {pinnedMessage && (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 16px', background:'#FFFBEB', borderBottom:'1px solid #FEF3C7' }}>
                <span style={{ fontSize:13 }}>📌</span>
                <span style={{ fontSize:11.5, color:'#92400E', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{pinnedMessage.content}</span>
                <button onClick={()=>chat.pinMessage(activeChannel.id, null)} style={{ background:'none', border:'none', color:'#92400E', cursor:'pointer', fontSize:12 }}>✕</button>
              </div>
            )}

            <div ref={scrollRef} style={{ flex:1, overflowY:'auto', padding:'14px 16px', display:'flex', flexDirection:'column', gap:4 }}>
              {messages.map((m, i) => {
                const isMe = m.senderId === currentUserId;
                const showSender = activeChannel.type==='GROUP' && !isMe && (i===0 || messages[i-1].senderId !== m.senderId);
                const msgDate = dateLabel(m.createdAt);
                const showDateSep = msgDate !== lastDate;
                lastDate = msgDate;
                const isDeleted = !!m.deletedAt;
                const reactions = m.reactions ?? {};
                const reactionEntries = Object.entries(reactions).filter(([,ids])=>ids.length>0);

                return (
                  <div key={m.id}>
                    {showDateSep && (
                      <div style={{ textAlign:'center', margin:'10px 0' }}>
                        <span style={{ fontSize:10.5, color:'#9B97CC', background:'#F0EDFF', padding:'3px 12px', borderRadius:20, fontWeight:600 }}>{msgDate}</span>
                      </div>
                    )}
                    <div style={{ display:'flex', flexDirection:'column', alignItems: isMe ? 'flex-end' : 'flex-start', marginTop:2 }}
                      onMouseEnter={()=>setHoveredMsgId(m.id)} onMouseLeave={()=>{ setHoveredMsgId(null); setShowReactionsFor(null); }}>
                      {showSender && <span style={{ fontSize:10.5, color:'#9B97CC', marginBottom:2, marginLeft:2 }}>{m.sender?.name}</span>}

                      <div style={{ display:'flex', alignItems:'flex-end', gap:4, maxWidth:'85%' }}>
                        {isMe && hoveredMsgId===m.id && !isDeleted && (
                          <div style={{ display:'flex', gap:2, marginBottom:4 }}>
                            <button onClick={()=>setShowReactionsFor(showReactionsFor===m.id?null:m.id)} title="Реакция" style={actionBtnStyle}>😀</button>
                            <button onClick={()=>startReply(m)} title="Ответить" style={actionBtnStyle}>↩️</button>
                            <button onClick={()=>startEdit(m)} title="Редактировать" style={actionBtnStyle}>✏️</button>
                            <button onClick={()=>setForwardMsg(m)} title="Переслать" style={actionBtnStyle}>➡️</button>
                            <button onClick={()=>{ if(confirm('Удалить сообщение?')) chat.deleteMessage(m.id); }} title="Удалить" style={actionBtnStyle}>🗑️</button>
                          </div>
                        )}

                        <div style={{ display:'flex', flexDirection:'column', gap:4, minWidth:0 }}>
                          {m.replyTo && (
                            <div style={{ fontSize:11, color:'#9B97CC', background:'rgba(127,119,221,0.08)', borderLeft:'2px solid #7F77DD', padding:'4px 8px', borderRadius:6, marginBottom:2 }}>
                              {m.replyTo.content ?? (m.replyTo.attachmentType==='image'?'📷 Фото':'📎 Вложение')}
                            </div>
                          )}

                          {m.attachmentUrl && m.attachmentType==='image' && (
                            <img src={m.attachmentUrl} alt={m.attachmentName??''} style={{ maxWidth:220, borderRadius:12, border:'1px solid #EDE9FE' }} />
                          )}
                          {m.attachmentUrl && m.attachmentType==='file' && (
                            <a href={m.attachmentUrl} target="_blank" rel="noopener noreferrer" style={{ display:'flex', alignItems:'center', gap:8, background: isMe?'#EDE9FE':'#F8F7FF', padding:'8px 12px', borderRadius:12, textDecoration:'none' }}>
                              <span style={{ fontSize:18 }}>📎</span>
                              <span style={{ fontSize:12, color:'#1a1040', fontWeight:600 }}>{m.attachmentName}</span>
                            </a>
                          )}
                          {m.attachmentUrl && m.attachmentType==='audio' && (
                            <audio controls src={m.attachmentUrl} style={{ height:34, maxWidth:220 }} />
                          )}

                          {isDeleted ? (
                            <div style={{ fontSize:12.5, color:'#C4C0E8', fontStyle:'italic', padding:'8px 14px' }}>Сообщение удалено</div>
                          ) : m.content && (
                            <div style={{ background: isMe ? 'linear-gradient(135deg,#7F77DD,#5248C5)' : '#F8F7FF', color: isMe ? 'white' : '#1a1040', padding:'8px 14px', borderRadius: isMe ? '16px 16px 4px 16px' : '16px 16px 16px 4px', fontSize:13, lineHeight:1.5, border: isMe ? 'none' : '1px solid #F3F0FF' }}>
                              {renderContent(m.content)}
                              {m.editedAt && <span style={{ fontSize:9.5, opacity:0.6, marginLeft:6 }}>(изменено)</span>}
                            </div>
                          )}

                          {reactionEntries.length>0 && (
                            <div style={{ display:'flex', gap:3, flexWrap:'wrap' }}>
                              {reactionEntries.map(([emoji, ids]) => (
                                <button key={emoji} onClick={()=>chat.toggleReaction(m.id, emoji)}
                                  style={{ fontSize:11, background: ids.includes(currentUserId)?'#EDE9FE':'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:20, padding:'1px 7px', cursor:'pointer', display:'flex', alignItems:'center', gap:3 }}>
                                  {emoji} <span style={{ fontSize:9.5, color:'#9B97CC' }}>{ids.length}</span>
                                </button>
                              ))}
                            </div>
                          )}

                          {showReactionsFor===m.id && (
                            <div style={{ display:'flex', gap:4, background:'white', border:'1px solid #EDE9FE', borderRadius:20, padding:'4px 8px', boxShadow:'0 4px 12px rgba(0,0,0,0.08)' }}>
                              {QUICK_REACTIONS.map(e => (
                                <button key={e} onClick={()=>{ chat.toggleReaction(m.id, e); setShowReactionsFor(null); }} style={{ background:'none', border:'none', cursor:'pointer', fontSize:15 }}>{e}</button>
                              ))}
                            </div>
                          )}
                        </div>

                        {!isMe && hoveredMsgId===m.id && !isDeleted && (
                          <div style={{ display:'flex', gap:2, marginBottom:4 }}>
                            <button onClick={()=>setShowReactionsFor(showReactionsFor===m.id?null:m.id)} title="Реакция" style={actionBtnStyle}>😀</button>
                            <button onClick={()=>startReply(m)} title="Ответить" style={actionBtnStyle}>↩️</button>
                            <button onClick={()=>setForwardMsg(m)} title="Переслать" style={actionBtnStyle}>➡️</button>
                            <button onClick={()=>chat.pinMessage(activeChannel.id, m.id)} title="Закрепить" style={actionBtnStyle}>📌</button>
                          </div>
                        )}
                      </div>

                      <span style={{ fontSize:9.5, color:'#C4C0E8', marginTop:2, display:'flex', alignItems:'center', gap:3 }}>
                        {formatTime(m.createdAt)}
                        {isMe && !isDeleted && <span style={{ color: m.isRead ? '#7F77DD' : '#C4C0E8' }}>{m.isRead ? '✓✓' : '✓'}</span>}
                      </span>
                    </div>
                  </div>
                );
              })}
              {messages.length===0 && (
                <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'#C4C0E8', fontSize:12 }}>Нет сообщений — начните переписку</div>
              )}
            </div>

            {(replyingTo || editingMsg) && (
              <div style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 16px', background:'#F8F7FF', borderTop:'1px solid #EDE9FE' }}>
                <span style={{ fontSize:14 }}>{editingMsg ? '✏️' : '↩️'}</span>
                <span style={{ fontSize:11.5, color:'#7F77DD', fontWeight:600 }}>{editingMsg ? 'Редактирование' : 'Ответ на сообщение'}</span>
                <span style={{ fontSize:11.5, color:'#9B97CC', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{(editingMsg??replyingTo)?.content}</span>
                <button onClick={()=>{ setReplyingTo(null); setEditingMsg(null); setMessageText(''); }} style={{ background:'none', border:'none', color:'#9B97CC', cursor:'pointer' }}>✕</button>
              </div>
            )}

            {memberSuggestions.length>0 && (
              <div style={{ padding:'6px 16px', borderTop:'1px solid #EDE9FE', display:'flex', gap:6, flexWrap:'wrap' }}>
                {memberSuggestions.slice(0,5).map(u => (
                  <button key={u.id} onClick={()=>insertMention(u.name)} style={{ fontSize:12, background:'#EDE9FE', color:'#7F77DD', border:'none', borderRadius:8, padding:'4px 10px', cursor:'pointer', fontWeight:600 }}>@{u.name}</button>
                ))}
              </div>
            )}

            <div style={{ padding:'10px 14px', borderTop:'1px solid #EDE9FE', display:'flex', alignItems:'flex-end', gap:8 }}>
              <input type="file" ref={fileInputRef} style={{ display:'none' }} onChange={e=>{ const f=e.target.files?.[0]; if(f) handleFileUpload(f); e.target.value=''; }} />
              <button onClick={()=>fileInputRef.current?.click()} disabled={uploading}
                style={{ width:36, height:36, borderRadius:10, background:'#F8F7FF', border:'1px solid #EDE9FE', color:'#9B97CC', cursor:'pointer', fontSize:16, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {uploading ? '⏳' : '📎'}
              </button>
              <button onClick={toggleRecording}
                style={{ width:36, height:36, borderRadius:10, background: recording ? '#FEE2E2' : '#F8F7FF', border:'1px solid ' + (recording?'#FCA5A5':'#EDE9FE'), color: recording?'#DC2626':'#9B97CC', cursor:'pointer', fontSize:16, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                {recording ? '⏹️' : '🎤'}
              </button>
              <textarea ref={textareaRef} value={messageText}
                onChange={e=>onComposerChange(e.target.value)}
                onKeyDown={e=>{ if(e.key==='Enter' && !e.shiftKey){ e.preventDefault(); send(); } }}
                placeholder={recording ? 'Идёт запись...' : 'Напишите сообщение... (@ для упоминания)'} rows={1} disabled={recording}
                style={{ flex:1, background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:12, padding:'9px 14px', fontSize:13, resize:'none', outline:'none', maxHeight:100, fontFamily:'inherit' }} />
              <button onClick={send} disabled={!messageText.trim()}
                style={{ width:36, height:36, borderRadius:10, background: messageText.trim() ? 'linear-gradient(135deg,#7F77DD,#5248C5)' : '#EDE9FE', border:'none', color:'white', cursor: messageText.trim()?'pointer':'not-allowed', fontSize:15, flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center' }}>
                ➤
              </button>
            </div>
          </>
        )}
      </div>

      {showNewChat && (
        <NewChatModal chat={chat} onClose={()=>setShowNewChat(false)}
          onSelect={(ch: ChatChannel)=>{ setActiveChannel(ch); setShowNewChat(false); }} />
      )}

      {forwardMsg && (
        <ForwardModal chat={chat} onClose={()=>setForwardMsg(null)}
          onForward={async (targetId: string)=>{ await chat.forwardMessage(forwardMsg.id, targetId); setForwardMsg(null); }} />
      )}
    </div>
  );
}

const actionBtnStyle: React.CSSProperties = { background:'white', border:'1px solid #EDE9FE', borderRadius:8, width:26, height:26, cursor:'pointer', fontSize:12, display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'0 2px 6px rgba(0,0,0,0.06)' };

function NewChatModal({ chat, onClose, onSelect }: any) {
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
                <div key={u.id} onClick={()=> mode==='direct' ? startDirect(u.id) : setSelectedIds((p: string[]) => isSelected ? p.filter(id=>id!==u.id) : [...p, u.id])}
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

function ForwardModal({ chat, onClose, onForward }: any) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(26,16,64,0.4)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:'white', borderRadius:20, width:320, maxHeight:'60vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 64px rgba(127,119,221,0.2)' }}>
        <div style={{ padding:'16px 20px', borderBottom:'1px solid #EDE9FE', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <h3 style={{ fontSize:15, fontWeight:800, color:'#1a1040', margin:0 }}>Переслать в...</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', color:'#9B97CC', fontSize:18, cursor:'pointer' }}>✕</button>
        </div>
        <div style={{ padding:10, overflowY:'auto', flex:1 }}>
          {chat.channels.map((ch: ChatChannel) => (
            <div key={ch.id} onClick={()=>onForward(ch.id)}
              style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 10px', borderRadius:10, cursor:'pointer' }}
              onMouseEnter={e=>(e.currentTarget as HTMLElement).style.background='#F8F7FF'}
              onMouseLeave={e=>(e.currentTarget as HTMLElement).style.background='transparent'}>
              <div style={{ width:32, height:32, borderRadius:'50%', background: ch.type==='GROUP'?'#7F77DD':avatarColor(ch.name??''), display:'flex', alignItems:'center', justifyContent:'center' }}>
                {ch.type==='GROUP' ? '👥' : <span style={{ color:'white', fontSize:12, fontWeight:700 }}>{ch.name?.charAt(0)}</span>}
              </div>
              <span style={{ fontSize:13, fontWeight:600, color:'#1a1040' }}>{ch.name}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
