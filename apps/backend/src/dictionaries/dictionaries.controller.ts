import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, UseGuards } from '@nestjs/common';
import { DictionariesService } from './dictionaries.service';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { RbacGuard } from '../auth/guards/index';

@Controller('api/v1/dictionaries')
@UseGuards(RbacGuard)
export class DictionariesController {
  constructor(private readonly dicts: DictionariesService) {}

  // ===== ОТДЕЛЫ =====
  @Get('departments')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getDepartments(@CurrentUser() user: any) {
    return this.dicts.getDepartments(user.orgId);
  }

  @Post('departments')
  @RequirePermissions('org:update')
  createDepartment(@CurrentUser() user: any, @Body() body: { name: string; color?: string }) {
    return this.dicts.createDepartment(user.orgId, body);
  }

  @Patch('departments/:id')
  @RequirePermissions('org:update')
  updateDepartment(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.dicts.updateDepartment(user.orgId, id, body);
  }

  @Delete('departments/:id')
  @HttpCode(204)
  @RequirePermissions('org:update')
  deleteDepartment(@CurrentUser() user: any, @Param('id') id: string) {
    return this.dicts.deleteDepartment(user.orgId, id);
  }

  // ===== СТАДИИ КАРТОЧЕК =====
  @Get('card-stages')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getCardStages(@CurrentUser() user: any) {
    return this.dicts.getCardStages(user.orgId);
  }

  @Post('card-stages')
  @RequirePermissions('org:update')
  createCardStage(@CurrentUser() user: any, @Body() body: { name: string; description?: string; color?: string }) {
    return this.dicts.createCardStage(user.orgId, body);
  }

  @Patch('card-stages/:id')
  @RequirePermissions('org:update')
  updateCardStage(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.dicts.updateCardStage(user.orgId, id, body);
  }

  @Delete('card-stages/:id')
  @HttpCode(204)
  @RequirePermissions('org:update')
  deleteCardStage(@CurrentUser() user: any, @Param('id') id: string) {
    return this.dicts.deleteCardStage(user.orgId, id);
  }

  // Инициализация дефолтных значений (вызывается при онбординге)
  @Post('init-defaults')
  @RequirePermissions('org:update')
  initDefaults(@CurrentUser() user: any) {
    return this.dicts.initDefaults(user.orgId);
  }
}
