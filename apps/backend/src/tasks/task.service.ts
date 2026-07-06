import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { TaskRepository } from './task.repository';
import { TASK_TRANSITIONS } from './task.types';
import { TelegramService } from '../telegram/telegram.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';
import { CustomFieldsService } from '../custom-fields/custom-fields.service';
import { RelationsService } from '../relations/relations.service';
import { ApprovalsService } from '../approvals/approvals.service';

// Проверяет может ли пользователь редактировать/удалить конкретную задачу.
// Если у него есть "any"-право (ADMIN/MANAGER) — разрешено всё.
// Если только "self"-право (EMPLOYEE) — разрешено только если он автор ИЛИ исполнитель.
function canModifyTask(task: { createdById: string; assigneeId?: string | null; assigneeIds?: string[] }, userId: string, permissions?: Set<string>, anyPerm = 'task:update:any') {
  if (permissions?.has(anyPerm)) return true;
  if (task.createdById === userId || task.assigneeId === userId) return true;
  return Array.isArray(task.assigneeIds) && task.assigneeIds.includes(userId);
}

@Injectable()
export class TaskService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly telegram: TelegramService,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
    private readonly customFields: CustomFieldsService,
    private readonly relations: RelationsService,
    private readonly approvals: ApprovalsService,
  ) {}

  // Если у пользователя нет права видеть все/командные задачи — ограничиваем выборку
  // только задачами где он автор или исполнитель
  private applyVisibilityRestriction(filters: any, user?: any) {
    if (!user) return filters;
    const perms: Set<string> = user.permissions ?? new Set();
    const canSeeAll = perms.has('task:read:all') || perms.has('task:read:team');
    if (!canSeeAll) {
      return { ...filters, _restrictToUserId: user.id ?? user.sub };
    }
    return filters;
  }

  async getKanban(orgId: string, filters: any, user?: any) {
    return this.repo.findKanban(orgId, this.applyVisibilityRestriction(filters, user));
  }

  async getById(id: string, orgId: string) {
    const task = await this.repo.findById(id, orgId);
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async getList(orgId: string, filters: any, user?: any) {
    const base = this.applyVisibilityRestriction(filters, user);
    if (user) base._currentUserId = user.sub ?? user.id;

    // Parse custom field filters from query: ?cf=[{"fieldId":"...","op":"EQ","val":"...","type":"TEXT"}]
    if (filters.cf) {
      try {
        const cfFilters = typeof filters.cf === 'string' ? JSON.parse(filters.cf) : filters.cf;
        if (Array.isArray(cfFilters) && cfFilters.length > 0) {
          base._customFieldWhere = this.customFields.buildCustomFieldWhere(orgId, cfFilters);
        }
      } catch {}
    }

    return this.repo.findMany(orgId, base);
  }

  async create(orgId: string, userId: string, dto: any) {
    let { departmentId, projectId, assigneeId, parentId } = dto;
    // Принимаем либо dto.assigneeIds (массив), либо одиночный dto.assigneeId — приводим к единому виду
    let assigneeIds: string[] = Array.isArray(dto.assigneeIds) ? dto.assigneeIds.filter(Boolean) : (assigneeId ? [assigneeId] : []);

    if (parentId) {
      // Подзадача: наследует отдел и проект от родительской задачи
      const parent = await this.prisma.task.findFirst({ where: { id: parentId, orgId, deletedAt: null } });
      if (!parent) throw new BadRequestException('Родительская задача не найдена');
      departmentId = parent.departmentId;
      projectId    = parent.projectId;
      // Исполнитель у подзадачи не обязателен
    } else {
      // Обычная задача: Отдел, Проект и Исполнитель обязательны
      if (!projectId) throw new BadRequestException('Поле "Проект" обязательно для создания задачи');
      if (assigneeIds.length === 0) throw new BadRequestException('Поле "Исполнитель" обязательно для создания задачи');

      // Автонаследование: отдел определяется проектом (гарантирует согласованность)
      const project = await this.prisma.project.findFirst({ where: { id: projectId, orgId, deletedAt: null } });
      if (!project) throw new BadRequestException('Указанный проект не найден');
      if (!project.departmentId) throw new BadRequestException('У выбранного проекта не задан отдел — сначала привяжите проект к отделу');
      departmentId = project.departmentId;
    }

    // Primary assigneeId = первый в списке (для обратной совместимости с уведомлениями/фильтрами)
    assigneeId = assigneeIds[0] ?? null;

    const task = await this.repo.create({
      orgId,
      createdById: userId,
      title:        dto.title,
      description:  dto.description,
      priority:     dto.priority ?? 'MEDIUM',
      assigneeId,
      assigneeIds,
      teamId:       dto.teamId,
      departmentId,
      projectId,
      productId:    dto.productId,
      parentId,
      taskTypeId:   dto.taskTypeId,
      dueDate:      dto.dueDate ? new Date(dto.dueDate) : undefined,
      status:       'NEW',
      tags:         dto.tags ?? [],
    });

    // Save custom field values if provided
    if (dto.customFields && typeof dto.customFields === 'object') {
      await this.customFields.setTaskFieldValues(task.id, orgId, dto.customFields).catch(() => {});
    }

    // Множественные исполнители: остальные выбранные (кроме основного) добавляются как соисполнители
    if (Array.isArray(dto.coAssigneeIds) && dto.coAssigneeIds.length > 0) {
      const uniqueCoIds = Array.from(new Set(dto.coAssigneeIds.filter((id: string) => id !== assigneeId)));
      if (uniqueCoIds.length) {
        await this.prisma.taskParticipant.createMany({
          data: uniqueCoIds.map((uid: string) => ({ taskId: task.id, userId: uid, role: 'co_executor' })),
          skipDuplicates: true,
        }).catch(() => {});
      }
    }

    // Log creation activity
    const creator = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    await this.relations.logActivity(orgId, {
      entityType: 'TASK', entityId: task.id,
      actorId: userId, actorName: creator?.name,
      action: 'CREATED', newValue: task.title,
    }).catch(() => {});

    // Уведомление исполнителю
    if (dto.assigneeId && dto.assigneeId !== userId) {
      const assignee = await this.prisma.user.findUnique({ where: { id: dto.assigneeId } });
      const creator = await this.prisma.user.findUnique({ where: { id: userId } });
      if (assignee?.telegramChatId) {
        await this.telegram.notifyTaskAssigned(assignee.telegramChatId, task.title, creator?.name ?? 'Менеджер');
      }
      await this.notificationService.create(
        dto.assigneeId, orgId, 'task_assigned',
        '📋 Новая задача',
        `Вам назначена задача: "${task.title}" от ${creator?.name ?? 'Менеджер'}`,
        task.id
      );
    }
    return task;
  }

  async update(id: string, orgId: string, userId: string, dto: any, permissions?: Set<string>) {
    const task = await this.repo.findById(id, orgId);
    if (!task) throw new NotFoundException('Task not found');

    if (!canModifyTask(task, userId, permissions)) {
      throw new ForbiddenException('Вы можете редактировать только свои задачи или задачи, назначенные вам');
    }

    const fields = ['title', 'description', 'priority', 'assigneeId', 'assigneeIds', 'dueDate', 'tags'];
    for (const field of fields) {
      if (dto[field] !== undefined && dto[field] !== (task as any)[field]) {
        await this.repo.addHistory(id, userId, field, String((task as any)[field] ?? ''), String(dto[field]));
      }
    }

    const data: any = {};
    for (const field of fields) {
      if (dto[field] !== undefined) data[field] = field === 'dueDate' ? new Date(dto[field]) : dto[field];
    }
    // Синхронизация: если обновили список исполнителей — первый становится основным assigneeId
    if (dto.assigneeIds !== undefined) {
      data.assigneeId = Array.isArray(dto.assigneeIds) && dto.assigneeIds.length > 0 ? dto.assigneeIds[0] : null;
    }

    return this.repo.update(id, orgId, data);
  }

  async move(id: string, orgId: string, userId: string, newStatus: string, permissions?: Set<string>) {
    const task = await this.repo.findById(id, orgId);
    if (!task) throw new NotFoundException('Task not found');

    if (!canModifyTask(task, userId, permissions)) {
      throw new ForbiddenException('Вы можете перемещать только свои задачи или задачи, назначенные вам');
    }

    const allowed = TASK_TRANSITIONS[task.status] ?? [];
    if (!allowed.includes(newStatus)) {
      throw new BadRequestException(`Cannot move from ${task.status} to ${newStatus}`);
    }

    await this.repo.addHistory(id, userId, 'status', task.status, newStatus);
    const moved = await this.repo.move(id, newStatus);

    // Log status change activity
    const actor = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });
    await this.relations.logActivity(orgId, {
      entityType: 'TASK', entityId: id,
      actorId: userId, actorName: actor?.name,
      action: 'STATUS_CHANGED', field: 'status',
      oldValue: task.status, newValue: newStatus,
    }).catch(() => {});

    // Auto-trigger approval flow if configured
    await this.approvals.checkAutoTrigger(
      orgId, userId, 'TASK', id, newStatus, task.title,
    ).catch(() => {});

    // Уведомление исполнителю
    if (task.assigneeId && task.assigneeId !== userId) {
      const assignee = await this.prisma.user.findUnique({ where: { id: task.assigneeId } });
      const actor = await this.prisma.user.findUnique({ where: { id: userId } });
      if (assignee?.telegramChatId) {
        await this.telegram.notifyTaskStatusChanged(assignee.telegramChatId, task.title, newStatus, actor?.name ?? 'Менеджер');
      }
      const statusLabels: Record<string, string> = { NEW: 'Новая', IN_PROGRESS: 'В работе', REVIEW: 'Проверка', BLOCKED: 'Заблокировано', DONE: 'Готово' };
      await this.notificationService.create(
        task.assigneeId, task.orgId, 'task_status',
        '🔄 Статус задачи изменён',
        `Задача "${task.title}" → ${statusLabels[newStatus] ?? newStatus}`,
        task.id
      );
    }
    return moved;
  }

  async markOverdueTasks(orgId?: string) {
    const now = new Date();
    const where: any = {
      dueDate: { lt: now },
      status:  { in: ['NEW', 'IN_PROGRESS', 'REVIEW'] },
      deletedAt: null,
    };
    if (orgId) where.orgId = orgId;

    const overdue = await this.prisma.task.findMany({ where, select: { id: true, title: true, assigneeId: true, orgId: true } });
    if (!overdue.length) return { updated: 0 };

    await this.prisma.task.updateMany({
      where: { id: { in: overdue.map(t => t.id) } },
      data:  { status: 'OVERDUE', updatedAt: now },
    });

    // Уведомления исполнителям
    for (const task of overdue) {
      if (task.assigneeId) {
        await this.notificationService.create(
          task.assigneeId, task.orgId, 'task_overdue',
          '⚠️ Задача просрочена',
          `Задача "${task.title}" просрочена!`,
          task.id
        ).catch(() => {});
      }
    }
    return { updated: overdue.length };
  }

  async delete(id: string, orgId: string, userId: string, permissions?: Set<string>) {
    const task = await this.repo.findById(id, orgId);
    if (!task) throw new NotFoundException('Task not found');
    // task:delete (ADMIN/MANAGER) разрешает удалять любые; иначе — только свои созданные
    const canDeleteAny = permissions?.has('task:delete');
    if (!canDeleteAny && task.createdById !== userId) {
      throw new ForbiddenException('Вы можете удалять только созданные вами задачи');
    }
    return this.repo.softDelete(id);
  }

  async addComment(taskId: string, orgId: string, userId: string, content: string) {
    const task = await this.repo.findById(taskId, orgId);
    if (!task) throw new NotFoundException('Task not found');
    const comment = await this.repo.addComment(taskId, userId, content);

    if (task.assigneeId && task.assigneeId !== userId) {
      const assignee = await this.prisma.user.findUnique({ where: { id: task.assigneeId } });
      const author = await this.prisma.user.findUnique({ where: { id: userId } });
      if (assignee?.telegramChatId) {
        await this.telegram.notifyTaskComment(assignee.telegramChatId, task.title, author?.name ?? 'Менеджер', content);
      }
      await this.notificationService.create(
        task.assigneeId, task.orgId, 'task_comment',
        '💬 Новый комментарий',
        `${author?.name ?? 'Менеджер'} прокомментировал задачу "${task.title}": ${content.slice(0, 100)}`,
        task.id
      );
    }
    return comment;
  }

  // ===== ЧЕКЛИСТЫ =====
  async getChecklists(taskId: string) {
    return this.prisma.taskChecklist.findMany({ where: { taskId }, orderBy: { position: 'asc' } });
  }

  async addChecklist(taskId: string, orgId: string, userId: string, dto: { text: string; assigneeId?: string }, permissions?: Set<string>) {
    const task = await this.repo.findById(taskId, orgId);
    if (!task) throw new NotFoundException('Task not found');
    if (!canModifyTask(task, userId, permissions)) throw new ForbiddenException('Нет прав на редактирование задачи');
    const maxPos = await this.prisma.taskChecklist.aggregate({ where: { taskId }, _max: { position: true } });
    return this.prisma.taskChecklist.create({
      data: { taskId, text: dto.text, assigneeId: dto.assigneeId, position: (maxPos._max.position ?? 0) + 1 },
    });
  }

  async updateChecklist(taskId: string, checkId: string, orgId: string, userId: string, dto: { text?: string; isDone?: boolean; assigneeId?: string }, permissions?: Set<string>) {
    const task = await this.repo.findById(taskId, orgId);
    if (!task) throw new NotFoundException('Task not found');
    if (!canModifyTask(task, userId, permissions)) throw new ForbiddenException('Нет прав на редактирование задачи');
    return this.prisma.taskChecklist.update({ where: { id: checkId }, data: dto });
  }

  async deleteChecklist(taskId: string, checkId: string, orgId: string, userId: string, permissions?: Set<string>) {
    const task = await this.repo.findById(taskId, orgId);
    if (!task) throw new NotFoundException('Task not found');
    if (!canModifyTask(task, userId, permissions)) throw new ForbiddenException('Нет прав на редактирование задачи');
    await this.prisma.taskChecklist.delete({ where: { id: checkId } });
  }

  // ===== УЧАСТНИКИ ЗАДАЧИ =====
  async getParticipants(taskId: string) {
    return this.prisma.taskParticipant.findMany({
      where: { taskId },
      include: { user: { select: { id: true, name: true, avatarUrl: true } } },
    });
  }

  async addParticipant(taskId: string, orgId: string, userId: string, dto: { userId: string; role: string }, permissions?: Set<string>) {
    const task = await this.repo.findById(taskId, orgId);
    if (!task) throw new NotFoundException('Task not found');
    if (!canModifyTask(task, userId, permissions)) throw new ForbiddenException('Нет прав на редактирование задачи');
    return this.prisma.taskParticipant.upsert({
      where: { taskId_userId: { taskId, userId: dto.userId } },
      update: { role: dto.role },
      create: { taskId, userId: dto.userId, role: dto.role },
    });
  }

  async removeParticipant(taskId: string, targetUserId: string, orgId: string, userId: string, permissions?: Set<string>) {
    const task = await this.repo.findById(taskId, orgId);
    if (!task) throw new NotFoundException('Task not found');
    if (!canModifyTask(task, userId, permissions)) throw new ForbiddenException('Нет прав на редактирование задачи');
    await this.prisma.taskParticipant.delete({ where: { taskId_userId: { taskId, userId: targetUserId } } });
  }

  // ===== ДВОЙНОЙ ВИД =====
  async getByDepartment(orgId: string, filters: any, user?: any) {
    const departments = await this.prisma.department.findMany({
      where: { orgId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: {
        tasks: {
          where: { deletedAt: null, ...(this.applyVisibilityRestriction({}, user)._restrictToUserId ? { OR: [{ createdById: user.id }, { assigneeId: user.id }] } : {}) },
          include: { assignee: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    return departments;
  }

  async getByProduct(orgId: string, filters: any, user?: any) {
    const restriction = this.applyVisibilityRestriction({}, user);
    return this.prisma.product.findMany({
      where: { orgId },
      orderBy: { updatedAt: 'desc' },
      include: {
        tasks: {
          where: { deletedAt: null, ...(restriction._restrictToUserId ? { OR: [{ createdById: restriction._restrictToUserId }, { assigneeId: restriction._restrictToUserId }] } : {}) },
          include: { assignee: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
        },
        stage: true,
      },
    });
  }
}
