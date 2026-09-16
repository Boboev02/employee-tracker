import { Controller, Get, UseGuards } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { RbacGuard } from '../auth/guards/index';
import { CommandCenterService } from './command-center.service';

@Controller('api/v1/command-center')
@UseGuards(RbacGuard)
export class CommandCenterController {
  constructor(private readonly cc: CommandCenterService) {}

  @Get('overview')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getOverview(@CurrentUser() user: any) {
    return this.cc.getOverview(user.orgId);
  }
}
