const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

// ─── Backend: Analytics service ───────────────────────────────
write('src/analytics/analytics.service.ts', `import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrgStats(orgId: string) {
    const [totalUsers, activeTasks, doneTasks, totalTasks] = await Promise.all([
      this.prisma.user.count({ where: { orgId, deletedAt: null } }),
      this.prisma.task.count({ where: { orgId, status: 'IN_PROGRESS', deletedAt: null } }),
      this.prisma.task.count({ where: { orgId, status: 'DONE', deletedAt: null } }),
      this.prisma.task.count({ where: { orgId, deletedAt: null } }),
    ]);

    return { totalUsers, activeTasks, doneTasks, totalTasks,
      completionRate: totalTasks > 0 ? Math.round(doneTasks / totalTasks * 100) : 0 };
  }

  async getTasksByStatus(orgId: string) {
    const statuses = ['NEW','IN_PROGRESS','REVIEW','DONE','OVERDUE','BLOCKED'];
    const counts = await Promise.all(
      statuses.map(s => this.prisma.task.count({ where: { orgId, status: s, deletedAt: null } }))
    );
    return statuses.map((status, i) => ({ status, count: counts[i] }));
  }

  async getTasksByPriority(orgId: string) {
    const priorities = ['CRITICAL','HIGH','MEDIUM','LOW'];
    const counts = await Promise.all(
      priorities.map(p => this.prisma.task.count({ where: { orgId, priority: p, deletedAt: null } }))
    );
    return priorities.map((priority, i) => ({ priority, count: counts[i] }));
  }

  async getTasksCreatedByDay(orgId: string, days = 14) {
    const from = new Date();
    from.setDate(from.getDate() - days);

    const tasks = await this.prisma.task.findMany({
      where: { orgId, createdAt: { gte: from }, deletedAt: null },
      select: { createdAt: true, status: true },
      orderBy: { createdAt: 'asc' },
    });

    const byDay: Record<string, { created: number; done: number }> = {};
    for (let i = 0; i <= days; i++) {
      const d = new Date(from);
      d.setDate(d.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      byDay[key] = { created: 0, done: 0 };
    }

    for (const task of tasks) {
      const key = task.createdAt.toISOString().slice(0, 10);
      if (byDay[key]) {
        byDay[key].created++;
        if (task.status === 'DONE') byDay[key].done++;
      }
    }

    return Object.entries(byDay).map(([date, v]) => ({ date, ...v }));
  }

  async getEmployeeStats(orgId: string) {
    const users = await this.prisma.user.findMany({
      where: { orgId, deletedAt: null },
      include: { userRoles: { include: { role: true } } },
    });

    const stats = await Promise.all(users.map(async u => {
      const [created, completed, inProgress] = await Promise.all([
        this.prisma.task.count({ where: { createdById: u.id, deletedAt: null } }),
        this.prisma.task.count({ where: { assigneeId: u.id, status: 'DONE', deletedAt: null } }),
        this.prisma.task.count({ where: { assigneeId: u.id, status: 'IN_PROGRESS', deletedAt: null } }),
      ]);
      return { id: u.id, name: u.name, role: u.userRoles[0]?.role.name ?? 'EMPLOYEE',
        created, completed, inProgress };
    }));

    return stats.sort((a, b) => b.completed - a.completed);
  }
}
`);

// ─── Backend: Analytics controller ───────────────────────────
write('src/analytics/analytics.controller.ts', `import { Controller, Get, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { CurrentUser } from '../auth/decorators/index';

@Controller('api/v1/analytics')
export class AnalyticsController {
  constructor(private readonly analytics: AnalyticsService) {}

  @Get('stats')
  getStats(@CurrentUser() user: any) {
    return this.analytics.getOrgStats(user.orgId);
  }

  @Get('tasks/by-status')
  getByStatus(@CurrentUser() user: any) {
    return this.analytics.getTasksByStatus(user.orgId);
  }

  @Get('tasks/by-priority')
  getByPriority(@CurrentUser() user: any) {
    return this.analytics.getTasksByPriority(user.orgId);
  }

  @Get('tasks/by-day')
  getByDay(@CurrentUser() user: any, @Query('days') days?: string) {
    return this.analytics.getTasksCreatedByDay(user.orgId, days ? parseInt(days) : 14);
  }

  @Get('employees')
  getEmployeeStats(@CurrentUser() user: any) {
    return this.analytics.getEmployeeStats(user.orgId);
  }
}
`);

// ─── Backend: Analytics module ────────────────────────────────
write('src/analytics/analytics.module.ts', `import { Module } from '@nestjs/common';
import { AnalyticsController } from './analytics.controller';
import { AnalyticsService } from './analytics.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [AnalyticsController],
  providers: [AnalyticsService],
})
export class AnalyticsModule {}
`);

// ─── Update app.module.ts ─────────────────────────────────────
write('src/app.module.ts', `import 'dotenv/config';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule }    from './prisma/prisma.module';
import { AuthModule }      from './auth/auth.module';
import { HealthModule }    from './health/health.module';
import { TasksModule }     from './tasks/tasks.module';
import { EmployeesModule } from './employees/employees.module';
import { RealtimeModule }  from './realtime/realtime.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { JwtAuthGuard }    from './auth/guards/index';

@Module({
  imports: [PrismaModule, AuthModule, HealthModule, TasksModule, EmployeesModule, RealtimeModule, AnalyticsModule],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
`);

console.log('\n✅ Analytics backend created');
