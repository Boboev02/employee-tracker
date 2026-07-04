import { NotesModule } from './notes/notes.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { RelationsModule } from './relations/relations.module';
import 'dotenv/config';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { SearchModule } from './search/search.module';
import { RoutineTasksModule } from './routine-tasks/routine-tasks.module';
import { PrismaModule }    from './prisma/prisma.module';
import { AuthModule }      from './auth/auth.module';
import { WbReviewsModule } from './wb-reviews/wb-reviews.module';
import { CallsModule } from './calls/calls.module';
import { AuditModule } from './audit/audit.module';
import { ProductsModule } from './products/products.module';
import { DictionariesModule } from './dictionaries/dictionaries.module';
import { ProjectsModule } from './projects/projects.module';
import { CrmModule } from './crm/crm.module';
import { AttachmentsModule } from './attachments/attachments.module';
import { ResetModule } from './reset/reset.module';
import { KpiModule } from './kpi/kpi.module';
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
    ThrottlerModule.forRoot([{
      name: 'default',
      ttl: 60000,
      limit: 99999, // effectively disabled for authenticated users
    }, {
      name: 'auth',
      ttl: 900000,
      limit: 20,
    }]),
    NotesModule,
    PrismaModule,
    RoutineTasksModule,
    SearchModule, AuthModule, ResetModule,
    WbReviewsModule,
    CallsModule,
    AuditModule,
    ProductsModule,
    DictionariesModule,
    ProjectsModule,
    CrmModule,
    AttachmentsModule,
    HealthModule,
    KpiModule,
    TasksModule, EmployeesModule, RealtimeModule,
    AnalyticsModule, TrackingModule, TeamsModule,
    SettingsModule, NotificationModule, KnowledgeModule,
    CustomFieldsModule,
    RelationsModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
