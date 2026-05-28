import { API_BASE_URL, STORAGE_KEYS, IDLE_THRESHOLD_MS } from '../shared/constants';
import type { RawEvent, Platform } from '../shared/types';

const MAX_DAILY_ACTIVE_SECONDS   = 10 * 60 * 60; // 10 часов максимум в день
const MAX_CONTINUOUS_SECONDS     = 2 * 60 * 60;  // 2 часа непрерывной активности
const MIN_SECTION_SECONDS        = 3;             // минимум 3 секунды в разделе
const MIN_SECTION_STAY_MS        = 1_000;         // минимум 1 секунда в разделе (защита от быстрых переходов)

export abstract class BaseTracker {
  protected sessionToken   = crypto.randomUUID();
  protected lastActivity   = Date.now();
  protected idleTimer: ReturnType<typeof setTimeout> | null = null;
  protected isIdle         = true; // начинаем в idle — ждём первого клика
  protected buffer: RawEvent[] = [];
  protected currentSection = '';
  protected sectionEnterTime = 0;

  // Накопительный счётчик активного времени
  private accumulatedActiveSeconds = 0;
  private activeSegmentStart: number | null = null;
  private dailyActiveSeconds = 0;
  private continuousActiveSeconds = 0;
  private continuousStartTime: number | null = null;
  private clickCount = 0; // количество кликов в разделе
  private lastSectionEnterTime = 0; // для защиты от быстрых переходов
  private tabId = crypto.randomUUID(); // уникальный ID вкладки

  abstract platform: Platform;

  init() {
    this.attachListeners();
    this.scheduleFlush();

    const section = this.detectSection();
    this.currentSection       = section;
    this.sectionEnterTime     = Date.now();
    this.lastSectionEnterTime = Date.now();
    this.resetSectionCounters();

    // Восстанавливаем накопленное время из storage (для Ozon перезагрузок)
    this.restoreFromStorage(section).then(() => {
      this.sendEvent('page_load', { section, sectionLabel: this.getSectionLabel(section) });
      console.log('[ET] Tracker initialized:', this.platform, location.href, 'section:', section);
    });

    // Регистрируем эту вкладку как активную
    this.registerActiveTab();
  }

  // Восстанавливаем время из storage при перезагрузке страницы
  private async restoreFromStorage(section: string) {
    if (!chrome.runtime?.id) return;
    try {
      const key = `et_time_${this.platform}_${section}`;
      const result = await new Promise<any>(r => chrome.storage.local.get(key, r));
      if (result[key] && result[key].seconds > 0) {
        const saved = result[key];
        // Восстанавливаем только если данные свежие (менее 4 часов)
        if (Date.now() - saved.timestamp < 4 * 60 * 60 * 1000) {
          this.accumulatedActiveSeconds = saved.seconds;
          console.log('[ET] Restored', saved.seconds, 'seconds for', section);
        }
      }
    } catch {}
  }

  // Сохраняем накопленное время в storage
  private async saveToStorage() {
    if (!chrome.runtime?.id || !this.currentSection) return;
    try {
      const key = `et_time_${this.platform}_${this.currentSection}`;
      const total = this.getTotalActiveSeconds();
      if (total > 0) {
        await new Promise<void>(r => chrome.storage.local.set({
          [key]: { seconds: total, timestamp: Date.now(), section: this.currentSection }
        }, r));
      }
    } catch {}
  }

  // Очищаем storage для раздела после успешной отправки
  private async clearStorage(section: string) {
    if (!chrome.runtime?.id) return;
    try {
      const key = `et_time_${this.platform}_${section}`;
      await new Promise<void>(r => chrome.storage.local.remove(key, r));
    } catch {}
  }

  // Регистрируем вкладку как активную — сообщаем другим вкладкам уйти в idle
  private async registerActiveTab() {
    if (!chrome.runtime?.id) return;
    try {
      await new Promise<void>(r => chrome.storage.local.set({
        'et_active_tab': { tabId: this.tabId, platform: this.platform, timestamp: Date.now() }
      }, r));
    } catch {}
  }

  // Проверяем — не стала ли другая вкладка активной
  private async checkActiveTab(): Promise<boolean> {
    if (!chrome.runtime?.id) return true;
    try {
      const result = await new Promise<any>(r => chrome.storage.local.get('et_active_tab', r));
      const active = result['et_active_tab'];
      if (!active) return true;
      // Если другая вкладка активна менее 5 секунд назад — мы не активны
      if (active.tabId !== this.tabId && Date.now() - active.timestamp < 5000) {
        return false;
      }
      return true;
    } catch { return true; }
  }

  // ─── Управление активными отрезками ───────────────────────────────────────

  private startActiveSegment() {
    if (this.activeSegmentStart === null) {
      this.activeSegmentStart = Date.now();
      if (this.continuousStartTime === null) {
        this.continuousStartTime = Date.now();
      }
    }
  }

  private endActiveSegment() {
    if (this.activeSegmentStart !== null) {
      const segmentSeconds = Math.round((Date.now() - this.activeSegmentStart) / 1000);
      if (segmentSeconds > 0) {
        this.accumulatedActiveSeconds += segmentSeconds;
        this.dailyActiveSeconds       += segmentSeconds;
        this.continuousActiveSeconds  += segmentSeconds;
      }
      this.activeSegmentStart = null;
    }
  }

  private getTotalActiveSeconds(): number {
    const currentSegment = this.activeSegmentStart !== null
      ? Math.round((Date.now() - this.activeSegmentStart) / 1000)
      : 0;
    return this.accumulatedActiveSeconds + currentSegment;
  }

  private resetSectionCounters() {
    this.accumulatedActiveSeconds = 0;
    this.activeSegmentStart       = null;
    this.clickCount               = 0;
  }

  // ─── Проверки защит ───────────────────────────────────────────────────────

  private isDailyLimitReached(): boolean {
    return this.dailyActiveSeconds >= MAX_DAILY_ACTIVE_SECONDS;
  }

  private isContinuousLimitReached(): boolean {
    if (this.continuousActiveSeconds >= MAX_CONTINUOUS_SECONDS) {
      console.warn('[ET] Continuous activity limit reached (2h), stopping counter');
      return true;
    }
    return false;
  }

  private isQuickTransition(): boolean {
    const timeInSection = Date.now() - this.lastSectionEnterTime;
    return timeInSection < MIN_SECTION_STAY_MS;
  }

  // ─── Слушатели событий ────────────────────────────────────────────────────

  protected attachListeners() {
    // Только клик запускает новый активный отрезок
    document.addEventListener('click', () => this.handleClick(), { passive: true });

    // Скролл и клавиши только сбрасывают idle таймер (не запускают сегмент)
    document.addEventListener('scroll',  () => this.handleNonClickActivity(), { passive: true });
    document.addEventListener('keydown', () => this.handleNonClickActivity(), { passive: true });

    window.addEventListener('beforeunload', () => {
      this.endActiveSegment();
      this.recordSectionLeave();
      this.sendEvent('page_unload');
      this.flushBeacon();
    });

    // Переключение на другую вкладку или другое приложение → idle
    window.addEventListener('blur', () => {
      this.endActiveSegment();
      this.isIdle = true;
      if (this.idleTimer) clearTimeout(this.idleTimer);
    });

    // Возврат на вкладку → ждём клика
    window.addEventListener('focus', () => {
      // Не начинаем сегмент — ждём первого клика
    });

    // Вкладка скрыта (другая вкладка, свернули браузер) → idle
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.endActiveSegment();
        this.isIdle = true;
        if (this.idleTimer) clearTimeout(this.idleTimer);
      }
      // При возврате — ждём клика, не начинаем автоматически
    });
  }

  // ─── Обработка действий ───────────────────────────────────────────────────

  protected handleClick() {
    // Защита: дневной лимит
    if (this.isDailyLimitReached()) {
      console.warn('[ET] Daily limit reached (10h), ignoring activity');
      return;
    }

    // Защита: непрерывная активность 2ч
    if (this.isContinuousLimitReached()) {
      this.endActiveSegment();
      this.isIdle = true;
      return;
    }

    this.lastActivity = Date.now();
    this.clickCount++;

    // Регистрируем эту вкладку как активную
    this.registerActiveTab();

    // Клик выводит из idle и запускает новый сегмент
    if (this.isIdle) {
      this.isIdle = false;
      this.startActiveSegment();
    }

    this.resetIdleTimer();

    this.sendEvent('click', {
      section:      this.currentSection,
      sectionLabel: this.getSectionLabel(this.currentSection),
    });
  }

  protected handleNonClickActivity() {
    if (this.isIdle) return; // скролл/клавиша не выводят из idle
    this.lastActivity = Date.now();
    this.resetIdleTimer();
  }

  protected resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.endActiveSegment();
      this.isIdle = true;
      this.continuousStartTime     = null;
      this.continuousActiveSeconds = 0; // сброс непрерывной активности при idle
    }, IDLE_THRESHOLD_MS);
  }

  // ─── Смена раздела ────────────────────────────────────────────────────────

  protected onSectionChange(newSection: string) {
    if (newSection === this.currentSection) return;

    // Записываем уход из старого раздела
    this.endActiveSegment();
    this.recordSectionLeave();

    // Обновляем раздел
    this.currentSection       = newSection;
    this.sectionEnterTime     = Date.now();
    this.lastSectionEnterTime = Date.now();
    this.resetSectionCounters();
    this.isIdle = true; // ждём первого клика в новом разделе

    const enterEvent = this.platform === 'WILDBERRIES' ? 'wb_section_enter' : 'ozon_section_enter';
    this.sendEvent(enterEvent as any, {
      section:      newSection,
      sectionLabel: this.getSectionLabel(newSection),
      url:          location.href.slice(0, 300),
    });
  }

  protected recordSectionLeave() {
    if (!this.currentSection || this.sectionEnterTime === 0) return;

    // Защита от быстрых переходов (менее 1 секунды)
    if (this.isQuickTransition()) {
      console.log('[ET] Quick transition ignored (<1s):', this.currentSection);
      return;
    }

    const activeSeconds = this.getTotalActiveSeconds();

    // Минимальный порог
    if (activeSeconds < MIN_SECTION_SECONDS) return;

    const section = this.currentSection;
    const leaveEvent = this.platform === 'WILDBERRIES' ? 'wb_section_leave' : 'ozon_section_leave';
    this.sendEvent(leaveEvent as any, {
      section,
      sectionLabel:  this.getSectionLabel(section),
      activeSeconds,
    });
    // Очищаем storage после отправки
    this.clearStorage(section);
  }

  protected getSectionLabel(section: string): string { return section; }

  // ─── Ping ─────────────────────────────────────────────────────────────────

  protected scheduleFlush() {
    setInterval(() => this.flushNow(), 5000);
    setInterval(() => this.reportActivePing(), 15000);
    // Сохраняем время в storage каждые 5 секунд
    setInterval(() => {
      if (!this.isIdle && this.getTotalActiveSeconds() > 0) {
        this.saveToStorage();
      }
    }, 5000);
    // Сбрасываем дневной счётчик в полночь
    this.scheduleMidnightReset();
  }

  private scheduleMidnightReset() {
    const now = new Date();
    const midnight = new Date();
    midnight.setHours(24, 0, 0, 0);
    const msUntilMidnight = midnight.getTime() - now.getTime();
    setTimeout(() => {
      this.dailyActiveSeconds = 0;
      console.log('[ET] Daily counter reset at midnight');
      // Повторяем каждые 24 часа
      setInterval(() => {
        this.dailyActiveSeconds = 0;
        console.log('[ET] Daily counter reset');
      }, 24 * 60 * 60 * 1000);
    }, msUntilMidnight);
  }

  protected reportActivePing() {
    if (!this.currentSection || this.sectionEnterTime === 0 || this.isIdle) return;
    if (this.isDailyLimitReached()) return;

    const activeSeconds = this.getTotalActiveSeconds();
    if (activeSeconds < 10) return;

    const pingEvent = this.platform === 'WILDBERRIES' ? 'wb_section_ping' : 'ozon_section_ping';
    this.sendEvent(pingEvent as any, {
      section:      this.currentSection,
      sectionLabel: this.getSectionLabel(this.currentSection),
      activeSeconds,
    });
  }

  // ─── Отправка событий ─────────────────────────────────────────────────────

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

  // ─── Токен ────────────────────────────────────────────────────────────────

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
            method:  'POST',
            headers: { Authorization: 'Bearer ' + auth.accessToken },
          });
          if (res.ok) {
            const data    = await res.json();
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

  // ─── Flush ────────────────────────────────────────────────────────────────

  protected flushBeacon() {
    if (!this.buffer.length) return;
    const events = this.buffer.splice(0, this.buffer.length);
    try {
      const payload = JSON.stringify({
        batchId: crypto.randomUUID(), signature: 'beacon',
        extensionVersion: '1.0.0', sessionToken: this.sessionToken, events,
      });
      const sent = navigator.sendBeacon(
        API_BASE_URL + '/api/v1/events/batch',
        new Blob([payload], { type: 'application/json' })
      );
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
    } catch (e) {
      console.error('[ET] Flush error:', e);
      if (this.buffer.length < 200) this.buffer.unshift(...events);
      setTimeout(() => this.flushNow(), 30000);
    }
  }

  protected detectSection(): string { return 'unknown'; }
}
