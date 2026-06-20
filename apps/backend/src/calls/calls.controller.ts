import { Controller, Post, Get, Body, Param, NotFoundException, ForbiddenException } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/index';
import { v4 as uuidv4 } from 'uuid';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { AuditService } from '../audit/audit.service';

@Controller('api/v1/calls')
export class CallsController {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly audit: AuditService,
  ) {}

  private roomKey(roomId: string) { return 'call:room:' + roomId; }

  @Post('create')
  async createRoom(@CurrentUser() user: any, @Body() body: { title?: string }) {
    const roomId = uuidv4();
    const room = {
      roomId,
      title: body?.title ?? 'Видеозвонок',
      orgId: user.orgId,
      createdBy: user.sub,
      createdAt: Date.now(),
    };
    // Комната живёт 24 часа в Redis
    await this.redis.set(this.roomKey(roomId), JSON.stringify(room), 'EX', 60 * 60 * 24);
    this.audit.log({ orgId: user.orgId, userId: user.sub, userName: user.name ?? user.email, action: 'call.create', category: 'calls', details: { roomId, title: room.title } });
    return { ...room, url: `/dashboard/calls/${roomId}` };
  }

  @Get(':roomId/check')
  async checkAccess(@CurrentUser() user: any, @Param('roomId') roomId: string) {
    const raw = await this.redis.get(this.roomKey(roomId));
    if (!raw) {
      throw new NotFoundException('Звонок не найден или истёк (комнаты живут 24 часа)');
    }
    const room = JSON.parse(raw);
    if (room.orgId !== user.orgId) {
      throw new ForbiddenException('У вас нет доступа к этому звонку');
    }
    return { ok: true, title: room.title };
  }
}
