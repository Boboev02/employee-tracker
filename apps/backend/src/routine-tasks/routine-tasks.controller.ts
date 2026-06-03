import { Controller, Get, Post, Put, Delete, Patch, Param, Body, Query } from '@nestjs/common';
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
}
