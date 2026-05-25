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
  protected activeTimeStart  = 0; // tracks active (non-idle) time in section

  abstract platform: Platform;

  init() {
    this.attachListeners();
    this.scheduleFlush();

    const section = this.detectSection();
    this.currentSection   = section;
    this.sectionEnterTime = Date.now();
    this.activeTimeStart  = Date.now();
    this.sendEvent('page_load', { section, sectionLabel: this.getSectionLabel(section) });

    console.log('[ET] Tracker initialized:', this.platform, location.href, 'section:', section);
  }

  protected attachListeners() {
    document.addEventListener('click', () => this.handleClick(), { passive: true });

    window.addEventListener('beforeunload', () => {
      this.recordSectionLeave();
      this.sendEvent('page_unload');
      // Use sendBeacon for guaranteed delivery on unload
      this.flushBeacon();
    });

    window.addEventListener('focus', () => {
      this.isIdle = false;
      this.activeTimeStart = Date.now(); // resume active timer
    });
    window.addEventListener('blur', () => {
      this.isIdle = true;
    });

    document.addEventListener('mousemove', () => {
      if (this.isIdle) {
        this.isIdle = false;
        this.activeTimeStart = Date.now(); // resume active timer
      }
      this.lastActivity = Date.now();
      this.resetIdleTimer();
    }, { passive: true });

    document.addEventListener('keydown', () => {
      if (this.isIdle) {
        this.isIdle = false;
        this.activeTimeStart = Date.now();
      }
      this.lastActivity = Date.now();
      this.resetIdleTimer();
    }, { passive: true });

    this.resetIdleTimer();
  }

  protected handleClick() {
    if (this.isIdle) {
      this.isIdle = false;
      this.activeTimeStart = Date.now();
    }
    this.isIdle = false;
    this.lastActivity = Date.now();
    this.resetIdleTimer();
    this.sendEvent('click', {
      section: this.currentSection,
      sectionLabel: this.getSectionLabel(this.currentSection),
    });
  }

  protected resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.isIdle = true;
    }, IDLE_THRESHOLD_MS);
  }

  protected onSectionChange(newSection: string) {
    if (newSection === this.currentSection) return;
    this.recordSectionLeave();
    this.currentSection   = newSection;
    this.sectionEnterTime = Date.now();
    this.activeTimeStart  = Date.now();
    const enterEvent = this.platform === 'WILDBERRIES' ? 'wb_section_enter' : 'ozon_section_enter';
    this.sendEvent(enterEvent as any, {
      section: newSection,
      sectionLabel: this.getSectionLabel(newSection),
      url: location.href.slice(0, 300),
    });
  }

  protected recordSectionLeave() {
    if (!this.currentSection || this.sectionEnterTime === 0) return;
    const totalTime = Math.round((Date.now() - this.sectionEnterTime) / 1000);
    if (totalTime < 1) return;

    // Calculate active time (excluding idle periods)
    const activeTime = this.isIdle
      ? Math.round((this.lastActivity - this.sectionEnterTime) / 1000)
      : Math.round((Date.now() - this.sectionEnterTime) / 1000);

    const leaveEvent = this.platform === 'WILDBERRIES' ? 'wb_section_leave' : 'ozon_section_leave';
    this.sendEvent(leaveEvent as any, {
      section: this.currentSection,
      sectionLabel: this.getSectionLabel(this.currentSection),
      timeSpentSeconds: totalTime,
      activeSeconds: Math.max(0, activeTime),
    });
  }

  protected getSectionLabel(section: string): string { return section; }

  protected scheduleFlush() {
    setInterval(() => this.flushNow(), 5000);
    // Report active time in current section every 60 seconds
    setInterval(() => this.reportActivePing(), 60000);
  }

  protected reportActivePing() {
    if (!this.currentSection || this.sectionEnterTime === 0 || this.isIdle) return;
    const activeTime = Math.round((Date.now() - this.sectionEnterTime) / 1000);
    if (activeTime < 10) return;
    const pingEvent = this.platform === 'WILDBERRIES' ? 'wb_section_ping' : 'ozon_section_ping';
    this.sendEvent(pingEvent as any, {
      section: this.currentSection,
      sectionLabel: this.getSectionLabel(this.currentSection),
      activeSeconds: activeTime,
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
            const newAuth = { ...auth, accessToken: data.accessToken, expiresAt: Date.now() + 900_000 };
            await new Promise<void>(r => chrome.storage.local.set({ [STORAGE_KEYS.AUTH_STATE]: newAuth }, r));
            return data.accessToken;
          }
        } catch {}
      }
      return auth.accessToken;
    } catch(e) {
      // Extension context invalidated - ignore
      return null;
    }
  }

  // Use sendBeacon for guaranteed delivery on page unload
  protected flushBeacon() {
    if (!this.buffer.length) return;
    const events = this.buffer.splice(0, this.buffer.length);
    try {
      // sendBeacon is synchronous and guaranteed even on page close
      const payload = JSON.stringify({
        batchId: crypto.randomUUID(), signature: 'beacon',
        extensionVersion: '1.0.0', sessionToken: this.sessionToken, events,
      });
      // Try sendBeacon first (doesn't need token but server should accept)
      const sent = navigator.sendBeacon(API_BASE_URL + '/api/v1/events/batch', new Blob([payload], { type: 'application/json' }));
      if (!sent) this.buffer.unshift(...events); // put back if failed
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
  }

  protected detectSection(): string { return 'unknown'; }
}
