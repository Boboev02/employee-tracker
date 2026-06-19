import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect,
  ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PresenceService } from './presence.service';

interface CallRoom {
  roomId: string;
  orgId: string;
  createdBy: string;
  participants: Map<string, { userId: string; userName: string; socketId: string }>;
}

@WebSocketGateway({ cors: { origin: ['https://employee-tracker.ru', 'https://www.employee-tracker.ru', 'http://localhost:3000'], credentials: true }, namespace: '/realtime' })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private socketToUser = new Map<string, { userId: string; orgId: string; userName?: string }>();
  private callRooms = new Map<string, CallRoom>();

  constructor(
    private readonly jwt: JwtService,
    private readonly presence: PresenceService,
  ) {}

  async handleConnection(socket: Socket) {
    try {
      const token = socket.handshake.auth?.token
        ?? socket.handshake.headers?.authorization?.replace('Bearer ', '');
      if (!token) { socket.disconnect(); return; }

      const payload = this.jwt.verify(token, { secret: process.env.JWT_ACCESS_SECRET });
      const userId = payload.sub;
      const orgId  = payload.orgId;
      const userName = payload.name ?? payload.email ?? 'User';

      this.socketToUser.set(socket.id, { userId, orgId, userName });
      socket.join('org:' + orgId);
      socket.join('user:' + userId);

      await this.presence.setOnline(userId, orgId);

      const snapshot = await this.presence.getOrgPresence(orgId);
      socket.emit('presence:snapshot', snapshot);

      this.server.to('org:' + orgId).emit('presence:update', {
        userId, status: 'ONLINE', lastActivityAt: Date.now(),
      });

      console.log('WS connected:', userId);
    } catch {
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: Socket) {
    const user = this.socketToUser.get(socket.id);
    this.socketToUser.delete(socket.id);
    if (!user) return;

    // Покидаем все звонки в которых были
    for (const [roomId, room] of this.callRooms.entries()) {
      if (room.participants.has(user.userId)) {
        this.leaveCallRoom(socket, roomId, user.userId);
      }
    }

    await this.presence.setOffline(user.userId, user.orgId);

    this.server.to('org:' + user.orgId).emit('presence:update', {
      userId: user.userId, status: 'OFFLINE', lastActivityAt: Date.now(),
    });

    console.log('WS disconnected:', user.userId);
  }

  @SubscribeMessage('ping')
  handlePing(@ConnectedSocket() socket: Socket) {
    const user = this.socketToUser.get(socket.id);
    if (user) this.presence.setOnline(user.userId, user.orgId);
    socket.emit('pong', { time: Date.now() });
  }

  @SubscribeMessage('activity')
  async handleActivity(@ConnectedSocket() socket: Socket, @MessageBody() data: any) {
    const user = this.socketToUser.get(socket.id);
    if (!user) return;

    await this.presence.setOnline(user.userId, user.orgId, data);

    this.server.to('org:' + user.orgId).emit('presence:update', {
      userId:          user.userId,
      status:          'ONLINE',
      lastActivityAt:  Date.now(),
      platform:        data.platform,
      currentTitle:    data.currentTitle,
      todayActiveSecs: data.todayActiveSecs ?? 0,
    });
  }

  broadcastTaskUpdate(orgId: string, payload: any) {
    this.server.to('org:' + orgId).emit('task:update', payload);
  }

  // ==================== ВИДЕОЗВОНКИ (WebRTC signaling) ====================

  @SubscribeMessage('call:join')
  handleCallJoin(@ConnectedSocket() socket: Socket, @MessageBody() data: { roomId: string }) {
    const user = this.socketToUser.get(socket.id);
    if (!user) return;

    const { roomId } = data;
    let room = this.callRooms.get(roomId);

    if (!room) {
      room = { roomId, orgId: user.orgId, createdBy: user.userId, participants: new Map() };
      this.callRooms.set(roomId, room);
    }

    // Лимит 10 человек
    if (room.participants.size >= 10 && !room.participants.has(user.userId)) {
      socket.emit('call:error', { message: 'Комната заполнена (максимум 10 участников)' });
      return;
    }

    const existingParticipants = Array.from(room.participants.values())
      .filter(p => p.userId !== user.userId);

    room.participants.set(user.userId, { userId: user.userId, userName: user.userName ?? 'User', socketId: socket.id });
    socket.join('call:' + roomId);

    // Отправляем новому участнику список уже подключённых
    socket.emit('call:participants', { participants: existingParticipants });

    // Уведомляем остальных о новом участнике
    socket.to('call:' + roomId).emit('call:user-joined', {
      userId: user.userId,
      userName: user.userName ?? 'User',
      socketId: socket.id,
    });

    console.log(`Call ${roomId}: ${user.userId} joined (${room.participants.size} participants)`);
  }

  @SubscribeMessage('call:leave')
  handleCallLeave(@ConnectedSocket() socket: Socket, @MessageBody() data: { roomId: string }) {
    const user = this.socketToUser.get(socket.id);
    if (!user) return;
    this.leaveCallRoom(socket, data.roomId, user.userId);
  }

  private leaveCallRoom(socket: Socket, roomId: string, userId: string) {
    const room = this.callRooms.get(roomId);
    if (!room) return;

    room.participants.delete(userId);
    socket.leave('call:' + roomId);
    socket.to('call:' + roomId).emit('call:user-left', { userId });

    if (room.participants.size === 0) {
      this.callRooms.delete(roomId);
    }
    console.log(`Call ${roomId}: ${userId} left (${room.participants.size} remaining)`);
  }

  // WebRTC signaling relay — offer/answer/ice candidates передаются точечно по socketId
  @SubscribeMessage('call:signal')
  handleCallSignal(@ConnectedSocket() socket: Socket, @MessageBody() data: { targetSocketId: string; signal: any; fromUserId: string }) {
    this.server.to(data.targetSocketId).emit('call:signal', {
      signal: data.signal,
      fromUserId: data.fromUserId,
      fromSocketId: socket.id,
    });
  }

  @SubscribeMessage('call:toggle-media')
  handleToggleMedia(@ConnectedSocket() socket: Socket, @MessageBody() data: { roomId: string; userId: string; kind: 'audio' | 'video' | 'screen'; enabled: boolean }) {
    socket.to('call:' + data.roomId).emit('call:media-toggled', data);
  }
}
