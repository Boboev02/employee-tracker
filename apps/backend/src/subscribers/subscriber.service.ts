import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const CRM_STATUS_LABELS: Record<string, string> = {
  NEW: 'Новый', IN_PROGRESS: 'В работе', CONTACTED: 'Связались',
  RENEWED: 'Продлил', LOST: 'Потерян', ARCHIVED: 'В архиве',
};

@Injectable()
export class SubscriberService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Список с поиском/фильтром/сортировкой/группировкой ────────────────────

  async getSubscribers(orgId: string, query: any = {}) {
    const where: any = { orgId, deletedAt: null };

    if (query.search) {
      const s = query.search.trim();
      where.OR = [
        { firstName: { contains: s, mode: 'insensitive' } },
        { lastName: { contains: s, mode: 'insensitive' } },
        { username: { contains: s, mode: 'insensitive' } },
        { email: { contains: s, mode: 'insensitive' } },
        { phone: { contains: s, mode: 'insensitive' } },
      ];
    }
    if (query.plan) where.plan = Array.isArray(query.plan) ? { in: query.plan } : query.plan;
    if (query.crmStatus) where.crmStatus = Array.isArray(query.crmStatus) ? { in: query.crmStatus } : query.crmStatus;
    if (query.managerId) where.managerId = query.managerId === 'unassigned' ? null : query.managerId;
    if (query.tag) where.tags = { has: query.tag };

    const take = Math.min(parseInt(query.limit ?? '50'), 500);
    const skip = parseInt(query.offset ?? '0');

    const sortField = ['firstName', 'plan', 'crmStatus', 'trialEndsAt', 'subscriptionEndsAt', 'createdAt', 'lastLoginAt'].includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';

    const [data, total] = await Promise.all([
      this.prisma.subscriber.findMany({
        where, orderBy: { [sortField]: sortDir }, take, skip,
        include: { manager: { select: { id: true, name: true, avatarUrl: true } } },
      }),
      this.prisma.subscriber.count({ where }),
    ]);

    return { data, total, take, skip };
  }

  /** Группировка (для UI) — считает количество по выбранному полю */
  async getGroupCounts(orgId: string, groupBy: 'plan' | 'crmStatus' | 'managerId') {
    const where = { orgId, deletedAt: null };
    if (groupBy === 'managerId') {
      const groups = await this.prisma.subscriber.groupBy({ by: ['managerId'], where, _count: true });
      const managerIds = groups.map(g => g.managerId).filter(Boolean) as string[];
      const managers = await this.prisma.user.findMany({ where: { id: { in: managerIds } }, select: { id: true, name: true } });
      const nameMap = new Map(managers.map(m => [m.id, m.name]));
      return groups.map(g => ({ key: g.managerId ?? 'unassigned', label: g.managerId ? (nameMap.get(g.managerId) ?? '—') : 'Без менеджера', count: g._count }));
    }
    const groups = await this.prisma.subscriber.groupBy({ by: [groupBy], where, _count: true });
    return groups.map(g => ({ key: (g as any)[groupBy] ?? 'none', label: groupBy === 'crmStatus' ? (CRM_STATUS_LABELS[(g as any)[groupBy]] ?? (g as any)[groupBy]) : ((g as any)[groupBy] ?? 'Без тарифа'), count: g._count }));
  }

  async getStats(orgId: string) {
    const where = { orgId, deletedAt: null };
    const [total, byPlan, trialEndingSoon, expiredRecently] = await Promise.all([
      this.prisma.subscriber.count({ where }),
      this.prisma.subscriber.groupBy({ by: ['plan'], where, _count: true }),
      this.prisma.subscriber.count({ where: { ...where, plan: 'TRIAL', trialEndsAt: { gte: new Date(), lte: new Date(Date.now() + 3 * 86400000) } } }),
      this.prisma.subscriber.count({ where: { ...where, planStatus: 'expired', OR: [{ trialEndsAt: { gte: new Date(Date.now() - 14 * 86400000) } }, { subscriptionEndsAt: { gte: new Date(Date.now() - 14 * 86400000) } }] } }),
    ]);
    return { total, byPlan: byPlan.map(p => ({ plan: p.plan ?? 'NONE', count: p._count })), trialEndingSoon, expiredRecently };
  }

  // ─── Карточка подписчика ────────────────────────────────────────────────────

  async getSubscriber(orgId: string, id: string) {
    const sub = await this.prisma.subscriber.findFirst({
      where: { id, orgId },
      include: {
        manager: { select: { id: true, name: true, avatarUrl: true } },
        history: { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
    if (!sub) throw new NotFoundException('Подписчик не найден');
    return sub;
  }

  async updateSubscriber(orgId: string, id: string, userId: string, dto: any) {
    const sub = await this.prisma.subscriber.findFirst({ where: { id, orgId } });
    if (!sub) throw new NotFoundException('Подписчик не найден');

    const trackedFields = ['crmStatus', 'tags', 'managerId', 'plan'];
    const historyEntries: any[] = [];
    for (const field of trackedFields) {
      if (dto[field] !== undefined && JSON.stringify(dto[field]) !== JSON.stringify((sub as any)[field])) {
        historyEntries.push({
          subscriberId: id, orgId, field,
          oldValue: JSON.stringify((sub as any)[field] ?? null),
          newValue: JSON.stringify(dto[field]),
          changedById: userId,
        });
      }
    }

    const updated = await this.prisma.subscriber.update({ where: { id }, data: { ...dto, updatedAt: new Date() } });
    if (historyEntries.length) await this.prisma.subscriberHistory.createMany({ data: historyEntries });
    return updated;
  }

  // ─── Синхронизация (Этап 1) ──────────────────────────────────────────────────

  async getIntegration(orgId: string, name = 'kingstats') {
    const integration = await this.prisma.subscriberIntegration.findUnique({ where: { orgId_name: { orgId, name } } });
    if (!integration) return null;
    return { ...integration, apiKey: integration.apiKey ? '••••••••' : null };
  }

  async saveIntegration(orgId: string, name: string, dto: any) {
    return this.prisma.subscriberIntegration.upsert({
      where: { orgId_name: { orgId, name } },
      update: {
        apiUrl: dto.apiUrl,
        ...(dto.apiKey && dto.apiKey !== '••••••••' ? { apiKey: dto.apiKey } : {}),
        displayName: dto.displayName, isActive: dto.isActive ?? true,
      },
      create: { orgId, name, displayName: dto.displayName ?? name, apiUrl: dto.apiUrl, apiKey: dto.apiKey, isActive: dto.isActive ?? false },
    });
  }

  /**
   * Запускает синхронизацию: создаёт новых подписчиков, обновляет существующих (по externalId),
   * исключает дубли через unique-constraint (orgId, externalSource, externalId).
   */
  async syncNow(orgId: string, name = 'kingstats') {
    const integration = await this.prisma.subscriberIntegration.findUnique({ where: { orgId_name: { orgId, name } } });
    if (!integration || !integration.apiUrl || !integration.apiKey) {
      throw new BadRequestException(`Интеграция "${name}" не настроена — укажите URL и API-ключ в настройках`);
    }

    try {
      const externalUsers = await this.fetchExternalSubscribers(integration.apiUrl, integration.apiKey);
      let created = 0, updated = 0;

      for (const u of externalUsers) {
        const externalId = String(u.id ?? u.username ?? u.email);
        if (!externalId) continue;

        const existing = await this.prisma.subscriber.findUnique({
          where: { orgId_externalSource_externalId: { orgId, externalSource: name, externalId } },
        });

        const data = {
          username: u.username, firstName: u.name ?? u.username ?? 'Без имени', email: u.email, phone: u.phone,
          externalRole: u.role, plan: u.plan, planStatus: u.planStatus,
          trialEndsAt: u.trialEndsAt ? new Date(u.trialEndsAt) : null,
          subscriptionEndsAt: u.subscriptionEndsAt ? new Date(u.subscriptionEndsAt) : null,
          registeredAt: u.createdAt ? new Date(u.createdAt) : undefined,
          lastLoginAt: u.lastLoginAt ? new Date(u.lastLoginAt) : null,
          lastSyncAt: new Date(),
        };

        if (existing) {
          await this.prisma.subscriber.update({ where: { id: existing.id }, data });
          updated++;
        } else {
          await this.prisma.subscriber.create({ data: { orgId, externalId, externalSource: name, ...data } });
          created++;
        }
      }

      await this.prisma.subscriberIntegration.update({
        where: { orgId_name: { orgId, name } },
        data: { lastSyncAt: new Date(), lastSyncStatus: 'SUCCESS', lastSyncMessage: `Создано ${created}, обновлено ${updated}`, totalFetched: externalUsers.length, totalCreated: created, totalUpdated: updated },
      });
      return { ok: true, fetched: externalUsers.length, created, updated };
    } catch (e: any) {
      await this.prisma.subscriberIntegration.update({
        where: { orgId_name: { orgId, name } },
        data: { lastSyncAt: new Date(), lastSyncStatus: 'ERROR', lastSyncMessage: e.message },
      });
      throw e;
    }
  }

  /**
   * ⚠️ ЗАГЛУШКА — заменить на реальный вызов при подключении API KingStats.
   * Ожидаемый формат: { users: [{ id, username, email, name, phone, role, plan, planStatus, trialEndsAt, subscriptionEndsAt, createdAt, lastLoginAt }] }
   */
  private async fetchExternalSubscribers(apiUrl: string, apiKey: string): Promise<any[]> {
    const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) throw new Error(`API вернул ${res.status}`);
    const data = await res.json();
    return data.users ?? data.subscribers ?? [];
  }
}
