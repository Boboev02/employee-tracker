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

  // ===== ЧЕКЛИСТЫ =====
  @Get(':id/checklists')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getChecklists(@Param('id') id: string) {
    return this.tasks.getChecklists(id);
  }

  @Post(':id/checklists')
  @RequirePermissions('task:update:any', 'task:update:self')
  addChecklist(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { text: string; assigneeId?: string }) {
    return this.tasks.addChecklist(id, user.orgId, user.id, body, user.permissions);
  }

  @Patch(':id/checklists/:checkId')
  @RequirePermissions('task:update:any', 'task:update:self')
  updateChecklist(@CurrentUser() user: any, @Param('id') id: string, @Param('checkId') checkId: string, @Body() body: { text?: string; isDone?: boolean; assigneeId?: string }) {
    return this.tasks.updateChecklist(id, checkId, user.orgId, user.id, body, user.permissions);
  }

  @Delete(':id/checklists/:checkId')
  @HttpCode(204)
  @RequirePermissions('task:update:any', 'task:update:self')
  deleteChecklist(@CurrentUser() user: any, @Param('id') id: string, @Param('checkId') checkId: string) {
    return this.tasks.deleteChecklist(id, checkId, user.orgId, user.id, user.permissions);
  }

  // ===== УЧАСТНИКИ ЗАДАЧИ =====
  @Get(':id/participants')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getParticipants(@Param('id') id: string) {
    return this.tasks.getParticipants(id);
  }

  @Post(':id/participants')
  @RequirePermissions('task:update:any', 'task:update:self')
  addParticipant(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { userId: string; role: 'co_executor' | 'observer' | 'reviewer' | 'approver' }) {
    return this.tasks.addParticipant(id, user.orgId, user.id, body, user.permissions);
  }

  @Delete(':id/participants/:userId')
  @HttpCode(204)
  @RequirePermissions('task:update:any', 'task:update:self')
  removeParticipant(@CurrentUser() user: any, @Param('id') id: string, @Param('userId') targetUserId: string) {
    return this.tasks.removeParticipant(id, targetUserId, user.orgId, user.id, user.permissions);
  }

  // ===== ДВОЙНОЙ ВИД — по отделам =====
  @Get('view/by-department')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getByDepartment(@CurrentUser() user: any, @Query() q: any) {
    return this.tasks.getByDepartment(user.orgId, q, user);
  }

  // ===== ДВОЙНОЙ ВИД — по карточкам товаров =====
  @Get('view/by-product')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getByProduct(@CurrentUser() user: any, @Query() q: any) {
    return this.tasks.getByProduct(user.orgId, q, user);
  }
}