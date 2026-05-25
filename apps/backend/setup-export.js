const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

// ─── Backend: Export controller ───────────────────────────────
write('src/analytics/export.controller.ts', `import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from './export.service';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { RbacGuard } from '../auth/guards/index';

@Controller('api/v1/export')
@UseGuards(RbacGuard)
export class ExportController {
  constructor(private readonly export_: ExportService) {}

  @Get('activity')
  @RequirePermissions('analytics:view:org', 'analytics:view:team', 'tracking:export')
  async exportActivity(
    @CurrentUser() user: any,
    @Query('days') days: string,
    @Res() res: Response,
  ) {
    const csv = await this.export_.exportActivity(user.orgId, parseInt(days ?? '7'));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="activity-report.csv"');
    res.send('\\uFEFF' + csv); // BOM for Excel UTF-8
  }

  @Get('employees')
  @RequirePermissions('user:read:all', 'user:read:team')
  async exportEmployees(@CurrentUser() user: any, @Res() res: Response) {
    const csv = await this.export_.exportEmployees(user.orgId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="employees-report.csv"');
    res.send('\\uFEFF' + csv);
  }

  @Get('tasks')
  @RequirePermissions('task:read:all', 'task:read:team', 'report:view')
  async exportTasks(@CurrentUser() user: any, @Res() res: Response) {
    const csv = await this.export_.exportTasks(user.orgId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="tasks-report.csv"');
    res.send('\\uFEFF' + csv);
  }

  @Get('productivity')
  @RequirePermissions('analytics:view:org', 'analytics:view:team', 'report:view')
  async exportProductivity(
    @CurrentUser() user: any,
    @Query('days') days: string,
    @Res() res: Response,
  ) {
    const csv = await this.export_.exportProductivity(user.orgId, parseInt(days ?? '7'));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="productivity-report.csv"');
    res.send('\\uFEFF' + csv);
  }
}
`);

// ─── Backend: Export service ──────────────────────────────────
write('src/analytics/export.service.ts', `import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ProductivityService } from './productivity.service';

function escapeCsv(val: any): string {
  if (val == null) return '';
  const str = String(val);
  if (str.includes(',') || str.includes('"') || str.includes('\\n')) {
    return '"' + str.replace(/"/g, '""') + '"';
  }
  return str;
}

function toCsv(rows: Record<string, any>[]): string {
  if (!rows.length) return '';
  const headers = Object.keys(rows[0]);
  const lines = [
    headers.join(','),
    ...rows.map(row => headers.map(h => escapeCsv(row[h])).join(',')),
  ];
  return lines.join('\\n');
}

@Injectable()
export class ExportService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly productivity: ProductivityService,
  ) {}

  async exportActivity(orgId: string, days = 7): Promise<string> {
    const from = new Date();
    from.setDate(from.getDate() - days);

    const events = await this.prisma.activityEvent.findMany({
      where: { orgId, createdAt: { gte: from } },
      orderBy: { createdAt: 'desc' },
      take: 10000,
    });

    // Get user names
    const userIds = [...new Set(events.map(e => e.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true, email: true },
    });
    const userMap = Object.fromEntries(users.map(u => [u.id, u]));

    const rows = events.map(e => ({
      'Дата':         e.createdAt.toISOString().slice(0, 19).replace('T', ' '),
      'Сотрудник':    userMap[e.userId]?.name ?? e.userId,
      'Email':        userMap[e.userId]?.email ?? '',
      'Платформа':    e.platform,
      'Тип события':  e.eventType,
      'URL':          e.url ?? '',
      'Заголовок':    e.pageTitle ?? '',
      'Раздел':       (e.platformData as any)?.section ?? '',
    }));

    return toCsv(rows);
  }

  async exportEmployees(orgId: string): Promise<string> {
    const users = await this.prisma.user.findMany({
      where: { orgId, deletedAt: null },
      include: { userRoles: { include: { role: true } } },
      orderBy: { name: 'asc' },
    });

    // Get activity counts
    const activityCounts = await this.prisma.activityEvent.groupBy({
      by: ['userId'],
      where: { orgId },
      _count: { id: true },
    });
    const actMap = Object.fromEntries(activityCounts.map(a => [a.userId, a._count.id]));

    // Get task counts
    const taskCounts = await this.prisma.task.groupBy({
      by: ['assigneeId'],
      where: { orgId, deletedAt: null, assigneeId: { not: null } },
      _count: { id: true },
    });
    const taskMap = Object.fromEntries(taskCounts.map(t => [t.assigneeId!, t._count.id]));

    const rows = users.map(u => ({
      'Имя':              u.name,
      'Email':            u.email,
      'Роль':             u.userRoles[0]?.role.name ?? 'EMPLOYEE',
      'Статус':           u.status,
      'Дата добавления':  u.createdAt.toISOString().slice(0, 10),
      'Событий всего':    actMap[u.id] ?? 0,
      'Задач назначено':  taskMap[u.id] ?? 0,
    }));

    return toCsv(rows);
  }

  async exportTasks(orgId: string): Promise<string> {
    const tasks = await this.prisma.task.findMany({
      where: { orgId, deletedAt: null },
      orderBy: { createdAt: 'desc' },
    });

    // Get user names
    const userIds = [...new Set([
      ...tasks.map(t => t.assigneeId).filter(Boolean),
      ...tasks.map(t => t.createdById),
    ])] as string[];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });
    const userMap = Object.fromEntries(users.map(u => [u.id, u.name]));

    const rows = tasks.map(t => ({
      'Название':         t.title,
      'Статус':           t.status,
      'Приоритет':        t.priority,
      'Исполнитель':      t.assigneeId ? userMap[t.assigneeId] ?? '' : '',
      'Создатель':        userMap[t.createdById] ?? '',
      'Дата создания':    t.createdAt.toISOString().slice(0, 10),
      'Дата начала':      t.startedAt?.toISOString().slice(0, 10) ?? '',
      'Дата завершения':  t.completedAt?.toISOString().slice(0, 10) ?? '',
      'Дедлайн':          t.dueDate?.toISOString().slice(0, 10) ?? '',
      'Теги':             t.tags.join('; '),
    }));

    return toCsv(rows);
  }

  async exportProductivity(orgId: string, days = 7): Promise<string> {
    const scores = await this.productivity.getOrgProductivity(orgId, days);

    const rows = scores.map((s, i) => ({
      'Место':            i + 1,
      'Сотрудник':        s.name,
      'Оценка':           s.score,
      'Грейд':            s.grade,
      'Активность':       s.factors.activity,
      'Стабильность':     s.factors.consistency,
      'Задачи':           s.factors.tasks,
      'Фокус':            s.factors.focus,
      'Событий':          s.details.totalEvents,
      'Активных дней':    s.details.activeDays,
      'Задач выполнено':  s.details.tasksCompleted,
      'Платформа':        s.details.topPlatform,
      'Раздел':           s.details.topSection,
    }));

    return toCsv(rows);
  }
}
`);

// ─── Update analytics module ──────────────────────────────────
write('src/analytics/analytics.module.ts', `import { Module } from '@nestjs/common';
import { AnalyticsController }  from './analytics.controller';
import { AnalyticsService }     from './analytics.service';
import { ActiveTimeService }    from './active-time.service';
import { ProductivityService }  from './productivity.service';
import { ExportService }        from './export.service';
import { ExportController }     from './export.controller';
import { PrismaModule }         from '../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  controllers: [AnalyticsController, ExportController],
  providers:   [AnalyticsService, ActiveTimeService, ProductivityService, ExportService],
})
export class AnalyticsModule {}
`);

console.log('\n✅ Export backend created');
