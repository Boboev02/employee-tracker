import { NotesModule } from './notes/notes.module';
import { CustomFieldsModule } from './custom-fields/custom-fields.module';
import { RelationsModule } from './relations/relations.module';
import { ApprovalsModule } from './approvals/approvals.module';
import { ChatModule } from './chat/chat.module';
import { SubscriberModule } from './subscribers/subscriber.module';
import 'dotenv/config';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule, ThrottlerGuard} from '@nestjs/throttler';
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
import { SidebarModule } from './sidebar/sidebar.module';
import { CommandCenterModule } from './command-center/command-center.module';

@Module({
  imports: [
    CommandCenterModule,
    SidebarModule,
    // Один глобальный лимитер. Несколько именованных лимитеров в forRoot
    // применяются ВСЕ и ко ВСЕМ маршрутам — из-за этого лимит для auth
    // (20 запросов / 15 мин) действовал на весь API и давал 429.
    // Жёсткие лимиты для login/register заданы декораторами на самих маршрутах.
    ThrottlerModule.forRoot([{
      name: 'default',
      ttl: 60000,
      limit: 600, // щадящий потолок: интерфейс не упирается, ботов тормозит
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
    AttachmentsModule,
    HealthModule,
    KpiModule,
    TasksModule, EmployeesModule, RealtimeModule,
    AnalyticsModule, TrackingModule, TeamsModule,
    SettingsModule, NotificationModule, KnowledgeModule,
    CustomFieldsModule,
    RelationsModule,
    ApprovalsModule,
    ChatModule,
    SubscriberModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
