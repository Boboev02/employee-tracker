import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';

const CRM_STATUS_LABELS: Record<string, string> = {
  NEW: 'Новый', IN_PROGRESS: 'В работе', CONTACTED: 'Связались',
  RENEWED: 'Продлил', LOST: 'Потерян', ARCHIVED: 'В архиве',
};

const PLAN_RU: Record<string, string> = { TRIAL: 'Пробный', PRO: 'Профи', BUSINESS: 'Бизнес', NONE: 'Нет подписки' };

const FIELD_LABELS: Record<string, string> = {
  crmStatus: 'CRM статус', tags: 'Теги', managerId: 'Менеджер', plan: 'Тариф',
  planStatus: 'Статус подписки',
};

@Injectable()
export class SubscriberService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

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
    if (historyEntries.length) {
      await this.prisma.subscriberHistory.createMany({ data: historyEntries });
      const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } }).catch(() => null);
      for (const entry of historyEntries) {
        await this.audit.log({
          orgId, userId, userName: user?.name,
          action: `subscriber.${entry.field}.change`,
          category: 'subscribers',
          details: { subscriberId: id, subscriberName: `${sub.firstName} ${sub.lastName ?? ''}`.trim(), field: FIELD_LABELS[entry.field] ?? entry.field, oldValue: entry.oldValue, newValue: entry.newValue },
        }).catch(() => {});
      }
    }
    return updated;
  }

  // ─── Комментарии ─────────────────────────────────────────────────────────────

  async getComments(orgId: string, subscriberId: string) {
    const comments = await this.prisma.subscriberComment.findMany({
      where: { subscriberId, orgId },
      orderBy: { createdAt: 'desc' },
    });
    const authorIds = Array.from(new Set(comments.map(c => c.authorId)));
    const authors = await this.prisma.user.findMany({ where: { id: { in: authorIds } }, select: { id: true, name: true, avatarUrl: true } });
    const map = new Map(authors.map(a => [a.id, a]));
    return comments.map(c => ({ ...c, author: map.get(c.authorId) }));
  }

  async addComment(orgId: string, subscriberId: string, userId: string, content: string) {
    if (!content?.trim()) throw new BadRequestException('Комментарий не может быть пустым');
    const sub = await this.prisma.subscriber.findFirst({ where: { id: subscriberId, orgId } });
    if (!sub) throw new NotFoundException('Подписчик не найден');

    const comment = await this.prisma.subscriberComment.create({
      data: { subscriberId, orgId, authorId: userId, content: content.trim() },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } }).catch(() => null);
    await this.audit.log({
      orgId, userId, userName: user?.name,
      action: 'subscriber.comment.add',
      category: 'subscribers',
      details: { subscriberId, subscriberName: `${sub.firstName} ${sub.lastName ?? ''}`.trim(), content: content.trim().slice(0, 200) },
    }).catch(() => {});

    return { ...comment, author: user ? { name: user.name } : null };
  }

  async deleteComment(orgId: string, commentId: string) {
    const comment = await this.prisma.subscriberComment.findFirst({ where: { id: commentId, orgId } });
    if (!comment) throw new NotFoundException('Комментарий не найден');
    await this.prisma.subscriberComment.delete({ where: { id: commentId } });
    return { ok: true };
  }

  // ─── Этап 3: Коммуникации ────────────────────────────────────────────────────

  async getTemplates(orgId: string, channel?: string) {
    return this.prisma.messageTemplate.findMany({
      where: { orgId, ...(channel ? { channel } : {}) },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createTemplate(orgId: string, userId: string, dto: any) {
    if (!dto.name?.trim() || !dto.content?.trim()) throw new BadRequestException('Название и текст шаблона обязательны');
    return this.prisma.messageTemplate.create({
      data: { orgId, createdById: userId, name: dto.name.trim(), channel: dto.channel, subject: dto.subject, content: dto.content.trim() },
    });
  }

  async deleteTemplate(orgId: string, id: string) {
    await this.prisma.messageTemplate.deleteMany({ where: { id, orgId } });
    return { ok: true };
  }

  /** Подставляет переменные {firstName}, {plan} и т.д. в текст шаблона */
  interpolateTemplate(content: string, subscriber: any): string {
    return content.replace(/\{(\w+)\}/g, (_, key) => {
      if (key === 'plan') return PLAN_RU[subscriber.plan] ?? subscriber.plan ?? '';
      return subscriber[key] ?? '';
    });
  }

  async getCommunications(orgId: string, subscriberId: string) {
    const comms = await this.prisma.subscriberCommunication.findMany({
      where: { subscriberId, orgId }, orderBy: { createdAt: 'desc' },
    });
    const userIds = Array.from(new Set(comms.map(c => c.sentById).filter(Boolean))) as string[];
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true } });
    const map = new Map(users.map(u => [u.id, u]));
    return comms.map(c => ({ ...c, sentBy: c.sentById ? map.get(c.sentById) : null }));
  }

  /** Логирует факт коммуникации (клик "Открыть WhatsApp/Email/Telegram/Позвонить") */
  async logCommunication(orgId: string, subscriberId: string, userId: string, dto: { channel: string; content?: string; templateId?: string }) {
    const sub = await this.prisma.subscriber.findFirst({ where: { id: subscriberId, orgId } });
    if (!sub) throw new NotFoundException('Подписчик не найден');

    const comm = await this.prisma.subscriberCommunication.create({
      data: { subscriberId, orgId, channel: dto.channel, content: dto.content, templateId: dto.templateId, sentById: userId },
    });

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } }).catch(() => null);
    await this.audit.log({
      orgId, userId, userName: user?.name,
      action: `subscriber.communication.${dto.channel.toLowerCase()}`,
      category: 'subscribers',
      details: { subscriberId, subscriberName: `${sub.firstName} ${sub.lastName ?? ''}`.trim(), channel: dto.channel },
    }).catch(() => {});

    return comm;
  }

  // ─── Timeline (история + комментарии + коммуникации) ────────────────────────

  async getTimeline(orgId: string, subscriberId: string) {
    const [history, comments, communications] = await Promise.all([
      this.prisma.subscriberHistory.findMany({ where: { subscriberId, orgId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.subscriberComment.findMany({ where: { subscriberId, orgId }, orderBy: { createdAt: 'desc' } }),
      this.prisma.subscriberCommunication.findMany({ where: { subscriberId, orgId }, orderBy: { createdAt: 'desc' } }),
    ]);

    const userIds = Array.from(new Set([
      ...history.map(h => h.changedById).filter(Boolean),
      ...comments.map(c => c.authorId),
      ...communications.map(c => c.sentById).filter(Boolean),
    ])) as string[];
    const users = await this.prisma.user.findMany({ where: { id: { in: userIds } }, select: { id: true, name: true, avatarUrl: true } });
    const userMap = new Map(users.map(u => [u.id, u]));

    const historyEvents = history.map(h => ({
      type: 'history' as const,
      id: h.id,
      createdAt: h.createdAt,
      field: h.field,
      fieldLabel: FIELD_LABELS[h.field] ?? h.field,
      oldValue: h.oldValue,
      newValue: h.newValue,
      user: h.changedById ? userMap.get(h.changedById) : null,
      isSystem: !h.changedById,
    }));

    const commentEvents = comments.map(c => ({
      type: 'comment' as const,
      id: c.id,
      createdAt: c.createdAt,
      content: c.content,
      user: userMap.get(c.authorId),
      isSystem: false,
    }));

    const CHANNEL_ICONS: Record<string, string> = { EMAIL: '📧', WHATSAPP: '💬', TELEGRAM: '✈️', PHONE: '📞' };
    const commEvents = communications.map(c => ({
      type: 'communication' as const,
      id: c.id,
      createdAt: c.createdAt,
      channel: c.channel,
      channelIcon: CHANNEL_ICONS[c.channel] ?? '📨',
      content: c.content,
      user: c.sentById ? userMap.get(c.sentById) : null,
      isSystem: false,
    }));

    return [...historyEvents, ...commentEvents, ...commEvents].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
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
          const historyEntries: any[] = [];
          if (data.plan !== undefined && data.plan !== existing.plan) {
            historyEntries.push({ subscriberId: existing.id, orgId, field: 'plan', oldValue: JSON.stringify(existing.plan), newValue: JSON.stringify(data.plan), changedById: null });
          }
          if (data.planStatus !== undefined && data.planStatus !== existing.planStatus) {
            historyEntries.push({ subscriberId: existing.id, orgId, field: 'planStatus', oldValue: JSON.stringify(existing.planStatus), newValue: JSON.stringify(data.planStatus), changedById: null });
          }
          await this.prisma.subscriber.update({ where: { id: existing.id }, data });
          if (historyEntries.length) await this.prisma.subscriberHistory.createMany({ data: historyEntries });
          updated++;
        } else {
          await this.prisma.subscriber.create({ data: { orgId, externalId, externalSource: name, ...data } });
          created++;
        }
      }

      await this.audit.log({
        orgId, action: 'subscriber.sync', category: 'subscribers',
        details: { source: name, fetched: externalUsers.length, created, updated },
      }).catch(() => {});

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
