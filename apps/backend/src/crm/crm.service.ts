import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CrmService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== ЛИДЫ =====
  async getLeads(orgId: string, filters: any = {}) {
    const where: any = { orgId, deletedAt: null };
    if (filters.status) where.status = filters.status;
    if (filters.search) where.name = { contains: filters.search, mode: 'insensitive' };
    const take = Math.min(parseInt(filters.limit ?? '50'), 200);
    const skip = parseInt(filters.offset ?? '0');
    const [data, total] = await Promise.all([
      this.prisma.crmLead.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
      this.prisma.crmLead.count({ where }),
    ]);
    return { data, total, take, skip };
  }

  async createLead(orgId: string, userId: string, dto: any) {
    const lead = await this.prisma.crmLead.create({
      data: { orgId, name: dto.name, email: dto.email, phone: dto.phone, source: dto.source, ownerId: userId, notes: dto.notes, tags: dto.tags ?? [] },
    });
    await this.logActivity(orgId, userId, { leadId: lead.id, type: 'created', content: 'Лид создан' });
    return lead;
  }

  async updateLead(orgId: string, id: string, userId: string, dto: any) {
    const lead = await this.prisma.crmLead.findFirst({ where: { id, orgId } });
    if (!lead) throw new NotFoundException('Лид не найден');
    const updated = await this.prisma.crmLead.update({ where: { id }, data: { ...dto, updatedAt: new Date() } });
    if (dto.status && dto.status !== lead.status) {
      await this.logActivity(orgId, userId, { leadId: id, type: 'status_change', content: `${lead.status} → ${dto.status}` });
    }
    return updated;
  }

  async deleteLead(orgId: string, id: string) {
    await this.prisma.crmLead.update({ where: { id, orgId }, data: { deletedAt: new Date() } });
  }

  // ===== КОНТАКТЫ =====
  async getContacts(orgId: string, filters: any = {}) {
    const where: any = { orgId, deletedAt: null };
    if (filters.search) where.OR = [
      { firstName: { contains: filters.search, mode: 'insensitive' } },
      { lastName: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
    ];
    const take = Math.min(parseInt(filters.limit ?? '50'), 200);
    const skip = parseInt(filters.offset ?? '0');
    const [data, total] = await Promise.all([
      this.prisma.crmContact.findMany({
        where, orderBy: { createdAt: 'desc' }, take, skip,
        include: { company: { select: { id: true, name: true } }, _count: { select: { deals: true } } },
      }),
      this.prisma.crmContact.count({ where }),
    ]);
    return { data, total, take, skip };
  }

  async getContact(orgId: string, id: string) {
    const contact = await this.prisma.crmContact.findFirst({
      where: { id, orgId },
      include: {
        company: true,
        deals: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
        activities: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!contact) throw new NotFoundException('Контакт не найден');
    return contact;
  }

  async createContact(orgId: string, userId: string, dto: any) {
    const contact = await this.prisma.crmContact.create({
      data: { orgId, firstName: dto.firstName, lastName: dto.lastName, email: dto.email, phone: dto.phone, position: dto.position, companyId: dto.companyId, source: dto.source, ownerId: userId, notes: dto.notes, tags: dto.tags ?? [] },
    });
    await this.logActivity(orgId, userId, { contactId: contact.id, type: 'created', content: 'Контакт создан' });
    return contact;
  }

  async updateContact(orgId: string, id: string, userId: string, dto: any) {
    const contact = await this.prisma.crmContact.findFirst({ where: { id, orgId } });
    if (!contact) throw new NotFoundException('Контакт не найден');
    return this.prisma.crmContact.update({ where: { id }, data: { ...dto, updatedAt: new Date() } });
  }

  async deleteContact(orgId: string, id: string) {
    await this.prisma.crmContact.update({ where: { id, orgId }, data: { deletedAt: new Date() } });
  }

  // ===== КОМПАНИИ =====
  async getCompanies(orgId: string, filters: any = {}) {
    const where: any = { orgId, deletedAt: null };
    if (filters.search) where.name = { contains: filters.search, mode: 'insensitive' };
    const take = Math.min(parseInt(filters.limit ?? '50'), 200);
    const skip = parseInt(filters.offset ?? '0');
    const [data, total] = await Promise.all([
      this.prisma.crmCompany.findMany({
        where, orderBy: { createdAt: 'desc' }, take, skip,
        include: { _count: { select: { contacts: true, deals: true } } },
      }),
      this.prisma.crmCompany.count({ where }),
    ]);
    return { data, total, take, skip };
  }

  async getCompany(orgId: string, id: string) {
    const company = await this.prisma.crmCompany.findFirst({
      where: { id, orgId },
      include: {
        contacts: { where: { deletedAt: null } },
        deals: { where: { deletedAt: null }, orderBy: { createdAt: 'desc' } },
        activities: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!company) throw new NotFoundException('Компания не найдена');
    return company;
  }

  async createCompany(orgId: string, userId: string, dto: any) {
    return this.prisma.crmCompany.create({
      data: { orgId, name: dto.name, industry: dto.industry, website: dto.website, phone: dto.phone, email: dto.email, address: dto.address, ownerId: userId, tags: dto.tags ?? [] },
    });
  }

  async updateCompany(orgId: string, id: string, dto: any) {
    const company = await this.prisma.crmCompany.findFirst({ where: { id, orgId } });
    if (!company) throw new NotFoundException('Компания не найдена');
    return this.prisma.crmCompany.update({ where: { id }, data: { ...dto, updatedAt: new Date() } });
  }

  // ===== СДЕЛКИ =====
  async getDeals(orgId: string, filters: any = {}) {
    const where: any = { orgId, deletedAt: null };
    if (filters.stage) where.stage = filters.stage;
    if (filters.search) where.title = { contains: filters.search, mode: 'insensitive' };
    const take = Math.min(parseInt(filters.limit ?? '50'), 200);
    const skip = parseInt(filters.offset ?? '0');
    const [data, total] = await Promise.all([
      this.prisma.crmDeal.findMany({
        where, orderBy: { updatedAt: 'desc' }, take, skip,
        include: {
          contact: { select: { id: true, firstName: true, lastName: true } },
          company: { select: { id: true, name: true } },
          _count: { select: { tasks: { where: { deletedAt: null } } } },
        },
      }),
      this.prisma.crmDeal.count({ where }),
    ]);
    return { data, total, take, skip };
  }

  async getDeal(orgId: string, id: string) {
    const deal = await this.prisma.crmDeal.findFirst({
      where: { id, orgId },
      include: {
        contact: true,
        company: true,
        tasks: { where: { deletedAt: null }, include: { assignee: { select: { id: true, name: true, avatarUrl: true } } } },
        activities: { orderBy: { createdAt: 'desc' }, take: 30 },
      },
    });
    if (!deal) throw new NotFoundException('Сделка не найдена');
    return deal;
  }

  async createDeal(orgId: string, userId: string, dto: any) {
    const deal = await this.prisma.crmDeal.create({
      data: { orgId, title: dto.title, amount: dto.amount, currency: dto.currency ?? 'RUB', stage: dto.stage ?? 'NEW', probability: dto.probability ?? 0, contactId: dto.contactId, companyId: dto.companyId, ownerId: userId, source: dto.source, tags: dto.tags ?? [] },
    });
    await this.logActivity(orgId, userId, { dealId: deal.id, type: 'deal_created', content: 'Сделка создана' });
    return deal;
  }

  async updateDeal(orgId: string, id: string, userId: string, dto: any) {
    const deal = await this.prisma.crmDeal.findFirst({ where: { id, orgId } });
    if (!deal) throw new NotFoundException('Сделка не найдена');
    const updated = await this.prisma.crmDeal.update({ where: { id }, data: { ...dto, updatedAt: new Date() } });
    if (dto.stage && dto.stage !== deal.stage) {
      await this.logActivity(orgId, userId, { dealId: id, type: 'status_change', content: `Этап: ${deal.stage} → ${dto.stage}` });
    }
    return updated;
  }

  async deleteDeal(orgId: string, id: string) {
    await this.prisma.crmDeal.update({ where: { id, orgId }, data: { deletedAt: new Date() } });
  }

  // Канбан по сделкам
  async getDealsKanban(orgId: string) {
    const stages = ['NEW', 'QUALIFIED', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];
    const deals = await this.prisma.crmDeal.findMany({
      where: { orgId, deletedAt: null },
      include: { contact: { select: { id: true, firstName: true, lastName: true } }, company: { select: { id: true, name: true } } },
      orderBy: { updatedAt: 'desc' },
    });

    return stages.map(stage => ({
      stage,
      deals: deals.filter(d => d.stage === stage),
      total: deals.filter(d => d.stage === stage).reduce((sum, d) => sum + (d.amount ?? 0), 0),
    }));
  }

  // ===== АКТИВНОСТЬ =====
  async addActivity(orgId: string, userId: string, dto: any) {
    return this.logActivity(orgId, userId, dto);
  }

  private async logActivity(orgId: string, userId: string, data: any) {
    return this.prisma.crmActivity.create({
      data: { orgId, userId, type: data.type, content: data.content, contactId: data.contactId, companyId: data.companyId, dealId: data.dealId, leadId: data.leadId },
    }).catch(() => {});
  }
}
