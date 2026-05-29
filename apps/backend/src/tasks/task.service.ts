import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { TaskRepository } from './task.repository';
import { TASK_TRANSITIONS } from './task.types';
import { TelegramService } from '../telegram/telegram.service';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class TaskService {
  constructor(
    private readonly repo: TaskRepository,
    private readonly telegram: TelegramService,
    private readonly prisma: PrismaService,
    private readonly notificationService: NotificationService,
  ) {}

  async getKanban(orgId: string, filters: any) {
    return this.repo.findKanban(orgId, filters);
  }

  async getById(id: string, orgId: string) {
    const task = await this.repo.findById(id, orgId);
    if (!task) throw new NotFoundException('Task not found');
    return task;
  }

  async getList(orgId: string, filters: any) {
    return this.repo.findMany(orgId, filters);
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

  async update(id: string, orgId: string, userId: string, dto: any) {
    const task = await this.repo.findById(id, orgId);
    if (!task) throw new NotFoundException('Task not found');

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

  async move(id: string, orgId: string, userId: string, newStatus: string) {
    const task = await this.repo.findById(id, orgId);
    if (!task) throw new NotFoundException('Task not found');

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

  async delete(id: string, orgId: string, userId: string) {
    const task = await this.repo.findById(id, orgId);
    if (!task) throw new NotFoundException('Task not found');
    if (task.createdById !== userId) throw new ForbiddenException();
    return this.repo.softDelete(id);
  }

  async addComment(taskId: string, orgId: string, userId: string, content: string) {
    const task = await this.repo.findById(taskId, orgId);
    if (!task) throw new NotFoundException('Task not found');
    const comment = await this.repo.addComment(taskId, userId, content);

    // Уведомление исполнителю
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
}
