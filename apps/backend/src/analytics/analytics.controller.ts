import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService }     from './analytics.service';
import { ReportService } from './report.service';
import { ActiveTimeService }    from './active-time.service';
import { ProductivityService }  from './productivity.service';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { RbacGuard }            from '../auth/guards/index';

@Controller('api/v1/analytics')
@UseGuards(RbacGuard)
export class AnalyticsController {
  constructor(
    private readonly reportService: ReportService,
    private readonly analytics:    AnalyticsService,
    private readonly activeTime:   ActiveTimeService,
    private readonly productivity: ProductivityService,
  ) {}

  @Get('stats')
  @RequirePermissions('analytics:view:org', 'analytics:view:team', 'analytics:view:self')
  getStats(@CurrentUser() user: any) {
    return this.analytics.getOrgStats(user.orgId);
  }

  @Get('tasks/by-status')
  @RequirePermissions('analytics:view:org', 'analytics:view:team')
  getByStatus(@CurrentUser() user: any) {
    return this.analytics.getTasksByStatus(user.orgId);
  }

  @Get('tasks/by-priority')
  @RequirePermissions('analytics:view:org', 'analytics:view:team')
  getByPriority(@CurrentUser() user: any) {
    return this.analytics.getTasksByPriority(user.orgId);
  }

  @Get('tasks/by-day')
  @RequirePermissions('analytics:view:org', 'analytics:view:team')
  getByDay(@CurrentUser() user: any, @Query('days') days?: string) {
    return this.analytics.getTasksCreatedByDay(user.orgId, days ? parseInt(days) : 14);
  }

  @Get('employees')
  @RequirePermissions('analytics:view:org', 'analytics:view:team')
  getEmployeeStats(@CurrentUser() user: any) {
    return this.analytics.getEmployeeStats(user.orgId);
  }

  @Get('activity/summary')
  @RequirePermissions('analytics:view:org', 'analytics:view:team', 'analytics:view:self')
  getActivitySummary(@CurrentUser() user: any, @Query('days') days?: string, @Query('userId') userId?: string) {
    // EMPLOYEE can only see own data
    const hasOrgView = user.permissions?.has('analytics:view:org') || user.permissions?.has('analytics:view:team');
    const targetUserId = hasOrgView ? userId : user.id;
    return this.activeTime.getActivitySummary(user.orgId, days ? parseInt(days) : 7, targetUserId);
  }

  @Get('activity/platforms')
  @RequirePermissions('analytics:view:org', 'analytics:view:team', 'analytics:view:self')
  getPlatformBreakdown(@CurrentUser() user: any, @Query('days') days?: string) {
    return this.activeTime.getPlatformBreakdown(user.orgId, days ? parseInt(days) : 7);
  }

  @Get('activity/hourly')
  @RequirePermissions('analytics:view:org', 'analytics:view:team', 'analytics:view:self')
  getHourlyActivity(@CurrentUser() user: any, @Query('userId') userId?: string) {
    const hasOrgView = user.permissions?.has('analytics:view:org') || user.permissions?.has('analytics:view:team');
    const targetUserId = hasOrgView ? userId : user.id;
    return this.activeTime.getHourlyActivity(user.orgId, targetUserId);
  }

  @Get('activity/total')
  @RequirePermissions('analytics:view:org', 'analytics:view:team', 'analytics:view:self')
  getTotalEvents(@CurrentUser() user: any) {
    return this.activeTime.getTotalEventCount(user.orgId);
  }

  @Get('full-report')
  async getReport(@CurrentUser() user: any, @Query('days') days = '7') {
    return this.reportService.getFullReport(user.orgId, parseInt(days));
  }

  @Get('productivity')
  @RequirePermissions('analytics:view:org', 'analytics:view:team')
  getProductivity(@CurrentUser() user: any, @Query('days') days?: string) {
    return this.productivity.getOrgProductivity(user.orgId, days ? parseInt(days) : 7);
  }

  @Get('activity/feed')
  async getFeed(@CurrentUser() user: any, @Query('limit') limit?: string) {
    return this.analytics.getActivityFeed(user.orgId, parseInt(limit||'50'));
  }
}
