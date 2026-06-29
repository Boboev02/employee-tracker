import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect,
  ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PresenceService } from './presence.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { AuditService } from '../audit/audit.service';

interface CallParticipant {
  userId: string;
  userName: string;
  socketId: string;
}

interface CallRoom {
  roomId: string;
  orgId: string;
  createdBy: string;
  locked: boolean;
  participants: Map<string, CallParticipant>;
}

@WebSocketGateway({ cors: { origin: ['https://employee-tracker.ru', 'https://www.employee-tracker.ru', 'http://localhost:3000'], credentials: true }, namespace: '/realtime' })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private socketToUser = new Map<string, { userId: string; orgId: string; userName?: string }>();
  private callRooms = new Map<string, CallRoom>();

  constructor(
    private readonly jwt: JwtService,
    private readonly presence: PresenceService,
    @InjectRedis() private readonly redis: Redis,
    private readonly audit: AuditService,
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

      console.log('WS connected:', userId, socket.id);
    } catch {
      socket.disconnect();
    }
  }

  async handleDisconnect(socket: Socket) {
    const user = this.socketToUser.get(socket.id);
    this.socketToUser.delete(socket.id);
    if (!user) return;

    for (const [roomId, room] of this.callRooms.entries()) {
      if (room.participants.has(socket.id)) {
        this.leaveCallRoom(socket, roomId);
      }
    }

    const stillOnline = Array.from(this.socketToUser.values()).some(u => u.userId === user.userId);
    if (!stillOnline) {
      await this.presence.setOffline(user.userId, user.orgId);
      this.server.to('org:' + user.orgId).emit('presence:update', {
        userId: user.userId, status: 'OFFLINE', lastActivityAt: Date.now(),
      });
    }

    console.log('WS disconnected:', user.userId, socket.id);
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

  @SubscribeMessage('call:join')
  async handleCallJoin(@ConnectedSocket() socket: Socket, @MessageBody() data: { roomId: string }) {
    const user = this.socketToUser.get(socket.id);
    if (!user) return;

    const { roomId } = data;

    const roomRaw = await this.redis.get('call:room:' + roomId);
    if (!roomRaw) {
      socket.emit('call:error', { message: 'Звонок не найден или истёк' });
      return;
    }
    const roomMeta = JSON.parse(roomRaw);
    if (roomMeta.orgId !== user.orgId) {
      socket.emit('call:error', { message: 'У вас нет доступа к этому звонку' });
      return;
    }

    let room = this.callRooms.get(roomId);
    if (!room) {
      room = { roomId, orgId: user.orgId, createdBy: user.userId, locked: false, participants: new Map() };
      this.callRooms.set(roomId, room);
    }

    if (room.participants.has(socket.id)) {
      this.leaveCallRoom(socket, roomId, true);
      room = this.callRooms.get(roomId) ?? room;
    }

    const isAlreadyInRoom = Array.from(room.participants.values()).some(p => p.userId === user.userId);

    if (room.locked && !isAlreadyInRoom && room.createdBy !== user.userId) {
      socket.emit('call:error', { message: 'Организатор закрыл вход в эту встречу' });
      return;
    }

    const uniqueUserCount = new Set(Array.from(room.participants.values()).map(p => p.userId)).size;
    if (uniqueUserCount >= 10 && !isAlreadyInRoom) {
      socket.emit('call:error', { message: 'Комната заполнена (максимум 10 участников)' });
      return;
    }

    const existingParticipants = Array.from(room.participants.values())
      .filter(p => p.userId !== user.userId);

    room.participants.set(socket.id, { userId: user.userId, userName: user.userName ?? 'User', socketId: socket.id });
    socket.join('call:' + roomId);

    socket.emit('call:participants', { participants: existingParticipants, hostUserId: room.createdBy });

    for (const p of room.participants.values()) {
      if (p.socketId !== socket.id && p.userId !== user.userId) {
        this.server.to(p.socketId).emit('call:user-joined', {
          userId: user.userId,
          userName: user.userName ?? 'User',
          socketId: socket.id,
        });
      }
    }

    console.log(`Call ${roomId}: ${user.userId} (${socket.id}) joined`);
  }

  @SubscribeMessage('call:leave')
  handleCallLeave(@ConnectedSocket() socket: Socket, @MessageBody() data: { roomId: string }) {
    this.leaveCallRoom(socket, data.roomId);
  }

  private leaveCallRoom(socket: Socket, roomId: string, silent = false) {
    const room = this.callRooms.get(roomId);
    if (!room) return;

    const me = room.participants.get(socket.id);
    if (!me) return;

    room.participants.delete(socket.id);
    socket.leave('call:' + roomId);

    if (!silent) {
      socket.to('call:' + roomId).emit('call:user-left', { userId: me.userId, socketId: socket.id });
    }

    if (room.participants.size === 0) {
      this.callRooms.delete(roomId);
    }
    console.log(`Call ${roomId}: ${me.userId} (${socket.id}) left`);
  }

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
    socket.to('call:' + data.roomId).emit('call:media-toggled', { ...data, socketId: socket.id });
  }

  @SubscribeMessage('call:chat-message')
  handleChatMessage(@ConnectedSocket() socket: Socket, @MessageBody() data: { roomId: string; text: string }) {
    const user = this.socketToUser.get(socket.id);
    if (!user) return;

    const message = {
      id: Date.now() + '-' + Math.random().toString(36).slice(2, 8),
      userId: user.userId,
      userName: user.userName ?? 'User',
      text: data.text.slice(0, 1000),
      timestamp: Date.now(),
    };

    this.server.to('call:' + data.roomId).emit('call:chat-message', message);
  }

  @SubscribeMessage('call:hand-raise')
  handleHandRaise(@ConnectedSocket() socket: Socket, @MessageBody() data: { roomId: string; raised: boolean }) {
    const user = this.socketToUser.get(socket.id);
    if (!user) return;
    socket.to('call:' + data.roomId).emit('call:hand-raised', { userId: user.userId, raised: data.raised });
  }

  @SubscribeMessage('call:kick')
  handleKick(@ConnectedSocket() socket: Socket, @MessageBody() data: { roomId: string; targetUserId: string }) {
    const user = this.socketToUser.get(socket.id);
    if (!user) return;

    const room = this.callRooms.get(data.roomId);
    if (!room || room.createdBy !== user.userId) {
      socket.emit('call:error', { message: 'Только организатор может удалять участников' });
      return;
    }

    const targets = Array.from(room.participants.values()).filter(p => p.userId === data.targetUserId);
    if (targets.length === 0) return;

    this.audit.log({ orgId: user.orgId, userId: user.userId, userName: user.userName, action: 'call.kick_participant', category: 'calls', details: { roomId: data.roomId, targetUserId: data.targetUserId, targetUserName: targets[0].userName } });

    for (const target of targets) {
      this.server.to(target.socketId).emit('call:kicked', { message: 'Вас удалил из звонка организатор' });
      room.participants.delete(target.socketId);
      const targetSocket = this.server.sockets.sockets.get(target.socketId);
      targetSocket?.leave('call:' + data.roomId);
    }

    this.server.to('call:' + data.roomId).emit('call:user-left', { userId: data.targetUserId });
  }

  @SubscribeMessage('call:end-for-all')
  handleEndForAll(@ConnectedSocket() socket: Socket, @MessageBody() data: { roomId: string }) {
    const user = this.socketToUser.get(socket.id);
    if (!user) return;

    const room = this.callRooms.get(data.roomId);
    if (!room || room.createdBy !== user.userId) {
      socket.emit('call:error', { message: 'Только организатор может завершить встречу для всех' });
      return;
    }

    this.audit.log({ orgId: user.orgId, userId: user.userId, userName: user.userName, action: 'call.end_for_all', category: 'calls', details: { roomId: data.roomId, participantsCount: room.participants.size } });

    this.server.to('call:' + data.roomId).emit('call:ended', { message: 'Организатор завершил встречу' });
    room.participants.clear();
    this.callRooms.delete(data.roomId);
  }

  @SubscribeMessage('call:toggle-lock')
  handleToggleLock(@ConnectedSocket() socket: Socket, @MessageBody() data: { roomId: string; locked: boolean }) {
    const user = this.socketToUser.get(socket.id);
    if (!user) return;

    const room = this.callRooms.get(data.roomId);
    if (!room || room.createdBy !== user.userId) {
      socket.emit('call:error', { message: 'Только организатор может блокировать комнату' });
      return;
    }

    room.locked = data.locked;
    this.server.to('call:' + data.roomId).emit('call:lock-changed', { locked: data.locked });
  }

  @SubscribeMessage('call:transfer-host')
  handleTransferHost(@ConnectedSocket() socket: Socket, @MessageBody() data: { roomId: string; newHostUserId: string }) {
    const user = this.socketToUser.get(socket.id);
    if (!user) return;

    const room = this.callRooms.get(data.roomId);
    if (!room || room.createdBy !== user.userId) {
      socket.emit('call:error', { message: 'Только организатор может передать роль' });
      return;
    }
    const hasTarget = Array.from(room.participants.values()).some(p => p.userId === data.newHostUserId);
    if (!hasTarget) return;

    room.createdBy = data.newHostUserId;
    this.server.to('call:' + data.roomId).emit('call:host-changed', { newHostUserId: data.newHostUserId });
  }

  @SubscribeMessage('call:mute-participant')
  handleMuteParticipant(@ConnectedSocket() socket: Socket, @MessageBody() data: { roomId: string; targetUserId: string }) {
    const user = this.socketToUser.get(socket.id);
    if (!user) return;

    const room = this.callRooms.get(data.roomId);
    if (!room || room.createdBy !== user.userId) return;

    for (const p of room.participants.values()) {
      if (p.userId === data.targetUserId) {
        this.server.to(p.socketId).emit('call:force-mute', {});
      }
    }
  }

  @SubscribeMessage('call:mute-all')
  handleMuteAll(@ConnectedSocket() socket: Socket, @MessageBody() data: { roomId: string }) {
    const user = this.socketToUser.get(socket.id);
    if (!user) return;

    const room = this.callRooms.get(data.roomId);
    if (!room || room.createdBy !== user.userId) return;

    for (const p of room.participants.values()) {
      if (p.userId !== user.userId) {
        this.server.to(p.socketId).emit('call:force-mute', {});
      }
    }
  }
}
