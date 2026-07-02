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
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getLeads(@CurrentUser() u: any, @Query() q: any) { return this.crm.getLeads(u.orgId, q); }

  @Post('leads')
  @RequirePermissions('task:create')
  createLead(@CurrentUser() u: any, @Body() body: any) { return this.crm.createLead(u.orgId, u.id ?? u.sub, body); }

  @Patch('leads/:id')
  @RequirePermissions('task:update:any', 'task:update:self')
  updateLead(@CurrentUser() u: any, @Param('id') id: string, @Body() body: any) { return this.crm.updateLead(u.orgId, id, u.id ?? u.sub, body); }

  @Delete('leads/:id')
  @HttpCode(204)
  @RequirePermissions('task:delete')
  deleteLead(@CurrentUser() u: any, @Param('id') id: string) { return this.crm.deleteLead(u.orgId, id); }

  // ===== КОНТАКТЫ =====
  @Get('contacts')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getContacts(@CurrentUser() u: any, @Query() q: any) { return this.crm.getContacts(u.orgId, q); }

  @Get('contacts/:id')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getContact(@CurrentUser() u: any, @Param('id') id: string) { return this.crm.getContact(u.orgId, id); }

  @Post('contacts')
  @RequirePermissions('task:create')
  createContact(@CurrentUser() u: any, @Body() body: any) { return this.crm.createContact(u.orgId, u.id ?? u.sub, body); }

  @Patch('contacts/:id')
  @RequirePermissions('task:update:any', 'task:update:self')
  updateContact(@CurrentUser() u: any, @Param('id') id: string, @Body() body: any) { return this.crm.updateContact(u.orgId, id, u.id ?? u.sub, body); }

  @Delete('contacts/:id')
  @HttpCode(204)
  @RequirePermissions('task:delete')
  deleteContact(@CurrentUser() u: any, @Param('id') id: string) { return this.crm.deleteContact(u.orgId, id); }

  // ===== КОМПАНИИ =====
  @Get('companies')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getCompanies(@CurrentUser() u: any, @Query() q: any) { return this.crm.getCompanies(u.orgId, q); }

  @Get('companies/:id')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getCompany(@CurrentUser() u: any, @Param('id') id: string) { return this.crm.getCompany(u.orgId, id); }

  @Post('companies')
  @RequirePermissions('task:create')
  createCompany(@CurrentUser() u: any, @Body() body: any) { return this.crm.createCompany(u.orgId, u.id ?? u.sub, body); }

  @Patch('companies/:id')
  @RequirePermissions('task:update:any')
  updateCompany(@CurrentUser() u: any, @Param('id') id: string, @Body() body: any) { return this.crm.updateCompany(u.orgId, id, body); }

  // ===== СДЕЛКИ =====
  @Get('deals')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getDeals(@CurrentUser() u: any, @Query() q: any) { return this.crm.getDeals(u.orgId, q); }

  @Get('deals/kanban')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getDealsKanban(@CurrentUser() u: any) { return this.crm.getDealsKanban(u.orgId); }

  @Get('deals/:id')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getDeal(@CurrentUser() u: any, @Param('id') id: string) { return this.crm.getDeal(u.orgId, id); }

  @Post('deals')
  @RequirePermissions('task:create')
  createDeal(@CurrentUser() u: any, @Body() body: any) { return this.crm.createDeal(u.orgId, u.id ?? u.sub, body); }

  @Patch('deals/:id')
  @RequirePermissions('task:update:any', 'task:update:self')
  updateDeal(@CurrentUser() u: any, @Param('id') id: string, @Body() body: any) { return this.crm.updateDeal(u.orgId, id, u.id ?? u.sub, body); }

  @Delete('deals/:id')
  @HttpCode(204)
  @RequirePermissions('task:delete')
  deleteDeal(@CurrentUser() u: any, @Param('id') id: string) { return this.crm.deleteDeal(u.orgId, id); }

  // ===== АКТИВНОСТЬ =====
  @Post('activity')
  @RequirePermissions('task:read:self')
  addActivity(@CurrentUser() u: any, @Body() body: any) { return this.crm.addActivity(u.orgId, u.id ?? u.sub, body); }
}
