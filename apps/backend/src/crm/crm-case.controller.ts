import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { CrmCaseService } from './crm-case.service';

@Controller('api/v1/crm/cases')
export class CrmCaseController {
  constructor(private readonly cases: CrmCaseService) {}

  @Get()
  @RequirePermissions('crm:read')
  getCases(@CurrentUser() u: any, @Query() q: any) { return this.cases.getCases(u.orgId, q); }

  @Get('stats')
  @RequirePermissions('crm:read')
  getStats(@CurrentUser() u: any) { return this.cases.getStats(u.orgId); }

  @Post()
  @RequirePermissions('crm:write')
  createCase(@CurrentUser() u: any, @Body() body: any) { return this.cases.createCase(u.orgId, u.id ?? u.sub, body); }

  @Patch(':id')
  @RequirePermissions('crm:write')
  updateCase(@CurrentUser() u: any, @Param('id') id: string, @Body() body: any) { return this.cases.updateCase(u.orgId, id, body); }

  @Delete(':id')
  @RequirePermissions('crm:delete')
  deleteCase(@CurrentUser() u: any, @Param('id') id: string) { return this.cases.deleteCase(u.orgId, id); }
}
