'use client';
export const dynamic = 'force-dynamic';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { io, Socket } from 'socket.io-client';
import { useIsMobile } from '@/hooks/useIsMobile';
// MediaPipe загружается динамически через CDN script тег (UMD-модуль, не поддерживает ES import)

interface Participant {
  userId: string;
  userName: string;
  socketId: string;
  stream?: MediaStream;
  audioEnabled: boolean;
  videoEnabled: boolean;
  isScreenShare: boolean;
}

interface MediaDeviceOption {
  deviceId: string;
  label: string;
}

const ICE_SERVERS = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    { urls: 'stun:stun1.l.google.com:19302' },
    { urls: 'stun:stun2.l.google.com:19302' },
    { urls: 'turn:openrelay.metered.ca:80', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443', username: 'openrelayproject', credential: 'openrelayproject' },
    { urls: 'turn:openrelay.metered.ca:443?transport=tcp', username: 'openrelayproject', credential: 'openrelayproject' },
  ],
};

type Stage = 'checking' | 'lobby' | 'call' | 'error';

export default function CallRoomPage() {
  const router = useRouter();
  const isMobile = useIsMobile(768);
  const params = useParams();
  const roomId = params.roomId as string;

  const [stage, setStage] = useState<Stage>('checking');
  const [error, setError] = useState('');
  const [callTitle, setCallTitle] = useState('Видеозвонок');

  const [myUserId, setMyUserId] = useState('');
  const [myUserName, setMyUserName] = useState('');

  // Lobby state
  const [lobbyStream, setLobbyStream] = useState<MediaStream | null>(null);
  const [lobbyAudioOn, setLobbyAudioOn] = useState(true);
  const [lobbyVideoOn, setLobbyVideoOn] = useState(true);
  const [cameras, setCameras] = useState<MediaDeviceOption[]>([]);
  const [microphones, setMicrophones] = useState<MediaDeviceOption[]>([]);
  const [selectedCamera, setSelectedCamera] = useState('');
  const [selectedMic, setSelectedMic] = useState('');
  const [deviceError, setDeviceError] = useState('');
  const [joining, setJoining] = useState(false);

  // Call state
  const [connecting, setConnecting] = useState(true);
  const [participants, setParticipants] = useState<Map<string, Participant>>(new Map());
  const [audioOn, setAudioOn] = useState(true);
  const [videoOn, setVideoOn] = useState(true);
  const [screenSharing, setScreenSharing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [pinnedUserId, setPinnedUserId] = useState<string | null>(null); // null = я сам не запинен, 'self' = я запинен
  const [speakingUserId, setSpeakingUserId] = useState<string | null>(null);
  const [mySpeaking, setMySpeaking] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [sidePanel, setSidePanel] = useState<'none' | 'participants' | 'chat'>('none');
  const [chatMessages, setChatMessages] = useState<{ id: string; userId: string; userName: string; text: string; timestamp: number }[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [handRaised, setHandRaised] = useState(false);
  const [raisedHands, setRaisedHands] = useState<Set<string>>(new Set());
  const [unreadChat, setUnreadChat] = useState(0);
  const [hostUserId, setHostUserId] = useState<string | null>(null);
  const [kickedMessage, setKickedMessage] = useState('');
  const [networkStatus, setNetworkStatus] = useState<'online' | 'offline' | 'reconnecting'>('online');
  const [socketConnected, setSocketConnected] = useState(true);
  const [roomLocked, setRoomLocked] = useState(false);
  const [forceMuted, setForceMuted] = useState(false);
  const [connectionQuality, setConnectionQuality] = useState<'good' | 'medium' | 'poor'>('good');
  const [bgMode, setBgMode] = useState<'none' | 'blur'>('none');
  const [bgProcessing, setBgProcessing] = useState(false);

  const socketRef = useRef<Socket | null>(null);
  const lobbyVideoRef = useRef<HTMLVideoElement>(null);
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const peersRef = useRef<Map<string, RTCPeerConnection>>(new Map());
  const pendingCandidatesRef = useRef<Map<string, RTCIceCandidateInit[]>>(new Map());
  const localStreamRef = useRef<MediaStream | null>(null);
  const screenStreamRef = useRef<MediaStream | null>(null);
  const myUserIdRef = useRef('');
  const tokenRef = useRef('');
  const audioContextRef = useRef<AudioContext | null>(null);
  const analysersRef = useRef<Map<string, { analyser: AnalyserNode; data: Uint8Array<ArrayBuffer> }>>(new Map());
  const speakingCheckIntervalRef = useRef<number | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const segmenterRef = useRef<any>(null);
  const bgCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const bgVideoElRef = useRef<HTMLVideoElement | null>(null);
  const bgRafRef = useRef<number | null>(null);
  const originalCamTrackRef = useRef<MediaStreamTrack | null>(null);
  const bgCanvasStreamRef = useRef<MediaStream | null>(null);

  // ===== Шаг 1: Проверка доступа к комнате =====
  useEffect(() => {
    const token = localStorage.getItem('access_token');
    if (!token) { router.push('/login'); return; }
    tokenRef.current = token;

    const userStr = localStorage.getItem('user');
    let userId = '', userName = 'Сотрудник';
    try {
      const u = JSON.parse(userStr ?? '{}');
      userId = u.id ?? '';
      userName = u.name ?? u.email ?? 'Сотрудник';
    } catch {}
    setMyUserId(userId);
    myUserIdRef.current = userId;
    setMyUserName(userName);

    (async () => {
      try {
        const checkRes = await fetch(`https://employee-tracker.ru/api/v1/calls/${roomId}/check`, {
          headers: { Authorization: 'Bearer ' + token },
        });
        if (!checkRes.ok) {
          const errData = await checkRes.json().catch(() => ({}));
          setError(errData.message ?? 'Не удалось подключиться к звонку');
          setStage('error');
          return;
        }
        const data = await checkRes.json().catch(() => ({}));
        if (data.title) setCallTitle(data.title);
        setStage('lobby');
      } catch (e: any) {
        setError('Ошибка соединения с сервером');
        setStage('error');
      }
    })();
  }, []);

  // ===== Шаг 2: В lobby — получаем устройства и превью =====
  useEffect(() => {
    if (stage !== 'lobby') return;
    let mounted = true;

    (async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (!mounted) { stream.getTracks().forEach(t => t.stop()); return; }
        setLobbyStream(stream);
        if (lobbyVideoRef.current) lobbyVideoRef.current.srcObject = stream;

        const camTrack = stream.getVideoTracks()[0];
        const micTrack = stream.getAudioTracks()[0];
        if (camTrack) setSelectedCamera(camTrack.getSettings().deviceId ?? '');
        if (micTrack) setSelectedMic(micTrack.getSettings().deviceId ?? '');

        // Список устройств (после получения разрешения — лейблы будут не пустые)
        const devices = await navigator.mediaDevices.enumerateDevices();
        setCameras(devices.filter(d => d.kind === 'videoinput').map(d => ({ deviceId: d.deviceId, label: d.label || 'Камера' })));
        setMicrophones(devices.filter(d => d.kind === 'audioinput').map(d => ({ deviceId: d.deviceId, label: d.label || 'Микрофон' })));
      } catch (e: any) {
        if (e.name === 'NotAllowedError') {
          setDeviceError('Доступ к камере/микрофону запрещён. Разрешите доступ в настройках браузера и обновите страницу.');
        } else if (e.name === 'NotFoundError') {
          setDeviceError('Камера или микрофон не найдены на этом устройстве.');
        } else {
          setDeviceError('Не удалось получить доступ к камере/микрофону: ' + e.message);
        }
      }
    })();

    return () => { mounted = false; };
  }, [stage]);

  const switchDevice = async (kind: 'camera' | 'mic', deviceId: string) => {
    if (!lobbyStream) return;
    try {
      const constraints: MediaStreamConstraints = kind === 'camera'
        ? { video: { deviceId: { exact: deviceId } }, audio: false }
        : { video: false, audio: { deviceId: { exact: deviceId }, echoCancellation: true, noiseSuppression: true } };
      const newStream = await navigator.mediaDevices.getUserMedia(constraints);
      const newTrack = kind === 'camera' ? newStream.getVideoTracks()[0] : newStream.getAudioTracks()[0];

      if (kind === 'camera') {
        lobbyStream.getVideoTracks().forEach(t => { t.stop(); lobbyStream.removeTrack(t); });
        lobbyStream.addTrack(newTrack);
        setSelectedCamera(deviceId);
      } else {
        lobbyStream.getAudioTracks().forEach(t => { t.stop(); lobbyStream.removeTrack(t); });
        lobbyStream.addTrack(newTrack);
        setSelectedMic(deviceId);
      }
      if (lobbyVideoRef.current) lobbyVideoRef.current.srcObject = lobbyStream;
    } catch (e) {
      console.warn('Failed to switch device', e);
    }
  };

  const toggleLobbyAudio = () => {
    const enabled = !lobbyAudioOn;
    setLobbyAudioOn(enabled);
    lobbyStream?.getAudioTracks().forEach(t => { t.enabled = enabled; });
  };

  const toggleLobbyVideo = () => {
    const enabled = !lobbyVideoOn;
    setLobbyVideoOn(enabled);
    lobbyStream?.getVideoTracks().forEach(t => { t.enabled = enabled; });
  };

  // ===== Шаг 3: Вход в звонок из lobby =====
  const joinCall = () => {
    if (!lobbyStream) return;
    setJoining(true);
    localStreamRef.current = lobbyStream;
    setAudioOn(lobbyAudioOn);
    setVideoOn(lobbyVideoOn);
    setStage('call');
    setTimeout(() => {
      if (localVideoRef.current) localVideoRef.current.srcObject = lobbyStream;
      setupAudioAnalysis(lobbyStream, 'self');
      connectSocket(tokenRef.current, myUserIdRef.current, myUserName);
    }, 50);
  };

  const cleanup = () => {
    if (bgRafRef.current) cancelAnimationFrame(bgRafRef.current);
    segmenterRef.current?.close();
    bgCanvasStreamRef.current?.getTracks().forEach(t => t.stop());
    originalCamTrackRef.current?.stop();
    localStreamRef.current?.getTracks().forEach(t => t.stop());
    lobbyStream?.getTracks().forEach(t => t.stop());
    screenStreamRef.current?.getTracks().forEach(t => t.stop());
    peersRef.current.forEach(pc => pc.close());
    peersRef.current.clear();
    pendingCandidatesRef.current.clear();
    socketRef.current?.emit('call:leave', { roomId });
    socketRef.current?.disconnect();
  };

  useEffect(() => {
    return () => { cleanup(); };
  }, []);

  // Слушаем браузерные события online/offline (полная потеря сети, не только сокет)
  useEffect(() => {
    const handleOffline = () => setNetworkStatus('offline');
    const handleOnline = () => {
      // Браузер сообщил что сеть вернулась — socket.io сам попробует переподключиться,
      // но дадим явный сигнал что мы знаем о восстановлении
      setNetworkStatus(prev => prev === 'offline' ? 'reconnecting' : prev);
    };
    window.addEventListener('offline', handleOffline);
    window.addEventListener('online', handleOnline);
    return () => {
      window.removeEventListener('offline', handleOffline);
      window.removeEventListener('online', handleOnline);
    };
  }, []);

  const createPeerConnection = useCallback((targetSocketId: string, targetUserId: string) => {
    const existing = peersRef.current.get(targetSocketId);
    if (existing) return existing;

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
          fromUserId: myUserIdRef.current,
          signal: { type: 'ice-candidate', candidate: event.candidate.toJSON() },
        });
      }
    };

    pc.ontrack = (event) => {
      const incomingStream = event.streams[0];
      setParticipants(prev => {
        const next = new Map(prev);
        const p = next.get(targetUserId);
        if (p) next.set(targetUserId, { ...p, stream: incomingStream });
        return next;
      });
      setupAudioAnalysis(incomingStream, targetUserId);
    };

    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') pc.restartIce();
    };

    peersRef.current.set(targetSocketId, pc);
    return pc;
  }, []);

  // Анализ уровня звука для определения "кто говорит"
  const setupAudioAnalysis = useCallback((stream: MediaStream, key: string) => {
    if (!stream.getAudioTracks().length) return;
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new AudioContext();
      }
      const ctx = audioContextRef.current;
      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 256;
      analyser.smoothingTimeConstant = 0.6;
      source.connect(analyser);
      const data = new Uint8Array(new ArrayBuffer(analyser.frequencyBinCount));
      analysersRef.current.set(key, { analyser, data });
    } catch (e) {
      console.warn('Audio analysis setup failed', e);
    }
  }, []);

  // Периодически проверяем у кого громче звук — определяем "говорящего"
  useEffect(() => {
    speakingCheckIntervalRef.current = window.setInterval(() => {
      let maxVolume = 0;
      let maxKey: string | null = null;
      const SPEAKING_THRESHOLD = 18;

      analysersRef.current.forEach(({ analyser, data }, key) => {
        analyser.getByteFrequencyData(data);
        const avg = data.reduce((a, b) => a + b, 0) / data.length;
        if (avg > maxVolume) { maxVolume = avg; maxKey = key; }
      });

      if (maxVolume > SPEAKING_THRESHOLD && maxKey) {
        if (maxKey === 'self') {
          setMySpeaking(true);
          setSpeakingUserId(null);
        } else {
          setMySpeaking(false);
          setSpeakingUserId(maxKey);
        }
      } else {
        setMySpeaking(false);
        setSpeakingUserId(null);
      }
    }, 400);

    return () => {
      if (speakingCheckIntervalRef.current) window.clearInterval(speakingCheckIntervalRef.current);
    };
  }, []);

  const flushPendingCandidates = async (socketId: string, pc: RTCPeerConnection) => {
    const pending = pendingCandidatesRef.current.get(socketId);
    if (pending && pending.length > 0) {
      for (const candidate of pending) {
        try { await pc.addIceCandidate(new RTCIceCandidate(candidate)); } catch {}
      }
      pendingCandidatesRef.current.delete(socketId);
    }
  };

  const connectSocket = (token: string, userId: string, userName: string) => {
    const socket = io('https://employee-tracker.ru/realtime', {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('connect', () => { socket.emit('call:join', { roomId }); });

    socket.on('call:error', (data: { message: string }) => {
      setError(data.message);
      setStage('error');
    });

    socket.on('call:participants', async (data: { participants: any[]; hostUserId?: string }) => {
      setConnecting(false);
      if (data.hostUserId) setHostUserId(data.hostUserId);
      if (!data.hostUserId) setHostUserId(userId); // если участников не было — я создал, я и хост
      for (const p of data.participants) {
        setParticipants(prev => {
          const next = new Map(prev);
          next.set(p.userId, { userId: p.userId, userName: p.userName, socketId: p.socketId, audioEnabled: true, videoEnabled: true, isScreenShare: false });
          return next;
        });
        const pc = createPeerConnection(p.socketId, p.userId);
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('call:signal', { targetSocketId: p.socketId, fromUserId: userId, signal: { type: 'offer', sdp: offer } });
      }
    });

    socket.on('call:user-joined', (data: { userId: string; userName: string; socketId: string }) => {
      setParticipants(prev => {
        const next = new Map(prev);
        next.set(data.userId, { userId: data.userId, userName: data.userName, socketId: data.socketId, audioEnabled: true, videoEnabled: true, isScreenShare: false });
        return next;
      });
    });

    socket.on('call:user-left', (data: { userId: string }) => {
      setParticipants(prev => {
        const next = new Map(prev);
        const p = next.get(data.userId);
        if (p) {
          peersRef.current.get(p.socketId)?.close();
          peersRef.current.delete(p.socketId);
          pendingCandidatesRef.current.delete(p.socketId);
        }
        next.delete(data.userId);
        return next;
      });
      analysersRef.current.delete(data.userId);
      if (pinnedUserId === data.userId) setPinnedUserId(null);
    });

    socket.on('call:signal', async (data: { signal: any; fromUserId: string; fromSocketId: string }) => {
      const { signal, fromUserId, fromSocketId } = data;
      if (signal.type === 'offer') {
        let pc = peersRef.current.get(fromSocketId);
        if (!pc) pc = createPeerConnection(fromSocketId, fromUserId);
        await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp));
        await flushPendingCandidates(fromSocketId, pc);
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('call:signal', { targetSocketId: fromSocketId, fromUserId: userId, signal: { type: 'answer', sdp: answer } });
      } else if (signal.type === 'answer') {
        const pc = peersRef.current.get(fromSocketId);
        if (pc) { await pc.setRemoteDescription(new RTCSessionDescription(signal.sdp)); await flushPendingCandidates(fromSocketId, pc); }
      } else if (signal.type === 'ice-candidate') {
        const pc = peersRef.current.get(fromSocketId);
        if (pc && pc.remoteDescription) {
          try { await pc.addIceCandidate(new RTCIceCandidate(signal.candidate)); } catch {}
        } else {
          const arr = pendingCandidatesRef.current.get(fromSocketId) ?? [];
          arr.push(signal.candidate);
          pendingCandidatesRef.current.set(fromSocketId, arr);
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

    socket.on('call:chat-message', (msg: { id: string; userId: string; userName: string; text: string; timestamp: number }) => {
      setChatMessages(prev => [...prev, msg]);
      if (msg.userId !== userId) {
        setUnreadChat(prev => prev + 1);
      }
    });

    socket.on('call:hand-raised', (data: { userId: string; raised: boolean }) => {
      setRaisedHands(prev => {
        const next = new Set(prev);
        if (data.raised) next.add(data.userId); else next.delete(data.userId);
        return next;
      });
    });

    socket.on('call:kicked', (data: { message: string }) => {
      setKickedMessage(data.message);
      cleanup();
    });

    socket.on('call:ended', (data: { message: string }) => {
      setKickedMessage(data.message);
      cleanup();
    });

    socket.on('call:lock-changed', (data: { locked: boolean }) => {
      setRoomLocked(data.locked);
    });

    socket.on('call:host-changed', (data: { newHostUserId: string }) => {
      setHostUserId(data.newHostUserId);
    });

    socket.on('call:force-mute', () => {
      setForceMuted(true);
      setAudioOn(false);
      localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = false; });
      socketRef.current?.emit('call:toggle-media', { roomId, userId: myUserIdRef.current, kind: 'audio', enabled: false });
      setTimeout(() => setForceMuted(false), 3000);
    });

    socket.on('disconnect', (reason) => {
      setSocketConnected(false);
      if (reason !== 'io client disconnect') {
        setNetworkStatus('reconnecting');
      }
    });

    socket.io.on('reconnect_attempt', () => {
      setNetworkStatus('reconnecting');
    });

    socket.io.on('reconnect', () => {
      setSocketConnected(true);
      setNetworkStatus('online');
      // После переподключения — пересоздаём все peer connections с нуля,
      // т.к. старые WebRTC соединения могли протухнуть пока был офлайн
      peersRef.current.forEach(pc => pc.close());
      peersRef.current.clear();
      pendingCandidatesRef.current.clear();
      socket.emit('call:join', { roomId });
    });

    setTimeout(() => setConnecting(false), 5000);
  };

  const toggleAudio = () => {
    const enabled = !audioOn;
    setAudioOn(enabled);
    localStreamRef.current?.getAudioTracks().forEach(t => { t.enabled = enabled; });
    socketRef.current?.emit('call:toggle-media', { roomId, userId: myUserIdRef.current, kind: 'audio', enabled });
  };

  const toggleVideo = () => {
    const enabled = !videoOn;
    setVideoOn(enabled);
    localStreamRef.current?.getVideoTracks().forEach(t => { t.enabled = enabled; });
    socketRef.current?.emit('call:toggle-media', { roomId, userId: myUserIdRef.current, kind: 'video', enabled });
  };

  const toggleScreenShare = async () => {
    if (screenSharing) {
      screenStreamRef.current?.getTracks().forEach(t => t.stop());
      screenStreamRef.current = null;
      const camTrack = localStreamRef.current?.getVideoTracks()[0];
      if (camTrack) {
        peersRef.current.forEach(pc => {
          const sender = pc.getSenders().find(s => s.track?.kind === 'video');
          sender?.replaceTrack(camTrack);
        });
      }
      setScreenSharing(false);
      socketRef.current?.emit('call:toggle-media', { roomId, userId: myUserIdRef.current, kind: 'screen', enabled: false });
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
        socketRef.current?.emit('call:toggle-media', { roomId, userId: myUserIdRef.current, kind: 'screen', enabled: true });
      } catch {}
    }
  };

  const togglePin = (userId: string | null) => {
    setPinnedUserId(prev => prev === userId ? null : userId);
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      containerRef.current?.requestFullscreen?.().then(() => setIsFullscreen(true)).catch(() => {});
    } else {
      document.exitFullscreen?.().then(() => setIsFullscreen(false)).catch(() => {});
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const isHost = hostUserId === myUserIdRef.current;

  const kickParticipant = (targetUserId: string) => {
    if (!confirm('Удалить участника из звонка?')) return;
    socketRef.current?.emit('call:kick', { roomId, targetUserId });
  };

  const endCallForAll = () => {
    if (!confirm('Завершить встречу для всех участников?')) return;
    socketRef.current?.emit('call:end-for-all', { roomId });
  };

  const toggleRoomLock = () => {
    const newLocked = !roomLocked;
    socketRef.current?.emit('call:toggle-lock', { roomId, locked: newLocked });
  };

  const transferHost = (newHostUserId: string, userName: string) => {
    if (!confirm(`Передать роль организатора участнику ${userName}?`)) return;
    socketRef.current?.emit('call:transfer-host', { roomId, newHostUserId });
  };

  const muteParticipant = (targetUserId: string) => {
    socketRef.current?.emit('call:mute-participant', { roomId, targetUserId });
  };

  const muteAll = () => {
    if (!confirm('Отключить микрофон у всех участников?')) return;
    socketRef.current?.emit('call:mute-all', { roomId });
  };

  // Мониторинг качества соединения через WebRTC stats API
  useEffect(() => {
    if (stage !== 'call') return;
    const interval = setInterval(async () => {
      let worstQuality: 'good' | 'medium' | 'poor' = 'good';
      for (const pc of peersRef.current.values()) {
        try {
          const stats = await pc.getStats();
          stats.forEach(report => {
            if (report.type === 'candidate-pair' && report.state === 'succeeded') {
              const rtt = report.currentRoundTripTime;
              if (rtt !== undefined) {
                if (rtt > 0.3) worstQuality = 'poor';
                else if (rtt > 0.15 && worstQuality !== 'poor') worstQuality = 'medium';
              }
            }
            if (report.type === 'inbound-rtp' && report.kind === 'video') {
              const lost = report.packetsLost ?? 0;
              const received = report.packetsReceived ?? 1;
              const lossRate = lost / (lost + received);
              if (lossRate > 0.05) worstQuality = 'poor';
              else if (lossRate > 0.01 && worstQuality !== 'poor') worstQuality = 'medium';
            }
          });
        } catch {}
      }
      setConnectionQuality(worstQuality);
    }, 3000);
    return () => clearInterval(interval);
  }, [stage]);

  // ===== Виртуальный фон (блюр) через MediaPipe Selfie Segmentation =====
  const loadMediaPipeScript = (): Promise<any> => {
    return new Promise((resolve, reject) => {
      if ((window as any).SelfieSegmentation) {
        resolve((window as any).SelfieSegmentation);
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/selfie_segmentation.js';
      script.crossOrigin = 'anonymous';
      script.onload = () => {
        if ((window as any).SelfieSegmentation) resolve((window as any).SelfieSegmentation);
        else reject(new Error('SelfieSegmentation not found on window after script load'));
      };
      script.onerror = () => reject(new Error('Failed to load MediaPipe script'));
      document.head.appendChild(script);
    });
  };

  const stopBackgroundBlur = useCallback(() => {
    if (bgRafRef.current) { cancelAnimationFrame(bgRafRef.current); bgRafRef.current = null; }
    segmenterRef.current?.close();
    segmenterRef.current = null;
    bgCanvasStreamRef.current?.getTracks().forEach(t => t.stop());
    bgCanvasStreamRef.current = null;

    // Возвращаем оригинальный видеотрек камеры во все peer connections и в превью
    if (originalCamTrackRef.current && localStreamRef.current) {
      const oldTrack = localStreamRef.current.getVideoTracks()[0];
      if (oldTrack && oldTrack !== originalCamTrackRef.current) {
        localStreamRef.current.removeTrack(oldTrack);
        oldTrack.stop();
      }
      if (!localStreamRef.current.getVideoTracks().includes(originalCamTrackRef.current)) {
        localStreamRef.current.addTrack(originalCamTrackRef.current);
      }
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;
      peersRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        sender?.replaceTrack(originalCamTrackRef.current!);
      });
    }
  }, []);

  const startBackgroundBlur = useCallback(async () => {
    if (!localStreamRef.current) return;
    setBgProcessing(true);
    try {
      const camTrack = localStreamRef.current.getVideoTracks()[0];
      if (!camTrack) return;
      if (!originalCamTrackRef.current) originalCamTrackRef.current = camTrack;

      // Скрытый video элемент — источник кадров для MediaPipe
      const videoEl = document.createElement('video');
      videoEl.srcObject = new MediaStream([originalCamTrackRef.current]);
      videoEl.muted = true;
      videoEl.playsInline = true;
      await videoEl.play();
      bgVideoElRef.current = videoEl;

      const settings = originalCamTrackRef.current.getSettings();
      const width = settings.width ?? 1280;
      const height = settings.height ?? 720;

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d')!;
      bgCanvasRef.current = canvas;

      const SelfieSegmentationClass = await loadMediaPipeScript();
      const segmenter = new SelfieSegmentationClass({
        locateFile: (file: string) => `https://cdn.jsdelivr.net/npm/@mediapipe/selfie_segmentation/${file}`,
      });
      segmenter.setOptions({ modelSelection: 1 });

      segmenter.onResults((results: any) => {
        ctx.save();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        // Рисуем маску сегментации (человек = непрозрачный)
        ctx.drawImage(results.segmentationMask, 0, 0, canvas.width, canvas.height);

        // Composite: оставляем только область человека из исходного видео
        ctx.globalCompositeOperation = 'source-in';
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);

        // Рисуем блюрнутый фон позади человека
        ctx.globalCompositeOperation = 'destination-over';
        ctx.filter = 'blur(12px)';
        ctx.drawImage(results.image, 0, 0, canvas.width, canvas.height);
        ctx.filter = 'none';
        ctx.restore();
      });
      segmenterRef.current = segmenter;

      const processFrame = async () => {
        if (!segmenterRef.current || !bgVideoElRef.current) return;
        await segmenter.send({ image: bgVideoElRef.current });
        bgRafRef.current = requestAnimationFrame(processFrame);
      };
      processFrame();

      // Создаём поток из canvas и заменяем трек камеры на него
      await new Promise(r => setTimeout(r, 300)); // даём время на первые кадры
      const canvasStream = canvas.captureStream(30);
      bgCanvasStreamRef.current = canvasStream;
      const blurredTrack = canvasStream.getVideoTracks()[0];

      localStreamRef.current.removeTrack(camTrack);
      localStreamRef.current.addTrack(blurredTrack);
      if (localVideoRef.current) localVideoRef.current.srcObject = localStreamRef.current;

      peersRef.current.forEach(pc => {
        const sender = pc.getSenders().find(s => s.track?.kind === 'video');
        sender?.replaceTrack(blurredTrack);
      });
    } catch (e) {
      console.warn('Background blur failed', e);
      setBgMode('none');
    } finally {
      setBgProcessing(false);
    }
  }, []);

  const toggleBackgroundBlur = () => {
    if (bgMode === 'blur') {
      stopBackgroundBlur();
      setBgMode('none');
    } else {
      setBgMode('blur');
      startBackgroundBlur();
    }
  };

  const sendChatMessage = () => {
    if (!chatInput.trim() || !socketRef.current) return;
    socketRef.current.emit('call:chat-message', { roomId, text: chatInput.trim() });
    setChatInput('');
  };

  const toggleHandRaise = () => {
    const raised = !handRaised;
    setHandRaised(raised);
    socketRef.current?.emit('call:hand-raise', { roomId, raised });
  };

  const openSidePanel = (panel: 'participants' | 'chat') => {
    setSidePanel(prev => prev === panel ? 'none' : panel);
    if (panel === 'chat') setUnreadChat(0);
  };

  useEffect(() => {
    if (sidePanel === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [chatMessages, sidePanel]);

  const leaveCall = () => {
    cleanup();
    router.push('/dashboard');
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`https://employee-tracker.ru/dashboard/calls/${roomId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // ===================== RENDER =====================

  if (stage === 'checking') {
    return (
      <div style={{ minHeight: '100vh', background: '#0F0A26', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ color: '#9B97CC', fontSize: '14px' }}>Проверка доступа...</div>
      </div>
    );
  }

  if (kickedMessage) {
    return (
      <div style={{ minHeight: '100vh', background: '#1a1040', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '16px' }}>
        <div style={{ fontSize: '48px' }}>👋</div>
        <p style={{ color: 'white', fontSize: '16px', textAlign: 'center', maxWidth: '400px' }}>{kickedMessage}</p>
        <button onClick={() => router.push('/dashboard')} style={{ background: '#7F77DD', color: 'white', border: 'none', borderRadius: '12px', padding: '10px 24px', fontSize: '14px', fontWeight: 700, cursor: 'pointer' }}>
          Вернуться в дашборд
        </button>
      </div>
    );
  }

  if (stage === 'error') {
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

  if (stage === 'lobby') {
    return (
      <div style={{ minHeight: '100vh', background: '#0F0A26', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
        <div style={{ maxWidth: '560px', width: '100%', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          <div style={{ textAlign: 'center' }}>
            <h1 style={{ color: 'white', fontSize: '20px', fontWeight: 700, margin: 0 }}>{callTitle}</h1>
            <p style={{ color: '#9B97CC', fontSize: '13px', margin: '4px 0 0' }}>Проверьте камеру и микрофон перед входом</p>
          </div>

          {/* Превью камеры */}
          <div style={{ position: 'relative', background: '#1a1040', borderRadius: '20px', overflow: 'hidden', aspectRatio: '16/9' }}>
            <video ref={lobbyVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', transform: 'scaleX(-1)', display: lobbyVideoOn ? 'block' : 'none' }} />
            {(!lobbyVideoOn || !lobbyStream) && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ width: '72px', height: '72px', borderRadius: '50%', background: '#7F77DD', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '28px', fontWeight: 700 }}>
                  {myUserName.charAt(0).toUpperCase()}
                </div>
              </div>
            )}

            {/* Контролы поверх превью */}
            <div style={{ position: 'absolute', bottom: '14px', left: 0, right: 0, display: 'flex', justifyContent: 'center', gap: '12px' }}>
              <button onClick={toggleLobbyAudio} style={lobbyCtrlStyle(lobbyAudioOn)}>{lobbyAudioOn ? '🎤' : '🔇'}</button>
              <button onClick={toggleLobbyVideo} style={lobbyCtrlStyle(lobbyVideoOn)}>{lobbyVideoOn ? '📹' : '📷'}</button>
            </div>
          </div>

          {deviceError && (
            <div style={{ background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)', borderRadius: '12px', padding: '12px 16px' }}>
              <p style={{ color: '#FCA5A5', fontSize: '13px', margin: 0 }}>{deviceError}</p>
            </div>
          )}

          {/* Выбор устройств */}
          {lobbyStream && (cameras.length > 1 || microphones.length > 1) && (
            <div style={{ display: 'flex', gap: '10px' }}>
              {cameras.length > 1 && (
                <select value={selectedCamera} onChange={e => switchDevice('camera', e.target.value)}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '8px 12px', fontSize: '12px', outline: 'none' }}>
                  {cameras.map(c => <option key={c.deviceId} value={c.deviceId} style={{ color: 'black' }}>{c.label}</option>)}
                </select>
              )}
              {microphones.length > 1 && (
                <select value={selectedMic} onChange={e => switchDevice('mic', e.target.value)}
                  style={{ flex: 1, background: 'rgba(255,255,255,0.08)', color: 'white', border: '1px solid rgba(255,255,255,0.15)', borderRadius: '10px', padding: '8px 12px', fontSize: '12px', outline: 'none' }}>
                  {microphones.map(m => <option key={m.deviceId} value={m.deviceId} style={{ color: 'black' }}>{m.label}</option>)}
                </select>
              )}
            </div>
          )}

          <button onClick={joinCall} disabled={!lobbyStream || joining}
            style={{ background: lobbyStream ? 'linear-gradient(135deg,#7F77DD,#5248C5)' : 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '14px', padding: '14px', fontSize: '15px', fontWeight: 700, cursor: lobbyStream ? 'pointer' : 'not-allowed', opacity: joining ? 0.7 : 1 }}>
            {joining ? 'Подключение...' : lobbyStream ? 'Войти в звонок' : 'Ожидание доступа к камере...'}
          </button>
        </div>
      </div>
    );
  }

  // stage === 'call'
  const participantList = Array.from(participants.values());
  const totalCount = participantList.length + 1;

  // Кто закреплён? 'self' — я, userId — конкретный участник, null — никто (обычная сетка)
  const pinnedIsSelf = pinnedUserId === 'self';
  const pinnedParticipant = pinnedUserId && pinnedUserId !== 'self' ? participants.get(pinnedUserId) : null;
  const hasPinned = pinnedIsSelf || !!pinnedParticipant;

  const renderSelfTile = (big: boolean) => (
    <div
      onClick={() => togglePin('self')}
      style={{
        position: 'relative', background: '#1a1040', borderRadius: '16px', overflow: 'hidden',
        width: '100%', height: '100%',
        cursor: 'pointer',
        border: mySpeaking ? '3px solid #16A34A' : '3px solid transparent',
        transition: 'border-color 0.15s',
      }}
    >
      <video ref={localVideoRef} autoPlay muted playsInline style={{ width: '100%', height: '100%', objectFit: big ? 'contain' : 'cover', transform: 'scaleX(-1)' }} />
      {!videoOn && (
        <div style={{ position: 'absolute', inset: 0, background: '#1a1040', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: big ? '96px' : '64px', height: big ? '96px' : '64px', borderRadius: '50%', background: '#7F77DD', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: big ? '36px' : '24px', fontWeight: 700 }}>
            {myUserName.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', padding: '4px 10px', color: 'white', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {!audioOn && <span>🔇</span>}
        {myUserName} (вы)
      </div>
      {big && (
        <button onClick={(e) => { e.stopPropagation(); togglePin('self'); }} style={unpinBtnStyle}>✕ Открепить</button>
      )}
    </div>
  );

  const statusColor = networkStatus === 'offline' ? '#DC2626' : networkStatus === 'reconnecting' ? '#D97706' : connecting ? '#D97706' : '#16A34A';
  const statusText = networkStatus === 'offline' ? 'Нет подключения к интернету'
    : networkStatus === 'reconnecting' ? 'Переподключение...'
    : connecting ? 'Подключение...'
    : `${callTitle} · ${totalCount} участник${totalCount === 1 ? '' : totalCount < 5 ? 'а' : 'ов'}`;

  return (
    <div ref={containerRef} style={{ minHeight: '100vh', background: '#0F0A26', display: 'flex', flexDirection: 'column' }}>
      <style>{`@keyframes pulse { 0%, 100% { opacity: 1; } 50% { opacity: 0.4; } }`}</style>
      {(networkStatus === 'offline' || networkStatus === 'reconnecting') && (
        <div style={{ background: networkStatus === 'offline' ? '#DC2626' : '#D97706', padding: '8px 20px', textAlign: 'center' }}>
          <span style={{ color: 'white', fontSize: '13px', fontWeight: 600 }}>
            {networkStatus === 'offline' ? '⚠️ Нет подключения к интернету. Ожидаем восстановления сети...' : '🔄 Переподключение к звонку...'}
          </span>
        </div>
      )}
      <div style={{ padding: isMobile ? '10px 12px' : '14px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', background: 'rgba(255,255,255,0.03)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', minWidth: 0, overflow: 'hidden' }}>
          <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: statusColor, animation: networkStatus !== 'online' ? 'pulse 1.5s infinite' : undefined, flexShrink: 0 }} />
          <span style={{ color: 'white', fontSize: isMobile ? '12px' : '14px', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {statusText}
          </span>
          {!connecting && networkStatus === 'online' && (
            <span title={`Качество связи: ${connectionQuality === 'good' ? 'хорошее' : connectionQuality === 'medium' ? 'среднее' : 'плохое'}`} style={{ display: 'flex', gap: '2px', alignItems: 'flex-end', marginLeft: '4px' }}>
              {[1,2,3].map(bar => (
                <span key={bar} style={{
                  width: '3px', height: `${bar * 4}px`,
                  background: connectionQuality === 'good' ? '#16A34A' : connectionQuality === 'medium' ? (bar <= 2 ? '#D97706' : 'rgba(255,255,255,0.2)') : (bar === 1 ? '#DC2626' : 'rgba(255,255,255,0.2)'),
                  borderRadius: '1px',
                }} />
              ))}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: '8px' }}>
          {!isMobile && (
            <button onClick={toggleFullscreen} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '10px', padding: '7px 14px', fontSize: '12px', cursor: 'pointer' }}>
              {isFullscreen ? '⤓ Свернуть' : '⤢ На весь экран'}
            </button>
          )}
          <button onClick={copyLink} style={{ background: 'rgba(255,255,255,0.1)', color: 'white', border: 'none', borderRadius: '10px', padding: isMobile ? '7px 10px' : '7px 14px', fontSize: '12px', cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {isMobile ? (copied ? '✓' : '🔗') : (copied ? '✓ Скопировано' : '🔗 Скопировать ссылку')}
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          {hasPinned ? (
            <div style={{ flex: 1, padding: '16px', display: 'flex', gap: '12px', minHeight: 0 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                {pinnedIsSelf ? renderSelfTile(true) : pinnedParticipant && (
                  <PinnedRemoteVideo participant={pinnedParticipant} isSpeaking={speakingUserId === pinnedParticipant.userId} onUnpin={() => togglePin(pinnedParticipant.userId)} />
                )}
              </div>
              <div style={{ width: isMobile ? '90px' : '180px', display: 'flex', flexDirection: 'column', gap: isMobile ? '6px' : '10px', overflowY: 'auto' }}>
                {!pinnedIsSelf && (
                  <div style={{ aspectRatio: '16/9' }}>{renderSelfTile(false)}</div>
                )}
                {participantList.filter(p => p.userId !== pinnedUserId).map(p => (
                  <div key={p.userId} style={{ aspectRatio: '16/9' }}>
                    <RemoteVideo participant={p} isSpeaking={speakingUserId === p.userId} onPin={() => togglePin(p.userId)} />
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div style={{ flex: 1, padding: isMobile ? '8px' : '16px', display: 'grid', gridTemplateColumns: `repeat(${isMobile ? Math.min(Math.ceil(Math.sqrt(totalCount)), 2) : Math.min(Math.ceil(Math.sqrt(totalCount)), 4)}, 1fr)`, gap: isMobile ? '6px' : '12px', alignContent: 'center' }}>
              <div style={{ aspectRatio: '16/9' }}>{renderSelfTile(false)}</div>
              {participantList.map(p => (
                <RemoteVideo key={p.userId} participant={p} isSpeaking={speakingUserId === p.userId} onPin={() => togglePin(p.userId)} />
              ))}
            </div>
          )}

          <div style={{ padding: isMobile ? '12px' : '20px', display: 'flex', justifyContent: 'center', flexWrap: 'wrap', gap: isMobile ? '8px' : '14px' }}>
            <button onClick={toggleAudio} style={ctrlBtnStyle(audioOn, undefined, isMobile ? 44 : 52)}>{audioOn ? '🎤' : '🔇'}</button>
            <button onClick={toggleVideo} style={ctrlBtnStyle(videoOn, undefined, isMobile ? 44 : 52)}>{videoOn ? '📹' : '📷'}</button>
            {!isMobile && (
              <button onClick={toggleScreenShare} style={ctrlBtnStyle(!screenSharing, screenSharing ? '#7F77DD' : undefined)}>🖥️</button>
            )}
            {!isMobile && (
              <button onClick={toggleBackgroundBlur} disabled={bgProcessing || screenSharing} title="Размыть фон"
                style={{ ...ctrlBtnStyle(bgMode === 'none', bgMode === 'blur' ? '#7F77DD' : undefined), opacity: (bgProcessing || screenSharing) ? 0.5 : 1 }}>
                {bgProcessing ? '⏳' : '🌫️'}
              </button>
            )}
            <button onClick={toggleHandRaise} style={ctrlBtnStyle(!handRaised, handRaised ? '#D97706' : undefined, isMobile ? 44 : 52)}>✋</button>
            <button onClick={() => openSidePanel('participants')} style={ctrlBtnStyle(sidePanel !== 'participants', undefined, isMobile ? 44 : 52)}>
              👥{participantList.length > 0 && <span style={badgeStyle}>{totalCount}</span>}
            </button>
            <button onClick={() => openSidePanel('chat')} style={{ ...ctrlBtnStyle(sidePanel !== 'chat', undefined, isMobile ? 44 : 52), position: 'relative' }}>
              💬{unreadChat > 0 && <span style={{ ...badgeStyle, background: '#DC2626' }}>{unreadChat}</span>}
            </button>
            <button onClick={leaveCall} style={{ width: (isMobile ? 44 : 52) + 'px', height: (isMobile ? 44 : 52) + 'px', borderRadius: '50%', background: '#DC2626', border: 'none', color: 'white', fontSize: isMobile ? '16px' : '20px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>📞</button>
          </div>
          {isMobile && (
            <div style={{ padding: '0 12px 12px', display: 'flex', justifyContent: 'center', gap: '8px' }}>
              <button onClick={toggleScreenShare} style={{ ...ctrlBtnStyle(!screenSharing, screenSharing ? '#7F77DD' : undefined, 40), borderRadius: '20px', width: 'auto', padding: '0 16px', fontSize: '13px' }}>
                🖥️ Экран
              </button>
              <button onClick={toggleBackgroundBlur} disabled={bgProcessing || screenSharing}
                style={{ ...ctrlBtnStyle(bgMode === 'none', bgMode === 'blur' ? '#7F77DD' : undefined, 40), borderRadius: '20px', width: 'auto', padding: '0 16px', fontSize: '13px', opacity: (bgProcessing || screenSharing) ? 0.5 : 1 }}>
                {bgProcessing ? '⏳' : '🌫️'} Фон
              </button>
            </div>
          )}
        </div>

        {sidePanel !== 'none' && (
          <div style={isMobile ? {
            position: 'fixed', inset: 0, zIndex: 50,
            background: '#0F0A26', display: 'flex', flexDirection: 'column',
          } : { width: '300px', background: 'rgba(255,255,255,0.03)', borderLeft: '1px solid rgba(255,255,255,0.08)', display: 'flex', flexDirection: 'column' }}>
            <div style={{ padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ color: 'white', fontSize: '14px', fontWeight: 700 }}>
                {sidePanel === 'participants' ? `Участники (${totalCount})` : 'Чат'}
              </span>
              <button onClick={() => setSidePanel('none')} style={{ background: 'none', border: 'none', color: '#9B97CC', fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>

            {sidePanel === 'participants' && (
              <div style={{ flex: 1, overflowY: 'auto', padding: '12px' }}>
                {isHost && (
                  <button onClick={toggleRoomLock} style={{ width: '100%', marginBottom: '10px', background: roomLocked ? 'rgba(220,38,38,0.15)' : 'rgba(255,255,255,0.06)', border: `1px solid ${roomLocked ? 'rgba(220,38,38,0.4)' : 'rgba(255,255,255,0.1)'}`, borderRadius: '10px', padding: '9px', color: roomLocked ? '#FCA5A5' : '#9B97CC', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                    {roomLocked ? '🔒 Комната закрыта — нажмите для открытия' : '🔓 Закрыть вход новым участникам'}
                  </button>
                )}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 8px', borderRadius: '10px' }}>
                  <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#7F77DD', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '13px', fontWeight: 700 }}>
                    {myUserName.charAt(0).toUpperCase()}
                  </div>
                  <span style={{ color: 'white', fontSize: '13px', flex: 1 }}>{myUserName} (вы) {isHost && '👑'}</span>
                  {handRaised && <span>✋</span>}
                  {!audioOn && <span style={{ color: '#9B97CC' }}>🔇</span>}
                </div>
                {participantList.map(p => (
                  <div key={p.userId} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 8px', borderRadius: '10px' }}>
                    <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#5248C5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '13px', fontWeight: 700, flexShrink: 0 }}>
                      {p.userName.charAt(0).toUpperCase()}
                    </div>
                    <span style={{ color: 'white', fontSize: '13px', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.userName} {hostUserId === p.userId && '👑'}</span>
                    {raisedHands.has(p.userId) && <span style={{ flexShrink: 0 }}>✋</span>}
                    {p.audioEnabled === false && <span style={{ color: '#9B97CC', flexShrink: 0 }}>🔇</span>}
                    {isHost && hostUserId !== p.userId && (
                      <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                        {p.audioEnabled !== false && (
                          <button onClick={() => muteParticipant(p.userId)} title="Выключить микрофон"
                            style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', padding: '4px 6px', color: '#9B97CC', fontSize: '11px', cursor: 'pointer' }}>
                            🔇
                          </button>
                        )}
                        <button onClick={() => transferHost(p.userId, p.userName)} title="Сделать организатором"
                          style={{ background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '6px', padding: '4px 6px', color: '#9B97CC', fontSize: '11px', cursor: 'pointer' }}>
                          👑
                        </button>
                        <button onClick={() => kickParticipant(p.userId)} title="Удалить из звонка"
                          style={{ background: 'rgba(220,38,38,0.15)', border: 'none', borderRadius: '6px', padding: '4px 6px', color: '#DC2626', fontSize: '11px', cursor: 'pointer' }}>
                          ✕
                        </button>
                      </div>
                    )}
                  </div>
                ))}
                {isHost && participantList.length > 0 && (
                  <button onClick={muteAll} style={{ width: '100%', marginTop: '10px', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '10px', padding: '9px', color: '#9B97CC', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                    🔇 Выключить все микрофоны
                  </button>
                )}
                {isHost && (
                  <button onClick={endCallForAll} style={{ width: '100%', marginTop: '8px', background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.4)', borderRadius: '10px', padding: '10px', color: '#FCA5A5', fontSize: '12px', cursor: 'pointer', fontWeight: 600 }}>
                    Завершить встречу для всех
                  </button>
                )}
              </div>
            )}

            {sidePanel === 'chat' && (
              <>
                <div style={{ flex: 1, overflowY: 'auto', padding: '12px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {chatMessages.length === 0 && (
                    <p style={{ color: '#9B97CC', fontSize: '12px', textAlign: 'center', marginTop: '20px' }}>Сообщений пока нет</p>
                  )}
                  {chatMessages.map(msg => {
                    const isMe = msg.userId === myUserIdRef.current;
                    return (
                      <div key={msg.id} style={{ alignSelf: isMe ? 'flex-end' : 'flex-start', maxWidth: '85%' }}>
                        {!isMe && <div style={{ fontSize: '11px', color: '#9B97CC', marginBottom: '2px' }}>{msg.userName}</div>}
                        <div style={{ background: isMe ? '#7F77DD' : 'rgba(255,255,255,0.08)', color: 'white', borderRadius: '12px', padding: '8px 12px', fontSize: '13px', wordBreak: 'break-word' }}>
                          {msg.text}
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
                <div style={{ padding: '12px', borderTop: '1px solid rgba(255,255,255,0.08)', display: 'flex', gap: '8px' }}>
                  <input
                    value={chatInput}
                    onChange={e => setChatInput(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && sendChatMessage()}
                    placeholder="Написать сообщение..."
                    style={{ flex: 1, background: 'rgba(255,255,255,0.08)', border: 'none', borderRadius: '10px', padding: '9px 12px', fontSize: '13px', color: 'white', outline: 'none' }}
                  />
                  <button onClick={sendChatMessage} style={{ background: '#7F77DD', border: 'none', borderRadius: '10px', padding: '9px 14px', color: 'white', cursor: 'pointer', fontSize: '13px' }}>→</button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

const badgeStyle: React.CSSProperties = {
  position: 'absolute', top: '-4px', right: '-4px',
  background: '#7F77DD', color: 'white', borderRadius: '10px',
  fontSize: '10px', fontWeight: 700, minWidth: '18px', height: '18px',
  display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 4px',
};

const unpinBtnStyle: React.CSSProperties = {
  position: 'absolute', top: '10px', right: '10px',
  background: 'rgba(0,0,0,0.6)', color: 'white', border: 'none',
  borderRadius: '8px', padding: '4px 10px', fontSize: '11px', cursor: 'pointer',
};

function lobbyCtrlStyle(active: boolean) {
  return {
    width: '44px', height: '44px', borderRadius: '50%',
    background: active ? 'rgba(255,255,255,0.15)' : '#DC2626',
    border: 'none', color: 'white', fontSize: '18px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    backdropFilter: 'blur(8px)',
  } as React.CSSProperties;
}

function ctrlBtnStyle(active: boolean, activeColor?: string, size: number = 52) {
  return {
    width: size + 'px', height: size + 'px', borderRadius: '50%',
    background: active ? 'rgba(255,255,255,0.1)' : '#DC2626',
    border: activeColor ? `2px solid ${activeColor}` : 'none',
    color: 'white', fontSize: size <= 42 ? '16px' : '20px', cursor: 'pointer',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    position: 'relative', flexShrink: 0,
  } as React.CSSProperties;
}

function RemoteVideo({ participant, isSpeaking, onPin }: { participant: Participant; isSpeaking: boolean; onPin: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
      videoRef.current.play().catch(() => {});
    }
  }, [participant.stream]);

  const hasVideo = participant.stream && participant.stream.getVideoTracks().length > 0 && participant.videoEnabled !== false;

  return (
    <div
      onClick={onPin}
      style={{
        position: 'relative', background: '#1a1040', borderRadius: '16px', overflow: 'hidden', aspectRatio: '16/9',
        cursor: 'pointer',
        border: isSpeaking ? '3px solid #16A34A' : '3px solid transparent',
        transition: 'border-color 0.15s',
      }}
    >
      <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'cover', display: hasVideo ? 'block' : 'none' }} />
      {!hasVideo && (
        <div style={{ position: 'absolute', inset: 0, background: '#1a1040', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '64px', height: '64px', borderRadius: '50%', background: '#5248C5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '24px', fontWeight: 700 }}>
            {participant.userName.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <div style={{ position: 'absolute', bottom: '10px', left: '10px', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', padding: '4px 10px', color: 'white', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {participant.audioEnabled === false && <span>🔇</span>}
        {participant.userName}
        {!participant.stream && <span style={{ color: '#D97706' }}> · подключение...</span>}
      </div>
    </div>
  );
}

function PinnedRemoteVideo({ participant, isSpeaking, onUnpin }: { participant: Participant; isSpeaking: boolean; onUnpin: () => void }) {
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (videoRef.current && participant.stream) {
      videoRef.current.srcObject = participant.stream;
      videoRef.current.play().catch(() => {});
    }
  }, [participant.stream]);

  const hasVideo = participant.stream && participant.stream.getVideoTracks().length > 0 && participant.videoEnabled !== false;

  return (
    <div style={{
      position: 'relative', background: '#1a1040', borderRadius: '16px', overflow: 'hidden', height: '100%',
      border: isSpeaking ? '3px solid #16A34A' : '3px solid transparent',
      transition: 'border-color 0.15s',
    }}>
      <video ref={videoRef} autoPlay playsInline style={{ width: '100%', height: '100%', objectFit: 'contain', display: hasVideo ? 'block' : 'none' }} />
      {!hasVideo && (
        <div style={{ position: 'absolute', inset: 0, background: '#1a1040', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ width: '96px', height: '96px', borderRadius: '50%', background: '#5248C5', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: '36px', fontWeight: 700 }}>
            {participant.userName.charAt(0).toUpperCase()}
          </div>
        </div>
      )}
      <div style={{ position: 'absolute', bottom: '14px', left: '14px', background: 'rgba(0,0,0,0.5)', borderRadius: '8px', padding: '6px 12px', color: 'white', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}>
        {participant.audioEnabled === false && <span>🔇</span>}
        {participant.userName}
      </div>
      <button onClick={onUnpin} style={unpinBtnStyle}>✕ Открепить</button>
    </div>
  );
}
