import { Controller, Get, Post, Patch, Delete, Body, Param, Query, Req } from '@nestjs/common';
import { CurrentUser, RequirePermissions, Public } from '../auth/decorators/index';
import { CrmAutomationService } from './crm-automation.service';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/v1/crm/automation')
export class CrmAutomationController {
  constructor(
    private readonly automation: CrmAutomationService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('rules')
  @RequirePermissions('crm:read')
  getRules(@CurrentUser() u: any, @Query('entityType') entityType?: string) {
    return this.automation.getRules(u.orgId, entityType);
  }

  @Post('rules')
  @RequirePermissions('crm:write')
  createRule(@CurrentUser() u: any, @Body() body: any) {
    return this.automation.createRule(u.orgId, u.id ?? u.sub, body);
  }

  @Patch('rules/:id')
  @RequirePermissions('crm:write')
  updateRule(@CurrentUser() u: any, @Param('id') id: string, @Body() body: any) {
    return this.automation.updateRule(u.orgId, id, body);
  }

  @Delete('rules/:id')
  @RequirePermissions('crm:delete')
  deleteRule(@CurrentUser() u: any, @Param('id') id: string) {
    return this.automation.deleteRule(u.orgId, id);
  }

  @Get('logs')
  @RequirePermissions('crm:read')
  getLogs(@CurrentUser() u: any, @Query('entityId') entityId?: string) {
    return this.automation.getLogs(u.orgId, entityId);
  }

  // Вызывается системным cron (crontab) раз в час — обрабатывает правила "прошло N времени"
  @Public()
  @Post('cron/run-time-elapsed')
  async runTimeElapsed(@Req() req: any) {
    const ip = req.ip || req.connection?.remoteAddress || '';
    if (!ip.includes('127.0.0.1') && !ip.includes('::1')) return { error: 'Forbidden' };
    const orgs = await this.prisma.organisation.findMany({ select: { id: true } });
    for (const org of orgs) {
      await this.automation.runTimeElapsedRules(org.id);
      await this.automation.runDateApproachingRules(org.id);
    }
    return { ok: true, orgsProcessed: orgs.length };
  }
}
