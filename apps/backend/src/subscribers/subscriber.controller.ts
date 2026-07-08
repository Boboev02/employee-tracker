import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { CurrentUser, RequirePermissions, Public } from '../auth/decorators/index';
import { SubscriberService } from './subscriber.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/v1/subscribers')
export class SubscriberController {
  constructor(
    private readonly subscribers: SubscriberService,
    private readonly prisma: PrismaService,
  ) {}

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

  @Get('reminders')
  @RequirePermissions('crm:read')
  getReminders(@CurrentUser() u: any) { return this.subscribers.getReminders(u.orgId); }

  @Get('reminders/summary')
  @RequirePermissions('crm:read')
  getRemindersSummary(@CurrentUser() u: any) { return this.subscribers.getRemindersSummary(u.orgId); }

  // Системный cron (раз в день) — отправляет ежедневную сводку менеджерам
  @Public()
  @Post('cron/daily-summary')
  async dailySummary(@Req() req: any) {
    const ip = req.ip || req.connection?.remoteAddress || '';
    const isLocal = ip.includes('127.0.0.1') || ip.includes('::1') || /^(::ffff:)?(172\.(1[6-9]|2\d|3[01])\.|10\.|192\.168\.)/.test(ip);
    if (!isLocal) return { error: 'Forbidden' };
    const orgs = await this.prisma.organisation.findMany({ select: { id: true } });
    const results = [];
    for (const org of orgs) results.push(await this.subscribers.sendDailySummary(org.id));
    return { ok: true, orgsProcessed: orgs.length, results };
  }

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

  @Get(':id/tasks')
  @RequirePermissions('crm:read')
  getTasks(@CurrentUser() u: any, @Param('id') id: string) { return this.subscribers.getLinkedTasks(u.orgId, id); }
}
