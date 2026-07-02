import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, UseGuards } from '@nestjs/common';
import { ProjectsService } from './projects.service';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { RbacGuard } from '../auth/guards/index';

@Controller('api/v1/projects')
@UseGuards(RbacGuard)
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}

  @Get()
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getAll(@CurrentUser() user: any, @Query() q: any) {
    return this.projects.getAll(user.orgId, user.id ?? user.sub, q);
  }

  @Get(':id')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getById(@CurrentUser() user: any, @Param('id') id: string) {
    return this.projects.getById(user.orgId, id);
  }

  @Get(':id/stats')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getStats(@CurrentUser() user: any, @Param('id') id: string) {
    return this.projects.getStats(user.orgId, id);
  }

  @Post()
  @RequirePermissions('task:create')
  create(@CurrentUser() user: any, @Body() body: any) {
    return this.projects.create(user.orgId, user.id ?? user.sub, body);
  }

  @Patch(':id')
  @RequirePermissions('task:update:any', 'task:update:self')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.projects.update(user.orgId, id, user.id ?? user.sub, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('task:delete')
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.projects.delete(user.orgId, id, user.id ?? user.sub);
  }

  @Post(':id/members')
  @RequirePermissions('task:update:any')
  addMember(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { userId: string; role?: string }) {
    return this.projects.addMember(user.orgId, id, user.id ?? user.sub, body.userId, body.role);
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  @RequirePermissions('task:update:any')
  removeMember(@CurrentUser() user: any, @Param('id') id: string, @Param('userId') userId: string) {
    return this.projects.removeMember(id, user.id ?? user.sub, userId);
  }

  @Post(':id/comments')
  @RequirePermissions('task:read:self')
  addComment(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { content: string }) {
    return this.projects.addComment(id, user.id ?? user.sub, body.content);
  }
}
