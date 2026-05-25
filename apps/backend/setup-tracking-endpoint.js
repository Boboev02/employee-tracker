const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

write('src/tracking/tracking.controller.ts', `import { Controller, Post, Body, HttpCode, Get } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { CurrentUser } from '../auth/decorators/index';
import { Public } from '../auth/decorators/index';

@Controller('api/v1/events')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Post('batch')
  @HttpCode(200)
  ingestBatch(@CurrentUser() user: any, @Body() body: any) {
    return this.tracking.ingestBatch(user, body);
  }

  @Post('heartbeat')
  @HttpCode(204)
  heartbeat(@CurrentUser() user: any, @Body() body: any) {
    return this.tracking.heartbeat(user, body);
  }
}
`);

write('src/tracking/tracking.service.ts', `import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ingestBatch(user: any, payload: any) {
    const events = payload.events ?? [];
    if (!events.length) return { received: 0 };

    const toCreate = events.map((e: any) => ({
      eventId:         e.eventId,
      batchId:         payload.batchId ?? 'unknown',
      userId:          user.id,
      orgId:           user.orgId,
      eventType:       e.eventType,
      platform:        e.platform ?? 'OTHER',
      url:             e.url?.slice(0, 2000),
      urlHash:         e.url ? Buffer.from(e.url).toString('base64').slice(0, 64) : null,
      pageTitle:       e.pageTitle?.slice(0, 500),
      platformData:    e.platformData ?? {},
      clientTimestamp: new Date(e.clientTimestamp ?? Date.now()),
    }));

    try {
      const result = await this.prisma.activityEvent.createMany({
        data:           toCreate,
        skipDuplicates: true,
      });

      this.logger.debug('Ingested ' + result.count + ' events from user ' + user.id);
      return { received: result.count };
    } catch (err) {
      this.logger.error('Ingest error: ' + (err as Error).message);
      return { received: 0 };
    }
  }

  async heartbeat(user: any, body: any) {
    // Update realtime status
    return { ok: true };
  }

  async getRecentEvents(userId: string, orgId: string, limit = 100) {
    return this.prisma.activityEvent.findMany({
      where:   { userId, orgId },
      orderBy: { createdAt: 'desc' },
      take:    limit,
    });
  }
}
`);

write('src/tracking/tracking.module.ts', `import { Module } from '@nestjs/common';
import { TrackingController } from './tracking.controller';
import { TrackingService }    from './tracking.service';
import { PrismaModule }       from '../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  controllers: [TrackingController],
  providers:   [TrackingService],
  exports:     [TrackingService],
})
export class TrackingModule {}
`);

write('src/app.module.ts', `import 'dotenv/config';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule }    from './prisma/prisma.module';
import { AuthModule }      from './auth/auth.module';
import { HealthModule }    from './health/health.module';
import { TasksModule }     from './tasks/tasks.module';
import { EmployeesModule } from './employees/employees.module';
import { RealtimeModule }  from './realtime/realtime.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { TrackingModule }  from './tracking/tracking.module';
import { JwtAuthGuard }    from './auth/guards/index';

@Module({
  imports: [
    PrismaModule, AuthModule, HealthModule,
    TasksModule, EmployeesModule, RealtimeModule,
    AnalyticsModule, TrackingModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
`);

console.log('\n✅ Tracking endpoint created');
