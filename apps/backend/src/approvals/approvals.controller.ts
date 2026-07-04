import {
  Controller, Get, Post, Put, Patch, Delete,
  Param, Body, Query, HttpCode, UseGuards,
} from '@nestjs/common';
import { ApprovalsService } from './approvals.service';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { RbacGuard } from '../auth/guards/index';

@Controller('api/v1/approvals')
@UseGuards(RbacGuard)
export class ApprovalsController {
  constructor(private readonly svc: ApprovalsService) {}

  // ─── Stats ──────────────────────────────────────────────────────────────────

  @Get('stats')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getStats(@CurrentUser() u: any) {
    return this.svc.getStats(u.orgId);
  }

  // ─── Flows ──────────────────────────────────────────────────────────────────

  @Get('flows')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getFlows(@CurrentUser() u: any) {
    return this.svc.getFlows(u.orgId);
  }

  @Post('flows')
  @RequirePermissions('custom_field:manage')
  createFlow(@CurrentUser() u: any, @Body() body: any) {
    return this.svc.createFlow(u.orgId, u.id ?? u.sub, body);
  }

  @Patch('flows/:id')
  @RequirePermissions('custom_field:manage')
  updateFlow(@CurrentUser() u: any, @Param('id') id: string, @Body() body: any) {
    return this.svc.updateFlow(id, u.orgId, body);
  }

  @Delete('flows/:id')
  @HttpCode(204)
  @RequirePermissions('custom_field:manage')
  deleteFlow(@CurrentUser() u: any, @Param('id') id: string) {
    return this.svc.deleteFlow(id, u.orgId);
  }

  @Put('flows/:id/steps')
  @RequirePermissions('custom_field:manage')
  setSteps(@CurrentUser() u: any, @Param('id') id: string, @Body() body: { steps: any[] }) {
    return this.svc.setSteps(id, u.orgId, body.steps);
  }

  // ─── Requests ───────────────────────────────────────────────────────────────

  @Get('requests')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getRequests(@CurrentUser() u: any, @Query() q: any) {
    return this.svc.getRequests(u.orgId, q);
  }

  @Get('requests/my-decisions')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getMyDecisions(@CurrentUser() u: any) {
    return this.svc.getMyPendingDecisions(u.orgId, u.id ?? u.sub);
  }

  @Get('requests/by-entity/:entityType/:entityId')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getByEntity(@CurrentUser() u: any, @Param('entityType') et: string, @Param('entityId') eid: string) {
    return this.svc.getRequests(u.orgId, { entityType: et, entityId: eid });
  }

  @Post('requests')
  @RequirePermissions('task:create', 'task:update:any', 'task:update:self')
  createRequest(@CurrentUser() u: any, @Body() body: any) {
    return this.svc.createRequest(u.orgId, u.id ?? u.sub, body);
  }

  @Post('requests/:id/decide')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  decide(@CurrentUser() u: any, @Param('id') id: string, @Body() body: { status: 'APPROVED' | 'REJECTED'; comment?: string }) {
    return this.svc.decide(id, u.orgId, u.id ?? u.sub, body);
  }

  @Post('requests/:id/cancel')
  @HttpCode(200)
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  cancelRequest(@CurrentUser() u: any, @Param('id') id: string) {
    return this.svc.cancelRequest(id, u.orgId, u.id ?? u.sub);
  }
}
