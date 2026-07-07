import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { CrmIntegrationService } from './crm-integration.service';

@Controller('api/v1/crm/integrations')
export class CrmIntegrationController {
  constructor(private readonly integrations: CrmIntegrationService) {}

  @Get()
  @RequirePermissions('crm:read')
  getIntegrations(@CurrentUser() u: any) { return this.integrations.getIntegrations(u.orgId); }

  @Post(':name')
  @RequirePermissions('org:update')
  saveIntegration(@CurrentUser() u: any, @Param('name') name: string, @Body() body: any) {
    return this.integrations.saveIntegration(u.orgId, name, body);
  }

  @Post(':name/sync')
  @RequirePermissions('crm:write')
  sync(@CurrentUser() u: any, @Param('name') name: string) {
    return this.integrations.syncNow(u.orgId, name);
  }
}
