import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, UseGuards } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { RbacGuard } from '../auth/guards/index';

@Controller('api/v1/teams')
@UseGuards(RbacGuard)
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  @RequirePermissions('team:read:all')
  getAll(@CurrentUser() user: any) {
    return this.teams.getAll(user.orgId);
  }

  @Get(':id')
  @RequirePermissions('team:read:all')
  getById(@CurrentUser() user: any, @Param('id') id: string) {
    return this.teams.getById(id, user.orgId);
  }

  @Post()
  @RequirePermissions('team:create')
  create(@CurrentUser() user: any, @Body() body: { name: string }) {
    return this.teams.create(user.orgId, body.name);
  }

  @Patch(':id')
  @RequirePermissions('team:update')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { name: string }) {
    return this.teams.update(id, user.orgId, body.name);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('team:update')
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.teams.delete(id, user.orgId);
  }

  @Post(':id/members')
  @RequirePermissions('team:members:manage')
  addMember(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { userId: string }) {
    return this.teams.addMember(id, user.orgId, body.userId);
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  @RequirePermissions('team:members:manage')
  removeMember(@CurrentUser() user: any, @Param('id') id: string, @Param('userId') userId: string) {
    return this.teams.removeMember(id, user.orgId, userId);
  }
}
