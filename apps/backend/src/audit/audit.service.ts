import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async log(params: {
    orgId: string;
    userId?: string;
    userName?: string;
    action: string;
    category: string;
    details?: Record<string, any>;
    ipAddress?: string;
    userAgent?: string;
  }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          orgId: params.orgId,
          userId: params.userId,
          userName: params.userName,
          action: params.action,
          category: params.category,
          details: params.details ? JSON.stringify(params.details) : null,
          ipAddress: params.ipAddress,
          userAgent: params.userAgent,
        },
      });
    } catch (e) {
      // Логирование не должно ломать основной функционал — просто выводим в консоль
      console.error('[AuditService] Failed to log action:', e);
    }
  }
}
