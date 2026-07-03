import {
  Controller, Get, Post, Patch, Delete,
  Param, Body, Query, UseGuards, HttpCode,
} from '@nestjs/common';
import { CustomFieldsService } from './custom-fields.service';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { RbacGuard } from '../auth/guards/index';

@Controller('api/v1/custom-fields')
@UseGuards(RbacGuard)
export class CustomFieldsController {
  constructor(private readonly svc: CustomFieldsService) {}

  // ─── Fields ────────────────────────────────────────────────────────────

  @Get()
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getFields(@CurrentUser() u: any, @Query('projectId') projectId?: string) {
    return this.svc.getFields(u.orgId, projectId);
  }

  @Post()
  @RequirePermissions('custom_field:manage')
  createField(@CurrentUser() u: any, @Body() body: any) {
    return this.svc.createField(u.orgId, body);
  }

  @Patch(':id')
  @RequirePermissions('custom_field:manage')
  updateField(@CurrentUser() u: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateField(id, u.orgId, body);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('custom_field:delete')
  deleteField(@CurrentUser() u: any, @Param('id') id: string) {
    return this.svc.deleteField(id, u.orgId);
  }

  @Post('reorder')
  @RequirePermissions('custom_field:manage')
  reorderFields(@CurrentUser() u: any, @Body() body: { orders: { id: string; sortOrder: number }[] }) {
    return this.svc.reorderFields(u.orgId, body.orders);
  }

  @Patch(':id/projects')
  @RequirePermissions('custom_field:manage')
  setProjects(@CurrentUser() u: any, @Param('id') id: string, @Body() body: { projectIds: string[] }) {
    return this.svc.setFieldProjects(id, u.orgId, body.projectIds);
  }

  // ─── Values ────────────────────────────────────────────────────────────

  @Get('values/:taskId')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getValues(@CurrentUser() u: any, @Param('taskId') taskId: string) {
    return this.svc.getTaskFieldValues(taskId, u.orgId);
  }

  @Patch('values/:taskId')
  @RequirePermissions('task:update:any', 'task:update:self')
  setValues(@CurrentUser() u: any, @Param('taskId') taskId: string, @Body() body: Record<string, any>) {
    return this.svc.setTaskFieldValues(taskId, u.orgId, body);
  }

  @Post('values/bulk')
  @RequirePermissions('task:update:any')
  bulkSet(@CurrentUser() u: any, @Body() body: { taskIds: string[]; fieldId: string; value: any }) {
    return this.svc.bulkSetFieldValue(body.taskIds, u.orgId, body.fieldId, body.value);
  }

  // ─── Groups ────────────────────────────────────────────────────────────

  @Get('groups')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getGroups(@CurrentUser() u: any) {
    return this.svc.getGroups(u.orgId);
  }

  @Post('groups')
  @RequirePermissions('custom_field:manage')
  createGroup(@CurrentUser() u: any, @Body() body: any) {
    return this.svc.createGroup(u.orgId, body);
  }

  @Patch('groups/:id')
  @RequirePermissions('custom_field:manage')
  updateGroup(@CurrentUser() u: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateGroup(id, u.orgId, body);
  }

  @Delete('groups/:id')
  @HttpCode(204)
  @RequirePermissions('custom_field:manage')
  deleteGroup(@CurrentUser() u: any, @Param('id') id: string) {
    return this.svc.deleteGroup(id, u.orgId);
  }

  // ─── Task Types ────────────────────────────────────────────────────────

  @Get('task-types')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getTaskTypes(@CurrentUser() u: any) {
    return this.svc.getTaskTypes(u.orgId);
  }

  @Post('task-types')
  @RequirePermissions('custom_field:manage')
  createTaskType(@CurrentUser() u: any, @Body() body: any) {
    return this.svc.createTaskType(u.orgId, body);
  }

  @Patch('task-types/:id')
  @RequirePermissions('custom_field:manage')
  updateTaskType(@CurrentUser() u: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateTaskType(id, u.orgId, body);
  }

  @Delete('task-types/:id')
  @HttpCode(204)
  @RequirePermissions('custom_field:manage')
  deleteTaskType(@CurrentUser() u: any, @Param('id') id: string) {
    return this.svc.deleteTaskType(id, u.orgId);
  }

  @Patch('task-types/:id/fields')
  @RequirePermissions('custom_field:manage')
  setTaskTypeFields(
    @CurrentUser() u: any,
    @Param('id') id: string,
    @Body() body: { fieldIds: string[] },
  ) {
    return this.svc.setTaskTypeFields(id, u.orgId, body.fieldIds);
  }

  // ─── Conditions ────────────────────────────────────────────────────────

  @Get('conditions')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getConditions(@CurrentUser() u: any) {
    return this.svc.getConditions(u.orgId);
  }

  @Post('conditions')
  @RequirePermissions('custom_field:manage')
  createCondition(@CurrentUser() u: any, @Body() body: any) {
    return this.svc.createCondition(u.orgId, body);
  }

  @Delete('conditions/:id')
  @HttpCode(204)
  @RequirePermissions('custom_field:manage')
  deleteCondition(@CurrentUser() u: any, @Param('id') id: string) {
    return this.svc.deleteCondition(id, u.orgId);
  }

  // ─── Saved Filters ─────────────────────────────────────────────────────

  @Get('saved-filters')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getSavedFilters(@CurrentUser() u: any) {
    return this.svc.getSavedFilters(u.orgId, u.id);
  }

  @Post('saved-filters')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  createSavedFilter(@CurrentUser() u: any, @Body() body: any) {
    return this.svc.createSavedFilter(u.orgId, u.id, body);
  }

  @Delete('saved-filters/:id')
  @HttpCode(204)
  deleteSavedFilter(@CurrentUser() u: any, @Param('id') id: string) {
    return this.svc.deleteSavedFilter(id, u.orgId, u.id);
  }
}
