import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { PrismaService } from '../prisma/prisma.service';

export type SessionStatus = 'working' | 'break' | 'finished' | null;

export interface WorkSession {
  userId:     string;
  status:     SessionStatus;
  startedAt:  number | null;  // timestamp ms
  breakAt:    number | null;
  finishedAt: number | null;
  totalBreakMs: number;
}

@Injectable()
export class WorkSessionService {
  constructor(
    @InjectRedis() private readonly redis: Redis,
    private readonly prisma: PrismaService,
  ) {}

  private key(userId: string) { return 'worksession:' + userId; }

  async getSession(userId: string): Promise<WorkSession> {
    const val = await this.redis.get(this.key(userId));
    if (!val) return { userId, status: null, startedAt: null, breakAt: null, finishedAt: null, totalBreakMs: 0 };
    return JSON.parse(val);
  }

  async startWork(userId: string, orgId: string): Promise<WorkSession> {
    // Не создаём дубль если уже working
    const existing = await this.getSession(userId);
    if (existing.status === 'working') return existing;
    const now = Date.now();
    const session: WorkSession = {
      userId, status: 'working',
      startedAt: now, breakAt: null, finishedAt: null, totalBreakMs: 0,
    };
    await this.redis.setex(this.key(userId), 86400, JSON.stringify(session));
    await this.logEvent(userId, orgId, 'work_start');
    return session;
  }

  async startBreak(userId: string, orgId: string): Promise<WorkSession> {
    const session = await this.getSession(userId);
    if (session.status !== 'working') return session;
    session.status  = 'break';
    session.breakAt = Date.now();
    await this.redis.setex(this.key(userId), 86400, JSON.stringify(session));
    await this.logEvent(userId, orgId, 'work_break_start');
    return session;
  }

  async endBreak(userId: string, orgId: string): Promise<WorkSession> {
    const session = await this.getSession(userId);
    if (session.status !== 'break') return session;
    const breakDuration = Date.now() - (session.breakAt ?? Date.now());
    session.totalBreakMs += breakDuration;
    session.status  = 'working';
    session.breakAt = null;
    await this.redis.setex(this.key(userId), 86400, JSON.stringify(session));
    await this.logEvent(userId, orgId, 'work_break_end');
    return session;
  }

  async finishWork(userId: string, orgId: string): Promise<WorkSession> {
    const session = await this.getSession(userId);
    if (!session.startedAt) return session;
    session.status     = 'finished';
    session.finishedAt = Date.now();
    if (session.breakAt) {
      session.totalBreakMs += Date.now() - session.breakAt;
      session.breakAt = null;
    }
    await this.redis.setex(this.key(userId), 86400, JSON.stringify(session));
    await this.logEvent(userId, orgId, 'work_end');

    // Save history to DB
    const workMs = session.finishedAt - session.startedAt - session.totalBreakMs;
    await this.prisma.activityEvent.create({
      data: {
        eventId: require('crypto').randomUUID(),
        batchId: require('crypto').randomUUID(),
        userId, orgId,
        eventType: 'work_session_summary',
        platform: 'OTHER',
        clientTimestamp: new Date(),
        platformData: {
          startedAt:    session.startedAt,
          finishedAt:   session.finishedAt,
          workMinutes:  Math.round(workMs / 60000),
          breakMinutes: Math.round(session.totalBreakMs / 60000),
          totalMinutes: Math.round((session.finishedAt - session.startedAt) / 60000),
        },
      },
    });

    return session;
  }

  async getOrgSessions(orgId: string): Promise<any[]> {
    // Get today's work_start/end events for all users in org
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const events = await this.prisma.activityEvent.findMany({
      where: {
        orgId,
        eventType: { in: ['work_start', 'work_break_start', 'work_break_end', 'work_end'] },
        createdAt: { gte: today },
      },
      orderBy: { createdAt: 'asc' },
    });

    const users = await this.prisma.user.findMany({
      where: { orgId, deletedAt: null },
      select: { id: true, name: true, email: true },
    });

    return Promise.all(users.map(async user => {
      const userEvents = events.filter(e => e.userId === user.id);
      const session = await this.getSession(user.id);

      const startEvent = userEvents.find(e => e.eventType === 'work_start');
      const endEvent   = [...userEvents].reverse().find(e => e.eventType === 'work_end');

      let workMinutes = 0;
      if (session.startedAt) {
        const end = session.finishedAt ?? Date.now();
        workMinutes = Math.round((end - session.startedAt - session.totalBreakMs) / 60000);
      }

      return {
        userId:      user.id,
        name:        user.name,
        email:       user.email,
        status:      session.status,
        startedAt:   startEvent ? new Date(startEvent.createdAt).toTimeString().slice(0,5) : null,
        finishedAt:  endEvent   ? new Date(endEvent.createdAt).toTimeString().slice(0,5)   : null,
        workMinutes: Math.max(0, workMinutes),
        breakMinutes: Math.round(session.totalBreakMs / 60000),
      };
    }));
  }

  private async logEvent(userId: string, orgId: string, eventType: string) {
    await this.prisma.activityEvent.create({
      data: {
        eventId:         require('crypto').randomUUID(),
        batchId:         require('crypto').randomUUID(),
        userId, orgId, eventType,
        platform:        'OTHER',
        clientTimestamp: new Date(),
      },
    });
  }
}
