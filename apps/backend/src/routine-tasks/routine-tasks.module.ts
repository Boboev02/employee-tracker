import { Module } from '@nestjs/common';
import { RoutineTasksController } from './routine-tasks.controller';
import { RoutineTasksService } from './routine-tasks.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [RoutineTasksController],
  providers: [RoutineTasksService],
  exports: [RoutineTasksService],
})
export class RoutineTasksModule {}
