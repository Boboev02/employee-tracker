import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode } from '@nestjs/common';
import { TaskService } from './task.service';
import { CurrentUser } from '../auth/decorators/index';

@Controller('api/v1/tasks')
export class TaskController {
  constructor(private readonly tasks: TaskService) {}

  @Get('kanban')
  getKanban(@CurrentUser() user: any, @Query() q: any) {
    return this.tasks.getKanban(user.orgId, q);
  }

  @Get()
  getList(@CurrentUser() user: any, @Query() q: any) {
    return this.tasks.getList(user.orgId, q);
  }

  @Get(':id')
  getById(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tasks.getById(id, user.orgId);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() body: any) {
    return this.tasks.create(user.orgId, user.id, body);
  }

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.tasks.update(id, user.orgId, user.id, body);
  }

  @Patch(':id/move')
  move(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { status: string }) {
    return this.tasks.move(id, user.orgId, user.id, body.status);
  }

  @Post('cron/mark-overdue')
  async markOverdue(@Req() req: any) {
    const ip = req.ip || req.connection?.remoteAddress || '';
    if (!ip.includes('127.0.0.1') && !ip.includes('::1')) return { error: 'Forbidden' };
    return this.tasks.markOverdueTasks();
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.tasks.delete(id, user.orgId, user.id);
  }

  @Post(':id/comments')
  addComment(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { content: string }) {
    return this.tasks.addComment(id, user.orgId, user.id, body.content);
  }
}
