import { Module } from '@nestjs/common';
import { TrackingController, TrackingAdminController }     from './tracking.controller';
import { TrackingService }        from './tracking.service';
import { WorkSessionService }     from './work-session.service';
import { WorkSessionController }  from './work-session.controller';
import { PrismaModule }           from '../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  controllers: [TrackingController, WorkSessionController],
  providers:   [TrackingService, WorkSessionService],
  exports:     [TrackingService, WorkSessionService],
})
export class TrackingModule {}
