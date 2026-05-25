import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import { Response } from 'express';
import { ExportService } from './export.service';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { RbacGuard } from '../auth/guards/index';

@Controller('api/v1/export')
@UseGuards(RbacGuard)
export class ExportController {
  constructor(private readonly export_: ExportService) {}

  @Get('activity')
  @RequirePermissions('analytics:view:org', 'analytics:view:team', 'tracking:export')
  async exportActivity(
    @CurrentUser() user: any,
    @Query('days') days: string,
    @Res() res: Response,
  ) {
    const csv = await this.export_.exportActivity(user.orgId, parseInt(days ?? '7'));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="activity-report.csv"');
    res.send('\uFEFF' + csv); // BOM for Excel UTF-8
  }

  @Get('employees')
  @RequirePermissions('user:read:all', 'user:read:team')
  async exportEmployees(@CurrentUser() user: any, @Res() res: Response) {
    const csv = await this.export_.exportEmployees(user.orgId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="employees-report.csv"');
    res.send('\uFEFF' + csv);
  }

  @Get('tasks')
  @RequirePermissions('task:read:all', 'task:read:team', 'report:view')
  async exportTasks(@CurrentUser() user: any, @Res() res: Response) {
    const csv = await this.export_.exportTasks(user.orgId);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="tasks-report.csv"');
    res.send('\uFEFF' + csv);
  }

  @Get('productivity')
  @RequirePermissions('analytics:view:org', 'analytics:view:team', 'report:view')
  async exportProductivity(
    @CurrentUser() user: any,
    @Query('days') days: string,
    @Res() res: Response,
  ) {
    const csv = await this.export_.exportProductivity(user.orgId, parseInt(days ?? '7'));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename="productivity-report.csv"');
    res.send('\uFEFF' + csv);
  }
}
