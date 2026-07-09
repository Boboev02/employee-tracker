import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { TelegramNotifyService } from './telegram-notify.service';

const PLAN_RU: Record<string, string> = { TRIAL: 'Пробный', PRO: 'Профи', BUSINESS: 'Бизнес', NONE: 'Нет подписки' };

/**
 * Визуальный конструктор автоматизаций для подписчиков (Этап 4).
 * Правило: [Триггер] -> [Условия] -> [Действия]
 */
@Injectable()
export class SubscriberAutomationService {
  private readonly logger = new Logger('SubscriberAutomation');

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
    private readonly telegram: TelegramNotifyService,
  ) {}

  // ─── CRUD правил ─────────────────────────────────────────────────────────────

  async getRules(orgId: string) {
    return this.prisma.subscriberAutomationRule.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' } });
  }

  async createRule(orgId: string, userId: string, dto: any) {
    return this.prisma.subscriberAutomationRule.create({
      data: {
        orgId, createdById: userId, name: dto.name,
        triggerType: dto.triggerType, triggerDateField: dto.triggerDateField,
        triggerDays: dto.triggerDays, triggerTag: dto.triggerTag, triggerStatus: dto.triggerStatus,
        actions: dto.actions ?? [], isActive: dto.isActive ?? true,
      },
    });
  }

  async updateRule(orgId: string, id: string, dto: any) {
    return this.prisma.subscriberAutomationRule.update({ where: { id }, data: dto });
  }

  async deleteRule(orgId: string, id: string) {
    await this.prisma.subscriberAutomationRule.delete({ where: { id } });
    return { ok: true };
  }

  async getLogs(orgId: string, subscriberId?: string) {
    return this.prisma.subscriberAutomationLog.findMany({
      where: { orgId, ...(subscriberId ? { subscriberId } : {}) },
      orderBy: { createdAt: 'desc' }, take: 100,
    });
  }

  // ─── Точки входа триггеров (вызываются из SubscriberService) ────────────────

  async onRegister(orgId: string, subscriber: any) {
    const rules = await this.prisma.subscriberAutomationRule.findMany({ where: { orgId, isActive: true, triggerType: 'ON_REGISTER' } });
    for (const rule of rules) await this.tryRun(rule, subscriber, orgId);
  }

  /** Универсальная точка для изменений полей: plan, planStatus, crmStatus, tags, managerId */
  async onFieldChanged(orgId: string, subscriber: any, field: string, oldValue: any, newValue: any) {
    const candidateTriggers: string[] = [];
    if (field === 'plan') {
      candidateTriggers.push('PLAN_CHANGED');
      const wasFree = !oldValue || oldValue === 'NONE' || oldValue === 'TRIAL';
      const isPaid = newValue === 'PRO' || newValue === 'BUSINESS';
      if (wasFree && isPaid) candidateTriggers.push('PLAN_PURCHASED');
    }
    if (field === 'planStatus' && newValue === 'expired') candidateTriggers.push('SUBSCRIPTION_EXPIRED');
    if (field === 'crmStatus') candidateTriggers.push('STATUS_CHANGED');
    if (field === 'managerId' && !oldValue && newValue) candidateTriggers.push('MANAGER_ASSIGNED');
    if (field === 'tags' && Array.isArray(newValue)) {
      const oldTags: string[] = Array.isArray(oldValue) ? oldValue : [];
      const added = newValue.filter((t: string) => !oldTags.includes(t));
      if (added.length > 0) {
        const tagRules = await this.prisma.subscriberAutomationRule.findMany({ where: { orgId, isActive: true, triggerType: 'TAG_ADDED' } });
        for (const rule of tagRules) {
          if (rule.triggerTag && !added.includes(rule.triggerTag)) continue;
          await this.tryRun(rule, subscriber, orgId);
        }
      }
    }

    for (const triggerType of candidateTriggers) {
      const rules = await this.prisma.subscriberAutomationRule.findMany({ where: { orgId, isActive: true, triggerType } });
      for (const rule of rules) {
        if (triggerType === 'STATUS_CHANGED' && rule.triggerStatus && rule.triggerStatus !== newValue) continue;
        await this.tryRun(rule, subscriber, orgId);
      }
    }

    // ─── Этап 6: "Если продлилась → закрыть задачу" (встроенное поведение, не зависит от пользовательских правил) ───
    const isRenewal = (field === 'planStatus' && oldValue === 'expired' && newValue === 'active')
      || (field === 'crmStatus' && newValue === 'RENEWED');
    if (isRenewal) await this.autoCloseLinkedTasks(orgId, subscriber.id);
  }

  /** Закрывает все незавершённые задачи, связанные с подписчиком (Task.subscriberId) */
  private async autoCloseLinkedTasks(orgId: string, subscriberId: string) {
    const openTasks = await this.prisma.task.findMany({
      where: { orgId, subscriberId, status: { notIn: ['DONE', 'CANCELLED'] }, deletedAt: null },
    });
    for (const task of openTasks) {
      await this.prisma.task.update({ where: { id: task.id }, data: { status: 'DONE' } });
    }
    if (openTasks.length > 0) this.logger.log(`Auto-closed ${openTasks.length} tasks for subscriber ${subscriberId} (renewal)`);
  }

  /** Вызывается системным cron раз в день: DAYS_REMAINING + INACTIVE_DAYS */
  async runScheduledRules(orgId: string) {
    const rules = await this.prisma.subscriberAutomationRule.findMany({
      where: { orgId, isActive: true, triggerType: { in: ['DAYS_REMAINING', 'INACTIVE_DAYS'] } },
    });

    for (const rule of rules) {
      let subscribers: any[] = [];

      if (rule.triggerType === 'DAYS_REMAINING') {
        const dateField = rule.triggerDateField ?? 'trialEndsAt';
        const days = rule.triggerDays ?? 3;
        const targetDate = new Date(Date.now() + days * 86400000);
        const dayStart = new Date(targetDate.getFullYear(), targetDate.getMonth(), targetDate.getDate());
        const dayEnd = new Date(dayStart.getTime() + 86400000);
        subscribers = await this.prisma.subscriber.findMany({ where: { orgId, deletedAt: null, [dateField]: { gte: dayStart, lt: dayEnd } } });
      } else if (rule.triggerType === 'INACTIVE_DAYS') {
        const days = rule.triggerDays ?? 14;
        const cutoff = new Date(Date.now() - days * 86400000);
        subscribers = await this.prisma.subscriber.findMany({ where: { orgId, deletedAt: null, lastLoginAt: { lte: cutoff } } });
      }

      for (const sub of subscribers) {
        const alreadyToday = await this.prisma.subscriberAutomationLog.findFirst({
          where: { ruleId: rule.id, subscriberId: sub.id, createdAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } },
        });
        if (alreadyToday) continue;
        await this.tryRun(rule, sub, orgId);
      }
    }
  }

  // ─── Внутренняя логика ───────────────────────────────────────────────────────

  private async tryRun(rule: any, subscriber: any, orgId: string) {
    try {
      for (const action of rule.actions as any[]) {
        await this.executeAction(action, subscriber, rule, orgId);
      }
      await this.prisma.subscriberAutomationLog.create({
        data: { orgId, ruleId: rule.id, subscriberId: subscriber.id, status: 'SUCCESS', message: `Выполнено ${rule.actions.length} действий` },
      });
    } catch (e: any) {
      this.logger.error(`Rule ${rule.id} failed for subscriber ${subscriber.id}: ${e.message}`);
      await this.prisma.subscriberAutomationLog.create({
        data: { orgId, ruleId: rule.id, subscriberId: subscriber.id, status: 'ERROR', message: e.message },
      }).catch(() => {});
    }
  }

  private interpolate(template: string, subscriber: any): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => {
      if (key === 'plan') return PLAN_RU[subscriber.plan] ?? subscriber.plan ?? '';
      return subscriber[key] ?? '';
    });
  }

  private async executeAction(action: { type: string; params: any }, subscriber: any, rule: any, orgId: string) {
    const { type, params } = action;

    switch (type) {
      case 'CREATE_TASK': {
        if (!params.projectId || !params.assigneeId) { this.logger.warn('CREATE_TASK skipped: no projectId/assignee'); return; }
        await this.prisma.task.create({
          data: {
            orgId, createdById: rule.createdById,
            title: this.interpolate(params.title ?? 'Задача по подписчику {firstName}', subscriber),
            description: params.description ? this.interpolate(params.description, subscriber) : undefined,
            assigneeId: params.assigneeId, projectId: params.projectId, departmentId: params.departmentId,
            priority: params.priority ?? 'MEDIUM', status: 'NEW',
            dueDate: params.dueInDays ? new Date(Date.now() + params.dueInDays * 86400000) : undefined,
            subscriberId: subscriber.id,
          },
        });
        break;
      }
      case 'UPDATE_STATUS':
        await this.prisma.subscriber.update({ where: { id: subscriber.id }, data: { crmStatus: params.status } });
        await this.prisma.subscriberHistory.create({ data: { subscriberId: subscriber.id, orgId, field: 'crmStatus', oldValue: JSON.stringify(subscriber.crmStatus), newValue: JSON.stringify(params.status), changedById: null } });
        break;
      case 'ASSIGN_MANAGER':
        await this.prisma.subscriber.update({ where: { id: subscriber.id }, data: { managerId: params.managerId } });
        await this.prisma.subscriberHistory.create({ data: { subscriberId: subscriber.id, orgId, field: 'managerId', oldValue: JSON.stringify(subscriber.managerId), newValue: JSON.stringify(params.managerId), changedById: null } });
        break;
      case 'ADD_TAG': {
        const current: string[] = subscriber.tags ?? [];
        if (!current.includes(params.tag)) {
          await this.prisma.subscriber.update({ where: { id: subscriber.id }, data: { tags: [...current, params.tag] } });
        }
        break;
      }
      case 'SEND_EMAIL':
      case 'SEND_WHATSAPP':
      case 'SEND_TELEGRAM': {
        const channel = type === 'SEND_EMAIL' ? 'EMAIL' : type === 'SEND_WHATSAPP' ? 'WHATSAPP' : 'TELEGRAM';
        const content = params.templateId
          ? this.interpolate((await this.prisma.messageTemplate.findUnique({ where: { id: params.templateId } }))?.content ?? '', subscriber)
          : this.interpolate(params.content ?? '', subscriber);
        await this.prisma.subscriberCommunication.create({
          data: { subscriberId: subscriber.id, orgId, channel, content, templateId: params.templateId, sentById: null },
        });
        break;
      }
      case 'NOTIFY_USER': {
        const userId = params.userId ?? subscriber.managerId;
        if (!userId) return;
        const message = this.interpolate(params.message ?? '', subscriber);
        await this.notifications.create(userId, orgId, 'subscriber_automation', params.title ?? '⚡ Автоматизация CRM', message).catch(() => {});
        // Дублируем в Telegram, если у пользователя настроен chat_id (реальная доставка, не только внутри системы)
        const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { telegramChatId: true } });
        if (user?.telegramChatId) {
          const tgText = `${params.title ?? '⚡ Автоматизация CRM'}\n\n${message}`;
          await this.telegram.sendMessage(user.telegramChatId, tgText).catch(() => {});
        }
        break;
      }
      case 'ADD_COMMENT':
        await this.prisma.subscriberComment.create({
          data: { subscriberId: subscriber.id, orgId, authorId: rule.createdById, content: this.interpolate(params.content ?? '', subscriber) },
        });
        break;
      default:
        this.logger.warn(`Unknown action type: ${type}`);
    }
  }
}
