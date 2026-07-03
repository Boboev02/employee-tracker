import { Module } from '@nestjs/common';
import { TelegramModule } from '../telegram/telegram.module';
import { NotificationModule } from '../notifications/notification.module';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { TaskRepository } from './task.repository';
import { PrismaModule } from '../prisma/prisma.module';
import { AiClassifyController } from './ai-classify.controller';
import { CustomFieldsModule } from '../custom-fields/custom-fields.module';

@Module({
  imports: [TelegramModule, PrismaModule, NotificationModule, CustomFieldsModule],
  controllers: [TaskController, AiClassifyController],
  providers: [TaskService, TaskRepository],
  exports: [TaskService],
})
export class TasksModule {}
