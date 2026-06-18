import { Injectable } from '@nestjs/common';
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

  // WB API токен
  private wbKey(orgId: string) { return 'settings:wb_token:' + orgId; }

  async getWbToken(orgId: string): Promise<string | null> {
    return this.redis.get(this.wbKey(orgId));
  }

  async setWbToken(orgId: string, token: string): Promise<void> {
    await this.redis.set(this.wbKey(orgId), token);
  }
