import { Controller, Req, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, UseGuards } from '@nestjs/common';
import { TaskService } from './task.service';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { RbacGuard } from '../auth/guards/index';

@Controller('api/v1/tasks')
@UseGuards(RbacGuard)
export class TaskController {
  constructor(private readonly tasks: TaskService) {}

  @Get('kanban')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getKanban(@CurrentUser() user: any, @Query() q: any) {
    return this.tasks.getKanban(user.orgId, q, user);
  }

  @Get()
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getList(@CurrentUser() user: any, @Query() q: any) {
    return this.tasks.getList(user.orgId, q, user);
  }

  @Get(':id')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getById(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tasks.getById(id, user.orgId);
  }

  @Post()
  @RequirePermissions('task:create')
  create(@CurrentUser() user: any, @Body() body: any) {
    return this.tasks.create(user.orgId, user.id, body);
  }

  @Patch(':id')
  @RequirePermissions('task:update:any', 'task:update:self')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.tasks.update(id, user.orgId, user.id, body, user.permissions);
  }

  @Patch(':id/move')
  @RequirePermissions('task:update:any', 'task:update:self')
  move(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { status: string }) {
    return this.tasks.move(id, user.orgId, user.id, body.status, user.permissions);
  }

  @Post('cron/mark-overdue')
  async markOverdue(@Req() req: any) {
    const ip = req.ip || req.connection?.remoteAddress || '';
    if (!ip.includes('127.0.0.1') && !ip.includes('::1')) return { error: 'Forbidden' };
    return this.tasks.markOverdueTasks();
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('task:delete', 'task:update:self')
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tasks.delete(id, user.orgId, user.id, user.permissions);
  }

  @Post(':id/comments')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  addComment(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { content: string }) {
    return this.tasks.addComment(id, user.orgId, user.id, body.content);
  }
}
