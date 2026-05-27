import { API_BASE_URL, STORAGE_KEYS, IDLE_THRESHOLD_MS } from '../shared/constants';
import type { RawEvent, Platform } from '../shared/types';

export abstract class BaseTracker {
  protected sessionToken   = crypto.randomUUID();
  protected lastActivity   = Date.now();
  protected idleTimer: ReturnType<typeof setTimeout> | null = null;
  protected isIdle         = false;
  protected buffer: RawEvent[] = [];
  protected currentSection = '';
  protected sectionEnterTime = 0;

  // Накопительный счётчик активного времени
  protected accumulatedActiveSeconds = 0;  // уже накопленное время
  protected activeSegmentStart: number | null = null; // начало текущего активного отрезка

  abstract platform: Platform;

  init() {
    this.attachListeners();
    this.scheduleFlush();

    const section = this.detectSection();
    this.currentSection    = section;
    this.sectionEnterTime  = Date.now();
    this.startActiveSegment();
    this.sendEvent('page_load', { section, sectionLabel: this.getSectionLabel(section) });

    console.log('[ET] Tracker initialized:', this.platform, location.href, 'section:', section);
  }

  // Начать новый активный отрезок
  private startActiveSegment() {
    if (this.activeSegmentStart === null) {
      this.activeSegmentStart = Date.now();
    }
  }

  // Завершить текущий активный отрезок и накопить время
  private endActiveSegment() {
    if (this.activeSegmentStart !== null) {
      const segmentSeconds = Math.round((Date.now() - this.activeSegmentStart) / 1000);
      if (segmentSeconds > 0) {
        this.accumulatedActiveSeconds += segmentSeconds;
      }
      this.activeSegmentStart = null;
    }
  }

  // Получить текущее суммарное активное время
  private getTotalActiveSeconds(): number {
    const currentSegment = this.activeSegmentStart !== null
      ? Math.round((Date.now() - this.activeSegmentStart) / 1000)
      : 0;
    return this.accumulatedActiveSeconds + currentSegment;
  }

  // Сбросить счётчик при смене раздела
  private resetActiveCounter() {
    this.accumulatedActiveSeconds = 0;
    this.activeSegmentStart = null;
  }

  protected attachListeners() {
    document.addEventListener('click', () => this.handleActivity(), { passive: true });
    document.addEventListener('keydown', () => this.handleActivity(), { passive: true });
    document.addEventListener('scroll', () => this.handleActivity(), { passive: true });

    window.addEventListener('beforeunload', () => {
      this.recordSectionLeave();
      this.sendEvent('page_unload');
      this.flushBeacon();
    });

    window.addEventListener('focus', () => {
      if (this.isIdle) {
        this.isIdle = false;
        this.startActiveSegment();
      }
      this.resetIdleTimer();
    });

    window.addEventListener('blur', () => {
      this.endActiveSegment();
      this.isIdle = true;
      if (this.idleTimer) clearTimeout(this.idleTimer);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.endActiveSegment();
        this.isIdle = true;
      } else {
        this.isIdle = false;
        this.startActiveSegment();
        this.resetIdleTimer();
      }
    });

    this.resetIdleTimer();
  }

  protected handleActivity() {
    this.lastActivity = Date.now();
    if (this.isIdle) {
      this.isIdle = false;
      this.startActiveSegment();
    }
    this.resetIdleTimer();
  }

  // Оставим handleClick для обратной совместимости (отправка click-события)
  protected handleClick() {
    this.handleActivity();
    this.sendEvent('click', {
      section: this.currentSection,
      sectionLabel: this.getSectionLabel(this.currentSection),
    });
  }

  protected resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.endActiveSegment();
      this.isIdle = true;
    }, IDLE_THRESHOLD_MS);
  }

  protected onSectionChange(newSection: string) {
    if (newSection === this.currentSection) return;
    this.recordSectionLeave();
    this.currentSection   = newSection;
    this.sectionEnterTime = Date.now();
    this.resetActiveCounter();
    if (!this.isIdle) this.startActiveSegment();
    const enterEvent = this.platform === 'WILDBERRIES' ? 'wb_section_enter' : 'ozon_section_enter';
    this.sendEvent(enterEvent as any, {
      section: newSection,
      sectionLabel: this.getSectionLabel(newSection),
      url: location.href.slice(0, 300),
    });
  }

  protected recordSectionLeave() {
    if (!this.currentSection || this.sectionEnterTime === 0) return;
    const activeSeconds = this.getTotalActiveSeconds();
    if (activeSeconds < 3) return; // минимальный порог 3 секунды

    const leaveEvent = this.platform === 'WILDBERRIES' ? 'wb_section_leave' : 'ozon_section_leave';
    this.sendEvent(leaveEvent as any, {
      section: this.currentSection,
      sectionLabel: this.getSectionLabel(this.currentSection),
      activeSeconds,
    });
  }

  protected getSectionLabel(section: string): string { return section; }

  protected scheduleFlush() {
    setInterval(() => this.flushNow(), 5000);
    setInterval(() => this.reportActivePing(), 60000);
  }

  protected reportActivePing() {
    if (!this.currentSection || this.sectionEnterTime === 0 || this.isIdle) return;
    const activeSeconds = this.getTotalActiveSeconds();
    if (activeSeconds < 10) return;
    const pingEvent = this.platform === 'WILDBERRIES' ? 'wb_section_ping' : 'ozon_section_ping';
    this.sendEvent(pingEvent as any, {
      section: this.currentSection,
      sectionLabel: this.getSectionLabel(this.currentSection),
      activeSeconds,
    });
  }

  protected sendEvent(eventType: any, extra: Record<string, any> = {}) {
    const section = extra.section ?? this.currentSection ?? this.detectSection();
    const event: RawEvent = {
      eventId:         crypto.randomUUID(),
      sessionToken:    this.sessionToken,
      eventType,
      platform:        this.platform,
      clientTimestamp: Date.now(),
      url:             location.href.slice(0, 500),
      pageTitle:       document.title.slice(0, 200),
      platformData:    { ...extra, section },
    };
    this.buffer.push(event);
    if (this.buffer.length >= 20) this.flushNow();
  }

  protected async getValidToken(): Promise<string | null> {
    if (!chrome.runtime?.id) return null;
    try {
      const stored = await new Promise<any>(resolve => {
        chrome.storage.local.get(STORAGE_KEYS.AUTH_STATE, resolve);
      });
      const auth = stored[STORAGE_KEYS.AUTH_STATE];
      if (!auth) return null;
      if (auth.expiresAt - Date.now() < 120_000) {
        try {
          const res = await fetch(API_BASE_URL + '/api/v1/auth/refresh', {
            method: 'POST',
            headers: { Authorization: 'Bearer ' + auth.accessToken },
          });
          if (res.ok) {
            const data = await res.json();
            const newAuth = { ...auth, accessToken: data.accessToken, expiresAt: Date.now() + 86_400_000 };
            await new Promise<void>(r => chrome.storage.local.set({ [STORAGE_KEYS.AUTH_STATE]: newAuth }, r));
            return data.accessToken;
          }
        } catch {}
      }
      return auth.accessToken;
    } catch {
      return null;
    }
  }

  protected flushBeacon() {
    if (!this.buffer.length) return;
    const events = this.buffer.splice(0, this.buffer.length);
    try {
      const payload = JSON.stringify({
        batchId: crypto.randomUUID(), signature: 'beacon',
        extensionVersion: '1.0.0', sessionToken: this.sessionToken, events,
      });
      const sent = navigator.sendBeacon(API_BASE_URL + '/api/v1/events/batch', new Blob([payload], { type: 'application/json' }));
      if (!sent) this.buffer.unshift(...events);
    } catch {
      this.buffer.unshift(...events);
    }
  }

  protected async flushNow() {
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
        console.warn('[ET] Auth expired, dropping', events.length, 'events');
      } else {
        if (this.buffer.length < 200) this.buffer.unshift(...events);
      }
    } catch(e) {
      console.error('[ET] Flush error:', e);
      if (this.buffer.length < 200) this.buffer.unshift(...events);
      setTimeout(() => this.flushNow(), 30000);
    }
  }

  protected detectSection(): string { return 'unknown'; }
}
