import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, UseGuards } from '@nestjs/common';
import { CrmService } from './crm.service';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { RbacGuard } from '../auth/guards/index';

@Controller('api/v1/crm')
@UseGuards(RbacGuard)
export class CrmController {
  constructor(private readonly crm: CrmService) {}

  // ===== ЛИДЫ =====
  @Get('leads')
  @RequirePermissions('crm:read')
  getLeads(@CurrentUser() u: any, @Query() q: any) { return this.crm.getLeads(u.orgId, q); }

  @Post('leads')
  @RequirePermissions('crm:write')
  createLead(@CurrentUser() u: any, @Body() body: any) { return this.crm.createLead(u.orgId, u.id ?? u.sub, body); }

  @Patch('leads/:id')
  @RequirePermissions('crm:write')
  updateLead(@CurrentUser() u: any, @Param('id') id: string, @Body() body: any) { return this.crm.updateLead(u.orgId, id, u.id ?? u.sub, body); }

  @Delete('leads/:id')
  @HttpCode(204)
  @RequirePermissions('crm:delete')
  deleteLead(@CurrentUser() u: any, @Param('id') id: string) { return this.crm.deleteLead(u.orgId, id); }

  // ===== КОНТАКТЫ =====
  @Get('contacts')
  @RequirePermissions('crm:read')
  getContacts(@CurrentUser() u: any, @Query() q: any) { return this.crm.getContacts(u.orgId, q); }

  @Get('contacts/subscription-stats')
  @RequirePermissions('crm:read')
  getSubscriptionStats(@CurrentUser() u: any) { return this.crm.getSubscriptionStats(u.orgId); }

  @Get('contacts/:id')
  @RequirePermissions('crm:read')
  getContact(@CurrentUser() u: any, @Param('id') id: string) { return this.crm.getContact(u.orgId, id); }

  @Post('contacts')
  @RequirePermissions('crm:write')
  createContact(@CurrentUser() u: any, @Body() body: any) { return this.crm.createContact(u.orgId, u.id ?? u.sub, body); }

  @Patch('contacts/:id')
  @RequirePermissions('crm:write')
  updateContact(@CurrentUser() u: any, @Param('id') id: string, @Body() body: any) { return this.crm.updateContact(u.orgId, id, u.id ?? u.sub, body); }

  @Delete('contacts/:id')
  @HttpCode(204)
  @RequirePermissions('crm:delete')
  deleteContact(@CurrentUser() u: any, @Param('id') id: string) { return this.crm.deleteContact(u.orgId, id); }

  // ===== КОМПАНИИ =====
  @Get('companies')
  @RequirePermissions('crm:read')
  getCompanies(@CurrentUser() u: any, @Query() q: any) { return this.crm.getCompanies(u.orgId, q); }

  @Get('companies/:id')
  @RequirePermissions('crm:read')
  getCompany(@CurrentUser() u: any, @Param('id') id: string) { return this.crm.getCompany(u.orgId, id); }

  @Post('companies')
  @RequirePermissions('crm:write')
  createCompany(@CurrentUser() u: any, @Body() body: any) { return this.crm.createCompany(u.orgId, u.id ?? u.sub, body); }

  @Patch('companies/:id')
  @RequirePermissions('crm:write')
  updateCompany(@CurrentUser() u: any, @Param('id') id: string, @Body() body: any) { return this.crm.updateCompany(u.orgId, id, body); }

  // ===== СДЕЛКИ =====
  @Get('deals')
  @RequirePermissions('crm:read')
  getDeals(@CurrentUser() u: any, @Query() q: any) { return this.crm.getDeals(u.orgId, q); }

  @Get('deals/kanban')
  @RequirePermissions('crm:read')
  getDealsKanban(@CurrentUser() u: any) { return this.crm.getDealsKanban(u.orgId); }

  @Get('deals/:id')
  @RequirePermissions('crm:read')
  getDeal(@CurrentUser() u: any, @Param('id') id: string) { return this.crm.getDeal(u.orgId, id); }

  @Post('deals')
  @RequirePermissions('crm:write')
  createDeal(@CurrentUser() u: any, @Body() body: any) { return this.crm.createDeal(u.orgId, u.id ?? u.sub, body); }

  @Patch('deals/:id')
  @RequirePermissions('crm:write')
  updateDeal(@CurrentUser() u: any, @Param('id') id: string, @Body() body: any) { return this.crm.updateDeal(u.orgId, id, u.id ?? u.sub, body); }

  @Delete('deals/:id')
  @HttpCode(204)
  @RequirePermissions('crm:delete')
  deleteDeal(@CurrentUser() u: any, @Param('id') id: string) { return this.crm.deleteDeal(u.orgId, id); }

  // ===== АКТИВНОСТЬ =====
  @Post('activity')
  @RequirePermissions('crm:read')
  addActivity(@CurrentUser() u: any, @Body() body: any) { return this.crm.addActivity(u.orgId, u.id ?? u.sub, body); }
}
