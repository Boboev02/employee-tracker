import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CrmDocumentService {
  constructor(private readonly prisma: PrismaService) {}

  async getDocuments(orgId: string, dealId?: string) {
    return this.prisma.crmDocument.findMany({
      where: { orgId, ...(dealId ? { dealId } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDocument(orgId: string, userId: string, dto: any) {
    const items = (dto.items ?? []) as { name: string; qty: number; price: number }[];
    const totalAmount = items.reduce((sum, it) => sum + it.qty * it.price, 0);
    const prefix = dto.type === 'INVOICE' ? 'СЧ' : 'КП';
    const count = await this.prisma.crmDocument.count({ where: { orgId, type: dto.type } });
    const number = `${prefix}-${String(count + 1).padStart(4, '0')}`;

    return this.prisma.crmDocument.create({
      data: {
        orgId, createdById: userId,
        dealId: dto.dealId, type: dto.type, number,
        items: items.map(it => ({ ...it, total: it.qty * it.price })),
        totalAmount, currency: dto.currency ?? 'RUB',
        status: 'DRAFT',
        companyRequisites: dto.companyRequisites ?? null,
        clientInfo: dto.clientInfo ?? null,
      },
    });
  }

  async updateDocumentStatus(orgId: string, id: string, status: string) {
    const doc = await this.prisma.crmDocument.findFirst({ where: { id, orgId } });
    if (!doc) throw new NotFoundException('Документ не найден');
    return this.prisma.crmDocument.update({ where: { id }, data: { status } });
  }

  async deleteDocument(orgId: string, id: string) {
    await this.prisma.crmDocument.delete({ where: { id } });
    return { ok: true };
  }
}
