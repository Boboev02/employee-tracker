const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

// ─── Task types ───────────────────────────────────────────────
write('src/tasks/task.types.ts', `export const TaskStatus = {
  NEW:         'NEW',
  IN_PROGRESS: 'IN_PROGRESS',
  REVIEW:      'REVIEW',
  DONE:        'DONE',
  OVERDUE:     'OVERDUE',
  BLOCKED:     'BLOCKED',
} as const;

export const TaskPriority = {
  CRITICAL: 'CRITICAL',
  HIGH:     'HIGH',
  MEDIUM:   'MEDIUM',
  LOW:      'LOW',
} as const;

export const TASK_TRANSITIONS: Record<string, string[]> = {
  NEW:         ['IN_PROGRESS', 'BLOCKED'],
  IN_PROGRESS: ['REVIEW', 'BLOCKED', 'DONE'],
  REVIEW:      ['IN_PROGRESS', 'DONE', 'BLOCKED'],
  BLOCKED:     ['IN_PROGRESS'],
  OVERDUE:     ['IN_PROGRESS', 'DONE'],
  DONE:        ['IN_PROGRESS'],
};
`);

// ─── Task repository ──────────────────────────────────────────
write('src/tasks/task.repository.ts', `import { Injectable } from '@nestjs/common';
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
`);

// ─── Task service ─────────────────────────────────────────────
write('src/tasks/task.service.ts', `import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
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
      throw new BadRequestException(\`Cannot move from \${task.status} to \${newStatus}\`);
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
`);

// ─── Task controller ──────────────────────────────────────────
write('src/tasks/task.controller.ts', `import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode } from '@nestjs/common';
import { TaskService } from './task.service';
import { CurrentUser } from '../auth/decorators/index';

@Controller('api/v1/tasks')
export class TaskController {
  constructor(private readonly tasks: TaskService) {}

  @Get('kanban')
  getKanban(@CurrentUser() user: any, @Query() q: any) {
    return this.tasks.getKanban(user.orgId, q);
  }

  @Get()
  getList(@CurrentUser() user: any, @Query() q: any) {
    return this.tasks.getList(user.orgId, q);
  }

  @Get(':id')
  getById(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tasks.getById(id, user.orgId);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() body: any) {
    return this.tasks.create(user.orgId, user.id, body);
  }

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.tasks.update(id, user.orgId, user.id, body);
  }

  @Patch(':id/move')
  move(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { status: string }) {
    return this.tasks.move(id, user.orgId, user.id, body.status);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tasks.delete(id, user.orgId, user.id);
  }

  @Post(':id/comments')
  addComment(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { content: string }) {
    return this.tasks.addComment(id, user.orgId, user.id, body.content);
  }
}
`);

// ─── Task module ──────────────────────────────────────────────
write('src/tasks/tasks.module.ts', `import { Module } from '@nestjs/common';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { TaskRepository } from './task.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [TaskController],
  providers: [TaskService, TaskRepository],
  exports: [TaskService],
})
export class TasksModule {}
`);

// ─── Update app.module.ts ─────────────────────────────────────
write('src/app.module.ts', `import 'dotenv/config';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { TasksModule } from './tasks/tasks.module';
import { JwtAuthGuard } from './auth/guards/index';

@Module({
  imports: [PrismaModule, AuthModule, HealthModule, TasksModule],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
`);

console.log('\n✅ Tasks module created');
