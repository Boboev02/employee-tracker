import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

export interface DayRecord {
  date:         string;
  dayOfWeek:    string;
  isWorkDay:    boolean;
  firstEvent:   string | null;  // HH:MM
  lastEvent:    string | null;
  workDuration: number;         // minutes
  status:       'present' | 'late' | 'early_leave' | 'absent' | 'weekend' | 'no_data';
  lateMinutes:  number;
  earlyLeaveMinutes: number;
  eventCount:   number;
}

export interface TimesheetRow {
  userId:     string;
  name:       string;
  email:      string;
  days:       DayRecord[];
  totalDays:  number;
  presentDays: number;
  lateDays:   number;
  absentDays: number;
  totalWorkMinutes: number;
  avgStartTime: string;
  avgEndTime:   string;
}

const DAY_NAMES = ['Вс','Пн','Вт','Ср','Чт','Пт','Сб'];

@Injectable()
export class TimesheetService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
  ) {}

  async getTimesheet(orgId: string, days = 14, userId?: string): Promise<TimesheetRow[]> {
    const workHours = await this.settings.getWorkHours(orgId);
    const timezone  = workHours.timezone;

    // Build date range
    const dates: string[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const local = new Date(d.toLocaleString('en-US', { timeZone: timezone }));
      dates.push(local.toISOString().slice(0, 10));
    }

    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);

    // Get users
    const where: any = { orgId, deletedAt: null, status: 'ACTIVE' };
    if (userId) where.id = userId;
    const users = await this.prisma.user.findMany({ where, orderBy: { name: 'asc' } });

    return Promise.all(users.map(async user => {
      // Get all events for this user in range
      const events = await this.prisma.activityEvent.findMany({
        where: { userId: user.id, orgId, createdAt: { gte: from } },
        select: { clientTimestamp: true, eventType: true, platformData: true },
        orderBy: { clientTimestamp: 'asc' },
      });

      // Group by local date
      const byDate: Record<string, any[]> = {};
      for (const e of events) {
        const local = new Date(e.clientTimestamp.toLocaleString('en-US', { timeZone: timezone }));
        const dateStr = local.toISOString().slice(0, 10);
        if (!byDate[dateStr]) byDate[dateStr] = [];
        byDate[dateStr].push({ ...e, _localDate: local });
      }
      // For existing code that expects Date[]
      const byDateDates: Record<string, Date[]> = {};
      for (const [k, v] of Object.entries(byDate)) byDateDates[k] = v.map((e: any) => e._localDate);

      const dayRecords: DayRecord[] = dates.map(dateStr => {
        const date     = new Date(dateStr + 'T12:00:00');
        const dayOfWeek = DAY_NAMES[date.getDay()];
        const isWorkDay = workHours.enabled ? workHours.workDays.includes(date.getDay()) : true;
        const dayEvents = byDateDates[dateStr] ?? [];

        if (!isWorkDay) {
          return {
            date: dateStr, dayOfWeek, isWorkDay: false,
            firstEvent: null, lastEvent: null,
            workDuration: 0, status: 'weekend',
            lateMinutes: 0, earlyLeaveMinutes: 0,
            eventCount: dayEvents.length,
          };
        }

        if (dayEvents.length === 0) {
          // Check if this day is in the past
          const today = new Date().toISOString().slice(0, 10);
          return {
            date: dateStr, dayOfWeek, isWorkDay: true,
            firstEvent: null, lastEvent: null,
            workDuration: 0,
            status: dateStr < today ? 'absent' : 'no_data',
            lateMinutes: 0, earlyLeaveMinutes: 0,
            eventCount: 0,
          };
        }

        const first = dayEvents[0];
        const last  = dayEvents[dayEvents.length - 1];
        const firstHour = first.getHours() + first.getMinutes() / 60;
        const lastHour  = last.getHours()  + last.getMinutes()  / 60;

        const startHour = workHours.startHour;
        const endHour   = workHours.endHour;

        const lateMinutes      = Math.max(0, Math.round((firstHour - startHour) * 60));
        const earlyLeaveMinutes = Math.max(0, Math.round((endHour - lastHour) * 60));
        // Subtract breaks: get break events for this day
        const breakEvents = dayEvents.filter ? [] : []; // placeholder
        // Get break time from work_session_summary if available
        const summaryEvent = dayEvents.find ? null : null;
        const breakMins = (() => {
          const allEventsForDay = (byDate[dateStr] ?? []) as any[];
          const summary = allEventsForDay.find((e: any) => (e as any).eventType === 'work_session_summary');
          if (summary) return (summary as any).platformData?.breakMinutes ?? 0;
          return 0;
        })();
        const rawDuration  = Math.round((lastHour - firstHour) * 60);
        const workDuration = Math.max(0, rawDuration - breakMins);

        let status: DayRecord['status'] = 'present';
        if (lateMinutes > 15)       status = 'late';
        if (earlyLeaveMinutes > 15) status = 'early_leave';
        if (lateMinutes > 15 && earlyLeaveMinutes > 15) status = 'late';

        return {
          date: dateStr,
          dayOfWeek,
          isWorkDay: true,
          firstEvent: first.toTimeString().slice(0, 5),
          lastEvent:  last.toTimeString().slice(0, 5),
          workDuration,
          status,
          lateMinutes,
          earlyLeaveMinutes,
          eventCount: dayEvents.length,
        };
      });

      const workDays    = dayRecords.filter(d => d.isWorkDay);
      const presentDays = workDays.filter(d => d.status === 'present' || d.status === 'late' || d.status === 'early_leave').length;
      const lateDays    = workDays.filter(d => d.status === 'late').length;
      const absentDays  = workDays.filter(d => d.status === 'absent').length;
      const totalWork   = dayRecords.reduce((s, d) => s + d.workDuration, 0);

      // Avg start/end
      const startsWithData = dayRecords.filter(d => d.firstEvent).map(d => d.firstEvent!);
      const endsWithData   = dayRecords.filter(d => d.lastEvent).map(d => d.lastEvent!);
      const avgStart = startsWithData.length ? this.avgTime(startsWithData) : '—';
      const avgEnd   = endsWithData.length   ? this.avgTime(endsWithData)   : '—';

      return {
        userId:  user.id,
        name:    user.name,
        email:   user.email,
        days:    dayRecords,
        totalDays:    workDays.length,
        presentDays,
        lateDays,
        absentDays,
        totalWorkMinutes: totalWork,
        avgStartTime: avgStart,
        avgEndTime:   avgEnd,
      };
    }));
  }

  private avgTime(times: string[]): string {
    const mins = times.map(t => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    });
    const avg = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length);
    return String(Math.floor(avg / 60)).padStart(2, '0') + ':' + String(avg % 60).padStart(2, '0');
  }
}
