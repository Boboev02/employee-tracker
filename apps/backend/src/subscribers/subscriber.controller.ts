import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { SubscriberService } from './subscriber.service';

@Controller('api/v1/subscribers')
export class SubscriberController {
  constructor(private readonly subscribers: SubscriberService) {}

  // ─── Специфичные (не-:id) роуты — ВСЕГДА раньше generic :id ────────────────

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

  @Get('templates')
  @RequirePermissions('crm:read')
  getTemplates(@CurrentUser() u: any, @Query('channel') channel?: string) { return this.subscribers.getTemplates(u.orgId, channel); }

  @Post('templates')
  @RequirePermissions('crm:write')
  createTemplate(@CurrentUser() u: any, @Body() body: any) { return this.subscribers.createTemplate(u.orgId, u.id ?? u.sub, body); }

  @Delete('templates/:id')
  @RequirePermissions('crm:write')
  deleteTemplate(@CurrentUser() u: any, @Param('id') id: string) { return this.subscribers.deleteTemplate(u.orgId, id); }

  @Delete('comments/:commentId')
  @RequirePermissions('crm:write')
  deleteComment(@CurrentUser() u: any, @Param('commentId') commentId: string) {
    return this.subscribers.deleteComment(u.orgId, commentId);
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

  // ─── Generic :id роуты ────────────────────────────────────────────────────

  @Get(':id')
  @RequirePermissions('crm:read')
  getSubscriber(@CurrentUser() u: any, @Param('id') id: string) { return this.subscribers.getSubscriber(u.orgId, id); }

  @Patch(':id')
  @RequirePermissions('crm:write')
  updateSubscriber(@CurrentUser() u: any, @Param('id') id: string, @Body() body: any) {
    return this.subscribers.updateSubscriber(u.orgId, id, u.id ?? u.sub, body);
  }

  @Get(':id/timeline')
  @RequirePermissions('crm:read')
  getTimeline(@CurrentUser() u: any, @Param('id') id: string) { return this.subscribers.getTimeline(u.orgId, id); }

  @Get(':id/comments')
  @RequirePermissions('crm:read')
  getComments(@CurrentUser() u: any, @Param('id') id: string) { return this.subscribers.getComments(u.orgId, id); }

  @Post(':id/comments')
  @RequirePermissions('crm:write')
  addComment(@CurrentUser() u: any, @Param('id') id: string, @Body() body: { content: string }) {
    return this.subscribers.addComment(u.orgId, id, u.id ?? u.sub, body.content);
  }

  @Get(':id/communications')
  @RequirePermissions('crm:read')
  getCommunications(@CurrentUser() u: any, @Param('id') id: string) { return this.subscribers.getCommunications(u.orgId, id); }

  @Post(':id/communications')
  @RequirePermissions('crm:write')
  logCommunication(@CurrentUser() u: any, @Param('id') id: string, @Body() body: { channel: string; content?: string; templateId?: string }) {
    return this.subscribers.logCommunication(u.orgId, id, u.id ?? u.sub, body);
  }
}
