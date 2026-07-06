import { Injectable } from '@nestjs/common';
import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect,
  ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';

@Injectable()
@WebSocketGateway({
  cors: { origin: ['https://employee-tracker.ru', 'https://www.employee-tracker.ru', 'http://localhost:3000'], credentials: true },
  namespace: '/chat',
})
export class ChatGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server;

  private socketToUser = new Map<string, { userId: string; orgId: string; userName?: string }>();

  constructor(private readonly jwt: JwtService) {}

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
      socket.join('chat-user:' + userId);
    } catch {
      socket.disconnect();
    }
  }

  handleDisconnect(socket: Socket) {
    this.socketToUser.delete(socket.id);
  }

  // Client joins a specific channel room to receive live messages/typing
  @SubscribeMessage('chat:join')
  handleJoinChannel(@ConnectedSocket() socket: Socket, @MessageBody() data: { channelId: string }) {
    socket.join('chat-channel:' + data.channelId);
  }

  @SubscribeMessage('chat:leave')
  handleLeaveChannel(@ConnectedSocket() socket: Socket, @MessageBody() data: { channelId: string }) {
    socket.leave('chat-channel:' + data.channelId);
  }

  @SubscribeMessage('chat:typing')
  handleTyping(@ConnectedSocket() socket: Socket, @MessageBody() data: { channelId: string }) {
    const info = this.socketToUser.get(socket.id);
    if (!info) return;
    socket.to('chat-channel:' + data.channelId).emit('chat:typing', { channelId: data.channelId, userId: info.userId, userName: info.userName });
  }

  // Called by ChatController after saving a message via REST
  broadcastMessage(channelId: string, message: any) {
    this.server.to('chat-channel:' + channelId).emit('chat:message', { channelId, message });
    // Also notify each member's personal room for unread badge updates outside the open channel
    this.server.to('chat-channel:' + channelId).emit('chat:updated', { channelId });
  }
}
