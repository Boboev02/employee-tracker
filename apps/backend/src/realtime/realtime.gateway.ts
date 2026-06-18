import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect,
  ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PresenceService } from './presence.service';

@WebSocketGateway({ cors: { origin: ['https://employee-tracker.ru', 'https://www.employee-tracker.ru', 'http://localhost:3000'], credentials: true }, namespace: '/realtime' })
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private socketToUser = new Map<string, { userId: string; orgId: string }>();

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

      this.socketToUser.set(socket.id, { userId, orgId });
      socket.join('org:' + orgId);
      socket.join('user:' + userId);

      await this.presence.setOnline(userId, orgId);

      // Send current presence snapshot to newly connected client
      const snapshot = await this.presence.getOrgPresence(orgId);
      socket.emit('presence:snapshot', snapshot);

      // Notify org members that this user is online
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
    this.socketToUser.delete(socket.id); // всегда удаляем даже если user не найден
    if (!user) return;

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

  // Called by other services to broadcast task updates
  broadcastTaskUpdate(orgId: string, payload: any) {
    this.server.to('org:' + orgId).emit('task:update', payload);
  }
}
