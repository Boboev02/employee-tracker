import { Controller, Get, Post, Body } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { CrmEmailService } from './crm-email.service';

@Controller('api/v1/crm/email')
export class CrmEmailController {
  constructor(private readonly email: CrmEmailService) {}

  @Get('settings')
  @RequirePermissions('crm:read')
  getSettings(@CurrentUser() u: any) { return this.email.getSettings(u.orgId); }

  @Post('settings')
  @RequirePermissions('org:update')
  saveSettings(@CurrentUser() u: any, @Body() body: any) { return this.email.saveSettings(u.orgId, body); }

  @Post('send')
  @RequirePermissions('crm:write')
  send(@CurrentUser() u: any, @Body() body: { to: string; subject: string; body: string }) {
    return this.email.sendEmail(u.orgId, body.to, body.subject, body.body);
  }
}
