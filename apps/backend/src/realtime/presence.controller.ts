import { Controller, Get, Query } from '@nestjs/common';
import { PresenceService } from './presence.service';
import { CurrentUser } from '../auth/decorators/index';

@Controller('api/v1/presence')
export class PresenceController {
  constructor(private readonly presence: PresenceService) {}

  @Get()
  getOrgPresence(@CurrentUser() user: any) {
    return this.presence.getOrgPresence(user.orgId);
  }

  @Get('user')
  getUserPresence(@CurrentUser() user: any, @Query('userId') userId: string) {
    return this.presence.getPresence(userId ?? user.id);
  }
}
