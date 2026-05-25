const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

// ─── Backend: Work hours service ─────────────────────────────
write('src/settings/settings.service.ts', `import { Injectable } from '@nestjs/common';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

export interface WorkHoursSettings {
  enabled:    boolean;
  startHour:  number;  // 0-23
  endHour:    number;  // 0-23
  timezone:   string;
  workDays:   number[]; // 0=Sun, 1=Mon ... 6=Sat
  lunchStart: number | null; // null = no lunch
  lunchEnd:   number | null;
}

const DEFAULT_SETTINGS: WorkHoursSettings = {
  enabled:    true,
  startHour:  9,
  endHour:    18,
  timezone:   'Europe/Moscow',
  workDays:   [1, 2, 3, 4, 5], // Mon-Fri
  lunchStart: 13,
  lunchEnd:   14,
};

@Injectable()
export class SettingsService {
  constructor(@InjectRedis() private readonly redis: Redis) {}

  private key(orgId: string) { return 'settings:workhours:' + orgId; }

  async getWorkHours(orgId: string): Promise<WorkHoursSettings> {
    const val = await this.redis.get(this.key(orgId));
    if (!val) return { ...DEFAULT_SETTINGS };
    try { return { ...DEFAULT_SETTINGS, ...JSON.parse(val) }; }
    catch { return { ...DEFAULT_SETTINGS }; }
  }

  async setWorkHours(orgId: string, settings: Partial<WorkHoursSettings>): Promise<WorkHoursSettings> {
    const current = await this.getWorkHours(orgId);
    const updated = { ...current, ...settings };
    await this.redis.set(this.key(orgId), JSON.stringify(updated));
    return updated;
  }

  isWorkingTime(settings: WorkHoursSettings, date: Date = new Date()): boolean {
    if (!settings.enabled) return true;

    // Convert to org timezone
    const localDate = new Date(date.toLocaleString('en-US', { timeZone: settings.timezone }));
    const day  = localDate.getDay();
    const hour = localDate.getHours();
    const min  = localDate.getMinutes();
    const timeDecimal = hour + min / 60;

    // Check work day
    if (!settings.workDays.includes(day)) return false;

    // Check work hours
    if (timeDecimal < settings.startHour || timeDecimal >= settings.endHour) return false;

    // Check lunch break
    if (settings.lunchStart != null && settings.lunchEnd != null) {
      if (timeDecimal >= settings.lunchStart && timeDecimal < settings.lunchEnd) return false;
    }

    return true;
  }

  // Calculate working minutes between two dates
  calcWorkingMinutes(settings: WorkHoursSettings, from: Date, to: Date): number {
    let minutes = 0;
    const current = new Date(from);
    current.setSeconds(0, 0);

    while (current < to) {
      if (this.isWorkingTime(settings, current)) minutes++;
      current.setMinutes(current.getMinutes() + 1);
    }
    return minutes;
  }
}
`);

// ─── Backend: Settings controller ────────────────────────────
write('src/settings/settings.controller.ts', `import { Controller, Get, Put, Body } from '@nestjs/common';
import { SettingsService } from './settings.service';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';

@Controller('api/v1/settings')
export class SettingsController {
  constructor(private readonly settings: SettingsService) {}

  @Get('work-hours')
  getWorkHours(@CurrentUser() user: any) {
    return this.settings.getWorkHours(user.orgId);
  }

  @Put('work-hours')
  @RequirePermissions('org:update')
  setWorkHours(@CurrentUser() user: any, @Body() body: any) {
    return this.settings.setWorkHours(user.orgId, body);
  }
}
`);

// ─── Backend: Settings module ─────────────────────────────────
write('src/settings/settings.module.ts', `import { Module, Global } from '@nestjs/common';
import { SettingsController } from './settings.controller';
import { SettingsService }    from './settings.service';

@Global()
@Module({
  controllers: [SettingsController],
  providers:   [SettingsService],
  exports:     [SettingsService],
})
export class SettingsModule {}
`);

// ─── Update app.module.ts ─────────────────────────────────────
write('src/app.module.ts', `import 'dotenv/config';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule }    from './prisma/prisma.module';
import { AuthModule }      from './auth/auth.module';
import { HealthModule }    from './health/health.module';
import { TasksModule }     from './tasks/tasks.module';
import { EmployeesModule } from './employees/employees.module';
import { RealtimeModule }  from './realtime/realtime.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { TrackingModule }  from './tracking/tracking.module';
import { TeamsModule }     from './teams/teams.module';
import { SettingsModule }  from './settings/settings.module';
import { JwtAuthGuard }    from './auth/guards/index';

@Module({
  imports: [
    PrismaModule, AuthModule, HealthModule,
    TasksModule, EmployeesModule, RealtimeModule,
    AnalyticsModule, TrackingModule, TeamsModule,
    SettingsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
`);

console.log('\n✅ Work hours backend created');
