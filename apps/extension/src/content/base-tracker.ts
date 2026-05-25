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

  abstract platform: Platform;

  init() {
    this.attachListeners();
    this.scheduleFlush();

    // Init section on load
    const section = this.detectSection();
    this.currentSection   = section;
    this.sectionEnterTime = Date.now();
    this.sendEvent('page_load', { section, sectionLabel: this.getSectionLabel(section) });

    console.log('[ET] Tracker initialized:', this.platform, location.href, 'section:', section);
  }

  protected attachListeners() {
    document.addEventListener('click', () => this.handleClick(), { passive: true });

    window.addEventListener('beforeunload', () => {
      this.recordSectionLeave();
      this.sendEvent('page_unload');
      this.flushNow();
    });

    window.addEventListener('focus', () => { this.isIdle = false; });
    window.addEventListener('blur',  () => { this.isIdle = true; });

    document.addEventListener('mousemove', () => {
      this.lastActivity = Date.now();
      this.isIdle = false;
      this.resetIdleTimer();
    }, { passive: true });

    this.resetIdleTimer();
  }

  protected handleClick() {
    this.isIdle = false;
    this.lastActivity = Date.now();
    this.resetIdleTimer();
    // Always attach current section to click
    this.sendEvent('click', {
      section: this.currentSection,
      sectionLabel: this.getSectionLabel(this.currentSection),
    });
  }

  protected resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => { this.isIdle = true; }, IDLE_THRESHOLD_MS);
  }

  // Called by child trackers when section changes
  protected onSectionChange(newSection: string) {
    if (newSection === this.currentSection) return;

    // Record leave from old section
    this.recordSectionLeave();

    // Enter new section
    this.currentSection   = newSection;
    this.sectionEnterTime = Date.now();

    const enterEvent = this.platform === 'WILDBERRIES' ? 'wb_section_enter' : 'ozon_section_enter';
    this.sendEvent(enterEvent as any, {
      section: newSection,
      sectionLabel: this.getSectionLabel(newSection),
      url: location.href.slice(0, 300),
    });
  }

  protected recordSectionLeave() {
    if (!this.currentSection || this.sectionEnterTime === 0) return;
    const timeSpent = Math.round((Date.now() - this.sectionEnterTime) / 1000);
    if (timeSpent < 1) return;

    const leaveEvent = this.platform === 'WILDBERRIES' ? 'wb_section_leave' : 'ozon_section_leave';
    this.sendEvent(leaveEvent as any, {
      section: this.currentSection,
      sectionLabel: this.getSectionLabel(this.currentSection),
      timeSpentSeconds: timeSpent,
    });
  }

  protected getSectionLabel(section: string): string {
    return section;
  }

  protected scheduleFlush() {
    setInterval(() => this.flushNow(), 5000);
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
      if (res.ok) console.log('[ET] Flushed', (await res.json()).received, 'events');
    } catch(e) {
      console.error('[ET] Flush error:', e);
      this.buffer.unshift(...events);
    }
  }

  protected detectSection(): string { return 'unknown'; }
}
