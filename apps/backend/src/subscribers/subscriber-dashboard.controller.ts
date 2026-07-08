import { Controller, Get, Post, Body, Param, Query, Res } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { SubscriberDashboardService } from './subscriber-dashboard.service';

@Controller('api/v1/subscriber-dashboard')
export class SubscriberDashboardController {
  constructor(private readonly dashboard: SubscriberDashboardService) {}

  @Get('widgets')
  @RequirePermissions('crm:read')
  getWidgets(@CurrentUser() u: any) { return this.dashboard.getWidgets(u.orgId); }

  @Get('charts')
  @RequirePermissions('crm:read')
  getCharts(@CurrentUser() u: any) { return this.dashboard.getCharts(u.orgId); }

  @Get('reports')
  @RequirePermissions('crm:read')
  getReports(@CurrentUser() u: any) { return this.dashboard.getReports(u.orgId); }

  @Post('export/excel')
  @RequirePermissions('crm:read')
  async exportExcel(@CurrentUser() u: any, @Body() body: { ids?: string[] }, @Res() res: any) {
    const buffer = await this.dashboard.exportSubscribersExcel(u.orgId, body?.ids);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename="subscribers.xlsx"');
    res.send(buffer);
  }

  @Get('pricing')
  @RequirePermissions('crm:read')
  getPricing(@CurrentUser() u: any) { return this.dashboard.getPricing(u.orgId); }

  @Post('pricing/:plan')
  @RequirePermissions('org:update')
  savePricing(@CurrentUser() u: any, @Param('plan') plan: string, @Body() body: { monthlyPrice: number }) {
    return this.dashboard.savePricing(u.orgId, plan, body.monthlyPrice);
  }

  @Get('layout')
  @RequirePermissions('crm:read')
  getLayout(@CurrentUser() u: any) { return this.dashboard.getLayout(u.orgId, u.id ?? u.sub); }

  @Post('layout')
  @RequirePermissions('crm:read')
  saveLayout(@CurrentUser() u: any, @Body() body: { widgetOrder: string[] }) {
    return this.dashboard.saveLayout(u.orgId, u.id ?? u.sub, body.widgetOrder);
  }
}
