import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const SLA_BY_PRIORITY: Record<string, number> = {
  LOW: 3 * 24 * 60, MEDIUM: 24 * 60, HIGH: 4 * 60, URGENT: 60,
};

@Injectable()
export class CrmCaseService {
  constructor(private readonly prisma: PrismaService) {}

  async getCases(orgId: string, filters: any = {}) {
    const where: any = { orgId };
    if (filters.status) where.status = filters.status;
    if (filters.assignedToId) where.assignedToId = filters.assignedToId;
    const cases = await this.prisma.crmCase.findMany({
      where,
      include: {
        contact: { select: { id: true, firstName: true, lastName: true } },
        company: { select: { id: true, name: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    return cases.map(c => ({ ...c, isOverdue: c.dueBy && c.status !== 'RESOLVED' && c.status !== 'CLOSED' && new Date(c.dueBy) < new Date() }));
  }

  async createCase(orgId: string, userId: string, dto: any) {
    const slaMinutes = dto.slaMinutes ?? SLA_BY_PRIORITY[dto.priority ?? 'MEDIUM'] ?? 1440;
    return this.prisma.crmCase.create({
      data: {
        orgId, createdById: userId,
        subject: dto.subject, description: dto.description,
        priority: dto.priority ?? 'MEDIUM',
        contactId: dto.contactId, companyId: dto.companyId, dealId: dto.dealId,
        assignedToId: dto.assignedToId,
        slaMinutes,
        dueBy: new Date(Date.now() + slaMinutes * 60000),
      },
    });
  }

  async updateCase(orgId: string, id: string, dto: any) {
    const kase = await this.prisma.crmCase.findFirst({ where: { id, orgId } });
    if (!kase) throw new NotFoundException('Обращение не найдено');
    const data: any = { ...dto };
    if (dto.status === 'RESOLVED' && kase.status !== 'RESOLVED') data.resolvedAt = new Date();
    return this.prisma.crmCase.update({ where: { id }, data });
  }

  async deleteCase(orgId: string, id: string) {
    await this.prisma.crmCase.delete({ where: { id } });
    return { ok: true };
  }

  async getStats(orgId: string) {
    const [open, overdue, resolvedToday] = await Promise.all([
      this.prisma.crmCase.count({ where: { orgId, status: { in: ['OPEN', 'IN_PROGRESS'] } } }),
      this.prisma.crmCase.count({ where: { orgId, status: { in: ['OPEN', 'IN_PROGRESS'] }, dueBy: { lt: new Date() } } }),
      this.prisma.crmCase.count({ where: { orgId, status: 'RESOLVED', resolvedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    ]);
    return { open, overdue, resolvedToday };
  }
}
