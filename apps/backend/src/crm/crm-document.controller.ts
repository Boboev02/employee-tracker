import { Controller, Get, Post, Patch, Delete, Body, Param, Query } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { CrmDocumentService } from './crm-document.service';

@Controller('api/v1/crm/documents')
export class CrmDocumentController {
  constructor(private readonly docs: CrmDocumentService) {}

  @Get()
  @RequirePermissions('crm:read')
  getDocuments(@CurrentUser() u: any, @Query('dealId') dealId?: string) { return this.docs.getDocuments(u.orgId, dealId); }

  @Post()
  @RequirePermissions('crm:write')
  createDocument(@CurrentUser() u: any, @Body() body: any) { return this.docs.createDocument(u.orgId, u.id ?? u.sub, body); }

  @Patch(':id/status')
  @RequirePermissions('crm:write')
  updateStatus(@CurrentUser() u: any, @Param('id') id: string, @Body() body: { status: string }) { return this.docs.updateDocumentStatus(u.orgId, id, body.status); }

  @Delete(':id')
  @RequirePermissions('crm:delete')
  deleteDocument(@CurrentUser() u: any, @Param('id') id: string) { return this.docs.deleteDocument(u.orgId, id); }
}
