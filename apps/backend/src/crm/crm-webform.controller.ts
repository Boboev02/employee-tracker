import { Controller, Get, Post, Delete, Body, Param } from '@nestjs/common';
import { CurrentUser, RequirePermissions, Public } from '../auth/decorators/index';
import { CrmWebFormService } from './crm-webform.service';

@Controller('api/v1/crm/webforms')
export class CrmWebFormController {
  constructor(private readonly forms: CrmWebFormService) {}

  @Get()
  @RequirePermissions('crm:read')
  getForms(@CurrentUser() u: any) { return this.forms.getForms(u.orgId); }

  @Post()
  @RequirePermissions('crm:write')
  createForm(@CurrentUser() u: any, @Body() body: any) { return this.forms.createForm(u.orgId, body); }

  @Delete(':id')
  @RequirePermissions('crm:delete')
  deleteForm(@CurrentUser() u: any, @Param('id') id: string) { return this.forms.deleteForm(u.orgId, id); }

  // Публичный эндпоинт — вызывается со стороннего сайта, без авторизации
  @Public()
  @Post(':id/submit')
  submitForm(@Param('id') id: string, @Body() body: any) {
    return this.forms.submitForm(id, body);
  }
}
