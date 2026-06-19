'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';

interface Participant {
  userId: string;
  userName: string;
  socketId: string;
  stream?: MediaStream;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenShare: boolean;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
  ],
};

export default function CallRoomPage() {
  const router = useRouter();
  const params = useParams();
  const roomId = params.roomId as string;

  const [myUserId, setMyUserId] = useState('');
  const [myUserName, setMyUserName] = useState('');
  const [connecting, setConnecting] = useState(true);
  const [error, setError] = useState('');
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [audioOn, setAudioOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [copied, setCopied] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);

  // Инициализация: получаем доступ к камере/микрофону и подключаемся
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) { router.push('/login'); return; }

    const userStr = localStorage.getItem('user');
    let userId = '', userName = 'Сотрудник';
    try {
      const u = JSON.parse(userStr ?? '{}');
      userId = u.id ?? '';
      userName = u.name ?? u.email ?? 'Сотрудник';
    } catch {}
    setMyUserId(userId);
    setMyUserName(userName);

    let mounted = true;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        localStreamRef.current = stream;
        setLocalStream(stream);
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        connectSocket(token, userId, userName);
      } catch (e: any) {
        setError('Не удалось получить доступ к камере/микрофону: ' + e.message);
        setConnecting(false);
      }
    })();

    return () => {
      mounted = false;
      cleanup();
    };
  }, []);

  const cleanup = () => {
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();
    socketRef.current?.emit('call:leave', { roomId });
    socketRef.current?.disconnect();
  };

  const createPeerConnection = useCallback((targetSocketId: string, targetUserId: string) => {
    const pc = new RTCPeerConnection(ICE_SERVERS);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => {
        pc.addTrack(track, localStreamRef.current!);
      });
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && socketRef.current) {
        socketRef.current.emit('call:signal', {
          targetSocketId,
          fromUserId: myUserId,
          signal: { type: 'ice-candidate', candidate: event.candidate },
        });
      }
    };

    pc.ontrack = (event) => {
      setParticipants(prev => {
        const next = new Map(prev);
        const p = next.get(targetUserId);
        if (p) {
          next.set(targetUserId, { ...p, stream: event.streams[0] });
        }
        return next;
      });
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        console.log('Peer connection lost:', targetUserId);
      }
    };

    peersRef.current.set(targetSocketId, pc);
    return pc;
  }, [myUserId]);

  const connectSocket = (token: string, userId: string, userName: string) => {
    const socket = io('https://employee-tracker.ru/realtime', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      socket.emit('call:join', { roomId });
    });

    socket.on('call:error', (data: { message: string }) => {
      setError(data.message);
      setConnecting(false);
    });

    socket.on('call:participants', async (data: { participants: any[] }) => {
      setConnecting(false);
      // Создаём peer connection и отправляем offer каждому существующему участнику
      for (const p of data.participants) {
        setParticipants(prev => {
          const next = new Map(prev);
          next.set(p.userId, { userId: p.userId, userName: p.userName, socketId: p.socketId, audioEnabled: true, videoEnabled: true, isScreenShare: false });
          return next;
        });
        const pc = createPeerConnection(p.socketId, p.userId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('call:signal', {
          targetSocketId: p.socketId,
          fromUserId: userId,
          signal: { type: 'offer', sdp: offer },
        });
      }
    });

    socket.on('call:user-joined', (data: { userId: string; userName: string; socketId: string }) => {
      setParticipants(prev => {
        const next = new Map(prev);
        next.set(data.userId, { userId: data.userId, userName: data.userName, socketId: data.socketId, audioEnabled: true, videoEnabled: true, isScreenShare: false });
        return next;
      });
      // Не создаём peer тут — ждём offer от нового участника
    });

    socket.on('call:user-left', (data: { userId: string }) => {
      setParticipants(prev => {
        const next = new Map(prev);
        const p = next.get(data.userId);
        if (p) {
          peersRef.current.get(p.socketId)?.close();
          peersRef.current.delete(p.socketId);
        }
        next.delete(data.userId);
        return next;
      });
    });

    socket.on('call:signal', async (data: { signal: any; fromUserId: string; fromSocketId: string }) => {
      const { signal, fromUserId, fromSocketId } = data;

      if (signal.type === 'offer') {
        const pc = createPeerConnection(fromSocketId, fromUserId);
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('call:signal', {
          targetSocketId: fromSocketId,
          fromUserId: userId,
          signal: { type: 'answer', sdp: answer },
        });
      } else if (signal.type === 'answer') {
        const pc = peersRef.current.get(fromSocketId);
        if (pc) await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
      } else if (signal.type === 'ice-candidate') {
        const pc = peersRef.current.get(fromSocketId);
        if (pc) {
          try { await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)); } catch {}
        }
      }
    });

    socket.on('call:media-toggled', (data: { userId: string; kind: string; enabled: boolean }) => {
      setParticipants(prev => {
        const next = new Map(prev);
        const p = next.get(data.userId);
        if (p) {
          if (data.kind === 'audio') next.set(data.userId, { ...p, audioEnabled: data.enabled });
          if (data.kind === 'video') next.set(data.userId, { ...p, videoEnabled: data.enabled });
          if (data.kind === 'screen') next.set(data.userId, { ...p, isScreenShare: data.enabled });
        }
        return next;
      });
    });

    setTimeout(() => setConnecting(false), 3000); // fallback
  };

  const toggleAudio = () => {
    const enabled = !audioOn;
    setAudioOn(enabled);
    localStreamRef.current?.getAudioTracks().forEach(t => t.enabled = enabled);
    socketRef.current?.emit('call:toggle-media', { roomId, userId: myUserId, kind: 'audio', enabled });
  };

  const toggleVideo = () => {
    const enabled = !videoOn;
    setVideoOn(enabled);
    localStreamRef.current?.getVideoTracks().forEach(t => t.enabled = enabled);
    socketRef.current?.emit('call:toggle-media', { roomId, userId: myUserId, kind: 'video', enabled });
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      // Возвращаем камеру во все peer connections
      const camTrack = localStreamRef.current?.getVideoTracks()[0];
      if (camTrack) {
        peersRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          sender?.replaceTrack(camTrack);
        });
      }
      setScreenSharing(false);
      socketRef.current?.emit('call:toggle-media', { roomId, userId: myUserId, kind: 'screen', enabled: false });
    } else {
      try {
        const screenStream = await (navigator.mediaDevices as any).getDisplayMedia({ video: true });
        screenStreamRef.current = screenStream;
        const screenTrack = screenStream.getVideoTracks()[0];
        peersRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          sender?.replaceTrack(screenTrack);
        });
        screenTrack.onended = () => toggleScreenShare();
        setScreenSharing(true);
        socketRef.current?.emit('call:toggle-media', { roomId, userId: myUserId, kind: 'screen', enabled: true });
      } catch (e) {
        console.log('Screen share cancelled');
      }
    }
  };

  const leaveCall = () => {
    cleanup();
    router.push('/dashboard');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`https://employee-tracker.ru/dashboard/calls/${roomId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (error) {
    return (
      <div style={{ minHeight: '100vh', background: '#1a1040', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontSize: '48px' }}>⚠️</div>
        <p style={{ color: 'white', fontSize: '16px', textAlign: 'center', maxWidth: '400px' }}>{error}</p>
        <button onClick={() => router.push('/dashboard')} style={{ background: '#7F77DD', color: 'white', border: 'none', borderRadius: '12px', padding: '10px 24px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
          Вернуться в дашборд
        </button>
      </div>
    );
  }

  const participantList = Array.from(participants.values());
  const totalCount = participantList.length + 1;

  return (
    <div style={{ minHeight: '100vh', background: '#0F0A26', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div style={{ padding: '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: connecting ? '#D97706' : '#16A34A' }} />
          <span style={{ color: 'white', fontSize: '14px', fontWeight: 600 }}>
            {connecting ? 'Подключение...' : `Звонок · ${totalCount} участник${totalCount === 1 ? '' : totalCount < 5 ? 'а' : 'ов'}`}
          </span>
        </div>
        <button onClick={copyLink} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '10px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer' }}>
          {copied ? '✓ Скопировано' : '🔗 Скопировать ссылку'}
        </button>
      </div>

      {/* Video grid */}
      <div style={{ flex: 1, padding: '16px', display: 'grid', gridTemplateColumns: `repeat(${Math.min(Math.ceil(Math.sqrt(totalCount)), 4)}, 1fr)`, gap: '12px', alignContent: 'center' }}>
        {/* Local video */}
        <div style={{ position: 'relative', background: '#1a1040', borderRadius: '16px', overflow: 'hidden', aspectRatio: '16/9' }}>
          <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)' }} />
          {!videoOn && (
            <div style={{ position: 'absolute', inset: 0, background: '#1a1040', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#7F77DD', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '24px', fontWeight: 700 }}>
                {myUserName.charAt(0).toUpperCase()}
              </div>
            </div>
          )}
          <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', padding: '4px 10px', color: 'white', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
            {!audioOn && <span>🔇</span>}
            {myUserName} (вы)
          </div>
        </div>

        {/* Remote participants */}
        {participantList.map(p => (
          <RemoteVideo key={p.userId} participant={p} />
        ))}
      </div>

      {/* Controls */}
      <div style={{ padding: '20px', display: 'flex', justifyContent: 'center', gap: '14px' }}>
        <button onClick={toggleAudio} style={ctrlBtnStyle(audioOn)}>
          {audioOn ? '🎤' : '🔇'}
        </button>
        <button onClick={toggleVideo} style={ctrlBtnStyle(videoOn)}>
          {videoOn ? '📹' : '📷'}
        </button>
        <button onClick={toggleScreenShare} style={ctrlBtnStyle(!screenSharing, screenSharing ? '#7F77DD' : undefined)}>
          🖥️
        </button>
        <button onClick={leaveCall} style={{ width: '52px', height: '52px', borderRadius: '50%', background: '#DC2626', border: 'none', color: 'white', fontSize: '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          📞
        </button>
      </div>
    </div>
  );
}

function ctrlBtnStyle(active: boolean, activeColor?: string) {
  return {
    width: '52px', height: '52px', borderRadius: '50%',
    background: active ? 'rgba(255,255,255,0.1)' : '#DC2626',
    border: activeColor ? `2px solid ${activeColor}` : 'none',
    color: 'white', fontSize: '20px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  } as React.CSSProperties;
}

function RemoteVideo({ participant }: { participant: Participant }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
    }
  }, [participant.stream]);

  return (
    <div style={{ position: 'relative', background: '#1a1040', borderRadius: '16px', overflow: 'hidden', aspectRatio: '16/9' }}>
      <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: participant.videoEnabled !== false ? 'block' : 'none' }} />
      {(!participant.stream || participant.videoEnabled === false) && (
        <div style={{ position: 'absolute', inset: 0, background: '#1a1040', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#5248C5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '24px', fontWeight: 700 }}>
            {participant.userName.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', padding: '4px 10px', color: 'white', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {participant.audioEnabled === false && <span>🔇</span>}
        {participant.userName}
      </div>
    </div>
  );
}
