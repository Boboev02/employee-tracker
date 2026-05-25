#!/bin/bash
BASE=~/employee-tracker/apps/extension/src

cat > "$BASE/content/base-tracker.ts" << 'TSEOF'
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
TSEOF

echo "✅ base-tracker.ts updated"

cat > "$BASE/content/wb-tracker.ts" << 'TSEOF'
import { BaseTracker } from './base-tracker';

interface ActionConfig { selector: string; event: string; label: string; }
interface SectionConfig { name: string; label: string; actions: ActionConfig[]; }

const WB_SECTIONS: Record<string, SectionConfig> = {
  orders:      { name:'orders',      label:'Заказы',           actions:[{selector:'[class*="cancel"]',event:'wb_order_cancel',label:'Отменил заказ'},{selector:'[class*="filter"]',event:'wb_order_filter',label:'Фильтр'},{selector:'[class*="export"]',event:'wb_order_export',label:'Экспорт'}] },
  feedbacks:   { name:'feedbacks',   label:'Отзывы',           actions:[{selector:'textarea,[contenteditable]',event:'wb_review_reply',label:'Ответил на отзыв'},{selector:'[class*="complaint"]',event:'wb_review_complain',label:'Жалоба'}] },
  questions:   { name:'questions',   label:'Вопросы',          actions:[{selector:'textarea,[contenteditable]',event:'wb_question_reply',label:'Ответил на вопрос'}] },
  products:    { name:'products',    label:'Товары',           actions:[{selector:'[class*="create"],[class*="add"]',event:'wb_product_create',label:'Создал товар'},{selector:'[class*="edit"]',event:'wb_product_edit',label:'Редактировал'},{selector:'[class*="delete"]',event:'wb_product_delete',label:'Удалил'}] },
  prices:      { name:'prices',      label:'Цены',             actions:[{selector:'[class*="save"]',event:'wb_price_save',label:'Сохранил цены'},{selector:'input[type="number"]',event:'wb_price_edit',label:'Изменил цену'}] },
  stocks:      { name:'stocks',      label:'Остатки',          actions:[{selector:'[class*="save"],[class*="update"]',event:'wb_stock_update',label:'Обновил остатки'},{selector:'[class*="upload"]',event:'wb_stock_upload',label:'Загрузил файл'}] },
  supplies:    { name:'supplies',    label:'Поставки',         actions:[{selector:'[class*="create"]',event:'wb_supply_create',label:'Создал поставку'},{selector:'[class*="confirm"]',event:'wb_supply_confirm',label:'Подтвердил'},{selector:'[class*="print"]',event:'wb_supply_print',label:'Распечатал'}] },
  advertising: { name:'advertising', label:'Реклама',          actions:[{selector:'[class*="create"]',event:'wb_ads_create',label:'Создал кампанию'},{selector:'[class*="pause"]',event:'wb_ads_pause',label:'Приостановил'},{selector:'[class*="budget"]',event:'wb_ads_budget',label:'Изменил бюджет'}] },
  analytics:   { name:'analytics',   label:'Аналитика',        actions:[{selector:'[class*="export"]',event:'wb_analytics_export',label:'Экспорт отчёта'},{selector:'[class*="filter"]',event:'wb_analytics_filter',label:'Фильтр'}] },
  finance:     { name:'finance',     label:'Финансы',          actions:[{selector:'[class*="export"]',event:'wb_finance_export',label:'Скачал документ'}] },
  chat:        { name:'chat',        label:'Чат',              actions:[{selector:'button[type="submit"]',event:'wb_chat_send',label:'Отправил сообщение'}] },
  promotions:  { name:'promotions',  label:'Акции',            actions:[{selector:'[class*="join"]',event:'wb_promo_join',label:'Вступил в акцию'}] },
};

class WbTracker extends BaseTracker {
  platform = 'WILDBERRIES' as const;
  protected sectionListeners: { el: Element; fn: EventListener }[] = [];

  init() {
    super.init();
    this.watchNavigation();
    this.watchHashChange();
    this.attachSectionListeners();
  }

  protected detectSection(): string {
    const path = location.pathname + location.hash;
    const host = location.hostname;
    if (host.includes('cmp.wildberries.ru') || path.includes('/campaigns')) return 'advertising';
    if (path.includes('/orders') || path.includes('/sales'))                 return 'orders';
    if (path.includes('/feedbacks') || path.includes('/reviews'))            return 'feedbacks';
    if (path.includes('/questions'))                                          return 'questions';
    if (path.includes('/products') || path.includes('/goods'))               return 'products';
    if (path.includes('/prices') || path.includes('/price'))                 return 'prices';
    if (path.includes('/stocks') || path.includes('/remains'))               return 'stocks';
    if (path.includes('/supplies') || path.includes('/supply'))              return 'supplies';
    if (path.includes('/advertising') || path.includes('/promo') || path.includes('/campaigns')) return 'advertising';
    if (path.includes('/analytics') || path.includes('/statistics'))         return 'analytics';
    if (path.includes('/finance') || path.includes('/payments'))             return 'finance';
    if (path.includes('/chat') || path.includes('/messages'))                return 'chat';
    if (path.includes('/promotions') || path.includes('/actions'))           return 'promotions';
    return 'other';
  }

  protected getSectionLabel(s: string): string { return WB_SECTIONS[s]?.label ?? s; }

  private watchNavigation() {
    // Watch full URL including hash and search params
    let lastUrl = location.href;
    setInterval(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        this.onSectionChange(this.detectSection());
        this.attachSectionListeners();
      }
    }, 300);
  }

  private watchHashChange() {
    // Also watch pushState for SPA navigation
    const orig = history.pushState.bind(history);
    history.pushState = (...args) => {
      orig(...args);
      setTimeout(() => {
        this.onSectionChange(this.detectSection());
        this.attachSectionListeners();
      }, 100);
    };
    window.addEventListener('popstate', () => {
      setTimeout(() => {
        this.onSectionChange(this.detectSection());
        this.attachSectionListeners();
      }, 100);
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
TSEOF

echo "✅ wb-tracker.ts updated"

cat > "$BASE/content/ozon-tracker.ts" << 'TSEOF'
import { BaseTracker } from './base-tracker';

interface ActionConfig { selector: string; event: string; label: string; }
interface SectionConfig { name: string; label: string; actions: ActionConfig[]; }

const OZON_SECTIONS: Record<string, SectionConfig> = {
  orders:    { name:'orders',    label:'Заказы',       actions:[{selector:'[class*="cancel"]',event:'ozon_order_cancel',label:'Отменил заказ'},{selector:'[class*="filter"]',event:'ozon_order_filter',label:'Фильтр'},{selector:'[class*="export"]',event:'ozon_order_export',label:'Экспорт'},{selector:'[class*="label"],[class*="barcode"]',event:'ozon_order_label',label:'Этикетка'}] },
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
    const path = location.pathname + location.hash;
    if (path.includes('/orders') || path.includes('/fbs') || path.includes('/fbo'))     return 'orders';
    if (path.includes('/products') || path.includes('/goods'))                           return 'products';
    if (path.includes('/prices') || path.includes('/price'))                             return 'prices';
    if (path.includes('/stocks') || path.includes('/remains'))                           return 'stocks';
    if (path.includes('/analytics') || path.includes('/statistics'))                     return 'analytics';
    if (path.includes('/finance') || path.includes('/payments'))                         return 'finance';
    if (path.includes('/logistics') || path.includes('/supply'))                         return 'logistics';
    if (path.includes('/reviews') || path.includes('/feedbacks'))                        return 'reviews';
    if (path.includes('/questions'))                                                      return 'questions';
    if (path.includes('/promotion') || path.includes('/advertisement') || path.includes('/promo')) return 'promotion';
    if (path.includes('/rating'))                                                         return 'rating';
    if (path.includes('/chat') || path.includes('/messages'))                            return 'chat';
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
TSEOF

echo "✅ ozon-tracker.ts updated"

cd ~/employee-tracker/apps/extension && npm run build && echo "✅ Extension rebuilt successfully"
