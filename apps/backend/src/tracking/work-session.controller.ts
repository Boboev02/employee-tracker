import { Controller, Get, Post, UseGuards } from '@nestjs/common';
import { WorkSessionService } from './work-session.service';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { RbacGuard } from '../auth/guards/index';

@Controller('api/v1/work-session')
export class WorkSessionController {
  constructor(private readonly sessions: WorkSessionService) {}

  @Get('me')
  getMySession(@CurrentUser() user: any) {
    return this.sessions.getSession(user.id);
  }

  @Post('start')
  startWork(@CurrentUser() user: any) {
    return this.sessions.startWork(user.id, user.orgId);
  }

  @Post('break')
  startBreak(@CurrentUser() user: any) {
    return this.sessions.startBreak(user.id, user.orgId);
  }

  @Post('break-end')
  endBreak(@CurrentUser() user: any) {
    return this.sessions.endBreak(user.id, user.orgId);
  }

  @Post('finish')
  finishWork(@CurrentUser() user: any) {
    return this.sessions.finishWork(user.id, user.orgId);
  }

  @Get('org/today')
  @UseGuards(RbacGuard)
  @RequirePermissions('tracking:view:all', 'tracking:view:team')
  getOrgSessions(@CurrentUser() user: any) {
    return this.sessions.getOrgSessions(user.orgId);
  }
}
