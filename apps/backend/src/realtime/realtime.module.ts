import { Module, Global } from '@nestjs/common';
import { RedisModule } from '@nestjs-modules/ioredis';
import { RealtimeGateway } from './realtime.gateway';
import { PresenceService } from './presence.service';
import { PresenceController } from './presence.controller';

@Global()
@Module({
  imports: [
    RedisModule.forRootAsync({
      useFactory: () => ({
        type: 'single',
        url: process.env.REDIS_URL ?? 'redis://localhost:6379',
      }),
    }),
  ],
  controllers: [PresenceController],
  providers:   [RealtimeGateway, PresenceService],
  exports:     [RealtimeGateway, PresenceService],
})
export class RealtimeModule {}
