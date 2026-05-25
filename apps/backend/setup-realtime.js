const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

// ─── Backend: Presence service ────────────────────────────────
write('src/realtime/presence.service.ts', `import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

const PRESENCE_TTL = 65; // seconds

@Injectable()
export class PresenceService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  async setOnline(userId: string, orgId: string, data: any = {}) {
    const key = 'presence:v2:' + userId;
    const val = JSON.stringify({
      status: 'ONLINE', userId, orgId,
      lastActivityAt: Date.now(),
      todayActiveSecs: data.todayActiveSecs ?? 0,
      platform: data.platform,
      currentUrl: data.currentUrl,
      currentTitle: data.currentTitle,
    });
    await this.redis.setex(key, PRESENCE_TTL, val);
    await this.redis.sadd('pres:org:online:' + orgId, userId);
  }

  async setOffline(userId: string, orgId: string) {
    await this.redis.del('presence:v2:' + userId);
    await this.redis.srem('pres:org:online:' + orgId, userId);
  }

  async getPresence(userId: string) {
    const val = await this.redis.get('presence:v2:' + userId);
    if (!val) return { userId, status: 'OFFLINE', lastActivityAt: null };
    return JSON.parse(val);
  }

  async getOrgPresence(orgId: string) {
    const onlineIds = await this.redis.smembers('pres:org:online:' + orgId);
    if (!onlineIds.length) return {};

    const pipeline = this.redis.pipeline();
    onlineIds.forEach(id => pipeline.get('presence:v2:' + id));
    const results = await pipeline.exec();

    const presence: Record<string, any> = {};
    onlineIds.forEach((id, i) => {
      const val = results?.[i]?.[1];
      presence[id] = val ? JSON.parse(val as string) : { userId: id, status: 'OFFLINE' };
    });
    return presence;
  }
}
`);

// ─── Backend: Realtime gateway ────────────────────────────────
write('src/realtime/realtime.gateway.ts', `import {
  WebSocketGateway, WebSocketServer,
  SubscribeMessage, OnGatewayConnection, OnGatewayDisconnect,
  ConnectedSocket, MessageBody,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { JwtService } from '@nestjs/jwt';
import { PresenceService } from './presence.service';

@WebSocketGateway({ cors: { origin: '*' }, namespace: '/realtime' })
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
    if (!user) return;

    this.socketToUser.delete(socket.id);
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
`);

// ─── Backend: Realtime module ─────────────────────────────────
write('src/realtime/realtime.module.ts', `import { Module, Global } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { PresenceService } from './presence.service';

@Global()
@Module({
  providers: [RealtimeGateway, PresenceService],
  exports:   [RealtimeGateway, PresenceService],
})
export class RealtimeModule {}
`);

// ─── Presence API controller ──────────────────────────────────
write('src/realtime/presence.controller.ts', `import { Controller, Get, Query } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { CurrentUser } from '../auth/decorators/index';

@Controller('api/v1/presence')
export class PresenceController {
  constructor(private readonly presence: PresenceService) {}

  @Get()
  getOrgPresence(@CurrentUser() user: any) {
    return this.presence.getOrgPresence(user.orgId);
  }

  @Get('user')
  getUserPresence(@CurrentUser() user: any, @Query('userId') userId: string) {
    return this.presence.getPresence(userId ?? user.id);
  }
}
`);

// ─── Update realtime module with controller ───────────────────
write('src/realtime/realtime.module.ts', `import { Module, Global } from '@nestjs/common';
import { RealtimeGateway } from './realtime.gateway';
import { PresenceService } from './presence.service';
import { PresenceController } from './presence.controller';

@Global()
@Module({
  controllers: [PresenceController],
  providers:   [RealtimeGateway, PresenceService],
  exports:     [RealtimeGateway, PresenceService],
})
export class RealtimeModule {}
`);

// ─── Update app.module.ts ─────────────────────────────────────
write('src/app.module.ts', `import 'dotenv/config';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule }    from './prisma/prisma.module';
import { AuthModule }      from './auth/auth.module';
import { HealthModule }    from './health/health.module';
import { TasksModule }     from './tasks/tasks.module';
import { EmployeesModule } from './employees/employees.module';
import { RealtimeModule }  from './realtime/realtime.module';
import { JwtAuthGuard }    from './auth/guards/index';

@Module({
  imports: [PrismaModule, AuthModule, HealthModule, TasksModule, EmployeesModule, RealtimeModule],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
`);

console.log('\n✅ Realtime backend created');
