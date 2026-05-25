import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { TimesheetService } from './timesheet.service';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { RbacGuard } from '../auth/guards/index';

@Controller('api/v1/timesheet')
@UseGuards(RbacGuard)
export class TimesheetController {
  constructor(private readonly timesheet: TimesheetService) {}

  @Get()
  @RequirePermissions('analytics:view:org', 'analytics:view:team', 'tracking:view:all')
  getTimesheet(
    @CurrentUser() user: any,
    @Query('days') days?: string,
    @Query('userId') userId?: string,
  ) {
    return this.timesheet.getTimesheet(user.orgId, days ? parseInt(days) : 14, userId);
  }
}
