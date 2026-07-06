import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';

/**
 * Движок автоматизации CRM (аналог "Роботы + Триггеры" в Bitrix24).
 * Правило: [Триггер] -> [Условия] -> [Действия ("роботы")]
 *
 * Триггеры: ON_STAGE_ENTER | ON_CREATE | ON_FIELD_CHANGE | ON_TIME_ELAPSED
 * Действия: CREATE_TASK | NOTIFY_USER | UPDATE_FIELD | SEND_CHAT_MESSAGE | CHANGE_OWNER | SEND_EMAIL
 */
@Injectable()
export class CrmAutomationService {
  private readonly logger = new Logger('CrmAutomation');

  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  // ─── Rule CRUD ───────────────────────────────────────────────────────────────

  async getRules(orgId: string, entityType?: string) {
    return this.prisma.crmAutomationRule.findMany({
      where: { orgId, ...(entityType ? { entityType } : {}) },
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async createRule(orgId: string, userId: string, dto: any) {
    return this.prisma.crmAutomationRule.create({
      data: {
        orgId, createdById: userId,
        entityType: dto.entityType,
        name: dto.name,
        triggerType: dto.triggerType,
        triggerStage: dto.triggerStage,
        triggerField: dto.triggerField,
        triggerFieldValue: dto.triggerFieldValue,
        triggerDelayMinutes: dto.triggerDelayMinutes,
        conditions: dto.conditions ?? null,
        actions: dto.actions ?? [],
        isActive: dto.isActive ?? true,
      },
    });
  }

  async updateRule(orgId: string, id: string, dto: any) {
    return this.prisma.crmAutomationRule.update({ where: { id }, data: dto });
  }

  async deleteRule(orgId: string, id: string) {
    await this.prisma.crmAutomationRule.delete({ where: { id } });
    return { ok: true };
  }

  async getLogs(orgId: string, entityId?: string) {
    return this.prisma.crmAutomationLog.findMany({
      where: { orgId, ...(entityId ? { entityId } : {}) },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
  }

  // ─── Trigger evaluation entry points (called from CrmService) ─────────────

  async onEntityCreated(orgId: string, entityType: 'DEAL' | 'LEAD', entity: any) {
    const rules = await this.findActiveRules(orgId, entityType, 'ON_CREATE');
    for (const rule of rules) await this.tryRun(rule, entity, orgId);
  }

  async onStageChanged(orgId: string, entityType: 'DEAL' | 'LEAD', entity: any, newStage: string) {
    const rules = await this.findActiveRules(orgId, entityType, 'ON_STAGE_ENTER');
    for (const rule of rules) {
      if (rule.triggerStage && rule.triggerStage !== newStage) continue;
      await this.tryRun(rule, entity, orgId);
    }
  }

  async onFieldChanged(orgId: string, entityType: 'DEAL' | 'LEAD', entity: any, field: string, newValue: any) {
    const rules = await this.findActiveRules(orgId, entityType, 'ON_FIELD_CHANGE');
    for (const rule of rules) {
      if (rule.triggerField !== field) continue;
      if (rule.triggerFieldValue && String(newValue) !== rule.triggerFieldValue) continue;
      await this.tryRun(rule, entity, orgId);
    }
  }

  /** Called by a cron job to handle ON_TIME_ELAPSED rules (e.g. "лид не в работе 24ч") */
  async runTimeElapsedRules(orgId: string) {
    const rules = await this.prisma.crmAutomationRule.findMany({
      where: { orgId, isActive: true, triggerType: 'ON_TIME_ELAPSED' },
    });
    for (const rule of rules) {
      const cutoff = new Date(Date.now() - (rule.triggerDelayMinutes ?? 60) * 60000);
      const entities = rule.entityType === 'DEAL'
        ? await this.prisma.crmDeal.findMany({ where: { orgId, deletedAt: null, updatedAt: { lte: cutoff }, ...(rule.triggerStage ? { stage: rule.triggerStage } : {}) } })
        : await this.prisma.crmLead.findMany({ where: { orgId, deletedAt: null, updatedAt: { lte: cutoff }, status: rule.triggerStage ?? 'NEW' } });
      for (const entity of entities) await this.tryRun(rule, entity, orgId);
    }
  }

  // ─── Internals ───────────────────────────────────────────────────────────────

  private async findActiveRules(orgId: string, entityType: string, triggerType: string) {
    return this.prisma.crmAutomationRule.findMany({ where: { orgId, entityType, triggerType, isActive: true } });
  }

  private matchesConditions(entity: any, conditions: any[] | null): boolean {
    if (!conditions || conditions.length === 0) return true;
    return conditions.every(c => {
      const val = entity[c.field];
      switch (c.operator) {
        case 'EQ': return val === c.value;
        case 'NEQ': return val !== c.value;
        case 'GT': return Number(val) > Number(c.value);
        case 'LT': return Number(val) < Number(c.value);
        case 'CONTAINS': return String(val ?? '').toLowerCase().includes(String(c.value).toLowerCase());
        default: return true;
      }
    });
  }

  private async tryRun(rule: any, entity: any, orgId: string) {
    if (!this.matchesConditions(entity, rule.conditions)) return;
    try {
      for (const action of (rule.actions as any[])) {
        await this.executeAction(action, entity, rule, orgId);
      }
      await this.prisma.crmAutomationLog.create({
        data: { orgId, ruleId: rule.id, entityType: rule.entityType, entityId: entity.id, status: 'SUCCESS', message: `Выполнено ${rule.actions.length} действий` },
      });
    } catch (e: any) {
      this.logger.error(`Automation rule ${rule.id} failed: ${e.message}`);
      await this.prisma.crmAutomationLog.create({
        data: { orgId, ruleId: rule.id, entityType: rule.entityType, entityId: entity.id, status: 'ERROR', message: e.message },
      }).catch(() => {});
    }
  }

  private async executeAction(action: { type: string; params: any }, entity: any, rule: any, orgId: string) {
    const { type, params } = action;

    switch (type) {
      case 'CREATE_TASK': {
        const assigneeId = params.assignToOwner ? entity.ownerId : params.assigneeId;
        // Задача требует Отдел+Проект+Исполнителя по правилам системы — создаём только если есть проект по умолчанию
        if (!params.projectId || !assigneeId) {
          this.logger.warn('CREATE_TASK skipped: no projectId or assignee resolved');
          return;
        }
        await this.prisma.task.create({
          data: {
            orgId, createdById: rule.createdById,
            title: this.interpolate(params.title ?? 'Задача из CRM', entity),
            description: params.description ? this.interpolate(params.description, entity) : undefined,
            assigneeId, projectId: params.projectId, departmentId: params.departmentId,
            priority: params.priority ?? 'MEDIUM',
            status: 'NEW',
            dueDate: params.dueInDays ? new Date(Date.now() + params.dueInDays * 86400000) : undefined,
          },
        });
        break;
      }

      case 'NOTIFY_USER': {
        const userId = params.userId ?? entity.ownerId;
        if (!userId) return;
        await this.notifications.create(userId, orgId, 'crm_automation', params.title ?? '⚡ Автоматизация CRM', this.interpolate(params.message ?? '', entity)).catch(() => {});
        break;
      }

      case 'UPDATE_FIELD': {
        const model = rule.entityType === 'DEAL' ? this.prisma.crmDeal : this.prisma.crmLead;
        await (model as any).update({ where: { id: entity.id }, data: { [params.field]: params.value } });
        break;
      }

      case 'CHANGE_OWNER': {
        const newOwnerId = await this.resolveOwner(orgId, params);
        if (!newOwnerId) return;
        const model = rule.entityType === 'DEAL' ? this.prisma.crmDeal : this.prisma.crmLead;
        await (model as any).update({ where: { id: entity.id }, data: { ownerId: newOwnerId } });
        break;
      }

      case 'SEND_CHAT_MESSAGE': {
        const targetUserId = params.toOwner ? entity.ownerId : params.userId;
        if (!targetUserId) return;
        // Простая нотификация вместо полноценного чат-сообщения (упрощённый MVP)
        await this.notifications.create(targetUserId, orgId, 'crm_automation', '💬 CRM', this.interpolate(params.message ?? '', entity)).catch(() => {});
        break;
      }

      default:
        this.logger.warn(`Unknown action type: ${type}`);
    }
  }

  /** Правила автоназначения (Этап 2): round-robin или least-busy среди указанной команды */
  private async resolveOwner(orgId: string, params: any): Promise<string | null> {
    if (params.strategy === 'SPECIFIC') return params.userId ?? null;

    const candidateIds: string[] = params.candidateIds ?? [];
    if (candidateIds.length === 0) return null;

    if (params.strategy === 'LEAST_BUSY') {
      const counts = await Promise.all(candidateIds.map(async (uid) => ({
        uid,
        count: await this.prisma.crmDeal.count({ where: { orgId, ownerId: uid, stage: { notIn: ['WON', 'LOST'] }, deletedAt: null } }),
      })));
      counts.sort((a, b) => a.count - b.count);
      return counts[0]?.uid ?? null;
    }

    // ROUND_ROBIN (по умолчанию): берём того, у кого последняя сделка назначена раньше всех
    const lastAssigned = await this.prisma.crmDeal.findMany({
      where: { orgId, ownerId: { in: candidateIds } },
      orderBy: { createdAt: 'desc' },
      take: candidateIds.length,
      select: { ownerId: true },
    });
    const recentlyUsed = new Set(lastAssigned.map(d => d.ownerId));
    const next = candidateIds.find(id => !recentlyUsed.has(id));
    return next ?? candidateIds[Math.floor(Math.random() * candidateIds.length)];
  }

  private interpolate(template: string, entity: any): string {
    return template.replace(/\{(\w+)\}/g, (_, key) => entity[key] ?? '');
  }
}
