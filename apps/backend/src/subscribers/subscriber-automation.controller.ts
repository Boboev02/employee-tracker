import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { CurrentUser, RequirePermissions, Public } from '../auth/decorators/index';
import { SubscriberAutomationService } from './subscriber-automation.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/v1/subscriber-automation')
export class SubscriberAutomationController {
  constructor(
    private readonly automation: SubscriberAutomationService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('rules')
  @RequirePermissions('crm:read')
  getRules(@CurrentUser() u: any) { return this.automation.getRules(u.orgId); }

  @Post('rules')
  @RequirePermissions('crm:write')
  createRule(@CurrentUser() u: any, @Body() body: any) { return this.automation.createRule(u.orgId, u.id ?? u.sub, body); }

  @Patch('rules/:id')
  @RequirePermissions('crm:write')
  updateRule(@CurrentUser() u: any, @Param('id') id: string, @Body() body: any) { return this.automation.updateRule(u.orgId, id, body); }

  @Delete('rules/:id')
  @RequirePermissions('crm:write')
  deleteRule(@CurrentUser() u: any, @Param('id') id: string) { return this.automation.deleteRule(u.orgId, id); }

  @Get('logs')
  @RequirePermissions('crm:read')
  getLogs(@CurrentUser() u: any, @Query('subscriberId') subscriberId?: string) { return this.automation.getLogs(u.orgId, subscriberId); }

  // Системный cron (раз в день) — обрабатывает правила "осталось X дней" / "не заходил X дней"
  @Public()
  @Post('cron/run-scheduled')
  async runScheduled(@Req() req: any) {
    const ip = req.ip || req.connection?.remoteAddress || '';
    if (!ip.includes('127.0.0.1') && !ip.includes('::1')) return { error: 'Forbidden' };
    const orgs = await this.prisma.organisation.findMany({ select: { id: true } });
    for (const org of orgs) await this.automation.runScheduledRules(org.id);
    return { ok: true, orgsProcessed: orgs.length };
  }
}
