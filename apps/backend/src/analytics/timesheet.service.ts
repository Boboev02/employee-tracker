import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';

export interface DayRecord {
  date:              string;
  dayOfWeek:         string;
  isWorkDay:         boolean;
  firstEvent:        string | null;
  lastEvent:         string | null;
  workStart:         string | null;
  workEnd:           string | null;
  workDuration:      number;
  breakDuration:     number;
  status:            'present' | 'late' | 'early_leave' | 'absent' | 'weekend' | 'no_data';
  lateMinutes:       number;
  earlyLeaveMinutes: number;
  eventCount:        number;
}

export interface TimesheetRow {
  userId:           string;
  name:             string;
  email:            string;
  days:             DayRecord[];
  totalDays:        number;
  presentDays:      number;
  lateDays:         number;
  absentDays:       number;
  totalWorkMinutes: number;
  totalBreakMinutes: number;
  avgStartTime:     string;
  avgEndTime:       string;
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

    const where: any = { orgId, deletedAt: null, status: 'ACTIVE' };
    if (userId) where.id = userId;
    const users = await this.prisma.user.findMany({ where, orderBy: { name: 'asc' } });

    return Promise.all(users.map(async user => {
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
        byDate[dateStr].push({ ...e, _local: local });
      }

      const dayRecords: DayRecord[] = dates.map(dateStr => {
        const date      = new Date(dateStr + 'T12:00:00');
        const dayOfWeek = DAY_NAMES[date.getDay()];
        const isWorkDay = workHours.enabled ? workHours.workDays.includes(date.getDay()) : true;
        const dayEvs    = byDate[dateStr] ?? [];

        if (!isWorkDay) return {
          date: dateStr, dayOfWeek, isWorkDay: false,
          firstEvent: null, lastEvent: null, workStart: null, workEnd: null,
          workDuration: 0, breakDuration: 0, status: 'weekend',
          lateMinutes: 0, earlyLeaveMinutes: 0, eventCount: dayEvs.length,
        };

        const today = new Date().toISOString().slice(0, 10);

        if (dayEvs.length === 0) return {
          date: dateStr, dayOfWeek, isWorkDay: true,
          firstEvent: null, lastEvent: null, workStart: null, workEnd: null,
          workDuration: 0, breakDuration: 0,
          status: dateStr < today ? 'absent' : 'no_data',
          lateMinutes: 0, earlyLeaveMinutes: 0, eventCount: 0,
        };

        // Кнопочные события
        const startEv  = dayEvs.find(e => e.eventType === 'work_start');
        const endEv    = [...dayEvs].reverse().find(e => e.eventType === 'work_end');
        const breakStarts = dayEvs.filter((e: any) => e.eventType === 'work_break_start' && e._local);
        const breakEnds   = dayEvs.filter((e: any) => e.eventType === 'work_break_end' && e._local);

        // Считаем перерывы — только закрытые пары (есть и start и end)
        let breakMs = 0;
        for (let i = 0; i < breakStarts.length; i++) {
          const bEnd = breakEnds[i]?._local.getTime();
          if (!bEnd) continue; // незакрытый перерыв — пропускаем
          const bStart = breakStarts[i]._local.getTime();
          const duration = bEnd - bStart;
          // Максимум 2 часа на перерыв — защита от некорректных данных
          if (duration > 0 && duration < 7200000) {
            breakMs += duration;
          }
        }
        const breakMins = Math.round(breakMs / 60000);

        // Начало и конец — приоритет у кнопок, fallback у трекера
        const clickEvents = dayEvs.filter((e: any) =>
          !['work_start','work_end','work_break_start','work_break_end','work_session_summary'].includes(e.eventType) && e._local
        );

        const workStartLocal = startEv?._local ?? clickEvents[0]?._local;
        const workEndLocal   = endEv?._local   ?? clickEvents[clickEvents.length - 1]?._local;

        if (!workStartLocal) return {
          date: dateStr, dayOfWeek, isWorkDay: true,
          firstEvent: null, lastEvent: null, workStart: null, workEnd: null,
          workDuration: 0, breakDuration: 0,
          status: dateStr < today ? 'absent' : 'no_data',
          lateMinutes: 0, earlyLeaveMinutes: 0, eventCount: dayEvs.length,
        };

        const startHour = workHours.startHour;
        const endHour   = workHours.endHour;

        if (!workStartLocal || !workEndLocal) return {
          date: dateStr, dayOfWeek, isWorkDay: true,
          firstEvent: null, lastEvent: null, workStart: null, workEnd: null,
          workDuration: 0, breakDuration: 0,
          status: dateStr < today ? 'absent' : 'no_data',
          lateMinutes: 0, earlyLeaveMinutes: 0, eventCount: dayEvs.length,
        };
        const firstHour = workStartLocal.getHours() + workStartLocal.getMinutes() / 60;
        const lastHour  = workEndLocal.getHours()   + workEndLocal.getMinutes()   / 60;

        const rawDuration  = Math.round((workEndLocal.getTime() - workStartLocal.getTime()) / 60000);
        const workDuration = Math.max(0, rawDuration - breakMins);

        const lateMinutes       = Math.max(0, Math.round((firstHour - startHour) * 60));
        const earlyLeaveMinutes = endEv ? Math.max(0, Math.round((endHour - lastHour) * 60)) : 0;

        let status: DayRecord['status'] = 'present';
        if (lateMinutes > 15)        status = 'late';
        if (earlyLeaveMinutes > 15)  status = 'early_leave';
        if (lateMinutes > 15 && earlyLeaveMinutes > 15) status = 'late';

        return {
          date: dateStr, dayOfWeek, isWorkDay: true,
          firstEvent:  clickEvents[0]?._local.toTimeString().slice(0,5) ?? null,
          lastEvent:   clickEvents[clickEvents.length-1]?._local.toTimeString().slice(0,5) ?? null,
          workStart:   workStartLocal.toTimeString().slice(0,5),
          workEnd:     workEndLocal.toTimeString().slice(0,5),
          workDuration,
          breakDuration: breakMins,
          status,
          lateMinutes,
          earlyLeaveMinutes,
          eventCount: dayEvs.length,
        };
      });

      const workDays    = dayRecords.filter(d => d.isWorkDay);
      const presentDays = workDays.filter(d => ['present','late','early_leave'].includes(d.status)).length;
      const lateDays    = workDays.filter(d => d.status === 'late').length;
      const absentDays  = workDays.filter(d => d.status === 'absent').length;
      const totalWork   = dayRecords.reduce((s,d) => s + d.workDuration, 0);
      const totalBreak  = dayRecords.reduce((s,d) => s + d.breakDuration, 0);

      const startsWithData = dayRecords.filter(d => d.workStart).map(d => d.workStart!);
      const endsWithData   = dayRecords.filter(d => d.workEnd).map(d => d.workEnd!);

      return {
        userId: user.id, name: user.name, email: user.email,
        days: dayRecords,
        totalDays: workDays.length,
        presentDays, lateDays, absentDays,
        totalWorkMinutes:  totalWork,
        totalBreakMinutes: totalBreak,
        avgStartTime: startsWithData.length ? this.avgTime(startsWithData) : '—',
        avgEndTime:   endsWithData.length   ? this.avgTime(endsWithData)   : '—',
      };
    }));
  }

  private avgTime(times: string[]): string {
    const mins = times.map(t => {
      const [h, m] = t.split(':').map(Number);
      return h * 60 + m;
    });
    const avg = Math.round(mins.reduce((a,b) => a+b, 0) / mins.length);
    return String(Math.floor(avg/60)).padStart(2,'0') + ':' + String(avg%60).padStart(2,'0');
  }
}
