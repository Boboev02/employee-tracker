import { Controller, Get, Post, Put, Delete, Patch, Param, Body, Query, UseGuards } from '@nestjs/common';
import { RoutineTasksService } from './routine-tasks.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { CurrentUser } from '../auth/decorators/index';
import { RequirePermissions } from '../auth/rbac/require-permissions.decorator';

@Controller('api/v1/routine-tasks')
@UseGuards(JwtAuthGuard)
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
  @RequirePermissions('tasks:create')
  createTemplate(@CurrentUser() user: any, @Body() dto: any) {
    return this.service.createTemplate(user.orgId, user.id, dto);
  }

  @Put(':id')
  @RequirePermissions('tasks:create')
  updateTemplate(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: any) {
    return this.service.updateTemplate(id, user.orgId, dto);
  }

  @Delete(':id')
  @RequirePermissions('tasks:create')
  deleteTemplate(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.deleteTemplate(id, user.orgId);
  }

  @Patch(':id/toggle')
  @RequirePermissions('tasks:create')
  toggleActive(@Param('id') id: string, @CurrentUser() user: any) {
    return this.service.toggleActive(id, user.orgId);
  }

  @Post('spawn')
  @RequirePermissions('tasks:create')
  spawnToday(@CurrentUser() user: any) {
    return this.service.spawnTasksForToday(user.orgId);
  }
}
