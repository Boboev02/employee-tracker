import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { SubscriberSettingsService } from './subscriber-settings.service';

@Controller('api/v1/subscriber-settings')
export class SubscriberSettingsController {
  constructor(private readonly settings: SubscriberSettingsService) {}

  @Get('statuses')
  @RequirePermissions('crm:read')
  getStatuses(@CurrentUser() u: any) { return this.settings.getStatuses(u.orgId); }

  @Post('statuses')
  @RequirePermissions('org:update')
  createStatus(@CurrentUser() u: any, @Body() body: any) { return this.settings.createStatus(u.orgId, body); }

  @Delete('statuses/:id')
  @RequirePermissions('org:update')
  deleteStatus(@CurrentUser() u: any, @Param('id') id: string) { return this.settings.deleteStatus(u.orgId, id); }

  @Get('tags')
  @RequirePermissions('crm:read')
  getTags(@CurrentUser() u: any) { return this.settings.getTags(u.orgId); }

  @Post('tags')
  @RequirePermissions('crm:write')
  createTag(@CurrentUser() u: any, @Body() body: { name: string; color?: string }) { return this.settings.createTag(u.orgId, body.name, body.color); }

  @Delete('tags/:id')
  @RequirePermissions('crm:write')
  deleteTag(@CurrentUser() u: any, @Param('id') id: string) { return this.settings.deleteTag(u.orgId, id); }

  @Get('cancel-reasons')
  @RequirePermissions('crm:read')
  getCancelReasons(@CurrentUser() u: any) { return this.settings.getCancelReasons(u.orgId); }

  @Post('cancel-reasons')
  @RequirePermissions('org:update')
  createCancelReason(@CurrentUser() u: any, @Body() body: { label: string }) { return this.settings.createCancelReason(u.orgId, body.label); }

  @Delete('cancel-reasons/:id')
  @RequirePermissions('org:update')
  deleteCancelReason(@CurrentUser() u: any, @Param('id') id: string) { return this.settings.deleteCancelReason(u.orgId, id); }

  @Get('views')
  @RequirePermissions('crm:read')
  getSavedViews(@CurrentUser() u: any) { return this.settings.getSavedViews(u.orgId, u.id ?? u.sub); }

  @Post('views')
  @RequirePermissions('crm:read')
  createSavedView(@CurrentUser() u: any, @Body() body: { name: string; filters: any }) {
    return this.settings.createSavedView(u.orgId, u.id ?? u.sub, body.name, body.filters);
  }

  @Delete('views/:id')
  @RequirePermissions('crm:read')
  deleteSavedView(@CurrentUser() u: any, @Param('id') id: string) { return this.settings.deleteSavedView(u.orgId, u.id ?? u.sub, id); }
}
