import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { TaskRepository } from './task.repository';
import { TASK_TRANSITIONS } from './task.types';
import { TelegramService } from '../telegram/telegram.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';

// Проверяет может ли пользователь редактировать/удалить конкретную задачу.
// Если у него есть "any"-право (ADMIN/MANAGER) — разрешено всё.
// Если только "self"-право (EMPLOYEE) — разрешено только если он автор ИЛИ исполнитель.
function canModifyTask(task: { createdById: string; assigneeId?: string | null }, userId: string, permissions?: Set<string>, anyPerm = 'task:update:any') {
  if (permissions?.has(anyPerm)) return true;
  return task.createdById === userId || task.assigneeId === userId;
}

@Injectable()
export class TaskService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly telegram: TelegramService,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
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
    return this.repo.findMany(orgId, this.applyVisibilityRestriction(filters, user));
  }

  async create(orgId: string, userId: string, dto: any) {
    const task = await this.repo.create({
      orgId,
      createdById: userId,
      title:        dto.title,
      description:  dto.description,
      priority:     dto.priority ?? 'MEDIUM',
      assigneeId:   dto.assigneeId,
      teamId:       dto.teamId,
      dueDate:      dto.dueDate ? new Date(dto.dueDate) : undefined,
      status:       'NEW',
      tags:         dto.tags ?? [],
    });

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

    const fields = ['title', 'description', 'priority', 'assigneeId', 'dueDate', 'tags'];
    for (const field of fields) {
      if (dto[field] !== undefined && dto[field] !== (task as any)[field]) {
        await this.repo.addHistory(id, userId, field, String((task as any)[field] ?? ''), String(dto[field]));
      }
    }

    const data: any = {};
    for (const field of fields) {
      if (dto[field] !== undefined) data[field] = field === 'dueDate' ? new Date(dto[field]) : dto[field];
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
      include: { task: { select: { id: true } } },
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
