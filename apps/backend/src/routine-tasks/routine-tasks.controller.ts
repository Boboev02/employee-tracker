import { Controller, Get, Post, Put, Delete, Patch, Param, Body, Query, Req } from '@nestjs/common';
import { RoutineTasksService } from './routine-tasks.service';
import { CurrentUser } from '../auth/decorators/index';

@Controller('api/v1/routine-tasks')
export class RoutineTasksController {
  constructor(private readonly service: RoutineTasksService) {}

  @Get()
  getTemplates(@CurrentUser() user: any) {
    return this.service.getTemplates(user.orgId);
  }

  @Get('stats')
  getStats(@CurrentUser() user: any, @Query('days') days?: string) {
    return this.service.getStats(user.orgId, days ? parseInt(days) : 7);
  }

  @Post()
  createTemplate(@CurrentUser() user: any, @Body() dto: any) {
    return this.service.createTemplate(user.orgId, user.id, dto);
  }

  @Put(':id')
  updateTemplate(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: any) {
    return this.service.updateTemplate(id, user.orgId, dto);
  }

  @Delete(':id')
  deleteTemplate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.deleteTemplate(id, user.orgId);
  }

  @Patch(':id/toggle')
  toggleActive(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.toggleActive(id, user.orgId);
  }

  @Post('spawn')
  spawnToday(@CurrentUser() user: any) {
    return this.service.spawnTasksForToday(user.orgId);
  }

  // Internal cron endpoint — only from localhost
  @Post('cron/spawn-all')
  async cronSpawnAll(@Req() req: any) {
    const ip = req.ip || req.connection?.remoteAddress || '';
    if (!ip.includes('127.0.0.1') && !ip.includes('::1') && !ip.includes('localhost')) {
      return { error: 'Forbidden' };
    }
    const orgs = await this.service['prisma'].organisation.findMany({ select: { id: true } });
    const results = [];
    for (const org of orgs) {
      const r = await this.service.spawnTasksForToday(org.id);
      results.push({ orgId: org.id, ...r });
    }
    return { results, spawned: results.reduce((s: number, r: any) => s + (r.created || 0), 0) };
  }
}
