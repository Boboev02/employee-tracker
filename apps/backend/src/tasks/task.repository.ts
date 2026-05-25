import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TaskRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findById(id: string, orgId: string) {
    return this.prisma.task.findFirst({
      where: { id, orgId, deletedAt: null },
      include: {
        comments: { where: { deletedAt: null }, orderBy: { createdAt: 'asc' } },
        history:  { orderBy: { createdAt: 'desc' }, take: 50 },
      },
    });
  }

  async findKanban(orgId: string, filters: any = {}) {
    const where: any = { orgId, deletedAt: null };
    if (filters.assigneeId) where.assigneeId = filters.assigneeId;
    if (filters.teamId)     where.teamId     = filters.teamId;

    const tasks = await this.prisma.task.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
    });

    const columns: Record<string, any[]> = {
      NEW: [], IN_PROGRESS: [], REVIEW: [], BLOCKED: [], DONE: [],
    };
    for (const task of tasks) {
      if (columns[task.status]) columns[task.status].push(task);
    }
    return columns;
  }

  async findMany(orgId: string, filters: any = {}) {
    const where: any = { orgId, deletedAt: null };
    if (filters.status)     where.status     = { in: filters.status };
    if (filters.assigneeId) where.assigneeId = filters.assigneeId;
    if (filters.search)     where.title      = { contains: filters.search, mode: 'insensitive' };
    return this.prisma.task.findMany({
      where, orderBy: { createdAt: 'desc' },
      take: filters.limit ?? 50, skip: filters.offset ?? 0,
    });
  }

  async create(data: any) {
    const maxOrder = await this.prisma.task.aggregate({
      where:  { orgId: data.orgId, status: 'NEW', deletedAt: null },
      _max:   { sortOrder: true },
    });
    return this.prisma.task.create({
      data: { ...data, sortOrder: (maxOrder._max.sortOrder ?? 0) + 1 },
    });
  }

  async update(id: string, orgId: string, data: any) {
    return this.prisma.task.update({
      where: { id }, data: { ...data, updatedAt: new Date() },
    });
  }

  async move(id: string, status: string) {
    const extra: any = {};
    if (status === 'IN_PROGRESS') extra.startedAt   = new Date();
    if (status === 'DONE')        extra.completedAt = new Date();
    return this.prisma.task.update({
      where: { id }, data: { status, ...extra, updatedAt: new Date() },
    });
  }

  async softDelete(id: string) {
    return this.prisma.task.update({
      where: { id }, data: { deletedAt: new Date() },
    });
  }

  async addComment(taskId: string, authorId: string, content: string) {
    return this.prisma.taskComment.create({ data: { taskId, authorId, content } });
  }

  async addHistory(taskId: string, actorId: string, field: string, oldValue?: string, newValue?: string) {
    return this.prisma.taskHistory.create({ data: { taskId, actorId, field, oldValue, newValue } });
  }
}
