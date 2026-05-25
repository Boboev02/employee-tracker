import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      select: { id: true, deviceName: true, ipAddress: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(sessionId: string, userId: string) {
    await this.prisma.session.deleteMany({ where: { id: sessionId, userId } });
  }

  async revokeAllSessions(userId: string) {
    await this.prisma.session.deleteMany({ where: { userId } });
  }
}
