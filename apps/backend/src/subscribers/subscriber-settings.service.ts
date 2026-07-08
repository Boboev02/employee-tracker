import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const DEFAULT_STATUSES = [
  { key: 'NEW', label: 'Новый', color: '#7F77DD', sortOrder: 0 },
  { key: 'IN_PROGRESS', label: 'В работе', color: '#2563EB', sortOrder: 1 },
  { key: 'CONTACTED', label: 'Связались', color: '#D97706', sortOrder: 2 },
  { key: 'RENEWED', label: 'Продлил', color: '#16A34A', sortOrder: 3 },
  { key: 'LOST', label: 'Потерян', color: '#DC2626', sortOrder: 4 },
  { key: 'ARCHIVED', label: 'В архиве', color: '#6B7280', sortOrder: 5 },
];

@Injectable()
export class SubscriberSettingsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── CRM-статусы (заменяет хардкод STATUS_LABELS) ────────────────────────────

  async getStatuses(orgId: string) {
    const existing = await this.prisma.subscriberCrmStatusDef.findMany({ where: { orgId }, orderBy: { sortOrder: 'asc' } });
    if (existing.length > 0) return existing;
    // Первый запрос — засеиваем статусы по умолчанию, дальше администратор может менять
    await this.prisma.subscriberCrmStatusDef.createMany({
      data: DEFAULT_STATUSES.map(s => ({ orgId, ...s })),
    });
    return this.prisma.subscriberCrmStatusDef.findMany({ where: { orgId }, orderBy: { sortOrder: 'asc' } });
  }

  async createStatus(orgId: string, dto: { key: string; label: string; color?: string }) {
    const count = await this.prisma.subscriberCrmStatusDef.count({ where: { orgId } });
    return this.prisma.subscriberCrmStatusDef.create({
      data: { orgId, key: dto.key.toUpperCase().replace(/\s+/g, '_'), label: dto.label, color: dto.color ?? '#7F77DD', sortOrder: count },
    });
  }

  async deleteStatus(orgId: string, id: string) {
    await this.prisma.subscriberCrmStatusDef.deleteMany({ where: { id, orgId } });
    return { ok: true };
  }

  // ─── Каталог тегов ───────────────────────────────────────────────────────────

  async getTags(orgId: string) {
    return this.prisma.subscriberTagDef.findMany({ where: { orgId }, orderBy: { name: 'asc' } });
  }

  async createTag(orgId: string, name: string, color?: string) {
    return this.prisma.subscriberTagDef.upsert({
      where: { orgId_name: { orgId, name } },
      update: {},
      create: { orgId, name, color: color ?? '#7F77DD' },
    });
  }

  async deleteTag(orgId: string, id: string) {
    await this.prisma.subscriberTagDef.deleteMany({ where: { id, orgId } });
    return { ok: true };
  }

  // ─── Причины отказа ──────────────────────────────────────────────────────────

  async getCancelReasons(orgId: string) {
    return this.prisma.subscriberCancelReasonDef.findMany({ where: { orgId }, orderBy: { createdAt: 'asc' } });
  }

  async createCancelReason(orgId: string, label: string) {
    return this.prisma.subscriberCancelReasonDef.create({ data: { orgId, label } });
  }

  async deleteCancelReason(orgId: string, id: string) {
    await this.prisma.subscriberCancelReasonDef.deleteMany({ where: { id, orgId } });
    return { ok: true };
  }

  // ─── Сохранённые представления (Views) ──────────────────────────────────────

  async getSavedViews(orgId: string, userId: string) {
    return this.prisma.subscriberSavedView.findMany({ where: { orgId, userId }, orderBy: { createdAt: 'desc' } });
  }

  async createSavedView(orgId: string, userId: string, name: string, filters: any) {
    return this.prisma.subscriberSavedView.create({ data: { orgId, userId, name, filters } });
  }

  async deleteSavedView(orgId: string, userId: string, id: string) {
    await this.prisma.subscriberSavedView.deleteMany({ where: { id, orgId, userId } });
    return { ok: true };
  }
}
