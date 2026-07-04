import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(orgId: string, userId: string, filters: any = {}) {
    const where: any = { orgId, deletedAt: null };
    if (filters.status) where.status = filters.status;
    if (filters.search) where.name = { contains: filters.search, mode: 'insensitive' };
    if (filters.departmentId) where.departmentId = filters.departmentId;

    const projects = await this.prisma.project.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      include: {
        owner: { select: { id: true, name: true, avatarUrl: true } },
        department: { select: { id: true, name: true, color: true } },
        members: { include: { project: false } },
        _count: { select: { tasks: { where: { deletedAt: null } } } },
      },
    });
    return projects;
  }

  async getById(orgId: string, id: string) {
    const project = await this.prisma.project.findFirst({
      where: { id, orgId, deletedAt: null },
      include: {
        owner: { select: { id: true, name: true, avatarUrl: true } },
        department: { select: { id: true, name: true, color: true } },
        members: true,
        tasks: {
          where: { deletedAt: null },
          include: { assignee: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
        },
        comments: {
          include: { author: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
        },
        activities: { orderBy: { createdAt: 'desc' }, take: 20 },
      },
    });
    if (!project) throw new NotFoundException('Проект не найден');
    const completedTasks = project.tasks.filter((t: any) => t.status === 'DONE').length;
    const totalTasks = project.tasks.length;
    return { ...project, stats: { totalTasks, completedTasks, completionPercent: totalTasks ? Math.round((completedTasks/totalTasks)*100) : 0 } };
  }

  async create(orgId: string, userId: string, dto: any) {
    if (!dto.departmentId) {
      throw new BadRequestException('Поле "Отдел" обязательно для создания проекта');
    }
    const dept = await this.prisma.department.findFirst({ where: { id: dto.departmentId, orgId } });
    if (!dept) throw new BadRequestException('Указанный отдел не найден');

    const project = await this.prisma.project.create({
      data: {
        orgId,
        ownerId: userId,
        departmentId: dto.departmentId,
        name: dto.name,
        description: dto.description,
        color: dto.color ?? '#7F77DD',
        status: 'ACTIVE',
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        tags: dto.tags ?? [],
      },
    });

    // Добавляем создателя как участника
    await this.prisma.projectMember.create({
      data: { projectId: project.id, userId, role: 'owner' },
    });

    await this.logActivity(project.id, userId, 'created', 'Проект создан');
    return project;
  }

  async update(orgId: string, id: string, userId: string, dto: any) {
    const project = await this.prisma.project.findFirst({ where: { id, orgId, deletedAt: null } });
    if (!project) throw new NotFoundException('Проект не найден');

    const updated = await this.prisma.project.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        status: dto.status,
        color: dto.color,
        startDate: dto.startDate ? new Date(dto.startDate) : undefined,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        tags: dto.tags,
        updatedAt: new Date(),
      },
    });

    await this.logActivity(id, userId, 'updated', 'Проект обновлён');
    return updated;
  }

  async delete(orgId: string, id: string, userId: string, force = false) {
    const project = await this.prisma.project.findFirst({ where: { id, orgId } });
    if (!project) throw new NotFoundException('Проект не найден');
    if (project.ownerId !== userId) throw new ForbiddenException('Только владелец может удалить проект');

    const activeTasks = await this.prisma.task.count({
      where: { projectId: id, orgId, deletedAt: null, status: { notIn: ['DONE'] } },
    });
    if (!force && activeTasks > 0) {
      return { error: 'HAS_ACTIVE_TASKS', message: `В проекте есть ${activeTasks} активных задач. Подтвердите удаление.`, activeTasks };
    }

    await this.prisma.project.update({ where: { id }, data: { deletedAt: new Date() } });
    return { success: true };
  }

  async addMember(orgId: string, projectId: string, userId: string, targetUserId: string, role = 'member') {
    await this.prisma.projectMember.upsert({
      where: { projectId_userId: { projectId, userId: targetUserId } },
      update: { role },
      create: { projectId, userId: targetUserId, role },
    });
    await this.logActivity(projectId, userId, 'member_added', 'Добавлен участник');
    return { success: true };
  }

  async removeMember(projectId: string, userId: string, targetUserId: string) {
    await this.prisma.projectMember.deleteMany({ where: { projectId, userId: targetUserId } });
    await this.logActivity(projectId, userId, 'member_removed', 'Участник удалён');
    return { success: true };
  }

  async addComment(projectId: string, userId: string, content: string) {
    const comment = await this.prisma.projectComment.create({
      data: { projectId, userId, content },
      include: { author: { select: { id: true, name: true, avatarUrl: true } } },
    });
    await this.logActivity(projectId, userId, 'commented', content.slice(0, 100));
    return comment;
  }

  async getStats(orgId: string, id: string) {
    const tasks = await this.prisma.task.findMany({
      where: { projectId: id, deletedAt: null },
      select: { status: true, dueDate: true },
    });

    const total = tasks.length;
    const done = tasks.filter(t => t.status === 'DONE').length;
    const inProgress = tasks.filter(t => t.status === 'IN_PROGRESS').length;
    const overdue = tasks.filter(t => t.dueDate && new Date(t.dueDate) < new Date() && t.status !== 'DONE').length;
    const progress = total ? Math.round((done * 100) / total) : 0;

    return { total, done, inProgress, overdue, progress };
  }

  private async logActivity(projectId: string, userId: string, action: string, details: string) {
    await this.prisma.projectActivity.create({
      data: { projectId, userId, action, details },
    }).catch(() => {});
  }
}
