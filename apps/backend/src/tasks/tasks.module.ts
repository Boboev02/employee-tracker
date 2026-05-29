import { Module } from '@nestjs/common';
import { TelegramModule } from '../telegram/telegram.module';
import { TaskController } from './task.controller';
import { TaskService } from './task.service';
import { TaskRepository } from './task.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [TelegramModule, PrismaModule],
  controllers: [TaskController],
  providers: [TaskService, TaskRepository],
  exports: [TaskService],
})
export class TasksModule {}
