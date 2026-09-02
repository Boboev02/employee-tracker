'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

export type PresenceStatus = 'ONLINE' | 'OFFLINE' | 'IDLE';

export interface PresenceData {
  userId:          string;
  status:          PresenceStatus;
  lastActivityAt:  number | null;
  platform?:       string;
  currentTitle?:   string;
  todayActiveSecs: number;
}

export function useSocket(token: string | null) {
  const socketRef = useRef<Socket | null>(null);
  const [connected, setConnected]   = useState(false);
  const [presence, setPresence]     = useState<Record<string, PresenceData>>({});

  useEffect(() => {
    if (!token) return;

    const socket = io('http://localhost:3001/realtime', {
      auth:       { token },
      transports: ['websocket', 'polling'],
    });

    socketRef.current = socket;

    socket.on('connect',    () => setConnected(true));
    socket.on('disconnect', () => setConnected(false));

    socket.on('presence:snapshot', (snapshot: Record<string, PresenceData>) => {
      setPresence(snapshot);
    });

    socket.on('presence:update', (data: PresenceData) => {
      setPresence(prev => ({ ...prev, [data.userId]: data }));
    });

    // Ping every 30s to keep presence alive
    const ping = setInterval(() => socket.emit('ping'), 30_000);

    return () => {
      clearInterval(ping);
      socket.disconnect();
    };
  }, [token]);

  const getStatus = useCallback((userId: string): PresenceStatus => {
    return presence[userId]?.status ?? 'OFFLINE';
  }, [presence]);

  return { connected, presence, getStatus, socket: socketRef.current };
}
