#!/bin/bash
BASE=~/employee-tracker/apps/extension/src

# ─── Update base-tracker to only send meaningful events ──────
cat > "$BASE/content/base-tracker.ts" << 'TSEOF'
import { IDLE_THRESHOLD_MS, API_BASE_URL, STORAGE_KEYS } from '../shared/constants';
import type { RawEvent, Platform } from '../shared/types';

export abstract class BaseTracker {
  protected sessionToken = crypto.randomUUID();
  protected lastActivity = Date.now();
  protected idleTimer: ReturnType<typeof setTimeout> | null = null;
  protected isIdle = false;
  protected buffer: RawEvent[] = [];
  protected sectionEnterTime = 0;
  protected currentSection = '';

  abstract platform: Platform;

  init() {
    this.attachListeners();
    this.scheduleFlush();
    this.sendEvent('page_load');
    console.log('[ET] Tracker initialized:', this.platform, location.href);
  }

  protected attachListeners() {
    // Only track clicks — not scroll/keydown
    document.addEventListener('click', () => this.handleClick(), { passive: true });

    window.addEventListener('beforeunload', () => {
      this.sendSectionLeave();
      this.sendEvent('page_unload');
      this.flushNow();
    });

    window.addEventListener('focus', () => {
      if (this.isIdle) {
        this.isIdle = false;
        this.sendEvent('tab_focus');
      }
    });

    window.addEventListener('blur', () => {
      this.isIdle = true;
    });

    // Idle detection - but don't send events for it
    document.addEventListener('mousemove', () => {
      this.lastActivity = Date.now();
      this.isIdle = false;
      this.resetIdleTimer();
    }, { passive: true });

    this.resetIdleTimer();
  }

  protected handleClick() {
    if (this.isIdle) {
      this.isIdle = false;
    }
    this.lastActivity = Date.now();
    this.resetIdleTimer();
    this.sendEvent('click');
  }

  protected resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.isIdle = true;
    }, IDLE_THRESHOLD_MS);
  }

  protected sendSectionLeave() {
    if (this.currentSection && this.sectionEnterTime > 0) {
      const timeSpent = Math.round((Date.now() - this.sectionEnterTime) / 1000);
      this.sendEvent(this.platform === 'WILDBERRIES' ? 'wb_section_leave' : 'ozon_section_leave' as any, {
        section: this.currentSection,
        sectionLabel: this.getSectionLabel(this.currentSection),
        timeSpentSeconds: timeSpent,
      });
    }
  }

  protected getSectionLabel(section: string): string {
    return section;
  }

  protected scheduleFlush() {
    setInterval(() => this.flushNow(), 5000);
  }

  protected sendEvent(eventType: any, extra: Record<string, any> = {}) {
    const event: RawEvent = {
      eventId:         crypto.randomUUID(),
      sessionToken:    this.sessionToken,
      eventType,
      platform:        this.platform,
      clientTimestamp: Date.now(),
      url:             location.href.slice(0, 500),
      pageTitle:       document.title.slice(0, 200),
      platformData:    { ...extra, section: this.detectSection() },
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
          headers: { 'Authorization': 'Bearer ' + auth.accessToken },
        });
        if (res.ok) {
          const data = await res.json();
          const newAuth = { ...auth, accessToken: data.accessToken, expiresAt: Date.now() + 900_000 };
          await new Promise<void>(resolve => chrome.storage.local.set({ [STORAGE_KEYS.AUTH_STATE]: newAuth }, resolve));
          return data.accessToken;
        }
      } catch { /* use existing token */ }
    }
    return auth.accessToken;
  }

  protected async flushNow() {
    if (!this.buffer.length) return;
    const events = this.buffer.splice(0, this.buffer.length);
    try {
      const token = await this.getValidToken();
      if (!token) return;
      const res = await fetch(API_BASE_URL + '/api/v1/events/batch', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + token },
        body: JSON.stringify({
          batchId: crypto.randomUUID(), signature: 'direct',
          extensionVersion: '1.0.0', sessionToken: this.sessionToken, events,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        console.log('[ET] Flushed', data.received, 'events');
      }
    } catch(e) {
      console.error('[ET] Flush error:', e);
    }
  }

  protected detectSection(): string {
    return 'unknown';
  }
}
TSEOF

echo "✅ base-tracker updated"

# ─── Rebuild ─────────────────────────────────────────────────
cd ~/employee-tracker/apps/extension && npm run build && echo "✅ Extension rebuilt"
