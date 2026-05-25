import { Module } from '@nestjs/common';
import { AnalyticsController }   from './analytics.controller';
import { AnalyticsService }      from './analytics.service';
import { ReportService } from './report.service';
import { ActiveTimeService }     from './active-time.service';
import { ProductivityService }   from './productivity.service';
import { ExportService }         from './export.service';
import { ExportController }      from './export.controller';
import { TimesheetService }      from './timesheet.service';
import { TimesheetController }   from './timesheet.controller';
import { PrismaModule }          from '../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  controllers: [AnalyticsController, ExportController, TimesheetController],
  providers:   [AnalyticsService, ActiveTimeService, ProductivityService, ExportService, TimesheetService, ReportService],
})
export class AnalyticsModule {}
