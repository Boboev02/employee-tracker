'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

const API = 'https://employee-tracker.ru/api/v1/chat';

export interface ChatUser { id: string; name: string; avatarUrl?: string | null; email?: string; }
export interface ChatMessage {
  id: string; channelId: string; senderId: string;
  content?: string | null;
  attachmentUrl?: string | null; attachmentName?: string | null; attachmentType?: string | null;
  createdAt: string; sender?: ChatUser;
}
export interface ChatChannel {
  id: string; type: 'DIRECT' | 'GROUP';
  name: string | null; avatarUrl?: string | null;
  departmentId?: string | null; projectId?: string | null;
  memberCount: number; members: ChatUser[];
  lastMessage: ChatMessage | null; unreadCount: number; updatedAt: string;
}

export function useChat(token: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  const [channels, setChannels] = useState<ChatChannel[]>([]);
  const [loadingChannels, setLoadingChannels] = useState(true);
  const [messagesByChannel, setMessagesByChannel] = useState<Record<string, ChatMessage[]>>({});
  const [typingByChannel, setTypingByChannel] = useState<Record<string, string | null>>({});
  const activeChannelRef = useRef<string | null>(null);

  const h = useCallback(() => ({ 'Content-Type': 'application/json', Authorization: 'Bearer ' + token }), [token]);

  // ── Socket connection ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!token) return;
    const socket = io('https://employee-tracker.ru/chat', {
      auth: { token }, transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('chat:message', ({ channelId, message }: { channelId: string; message: ChatMessage }) => {
      setMessagesByChannel(prev => ({
        ...prev,
        [channelId]: [...(prev[channelId] ?? []), message],
      }));
      // Refresh channel list to update last message / unread badge
      loadChannels();
    });

    socket.on('chat:typing', ({ channelId, userName }: { channelId: string; userName: string }) => {
      setTypingByChannel(prev => ({ ...prev, [channelId]: userName }));
      setTimeout(() => setTypingByChannel(prev => ({ ...prev, [channelId]: null })), 3000);
    });

    return () => { socket.disconnect(); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // ── Channels ─────────────────────────────────────────────────────────────────
  const loadChannels = useCallback(async () => {
    if (!token) return;
    try {
      const r = await fetch(`${API}/channels`, { headers: h() });
      if (r.ok) setChannels(await r.json());
    } catch {}
    setLoadingChannels(false);
  }, [token, h]);

  useEffect(() => { loadChannels(); }, [loadChannels]);

  const openDirectChat = useCallback(async (otherUserId: string): Promise<ChatChannel | null> => {
    try {
      const r = await fetch(`${API}/channels/direct`, { method: 'POST', headers: h(), body: JSON.stringify({ userId: otherUserId }) });
      if (!r.ok) return null;
      const ch = await r.json();
      await loadChannels();
      return ch;
    } catch { return null; }
  }, [h, loadChannels]);

  const createGroup = useCallback(async (dto: { name: string; memberIds: string[]; departmentId?: string; projectId?: string }) => {
    const r = await fetch(`${API}/channels/group`, { method: 'POST', headers: h(), body: JSON.stringify(dto) });
    if (r.ok) { await loadChannels(); return r.json(); }
    return null;
  }, [h, loadChannels]);

  // ── Messages ─────────────────────────────────────────────────────────────────
  const joinChannel = useCallback((channelId: string) => {
    activeChannelRef.current = channelId;
    socketRef.current?.emit('chat:join', { channelId });
  }, []);

  const leaveChannel = useCallback((channelId: string) => {
    socketRef.current?.emit('chat:leave', { channelId });
    if (activeChannelRef.current === channelId) activeChannelRef.current = null;
  }, []);

  const loadMessages = useCallback(async (channelId: string) => {
    try {
      const r = await fetch(`${API}/channels/${channelId}/messages`, { headers: h() });
      if (r.ok) {
        const msgs = await r.json();
        setMessagesByChannel(prev => ({ ...prev, [channelId]: msgs }));
      }
    } catch {}
  }, [h]);

  const sendMessage = useCallback(async (channelId: string, dto: { content?: string; attachmentUrl?: string; attachmentName?: string; attachmentType?: string }) => {
    const r = await fetch(`${API}/channels/${channelId}/messages`, { method: 'POST', headers: h(), body: JSON.stringify(dto) });
    if (r.ok) return r.json();
    return null;
  }, [h]);

  const markRead = useCallback(async (channelId: string) => {
    await fetch(`${API}/channels/${channelId}/read`, { method: 'PATCH', headers: h() }).catch(() => {});
    setChannels(prev => prev.map(c => c.id === channelId ? { ...c, unreadCount: 0 } : c));
  }, [h]);

  const sendTyping = useCallback((channelId: string) => {
    socketRef.current?.emit('chat:typing', { channelId });
  }, []);

  const searchUsers = useCallback(async (query: string): Promise<ChatUser[]> => {
    try {
      const r = await fetch(`${API}/users/search?q=${encodeURIComponent(query)}`, { headers: h() });
      if (r.ok) return r.json();
    } catch {}
    return [];
  }, [h]);

  const totalUnread = channels.reduce((sum, c) => sum + c.unreadCount, 0);

  return {
    connected, channels, loadingChannels, loadChannels,
    messagesByChannel, typingByChannel,
    openDirectChat, createGroup,
    joinChannel, leaveChannel, loadMessages, sendMessage, markRead, sendTyping,
    searchUsers, totalUnread,
  };
}
