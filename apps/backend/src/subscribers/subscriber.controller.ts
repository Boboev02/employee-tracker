import { Controller, Get, Post, Patch, Body, Param, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { SubscriberService } from './subscriber.service';

@Controller('api/v1/subscribers')
export class SubscriberController {
  constructor(private readonly subscribers: SubscriberService) {}

  @Get()
  @RequirePermissions('crm:read')
  getSubscribers(@CurrentUser() u: any, @Query() q: any) { return this.subscribers.getSubscribers(u.orgId, q); }

  @Get('stats')
  @RequirePermissions('crm:read')
  getStats(@CurrentUser() u: any) { return this.subscribers.getStats(u.orgId); }

  @Get('group-counts')
  @RequirePermissions('crm:read')
  getGroupCounts(@CurrentUser() u: any, @Query('by') by: 'plan' | 'crmStatus' | 'managerId') {
    return this.subscribers.getGroupCounts(u.orgId, by ?? 'plan');
  }

  @Get(':id')
  @RequirePermissions('crm:read')
  getSubscriber(@CurrentUser() u: any, @Param('id') id: string) { return this.subscribers.getSubscriber(u.orgId, id); }

  @Patch(':id')
  @RequirePermissions('crm:write')
  updateSubscriber(@CurrentUser() u: any, @Param('id') id: string, @Body() body: any) {
    return this.subscribers.updateSubscriber(u.orgId, id, u.id ?? u.sub, body);
  }

  @Get('integrations/:name')
  @RequirePermissions('crm:read')
  getIntegration(@CurrentUser() u: any, @Param('name') name: string) { return this.subscribers.getIntegration(u.orgId, name); }

  @Post('integrations/:name')
  @RequirePermissions('org:update')
  saveIntegration(@CurrentUser() u: any, @Param('name') name: string, @Body() body: any) {
    return this.subscribers.saveIntegration(u.orgId, name, body);
  }

  @Post('integrations/:name/sync')
  @RequirePermissions('crm:write')
  sync(@CurrentUser() u: any, @Param('name') name: string) { return this.subscribers.syncNow(u.orgId, name); }
}
