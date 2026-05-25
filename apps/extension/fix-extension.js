const fs = require('fs');
const home = require('os').homedir();
const base = home + '/employee-tracker/apps/extension/src';

function write(p, c) {
  fs.writeFileSync(base + '/' + p, c);
  console.log('✓', p);
}

// ─── 1. FIX BASE-TRACKER ────────────────────────────────────────
// Problems: 
// - flushNow called on beforeunload but async - browser may cancel it
// - no try/catch around chrome.storage.local.get (Extension context invalidated)
// - idle detection doesn't stop counting section time

write('content/base-tracker.ts', `import { API_BASE_URL, STORAGE_KEYS, IDLE_THRESHOLD_MS } from '../shared/constants';
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
      if (res.ok) console.log('[ET] Flushed', (await res.json()).received ?? events.length, 'events');
      else this.buffer.unshift(...events); // put back on error
    } catch(e) {
      console.error('[ET] Flush error:', e);
      this.buffer.unshift(...events);
    }
  }

  protected detectSection(): string { return 'unknown'; }
}
`);

// ─── 2. FIX WB TRACKER ──────────────────────────────────────────
// Problems:
// - Missing replaceState hook
// - Missing /promotion-info URL pattern
// - Missing more URL patterns

write('content/wb-tracker.ts', `import { BaseTracker } from './base-tracker';

interface ActionConfig { selector: string; event: string; label: string; }
interface SectionConfig { name: string; label: string; actions: ActionConfig[]; }

const WB_SECTIONS: Record<string, SectionConfig> = {
  orders:      { name:'orders',      label:'Заказы',     actions:[{selector:'[class*="cancel"]',event:'wb_order_cancel',label:'Отменил заказ'},{selector:'[class*="filter"]',event:'wb_order_filter',label:'Фильтр'},{selector:'[class*="export"]',event:'wb_order_export',label:'Экспорт'}] },
  feedbacks:   { name:'feedbacks',   label:'Отзывы',     actions:[{selector:'textarea,[contenteditable]',event:'wb_review_reply',label:'Ответил на отзыв'},{selector:'[class*="complaint"]',event:'wb_review_complain',label:'Жалоба'}] },
  questions:   { name:'questions',   label:'Вопросы',    actions:[{selector:'textarea,[contenteditable]',event:'wb_question_reply',label:'Ответил на вопрос'}] },
  products:    { name:'products',    label:'Товары',     actions:[{selector:'[class*="create"],[class*="add"]',event:'wb_product_create',label:'Создал товар'},{selector:'[class*="edit"]',event:'wb_product_edit',label:'Редактировал'},{selector:'[class*="delete"]',event:'wb_product_delete',label:'Удалил'}] },
  prices:      { name:'prices',      label:'Цены',       actions:[{selector:'[class*="save"]',event:'wb_price_save',label:'Сохранил цены'},{selector:'input[type="number"]',event:'wb_price_edit',label:'Изменил цену'}] },
  stocks:      { name:'stocks',      label:'Остатки',    actions:[{selector:'[class*="save"],[class*="update"]',event:'wb_stock_update',label:'Обновил остатки'},{selector:'[class*="upload"]',event:'wb_stock_upload',label:'Загрузил файл'}] },
  supplies:    { name:'supplies',    label:'Поставки',   actions:[{selector:'[class*="create"]',event:'wb_supply_create',label:'Создал поставку'},{selector:'[class*="confirm"]',event:'wb_supply_confirm',label:'Подтвердил'},{selector:'[class*="print"]',event:'wb_supply_print',label:'Распечатал'}] },
  advertising: { name:'advertising', label:'Реклама',    actions:[{selector:'[class*="create"]',event:'wb_ads_create',label:'Создал кампанию'},{selector:'[class*="pause"]',event:'wb_ads_pause',label:'Приостановил'},{selector:'[class*="budget"]',event:'wb_ads_budget',label:'Изменил бюджет'}] },
  analytics:   { name:'analytics',   label:'Аналитика',  actions:[{selector:'[class*="export"]',event:'wb_analytics_export',label:'Экспорт отчёта'},{selector:'[class*="filter"]',event:'wb_analytics_filter',label:'Фильтр'}] },
  finance:     { name:'finance',     label:'Финансы',    actions:[{selector:'[class*="export"]',event:'wb_finance_export',label:'Скачал документ'}] },
  chat:        { name:'chat',        label:'Чат',        actions:[{selector:'button[type="submit"]',event:'wb_chat_send',label:'Отправил сообщение'}] },
  promotions:  { name:'promotions',  label:'Акции',      actions:[{selector:'[class*="join"]',event:'wb_promo_join',label:'Вступил в акцию'}] },
  content:     { name:'content',     label:'Контент',    actions:[] },
  knowledge:   { name:'knowledge',   label:'База знаний',actions:[] },
};

class WbTracker extends BaseTracker {
  platform = 'WILDBERRIES' as const;
  protected sectionListeners: { el: Element; fn: EventListener }[] = [];

  init() {
    super.init();
    this.watchNavigation();
    this.attachSectionListeners();
  }

  protected detectSection(): string {
    const path = location.pathname;
    const host = location.hostname;
    const hash = location.hash;

    // Реклама (отдельный домен)
    if (host.includes('cmp.wildberries.ru')) return 'advertising';
    if (path.includes('/campaigns')) return 'advertising';

    // Товары / контент
    if (path.includes('/new-goods')) return 'products';
    if (path.includes('/product-card')) return 'products';
    if (path.includes('/suppliers-product-verification')) return 'products';
    if (path.includes('/content-rating')) return 'content';
    if (path.includes('/media-content')) return 'content';

    // Цены и скидки
    if (path.includes('/discount-and-prices')) return 'prices';
    if (path.includes('/dp-promo-calendar')) return 'promotions';
    if (path.includes('/prices-index')) return 'prices';
    if (path.includes('/price')) return 'prices';

    // Отзывы и вопросы
    if (path.includes('/feedbacks')) return 'feedbacks';
    if (path.includes('/points-for-reviews')) return 'feedbacks';
    if (path.includes('/questions')) return 'questions';

    // Чат
    if (path.includes('/chat-with-clients') || path.includes('/chat')) return 'chat';

    // Финансы
    if (path.includes('/suppliers-mutual-settlements')) return 'finance';
    if (path.includes('/payment-history')) return 'finance';
    if (path.includes('/income-analytics')) return 'finance';
    if (path.includes('/finance')) return 'finance';

    // Аналитика
    if (path.includes('/content-analytics')) return 'analytics';
    if (path.includes('/remains-analytics')) return 'analytics';
    if (path.includes('/analytics-reports')) return 'analytics';
    if (path.includes('/analytics')) return 'analytics';

    // Остатки
    if (path.includes('/stocks') || path.includes('/remains') || path.includes('/warehouses')) return 'stocks';

    // Поставки
    if (path.includes('/supplies') || path.includes('/supply')) return 'supplies';

    // Заказы
    if (path.includes('/orders') || path.includes('/sales')) return 'orders';

    // Акции
    if (path.includes('/promotions') || path.includes('/actions') || path.includes('/promo')) return 'promotions';

    // База знаний
    if (path.includes('/knowledge') || path.includes('/help')) return 'knowledge';

    return 'other';
  }

  protected getSectionLabel(s: string): string { return WB_SECTIONS[s]?.label ?? s; }

  private watchNavigation() {
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        this.onSectionChange(this.detectSection());
        this.attachSectionListeners();
      }
    }, 300);

    // Hook pushState
    const orig = history.pushState.bind(history);
    history.pushState = (...args) => {
      orig(...args);
      setTimeout(() => { this.onSectionChange(this.detectSection()); this.attachSectionListeners(); }, 100);
    };
    // Hook replaceState
    const origReplace = history.replaceState.bind(history);
    history.replaceState = (...args) => {
      origReplace(...args);
      setTimeout(() => { this.onSectionChange(this.detectSection()); this.attachSectionListeners(); }, 100);
    };
    window.addEventListener('popstate', () => {
      setTimeout(() => { this.onSectionChange(this.detectSection()); this.attachSectionListeners(); }, 100);
    });
    window.addEventListener('hashchange', () => {
      this.onSectionChange(this.detectSection());
      this.attachSectionListeners();
    });
  }

  protected attachSectionListeners() {
    this.sectionListeners.forEach(({ el, fn }) => el.removeEventListener('click', fn));
    this.sectionListeners = [];
    const section = this.detectSection();
    const config  = WB_SECTIONS[section];
    if (!config) return;
    const attach = () => {
      config.actions.forEach(action => {
        document.querySelectorAll(action.selector).forEach(el => {
          if (this.sectionListeners.find(l => l.el === el)) return;
          const fn: EventListener = () => this.sendEvent(action.event as any, { section, sectionLabel: config.label, actionLabel: action.label });
          el.addEventListener('click', fn);
          this.sectionListeners.push({ el, fn });
        });
      });
    };
    attach();
    new MutationObserver(attach).observe(document.body, { childList: true, subtree: true });
  }
}

try { new WbTracker().init(); } catch(e) { console.error('[ET] WbTracker error:', e); }
`);

// ─── 3. FIX OZON TRACKER ────────────────────────────────────────
// Problems:
// - /supply catches before /supply/goods for stocks
// - missing /promotion-info, /advertisement URLs
// - missing replaceState hook

write('content/ozon-tracker.ts', `import { BaseTracker } from './base-tracker';

interface ActionConfig { selector: string; event: string; label: string; }
interface SectionConfig { name: string; label: string; actions: ActionConfig[]; }

const OZON_SECTIONS: Record<string, SectionConfig> = {
  orders:    { name:'orders',    label:'Заказы',       actions:[{selector:'[class*="cancel"]',event:'ozon_order_cancel',label:'Отменил заказ'},{selector:'[class*="filter"]',event:'ozon_order_filter',label:'Фильтр'},{selector:'[class*="export"]',event:'ozon_order_export',label:'Экспорт'}] },
  products:  { name:'products',  label:'Товары',       actions:[{selector:'[class*="create"],[class*="add"]',event:'ozon_product_create',label:'Создал товар'},{selector:'[class*="edit"]',event:'ozon_product_edit',label:'Редактировал'},{selector:'[class*="price"]',event:'ozon_product_price',label:'Цена'},{selector:'[class*="stock"]',event:'ozon_product_stock',label:'Остатки'}] },
  prices:    { name:'prices',    label:'Цены',         actions:[{selector:'[class*="save"]',event:'ozon_price_save',label:'Сохранил цены'},{selector:'[class*="discount"]',event:'ozon_price_discount',label:'Скидка'}] },
  stocks:    { name:'stocks',    label:'Остатки',      actions:[{selector:'[class*="update"],[class*="save"]',event:'ozon_stock_update',label:'Обновил остатки'},{selector:'[class*="upload"]',event:'ozon_stock_upload',label:'Загрузил'}] },
  analytics: { name:'analytics', label:'Аналитика',    actions:[{selector:'[class*="export"]',event:'ozon_analytics_export',label:'Экспорт'},{selector:'[class*="filter"]',event:'ozon_analytics_filter',label:'Фильтр'}] },
  finance:   { name:'finance',   label:'Финансы',      actions:[{selector:'[class*="export"]',event:'ozon_finance_export',label:'Скачал документ'},{selector:'[class*="invoice"]',event:'ozon_finance_invoice',label:'Счёт-фактура'}] },
  logistics: { name:'logistics', label:'Логистика',    actions:[{selector:'[class*="create"]',event:'ozon_logistics_create',label:'Создал отгрузку'},{selector:'[class*="print"]',event:'ozon_logistics_print',label:'Документ'}] },
  reviews:   { name:'reviews',   label:'Отзывы',       actions:[{selector:'textarea,[contenteditable]',event:'ozon_review_reply',label:'Ответил на отзыв'},{selector:'[class*="complaint"]',event:'ozon_review_complain',label:'Жалоба'}] },
  questions: { name:'questions', label:'Вопросы',      actions:[{selector:'textarea,[contenteditable]',event:'ozon_question_reply',label:'Ответил на вопрос'}] },
  promotion: { name:'promotion', label:'Продвижение',  actions:[{selector:'[class*="create"]',event:'ozon_ads_create',label:'Создал кампанию'},{selector:'[class*="pause"]',event:'ozon_ads_pause',label:'Приостановил'},{selector:'[class*="budget"]',event:'ozon_ads_budget',label:'Бюджет'}] },
  rating:    { name:'rating',    label:'Рейтинг',      actions:[] },
  chat:      { name:'chat',      label:'Чат',          actions:[{selector:'button[type="submit"]',event:'ozon_chat_send',label:'Отправил сообщение'}] },
};

class OzonTracker extends BaseTracker {
  platform = 'OZON' as const;
  protected sectionListeners: { el: Element; fn: EventListener }[] = [];

  init() {
    super.init();
    this.watchNavigation();
    this.attachSectionListeners();
  }

  protected detectSection(): string {
    const path = location.pathname;

    // Заказы — проверяем первыми т.к. /fbs /fbo специфичны
    if (path.includes('/orders') || path.includes('/fbs') || path.includes('/fbo')) return 'orders';

    // Остатки — ВАЖНО: /supply/goods должно быть ДО /supply
    if (path.includes('/supply/goods') || path.includes('/stocks') || path.includes('/remains')) return 'stocks';

    // Логистика
    if (path.includes('/logistics') || path.includes('/supply')) return 'logistics';

    // Товары
    if (path.includes('/products') || path.includes('/goods')) return 'products';

    // Цены
    if (path.includes('/prices')) return 'prices';

    // Финансы / банк
    if (path.includes('/finances') || path.includes('/payments') || path.includes('/fintech')) return 'finance';

    // Аналитика
    if (path.includes('/analytics-search') || path.includes('/analytics')) return 'analytics';

    // Отзывы
    if (path.includes('/reviews') || path.includes('/feedbacks')) return 'reviews';

    // Вопросы
    if (path.includes('/questions')) return 'questions';

    // Продвижение и реклама — все варианты URL
    if (
      path.includes('/advertisement') ||
      path.includes('/promotion-info') ||
      path.includes('/promotion') ||
      path.includes('/promo') ||
      path.includes('/adv')
    ) return 'promotion';

    // Рейтинг
    if (path.includes('/rating')) return 'rating';

    // Чат
    if (path.includes('/chat') || path.includes('/messages')) return 'chat';

    return 'other';
  }

  protected getSectionLabel(s: string): string { return OZON_SECTIONS[s]?.label ?? s; }

  private watchNavigation() {
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        this.onSectionChange(this.detectSection());
        this.attachSectionListeners();
      }
    }, 300);

    const orig = history.pushState.bind(history);
    history.pushState = (...args) => {
      orig(...args);
      setTimeout(() => { this.onSectionChange(this.detectSection()); this.attachSectionListeners(); }, 100);
    };
    // Fix: also hook replaceState
    const origReplace = history.replaceState.bind(history);
    history.replaceState = (...args) => {
      origReplace(...args);
      setTimeout(() => { this.onSectionChange(this.detectSection()); this.attachSectionListeners(); }, 100);
    };
    window.addEventListener('popstate', () => {
      setTimeout(() => { this.onSectionChange(this.detectSection()); this.attachSectionListeners(); }, 100);
    });
  }

  protected attachSectionListeners() {
    this.sectionListeners.forEach(({ el, fn }) => el.removeEventListener('click', fn));
    this.sectionListeners = [];
    const section = this.detectSection();
    const config  = OZON_SECTIONS[section];
    if (!config) return;
    const attach = () => {
      config.actions.forEach(action => {
        document.querySelectorAll(action.selector).forEach(el => {
          if (this.sectionListeners.find(l => l.el === el)) return;
          const fn: EventListener = () => this.sendEvent(action.event as any, { section, sectionLabel: config.label, actionLabel: action.label });
          el.addEventListener('click', fn);
          this.sectionListeners.push({ el, fn });
        });
      });
    };
    attach();
    new MutationObserver(attach).observe(document.body, { childList: true, subtree: true });
  }
}

try { new OzonTracker().init(); } catch(e) { console.error('[ET] OzonTracker error:', e); }
`);

console.log('\n✅ All extension files fixed');
