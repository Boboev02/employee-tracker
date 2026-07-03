import { Controller, Get, Post, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { KpiService } from './kpi.service';
import { JwtAuthGuard } from '../auth/guards/index';
import { CurrentUser } from '../auth/decorators/index';

@Controller('api/v1/kpi')
@UseGuards(JwtAuthGuard)
export class KpiController {
  constructor(private readonly kpi: KpiService) {}

  @Get()
  getKpis(@CurrentUser() user: any, @Query('period') period?: string) {
    return this.kpi.getKpis(user.orgId, period);
  }

  @Post()
  upsertKpi(@CurrentUser() user: any, @Body() dto: any) {
    return this.kpi.upsertKpi(user.orgId, user.id, dto);
  }

  @Delete(':id')
  deleteKpi(@CurrentUser() user: any, @Param('id') id: string) {
    return this.kpi.deleteKpi(id, user.orgId);
  }
}