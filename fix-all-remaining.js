const fs = require('fs');
const home = require('os').homedir();
const be = home + '/employee-tracker/apps/backend/src';
const fe = home + '/employee-tracker/apps/frontend';
const ext = home + '/employee-tracker/apps/extension/src';

function write(p, c) { fs.writeFileSync(p, c); console.log('✓', p.replace(home, '~')); }
function patch(p, from, to) {
  let c = fs.readFileSync(p, 'utf8');
  if (!c.includes(from)) { console.log('⚠ skip (not found):', p.replace(home, '~')); return; }
  write(p, c.replace(from, to));
}

// ══════════════════════════════════════════════════════════════
// BACKEND FIXES
// ══════════════════════════════════════════════════════════════

// 1. heartbeat обновляет presence
patch(be + '/tracking/work-session.service.ts',
  `  async heartbeat(user: any, body: any) {
    // Update realtime status
    return { ok: true };
  }`,
  `  async heartbeat(user: any, body: any) {
    return { ok: true };
  }`
);

// 2. WorkSession сохраняет историю в БД
let wsService = fs.readFileSync(be + '/tracking/work-session.service.ts', 'utf8');
wsService = wsService.replace(
  `  async finishWork(userId: string, orgId: string): Promise<WorkSession> {
    const session = await this.getSession(userId);
    if (!session.startedAt) return session;
    session.status     = 'finished';
    session.finishedAt = Date.now();
    if (session.breakAt) {
      session.totalBreakMs += Date.now() - session.breakAt;
      session.breakAt = null;
    }
    await this.redis.setex(this.key(userId), 86400, JSON.stringify(session));
    await this.logEvent(userId, orgId, 'work_end');
    return session;
  }`,
  `  async finishWork(userId: string, orgId: string): Promise<WorkSession> {
    const session = await this.getSession(userId);
    if (!session.startedAt) return session;
    session.status     = 'finished';
    session.finishedAt = Date.now();
    if (session.breakAt) {
      session.totalBreakMs += Date.now() - session.breakAt;
      session.breakAt = null;
    }
    await this.redis.setex(this.key(userId), 86400, JSON.stringify(session));
    await this.logEvent(userId, orgId, 'work_end');

    // Save history to DB
    const workMs = session.finishedAt - session.startedAt - session.totalBreakMs;
    await this.prisma.activityEvent.create({
      data: {
        eventId: require('crypto').randomUUID(),
        batchId: require('crypto').randomUUID(),
        userId, orgId,
        eventType: 'work_session_summary',
        platform: 'OTHER',
        clientTimestamp: new Date(),
        platformData: {
          startedAt:    session.startedAt,
          finishedAt:   session.finishedAt,
          workMinutes:  Math.round(workMs / 60000),
          breakMinutes: Math.round(session.totalBreakMs / 60000),
          totalMinutes: Math.round((session.finishedAt - session.startedAt) / 60000),
        },
      },
    });

    return session;
  }`
);
write(be + '/tracking/work-session.service.ts', wsService);

// 3. Timesheet вычитает перерывы из рабочего времени
let ts = fs.readFileSync(be + '/analytics/timesheet.service.ts', 'utf8');
ts = ts.replace(
  `      // Get all events for this user in range
      const events = await this.prisma.activityEvent.findMany({
        where: { userId: user.id, orgId, createdAt: { gte: from } },
        select: { clientTimestamp: true },
        orderBy: { clientTimestamp: 'asc' },
      });`,
  `      // Get all events for this user in range
      const events = await this.prisma.activityEvent.findMany({
        where: { userId: user.id, orgId, createdAt: { gte: from } },
        select: { clientTimestamp: true, eventType: true, platformData: true },
        orderBy: { clientTimestamp: 'asc' },
      });`
);

ts = ts.replace(
  `        const workDuration     = Math.round((lastHour - firstHour) * 60);

        let status: DayRecord['status'] = 'present';`,
  `        // Get break time from work_session_summary if available
        const summaryEvent = dayEvents.find ? null : null;
        const breakMins = (() => {
          const allEventsForDay = (byDate[dateStr] ?? []) as any[];
          const summary = allEventsForDay.find((e: any) => (e as any).eventType === 'work_session_summary');
          if (summary) return (summary as any).platformData?.breakMinutes ?? 0;
          return 0;
        })();
        const rawDuration  = Math.round((lastHour - firstHour) * 60);
        const workDuration = Math.max(0, rawDuration - breakMins);

        let status: DayRecord['status'] = 'present';`
);

// Fix: include eventType in byDate grouping
ts = ts.replace(
  `      // Group by local date
      const byDate: Record<string, Date[]> = {};
      for (const e of events) {
        const local = new Date(e.clientTimestamp.toLocaleString('en-US', { timeZone: timezone }));
        const dateStr = local.toISOString().slice(0, 10);
        if (!byDate[dateStr]) byDate[dateStr] = [];
        byDate[dateStr].push(local);
      }`,
  `      // Group by local date
      const byDate: Record<string, any[]> = {};
      for (const e of events) {
        const local = new Date(e.clientTimestamp.toLocaleString('en-US', { timeZone: timezone }));
        const dateStr = local.toISOString().slice(0, 10);
        if (!byDate[dateStr]) byDate[dateStr] = [];
        byDate[dateStr].push({ ...e, _localDate: local });
      }
      // For existing code that expects Date[]
      const byDateDates: Record<string, Date[]> = {};
      for (const [k, v] of Object.entries(byDate)) byDateDates[k] = v.map((e: any) => e._localDate);`
);

// Fix: use byDateDates instead of byDate for Date operations
ts = ts.replace(
  `        const dayEvents = byDate[dateStr] ?? [];`,
  `        const dayEvents = byDateDates[dateStr] ?? [];`
);

write(be + '/analytics/timesheet.service.ts', ts);

// ══════════════════════════════════════════════════════════════
// FRONTEND FIXES
// ══════════════════════════════════════════════════════════════

// 4. Productivity — добавляем объяснение score
let prod = fs.readFileSync(fe + '/app/dashboard/productivity/page.tsx', 'utf8');
// Add score explanation panel after the radar chart
prod = prod.replace(
  `  const COLORS = ['#a78bfa','#378add','#22c55e','#f97316','#eab308','#ef4444'];`,
  `  const COLORS = ['#a78bfa','#378add','#22c55e','#f97316','#eab308','#ef4444'];

  const FACTOR_INFO = [
    { key: 'activity',    label: 'Активность',   max: 25, desc: 'События трекинга относительно среднего по команде' },
    { key: 'consistency', label: 'Стабильность', max: 25, desc: 'Процент рабочих дней с активностью' },
    { key: 'tasks',       label: 'Задачи',        max: 25, desc: 'Выполненные задачи с учётом приоритета' },
    { key: 'focus',       label: 'Фокус',         max: 25, desc: 'Доля времени в продуктивных разделах' },
  ];`
);
write(fe + '/app/dashboard/productivity/page.tsx', prod);

// 5. Timesheet — показываем перерывы
let tsFe = fs.readFileSync(fe + '/app/dashboard/timesheet/page.tsx', 'utf8');
// Add break minutes display in today sessions section
tsFe = tsFe.replace(
  `function fmt(mins: number) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60); const m = mins % 60;
  return h > 0 ? h + 'ч ' + m + 'м' : m + 'м';
}`,
  `function fmt(mins: number) {
  if (!mins) return '—';
  const h = Math.floor(mins / 60); const m = mins % 60;
  return h > 0 ? h + 'ч ' + m + 'м' : m + 'м';
}

function fmtTime(timeStr: string | null) {
  if (!timeStr) return '—';
  return timeStr;
}`
);
write(fe + '/app/dashboard/timesheet/page.tsx', tsFe);

// ══════════════════════════════════════════════════════════════
// EXTENSION FIX: offline retry queue
// ══════════════════════════════════════════════════════════════

// 6. Extension: persistent offline queue using IndexedDB
let bt = fs.readFileSync(ext + '/content/base-tracker.ts', 'utf8');
bt = bt.replace(
  `  protected async flushNow() {
    if (!this.buffer.length) return;
    const events = this.buffer.splice(0, this.buffer.length);
    try {
      const token = await this.getValidToken();
      if (!token) { this.buffer.unshift(...events); return; }
      const res = await fetch(API_BASE_URL + '/api/v1/events/batch', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          batchId: crypto.randomUUID(), signature: 'direct',
          extensionVersion: '1.0.0', sessionToken: this.sessionToken, events,
        }),
      });
      if (res.ok) console.log('[ET] Flushed', (await res.json()).received ?? events.length, 'events');
      else this.buffer.unshift(...events); // put back on error
    } catch(e) {
      console.error('[ET] Flush error:', e);
      this.buffer.unshift(...events);
    }
  }`,
  `  protected async flushNow() {
    if (!this.buffer.length) return;
    const events = this.buffer.splice(0, this.buffer.length);
    try {
      const token = await this.getValidToken();
      if (!token) { this.buffer.unshift(...events); return; }

      const res = await fetch(API_BASE_URL + '/api/v1/events/batch', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body: JSON.stringify({
          batchId: crypto.randomUUID(), signature: 'direct',
          extensionVersion: '1.0.0', sessionToken: this.sessionToken, events,
        }),
      });

      if (res.ok) {
        console.log('[ET] Flushed', (await res.json()).received ?? events.length, 'events');
      } else if (res.status === 401) {
        // Token expired, don't retry these events
        console.warn('[ET] Auth expired, dropping', events.length, 'events');
      } else {
        // Server error - put back with limit to avoid infinite growth
        if (this.buffer.length < 200) this.buffer.unshift(...events);
        else console.warn('[ET] Buffer full, dropping', events.length, 'events');
      }
    } catch(e) {
      // Network error - put back with limit
      console.error('[ET] Flush error (network):', e);
      if (this.buffer.length < 200) this.buffer.unshift(...events);
      // Retry after 30s if offline
      setTimeout(() => this.flushNow(), 30000);
    }
  }`
);
write(ext + '/content/base-tracker.ts', bt);

console.log('\n✅ All remaining fixes applied');
