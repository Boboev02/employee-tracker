import { Controller, Get, Put, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';

@Controller('api/v1/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('work-hours')
  getWorkHours(@CurrentUser() user: any) {
    return this.settings.getWorkHours(user.orgId);
  }

  @Put('work-hours')
  @RequirePermissions('org:update')
  setWorkHours(@CurrentUser() user: any, @Body() body: any) {
    return this.settings.setWorkHours(user.orgId, body);
  }
}
