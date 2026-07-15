import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { SubscriberAutomationService } from './subscriber-automation.service';
import { NotificationService } from '../notifications/notification.service';
import { Client as PgClient } from 'pg';

const CRM_STATUS_LABELS: Record<string, string> = {
  NEW: 'Новый', IN_PROGRESS: 'В работе', CONTACTED: 'Связались',
  RENEWED: 'Продлил', LOST: 'Потерян', ARCHIVED: 'В архиве',
};

const PLAN_RU: Record<string, string> = { TRIAL: 'Пробный', START: 'Старт', PRO: 'Профи', BUSINESS: 'Бизнес', EXPERT: 'Эксперт', NONE: 'Нет подписки' };

const FIELD_LABELS: Record<string, string> = {
  crmStatus: 'CRM статус', tags: 'Теги', managerId: 'Менеджер', plan: 'Тариф',
  planStatus: 'Статус подписки',
};

@Injectable()
export class SubscriberService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly automation: SubscriberAutomationService,
    private readonly notifications: NotificationService,
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
    if (query.crmStatus) {
      where.crmStatus = Array.isArray(query.crmStatus) ? { in: query.crmStatus } : query.crmStatus;
    } else if (query.includeArchived !== 'true') {
      // По умолчанию архивные подписчики скрыты из основного списка — доступны через отдельный эндпоинт /subscribers/archived
      where.crmStatus = { not: 'ARCHIVED' };
    }
    if (query.managerId) where.managerId = query.managerId === 'unassigned' ? null : query.managerId;
    if (query.tag) where.tags = { has: query.tag };

    const take = Math.min(parseInt(query.limit ?? '50'), 500);
    const skip = parseInt(query.offset ?? '0');

    const sortField = ['firstName', 'plan', 'crmStatus', 'trialEndsAt', 'subscriptionEndsAt', 'createdAt', 'lastLoginAt'].includes(query.sortBy) ? query.sortBy : 'createdAt';
    const sortDir = query.sortDir === 'asc' ? 'asc' : 'desc';

    const [data, total] = await Promise.all([
      this.prisma.subscriber.findMany({
        where, orderBy: { [sortField]: sortDir }, take, skip,
        include: {
          manager: { select: { id: true, name: true, avatarUrl: true } },
          _count: { select: { comments: true, history: true } },
        },
      }),
      this.prisma.subscriber.count({ where }),
    ]);

    return { data, total, take, skip };
  }

  /** Счётчики по CRM-статусам для вкладок-фильтров (архивные считаются отдельно) */
  async getStatusCounts(orgId: string) {
    const baseWhere = { orgId, deletedAt: null };
    const [total, ...statusCounts] = await Promise.all([
      this.prisma.subscriber.count({ where: { ...baseWhere, crmStatus: { not: 'ARCHIVED' } } }),
      ...Object.keys(CRM_STATUS_LABELS).filter(s => s !== 'ARCHIVED').map(status =>
        this.prisma.subscriber.count({ where: { ...baseWhere, crmStatus: status } }).then(count => ({ status, count })),
      ),
    ]);
    const archived = await this.prisma.subscriber.count({ where: { ...baseWhere, crmStatus: 'ARCHIVED' } });
    return { total, byStatus: statusCounts, archived };
  }

  /** Список архивных подписчиков — отдельное окно, по аналогии с Корзиной */
  async getArchived(orgId: string) {
    return this.prisma.subscriber.findMany({
      where: { orgId, deletedAt: null, crmStatus: 'ARCHIVED' },
      orderBy: { updatedAt: 'desc' },
      include: { manager: { select: { id: true, name: true, avatarUrl: true } } },
    });
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
        await this.automation.onFieldChanged(orgId, updated, entry.field, JSON.parse(entry.oldValue ?? 'null'), JSON.parse(entry.newValue ?? 'null')).catch(() => {});
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

  // ─── Этап 6: Интеграция с задачами ──────────────────────────────────────────

  async getLinkedTasks(orgId: string, subscriberId: string) {
    return this.prisma.task.findMany({
      where: { orgId, subscriberId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
      include: { assignee: { select: { id: true, name: true, avatarUrl: true } } },
    });
  }

  // ─── Этап 11: Корзина (мягкое удаление + восстановление) ─────────────────────

  async softDelete(orgId: string, id: string, userId: string) {
    const sub = await this.prisma.subscriber.findFirst({ where: { id, orgId, deletedAt: null } });
    if (!sub) throw new NotFoundException('Подписчик не найден');
    await this.prisma.subscriber.update({ where: { id }, data: { deletedAt: new Date() } });
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } }).catch(() => null);
    await this.audit.log({
      orgId, userId, userName: user?.name, action: 'subscriber.delete', category: 'subscribers',
      details: { subscriberId: id, subscriberName: `${sub.firstName} ${sub.lastName ?? ''}`.trim() },
    }).catch(() => {});
    return { ok: true };
  }

  async getTrash(orgId: string) {
    return this.prisma.subscriber.findMany({ where: { orgId, deletedAt: { not: null } }, orderBy: { deletedAt: 'desc' } });
  }

  async restore(orgId: string, id: string, userId: string) {
    const sub = await this.prisma.subscriber.findFirst({ where: { id, orgId, deletedAt: { not: null } } });
    if (!sub) throw new NotFoundException('Подписчик не найден в корзине');
    await this.prisma.subscriber.update({ where: { id }, data: { deletedAt: null } });
    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } }).catch(() => null);
    await this.audit.log({
      orgId, userId, userName: user?.name, action: 'subscriber.restore', category: 'subscribers',
      details: { subscriberId: id, subscriberName: `${sub.firstName} ${sub.lastName ?? ''}`.trim() },
    }).catch(() => {});
    return { ok: true };
  }

  async permanentlyDelete(orgId: string, id: string) {
    await this.prisma.subscriber.deleteMany({ where: { id, orgId, deletedAt: { not: null } } });
    return { ok: true };
  }

  // ─── Этап 8: Массовые операции ───────────────────────────────────────────────

  async bulkUpdateStatus(orgId: string, userId: string, ids: string[], crmStatus: string) {
    for (const id of ids) await this.updateSubscriber(orgId, id, userId, { crmStatus }).catch(() => {});
    return { ok: true, count: ids.length };
  }

  async bulkAssignManager(orgId: string, userId: string, ids: string[], managerId: string | null) {
    for (const id of ids) await this.updateSubscriber(orgId, id, userId, { managerId }).catch(() => {});
    return { ok: true, count: ids.length };
  }

  async bulkAddTag(orgId: string, userId: string, ids: string[], tag: string) {
    const subs = await this.prisma.subscriber.findMany({ where: { id: { in: ids }, orgId } });
    for (const s of subs) {
      if (!(s.tags ?? []).includes(tag)) await this.updateSubscriber(orgId, s.id, userId, { tags: [...(s.tags ?? []), tag] }).catch(() => {});
    }
    return { ok: true, count: subs.length };
  }

  async bulkRemoveTag(orgId: string, userId: string, ids: string[], tag: string) {
    const subs = await this.prisma.subscriber.findMany({ where: { id: { in: ids }, orgId } });
    for (const s of subs) {
      if ((s.tags ?? []).includes(tag)) await this.updateSubscriber(orgId, s.id, userId, { tags: (s.tags ?? []).filter(t => t !== tag) }).catch(() => {});
    }
    return { ok: true, count: subs.length };
  }

  async bulkArchive(orgId: string, userId: string, ids: string[]) {
    return this.bulkUpdateStatus(orgId, userId, ids, 'ARCHIVED');
  }

  async bulkCreateTasks(orgId: string, userId: string, ids: string[], dto: { title: string; projectId: string; assigneeId: string; departmentId?: string; priority?: string; dueInDays?: number }) {
    let created = 0;
    for (const id of ids) {
      await this.prisma.task.create({
        data: {
          orgId, createdById: userId, title: dto.title, subscriberId: id,
          projectId: dto.projectId, assigneeId: dto.assigneeId, departmentId: dto.departmentId,
          priority: dto.priority ?? 'MEDIUM', status: 'NEW',
          dueDate: dto.dueInDays ? new Date(Date.now() + dto.dueInDays * 86400000) : undefined,
        },
      }).catch(() => {});
      created++;
    }
    return { ok: true, created };
  }

  async bulkLogCommunication(orgId: string, userId: string, ids: string[], channel: string, content: string) {
    for (const id of ids) await this.logCommunication(orgId, id, userId, { channel, content }).catch(() => {});
    return { ok: true, count: ids.length };
  }

  async bulkExportCsv(orgId: string, ids?: string[]) {
    const where: any = { orgId, deletedAt: null };
    if (ids && ids.length > 0) where.id = { in: ids };
    const subs = await this.prisma.subscriber.findMany({ where, include: { manager: { select: { name: true } } } });
    const headers = ['Имя', 'Фамилия', 'Email', 'Телефон', 'Тариф', 'CRM статус', 'Менеджер', 'Триал до', 'Подписка до', 'Теги'];
    const rows = subs.map(s => [
      s.firstName ?? '', s.lastName ?? '', s.email ?? '', s.phone ?? '', s.plan ?? '', s.crmStatus,
      s.manager?.name ?? '', s.trialEndsAt?.toISOString().slice(0, 10) ?? '', s.subscriptionEndsAt?.toISOString().slice(0, 10) ?? '',
      (s.tags ?? []).join(';'),
    ]);
    const csv = [headers, ...rows].map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n');
    return '\uFEFF' + csv; // BOM для корректной кодировки в Excel
  }

  /** Группирует подписчиков по срокам до окончания триала/подписки */
  // ─── Этап 5: Центр напоминаний ───────────────────────────────────────────────

  async getReminders(orgId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const tomorrowEnd = new Date(todayStart.getTime() + 2 * 86400000);
    const in3DaysEnd = new Date(todayStart.getTime() + 4 * 86400000);
    const inWeekEnd = new Date(todayStart.getTime() + 8 * 86400000);
    const inMonthEnd = new Date(todayStart.getTime() + 31 * 86400000);

    const relevantDateWhere = (gte: Date, lt: Date) => ({
      OR: [{ trialEndsAt: { gte, lt } }, { subscriptionEndsAt: { gte, lt } }],
    });

    const include = { manager: { select: { id: true, name: true } } };
    const baseWhere = { orgId, deletedAt: null };

    const [today, tomorrow, in3Days, inWeek, inMonth, overdue] = await Promise.all([
      this.prisma.subscriber.findMany({ where: { ...baseWhere, ...relevantDateWhere(todayStart, todayEnd) }, include }),
      this.prisma.subscriber.findMany({ where: { ...baseWhere, ...relevantDateWhere(todayEnd, tomorrowEnd) }, include }),
      this.prisma.subscriber.findMany({ where: { ...baseWhere, ...relevantDateWhere(tomorrowEnd, in3DaysEnd) }, include }),
      this.prisma.subscriber.findMany({ where: { ...baseWhere, ...relevantDateWhere(in3DaysEnd, inWeekEnd) }, include }),
      this.prisma.subscriber.findMany({ where: { ...baseWhere, ...relevantDateWhere(inWeekEnd, inMonthEnd) }, include }),
      this.prisma.subscriber.findMany({
        where: { ...baseWhere, crmStatus: { notIn: ['LOST', 'ARCHIVED'] }, OR: [{ trialEndsAt: { lt: todayStart } }, { subscriptionEndsAt: { lt: todayStart } }] },
        include,
      }),
    ]);

    return { today, tomorrow, in3Days, inWeek, inMonth, overdue };
  }

  async getRemindersSummary(orgId: string) {
    const r = await this.getReminders(orgId);
    return {
      today: r.today.length, tomorrow: r.tomorrow.length, in3Days: r.in3Days.length,
      inWeek: r.inWeek.length, inMonth: r.inMonth.length, overdue: r.overdue.length,
      total: r.today.length + r.tomorrow.length + r.in3Days.length + r.inWeek.length + r.inMonth.length + r.overdue.length,
    };
  }

  /** Ежедневная сводка — отправляет уведомление каждому менеджеру с количеством ЕГО подписчиков, требующих внимания */
  async sendDailySummary(orgId: string) {
    const reminders = await this.getReminders(orgId);
    const allRelevant = [...reminders.today, ...reminders.tomorrow, ...reminders.overdue];
    const withManager = allRelevant.filter(s => s.managerId);
    for (const s of withManager) {
      const name = `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim() || s.email || 'Подписчик';
      const dateField = s.trialEndsAt ?? s.subscriptionEndsAt;
      const isOverdue = dateField && new Date(dateField) < new Date();
      const reason = isOverdue ? 'просрочен срок подписки' : 'истекает срок сегодня/завтра';
      await this.notifications.create(
        s.managerId!, orgId, 'subscriber_daily_summary',
        `📊 ${name} — требует внимания`,
        `Причина: ${reason}. Тариф: ${s.plan ?? '—'}. Свяжитесь для уточнения продления.`,
        undefined, s.id,
      ).catch(() => {});
    }
    const managerIds = new Set(withManager.map(s => s.managerId));
    return { ok: true, notifiedManagers: managerIds.size, totalUrgent: allRelevant.length };
  }

  async getIntegration(orgId: string, name = 'kingstats') {
    const integration = await this.prisma.subscriberIntegration.findUnique({ where: { orgId_name: { orgId, name } } });
    if (!integration) return null;
    // Маскируем пароль внутри connectionString, но сохраняем видимость host/port/db для UI
    let maskedConnStr = integration.dbConnectionString;
    if (maskedConnStr) {
      maskedConnStr = maskedConnStr.replace(/:\/\/([^:]+):([^@]+)@/, '://$1:••••••••@');
    }
    return { ...integration, apiKey: integration.apiKey ? '••••••••' : null, dbConnectionString: maskedConnStr };
  }

  async saveIntegration(orgId: string, name: string, dto: any) {
    // Если пришла маскированная строка (пользователь не менял пароль) — не перезаписываем реальное значение
    const isMaskedConnStr = dto.dbConnectionString?.includes('••••••••');
    return this.prisma.subscriberIntegration.upsert({
      where: { orgId_name: { orgId, name } },
      update: {
        apiUrl: dto.apiUrl,
        ...(dto.apiKey && dto.apiKey !== '••••••••' ? { apiKey: dto.apiKey } : {}),
        ...(dto.connectionType ? { connectionType: dto.connectionType } : {}),
        ...(dto.dbConnectionString && !isMaskedConnStr ? { dbConnectionString: dto.dbConnectionString } : {}),
        displayName: dto.displayName, isActive: dto.isActive ?? true,
      },
      create: {
        orgId, name, displayName: dto.displayName ?? name,
        connectionType: dto.connectionType ?? 'API',
        apiUrl: dto.apiUrl, apiKey: dto.apiKey,
        dbConnectionString: isMaskedConnStr ? null : dto.dbConnectionString,
        isActive: dto.isActive ?? false,
      },
    });
  }

  /**
   * Запускает синхронизацию: создаёт новых подписчиков, обновляет существующих (по externalId),
   * исключает дубли через unique-constraint (orgId, externalSource, externalId).
   * Поддерживает два типа подключения: API (HTTP) и DATABASE (прямой PostgreSQL, только чтение).
   */
  async syncNow(orgId: string, name = 'kingstats') {
    const integration = await this.prisma.subscriberIntegration.findUnique({ where: { orgId_name: { orgId, name } } });
    if (!integration) throw new BadRequestException(`Интеграция "${name}" не настроена`);
    if (integration.connectionType === 'DATABASE' && !integration.dbConnectionString) {
      throw new BadRequestException(`Не указана строка подключения к БД для "${name}"`);
    }
    if (integration.connectionType === 'API' && (!integration.apiUrl || !integration.apiKey)) {
      throw new BadRequestException(`Интеграция "${name}" не настроена — укажите URL и API-ключ в настройках`);
    }

    try {
      const externalUsers = integration.connectionType === 'DATABASE'
        ? await this.fetchFromDatabase(integration.dbConnectionString!)
        : await this.fetchExternalSubscribers(integration.apiUrl!, integration.apiKey!);
      let created = 0, updated = 0;

      for (const u of externalUsers) {
        // externalId: используем username как уникальный ключ (у KingStats нет отдельного числового id в представлении)
        const externalId = String(u.id ?? u.username ?? u.email);
        if (!externalId) continue;

        const existing = await this.prisma.subscriber.findUnique({
          where: { orgId_externalSource_externalId: { orgId, externalSource: name, externalId } },
        });

        const data = {
          username: u.username, firstName: u.name ?? u.username ?? 'Без имени', email: u.email, phone: u.phone,
          externalRole: u.role, plan: u.plan, planStatus: u.planStatus,
          trialEndsAt: u.isTrial && u.activeUntil ? new Date(u.activeUntil) : null,
          subscriptionEndsAt: !u.isTrial && u.activeUntil ? new Date(u.activeUntil) : null,
          registeredAt: u.registeredAt ? new Date(u.registeredAt) : undefined,
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
          const updatedSub = await this.prisma.subscriber.update({ where: { id: existing.id }, data });
          if (historyEntries.length) {
            await this.prisma.subscriberHistory.createMany({ data: historyEntries });
            for (const entry of historyEntries) {
              await this.automation.onFieldChanged(orgId, updatedSub, entry.field, existing[entry.field as keyof typeof existing], (data as any)[entry.field]).catch(() => {});
            }
          }
          updated++;
        } else {
          const createdSub = await this.prisma.subscriber.create({ data: { orgId, externalId, externalSource: name, ...data } });
          await this.automation.onRegister(orgId, createdSub).catch(() => {});
          created++;
        }
      }

      await this.audit.log({
        orgId, action: 'subscriber.sync', category: 'subscribers',
        details: { source: name, connectionType: integration.connectionType, fetched: externalUsers.length, created, updated },
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
   * Прямое чтение из БД KingStats (только SELECT, только view reporting.users_overview).
   * Подключение идёт через SSH-туннель, поднятый на хосте (autossh), поэтому connectionString
   * должен указывать на host.docker.internal (или gateway-IP), а не localhost/127.0.0.1 —
   * иначе контейнер backend будет пытаться достучаться сам до себя.
   */
  private async fetchFromDatabase(connectionString: string): Promise<any[]> {
    const client = new PgClient({ connectionString, connectionTimeoutMillis: 8000 });
    try {
      await client.connect();
      const res = await client.query(`
        SELECT username, email, name, phone, plan_code, plan_label,
               is_trial, active_until, subscription_active, days_left, registered_at, role
        FROM reporting.users_overview
      `);
      return res.rows.map((r: any) => ({
        username: r.username,
        email: r.email,
        name: r.name,
        phone: r.phone,
        plan: this.mapPlanCode(r.plan_code, r.is_trial),
        planStatus: r.subscription_active ? 'active' : 'expired',
        isTrial: r.is_trial,
        activeUntil: r.active_until,
        registeredAt: r.registered_at,
        role: r.role,
      }));
    } finally {
      await client.end().catch(() => {});
    }
  }

  /** Приводит код тарифа KingStats к нашей внутренней системе (TRIAL|PRO|BUSINESS|NONE) */
  /** Точное сопоставление по реальным plan_code из БД KingStats (проверено напрямую в БД 10.07.2026) */
  private mapPlanCode(planCode: string | null, isTrial: boolean): string {
    if (isTrial) return 'TRIAL';
    if (!planCode) return 'NONE';
    const map: Record<string, string> = {
      trial: 'TRIAL', basic: 'START', pro: 'PRO', standart: 'BUSINESS', premium: 'EXPERT',
    };
    return map[planCode.toLowerCase().trim()] ?? 'NONE';
  }

  /**
   * HTTP API вариант (оставлен для будущих интеграций, где реально есть REST API).
   * Ожидаемый формат: { users: [{ id, username, email, name, phone, role, plan, planStatus, trialEndsAt, subscriptionEndsAt, createdAt, lastLoginAt }] }
   */
  private async fetchExternalSubscribers(apiUrl: string, apiKey: string): Promise<any[]> {
    const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) throw new Error(`API вернул ${res.status}`);
    const data = await res.json();
    return data.users ?? data.subscribers ?? [];
  }
}
