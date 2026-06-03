import { Controller, Post, Body, HttpCode, Get, Req } from '@nestjs/common';
import { TrackingService } from './tracking.service';
import { CurrentUser } from '../auth/decorators/index';
import { Public } from '../auth/decorators/index';

@Controller('api/v1/events')
export class TrackingController {
  constructor(private readonly tracking: TrackingService) {}

  @Post('batch')
  @HttpCode(200)
  ingestBatch(@CurrentUser() user: any, @Body() body: any) {
    return this.tracking.ingestBatch(user, body);
  }

  @Post('heartbeat')
  @HttpCode(204)
  heartbeat(@CurrentUser() user: any, @Body() body: any) {
    return this.tracking.heartbeat(user, body);
  }
}

@Controller('api/v1/tracking')
export class TrackingAdminController {
  constructor(private readonly tracking: TrackingService) {}

  @Post('cleanup')
  cleanup(@Req() req: any) {
    const ip = req.ip || req.connection?.remoteAddress || '';
    if (!ip.includes('127.0.0.1') && !ip.includes('::1')) return { error: 'Forbidden' };
    return this.tracking.cleanupOldEvents(90);
  }
}
