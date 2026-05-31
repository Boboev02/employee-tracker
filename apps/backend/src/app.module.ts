import 'dotenv/config';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule }    from './prisma/prisma.module';
import { AuthModule }      from './auth/auth.module';
import { ResetModule } from './reset/reset.module';
import { HealthModule }    from './health/health.module';
import { TasksModule }     from './tasks/tasks.module';
import { EmployeesModule } from './employees/employees.module';
import { RealtimeModule }  from './realtime/realtime.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { TrackingModule }  from './tracking/tracking.module';
import { TeamsModule }     from './teams/teams.module';
import { SettingsModule }  from './settings/settings.module';
import { NotificationModule } from './notifications/notification.module';
import { KnowledgeModule } from './knowledge/knowledge.module';
import { JwtAuthGuard }    from './auth/guards/index';

@Module({
  imports: [
    PrismaModule, AuthModule, ResetModule,
    HealthModule,
    TasksModule, EmployeesModule, RealtimeModule,
    AnalyticsModule, TrackingModule, TeamsModule,
    SettingsModule, NotificationModule, KnowledgeModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
