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
        project:    { select: { id: true, name: true, status: true, color: true } },
        department: { select: { id: true, name: true, color: true } },
        assignee:   { select: { id: true, name: true, avatarUrl: true } },
      },
    });
  }

  async findKanban(orgId: string, filters: any = {}) {
    const where: any = { orgId, deletedAt: null };
    if (filters.assigneeId) where.assigneeId = filters.assigneeId;
    if (filters.teamId)     where.teamId     = filters.teamId;
    // Если переданы ограничения по видимости (EMPLOYEE без task:read:all/team) — фильтруем
    // задачи где пользователь автор ИЛИ исполнитель
    if (filters._restrictToUserId) {
      where.OR = [{ createdById: filters._restrictToUserId }, { assigneeId: filters._restrictToUserId }];
    }

    const tasks = await this.prisma.task.findMany({
      where,
      orderBy: [{ sortOrder: 'asc' }, { createdAt: 'desc' }],
      take: 500,
      include: { assignee: { select: { id: true, name: true, avatarUrl: true } } },
    });

    const columns: Record<string, any[]> = {
      NEW: [], IN_PROGRESS: [], REVIEW: [], BLOCKED: [], OVERDUE: [], DONE: [],
    };
    for (const task of tasks) {
      if (columns[task.status]) columns[task.status].push(task);
    }
    return columns;
  }

  async findMany(orgId: string, filters: any = {}) {
    const where: any = { orgId, deletedAt: null };
    if (filters.status)       where.status       = Array.isArray(filters.status) ? { in: filters.status } : filters.status;
    if (filters.assigneeId)   where.assigneeId   = filters.assigneeId;
    if (filters.taskTypeId)   where.taskTypeId   = filters.taskTypeId;
    if (filters.projectId)    where.projectId    = filters.projectId;
    if (filters.departmentId) where.departmentId = filters.departmentId;
    if (filters.productId)    where.productId    = filters.productId;

    // parentId filter: if explicitly passed — get subtasks; if not passed — get top-level only
    // Note: query strings send parentId=null as the literal string "null", not JS null
    if (filters.parentId !== undefined) {
      where.parentId = (filters.parentId === 'null' || filters.parentId === '' || !filters.parentId) ? null : filters.parentId;
    } else {
      where.parentId = null; // default: only top-level tasks
    }

    if (filters.search) {
      where.OR = [
        { title: { contains: filters.search, mode: 'insensitive' } },
        { description: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters._restrictToUserId) {
      where.AND = [
        ...(where.AND ?? []),
        { OR: [{ createdById: filters._restrictToUserId }, { assigneeId: filters._restrictToUserId }] },
      ];
    }
    if (filters._customFieldWhere) {
      Object.assign(where, filters._customFieldWhere);
    }

    const orderBy: any = {};
    const validSortFields = ['createdAt', 'updatedAt', 'dueDate', 'priority', 'title', 'sortOrder'];
    const sortField = validSortFields.includes(filters.sortField) ? filters.sortField : 'createdAt';
    orderBy[sortField] = filters.sortDir === 'asc' ? 'asc' : 'desc';

    return this.prisma.task.findMany({
      where,
      orderBy,
      take: Math.min(filters.limit ?? 50, 200),
      skip: filters.offset ?? 0,
      include: {
        assignee: { select: { id: true, name: true, avatarUrl: true } },
        taskType: { select: { id: true, name: true, icon: true, color: true } },
      },
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
