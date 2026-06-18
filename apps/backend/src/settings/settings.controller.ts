import { Controller, Get, Put, Post, Body, HttpCode } from '@nestjs/common';
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

  @Get('wb-token')
  @RequirePermissions('org:update')
  async getWbToken(@CurrentUser() user: any) {
    const token = await this.settings.getWbToken(user.orgId);
    return { hasToken: !!token, tokenPreview: token ? token.slice(0, 8) + '...' : null };
  }

  @Post('wb-token')
  @HttpCode(200)
  @RequirePermissions('org:update')
  async setWbToken(@CurrentUser() user: any, @Body() body: { token: string }) {
    if (!body?.token) return { error: 'Token required' };
    await this.settings.setWbToken(user.orgId, body.token);
    return { success: true };
  }
}
