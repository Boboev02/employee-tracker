const fs = require('fs');
const os = require('os');
const path = os.homedir() + '/employee-tracker/apps/extension/src/content/base-tracker.ts';

let c = fs.readFileSync(path, 'utf8');

// 1. Добавляем новые поля и методы после импортов
c = c.replace(
  `export abstract class BaseTracker {
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
  private lastSectionEnterTime = 0; // для защиты от быстрых переходов`,
  `export abstract class BaseTracker {
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
  private tabId = crypto.randomUUID(); // уникальный ID вкладки`
);

// 2. Обновляем init() — добавляем восстановление из storage и регистрацию вкладки
c = c.replace(
  `  init() {
    this.attachListeners();
    this.scheduleFlush();

    const section = this.detectSection();
    this.currentSection       = section;
    this.sectionEnterTime     = Date.now();
    this.lastSectionEnterTime = Date.now();
    this.resetSectionCounters();

    this.sendEvent('page_load', { section, sectionLabel: this.getSectionLabel(section) });
    console.log('[ET] Tracker initialized:', this.platform, location.href, 'section:', section);
  }`,
  `  init() {
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
      const key = \`et_time_\${this.platform}_\${section}\`;
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
      const key = \`et_time_\${this.platform}_\${this.currentSection}\`;
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
      const key = \`et_time_\${this.platform}_\${section}\`;
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
  }`
);

// 3. Обновляем handleClick — регистрируем вкладку как активную при клике
c = c.replace(
  `  protected handleClick() {
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
  }`,
  `  protected handleClick() {
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
  }`
);

// 4. Обновляем scheduleFlush — добавляем сохранение в storage каждые 5 секунд
c = c.replace(
  `  protected scheduleFlush() {
    setInterval(() => this.flushNow(), 5000);
    setInterval(() => this.reportActivePing(), 60000);
  }`,
  `  protected scheduleFlush() {
    setInterval(() => this.flushNow(), 5000);
    setInterval(() => this.reportActivePing(), 60000);
    // Сохраняем время в storage каждые 5 секунд
    setInterval(() => {
      if (!this.isIdle && this.getTotalActiveSeconds() > 0) {
        this.saveToStorage();
      }
    }, 5000);
  }`
);

// 5. Обновляем recordSectionLeave — очищаем storage после успешной отправки
c = c.replace(
  `  protected recordSectionLeave() {
    if (!this.currentSection || this.sectionEnterTime === 0) return;

    // Защита от быстрых переходов (менее 5 секунд)
    if (this.isQuickTransition()) {
      console.log('[ET] Quick transition ignored (<5s):', this.currentSection);
      return;
    }

    const activeSeconds = this.getTotalActiveSeconds();`,
  `  protected recordSectionLeave() {
    if (!this.currentSection || this.sectionEnterTime === 0) return;

    // Защита от быстрых переходов (менее 1 секунды)
    if (this.isQuickTransition()) {
      console.log('[ET] Quick transition ignored (<1s):', this.currentSection);
      return;
    }

    const activeSeconds = this.getTotalActiveSeconds();`
);

// 6. Находим конец recordSectionLeave и добавляем clearStorage
c = c.replace(
  `    const leaveEvent = this.platform === 'WILDBERRIES' ? 'wb_section_leave' : 'ozon_section_leave';
    this.sendEvent(leaveEvent as any, {
      section:       this.currentSection,
      sectionLabel:  this.getSectionLabel(this.currentSection),
      activeSeconds,
    });
  }`,
  `    const section = this.currentSection;
    const leaveEvent = this.platform === 'WILDBERRIES' ? 'wb_section_leave' : 'ozon_section_leave';
    this.sendEvent(leaveEvent as any, {
      section,
      sectionLabel:  this.getSectionLabel(section),
      activeSeconds,
    });
    // Очищаем storage после отправки
    this.clearStorage(section);
  }`
);

fs.writeFileSync(path, c);
console.log('✅ base-tracker.ts updated with storage persistence and single active tab');
