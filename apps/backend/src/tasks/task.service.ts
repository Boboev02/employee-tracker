import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { TaskRepository } from './task.repository';
import { TASK_TRANSITIONS } from './task.types';

@Injectable()
export class TaskService {
  constructor(private readonly repo: TaskRepository) {}

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
    return this.repo.create({
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
    return this.repo.move(id, newStatus);
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
    return this.repo.addComment(taskId, userId, content);
  }
}
