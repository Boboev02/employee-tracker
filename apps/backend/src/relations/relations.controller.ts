import { Controller, Get, Post, Delete, Param, Body, Query, HttpCode, UseGuards } from '@nestjs/common';
import { RelationsService } from './relations.service';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { RbacGuard } from '../auth/guards/index';

@Controller('api/v1/relations')
@UseGuards(RbacGuard)
export class RelationsController {
  constructor(private readonly svc: RelationsService) {}

  // ─── Create relation ────────────────────────────────────────────────────

  @Post()
  @RequirePermissions('task:update:any', 'task:update:self', 'task:create')
  createRelation(@CurrentUser() user: any, @Body() body: any) {
    return this.svc.createRelation(user.orgId, user.id ?? user.sub, body);
  }

  // ─── Get relations for entity ───────────────────────────────────────────

  @Get(':entityType/:entityId')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getRelations(
    @CurrentUser() user: any,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('relationType') relationType?: string,
  ) {
    return this.svc.getRelations(user.orgId, entityType.toUpperCase(), entityId, relationType);
  }

  // ─── Get related entities by type ──────────────────────────────────────

  @Get(':entityType/:entityId/by-type/:targetType')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getRelatedByType(
    @CurrentUser() user: any,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Param('targetType') targetType: string,
  ) {
    return this.svc.getRelatedByType(
      user.orgId,
      entityType.toUpperCase(),
      entityId,
      targetType.toUpperCase(),
    );
  }

  // ─── Delete relation ────────────────────────────────────────────────────

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('task:update:any', 'task:update:self')
  deleteRelation(@CurrentUser() user: any, @Param('id') id: string) {
    return this.svc.deleteRelation(id, user.orgId, user.id ?? user.sub);
  }

  // ─── Activity log ───────────────────────────────────────────────────────

  @Get('activity/:entityType/:entityId')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getActivityLog(
    @CurrentUser() user: any,
    @Param('entityType') entityType: string,
    @Param('entityId') entityId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    return this.svc.getActivityLog(
      user.orgId,
      entityType.toUpperCase(),
      entityId,
      parseInt(limit ?? '50'),
      parseInt(offset ?? '0'),
    );
  }

  // ─── Search entities for picker ─────────────────────────────────────────

  @Get('search/:entityType')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  searchEntities(
    @CurrentUser() user: any,
    @Param('entityType') entityType: string,
    @Query('q') q: string,
  ) {
    return this.svc.searchEntities(user.orgId, entityType.toUpperCase(), q ?? '');
  }
}
