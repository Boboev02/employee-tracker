import { Controller, Post, Body, HttpCode, Get } from '@nestjs/common';
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
