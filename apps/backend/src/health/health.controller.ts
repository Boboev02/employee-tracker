import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/index';

@Controller()
export class HealthController {
  @Public()
  @Get('health')
  health() { return { status: 'ok', timestamp: new Date().toISOString() }; }

  @Public()
  @Get()
  root() { return { error: 'Route not found' }; }
}
