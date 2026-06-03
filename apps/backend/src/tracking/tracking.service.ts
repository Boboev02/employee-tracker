import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TrackingService {
  private readonly logger = new Logger(TrackingService.name);

  constructor(private readonly prisma: PrismaService) {}

  async ingestBatch(user: any, payload: any) {
    // Проверяем статус сотрудника
    const dbUser = await this.prisma.user.findUnique({ where: { id: user.id }, select: { status: true } });
    if (dbUser?.status === 'SUSPENDED') {
      this.logger.warn(`[Tracking] Rejected events from suspended user ${user.id}`);
      return { received: 0, error: 'suspended' };
    }
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
    // TODO: update presence via PresenceService
    return { ok: true, ts: Date.now() };
  }

  async cleanupOldEvents(daysToKeep = 90) {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - daysToKeep);
    const result = await this.prisma.activityEvent.deleteMany({
      where: { createdAt: { lt: cutoff } },
    });
    this.logger.log(`Cleanup: deleted ${result.count} events older than ${daysToKeep} days`);
    return { deleted: result.count, cutoff };
  }

  async getRecentEvents(userId: string, orgId: string, limit = 100) {
    return this.prisma.activityEvent.findMany({
      where:   { userId, orgId },
      orderBy: { createdAt: 'desc' },
      take:    limit,
    });
  }
}
