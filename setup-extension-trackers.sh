#!/bin/bash
BASE=~/employee-tracker/apps/extension/src

# ─── WB TRACKER ───────────────────────────────────────────────
cat > "$BASE/content/wb-tracker.ts" << 'EOF'
import { BaseTracker } from './base-tracker';

interface SectionConfig {
  name: string;
  label: string;
  actions: { selector: string; event: string; label: string }[];
}

const WB_SECTIONS: Record<string, SectionConfig> = {
  orders: {
    name: 'orders', label: 'Заказы',
    actions: [
      { selector: '[data-test="order-accept"]',   event: 'wb_order_accept',   label: 'Принял заказ' },
      { selector: '[data-test="order-cancel"]',   event: 'wb_order_cancel',   label: 'Отменил заказ' },
      { selector: '.order-filter',                event: 'wb_order_filter',   label: 'Применил фильтр' },
      { selector: '[class*="export"]',            event: 'wb_order_export',   label: 'Экспортировал заказы' },
      { selector: '[class*="search"] input',      event: 'wb_order_search',   label: 'Поиск заказов' },
    ],
  },
  feedbacks: {
    name: 'feedbacks', label: 'Отзывы',
    actions: [
      { selector: '[class*="reply"], [class*="answer"]', event: 'wb_review_reply',    label: 'Ответил на отзыв' },
      { selector: '[class*="complaint"]',                event: 'wb_review_complain', label: 'Жалоба на отзыв' },
      { selector: '[class*="filter"]',                   event: 'wb_review_filter',   label: 'Фильтр отзывов' },
      { selector: 'textarea',                            event: 'wb_review_typing',   label: 'Набирает ответ' },
    ],
  },
  questions: {
    name: 'questions', label: 'Вопросы',
    actions: [
      { selector: 'textarea, [contenteditable]',         event: 'wb_question_reply',  label: 'Ответил на вопрос' },
      { selector: '[class*="filter"]',                   event: 'wb_question_filter', label: 'Фильтр вопросов' },
    ],
  },
  products: {
    name: 'products', label: 'Товары',
    actions: [
      { selector: '[class*="add"], [class*="create"]',   event: 'wb_product_create',  label: 'Создал товар' },
      { selector: '[class*="edit"], [class*="update"]',  event: 'wb_product_edit',    label: 'Редактировал товар' },
      { selector: '[class*="delete"], [class*="remove"]',event: 'wb_product_delete',  label: 'Удалил товар' },
      { selector: '[class*="photo"], [class*="image"]',  event: 'wb_product_photo',   label: 'Загрузил фото' },
      { selector: '[class*="export"], [class*="download"]',event:'wb_product_export', label: 'Экспортировал товары' },
      { selector: '[class*="search"] input',             event: 'wb_product_search',  label: 'Поиск товаров' },
    ],
  },
  prices: {
    name: 'prices', label: 'Цены',
    actions: [
      { selector: '[class*="save"], [class*="apply"]',   event: 'wb_price_save',      label: 'Сохранил цены' },
      { selector: '[class*="discount"]',                 event: 'wb_price_discount',  label: 'Установил скидку' },
      { selector: 'input[type="number"]',                event: 'wb_price_edit',      label: 'Изменил цену' },
      { selector: '[class*="upload"], [class*="import"]',event: 'wb_price_upload',    label: 'Загрузил файл цен' },
    ],
  },
  stocks: {
    name: 'stocks', label: 'Остатки',
    actions: [
      { selector: '[class*="save"], [class*="update"]',  event: 'wb_stock_update',    label: 'Обновил остатки' },
      { selector: '[class*="upload"], [class*="import"]',event: 'wb_stock_upload',    label: 'Загрузил остатки' },
      { selector: '[class*="export"]',                   event: 'wb_stock_export',    label: 'Экспортировал остатки' },
      { selector: '[class*="warehouse"], [class*="склад"]',event:'wb_stock_warehouse',label: 'Выбрал склад' },
    ],
  },
  supplies: {
    name: 'supplies', label: 'Поставки',
    actions: [
      { selector: '[class*="create"], [class*="new"]',   event: 'wb_supply_create',   label: 'Создал поставку' },
      { selector: '[class*="add"]',                      event: 'wb_supply_add',      label: 'Добавил товар в поставку' },
      { selector: '[class*="confirm"], [class*="submit"]',event:'wb_supply_confirm',  label: 'Подтвердил поставку' },
      { selector: '[class*="print"], [class*="barcode"]',event: 'wb_supply_print',    label: 'Распечатал этикетки' },
      { selector: '[class*="delete"], [class*="cancel"]',event: 'wb_supply_cancel',   label: 'Отменил поставку' },
    ],
  },
  advertising: {
    name: 'advertising', label: 'Реклама',
    actions: [
      { selector: '[class*="create"], [class*="new"]',   event: 'wb_ads_create',      label: 'Создал кампанию' },
      { selector: '[class*="pause"], [class*="stop"]',   event: 'wb_ads_pause',       label: 'Приостановил рекламу' },
      { selector: '[class*="start"], [class*="resume"]', event: 'wb_ads_start',       label: 'Запустил рекламу' },
      { selector: '[class*="budget"]',                   event: 'wb_ads_budget',      label: 'Изменил бюджет' },
      { selector: 'input[type="number"]',                event: 'wb_ads_bid',         label: 'Изменил ставку' },
    ],
  },
  analytics: {
    name: 'analytics', label: 'Аналитика',
    actions: [
      { selector: '[class*="period"], [class*="date"]',  event: 'wb_analytics_period',label: 'Изменил период' },
      { selector: '[class*="export"], [class*="download"]',event:'wb_analytics_export',label:'Экспортировал отчёт' },
      { selector: '[class*="filter"]',                   event: 'wb_analytics_filter',label: 'Применил фильтр' },
    ],
  },
  finance: {
    name: 'finance', label: 'Финансы',
    actions: [
      { selector: '[class*="report"], [class*="statement"]',event:'wb_finance_report', label: 'Открыл отчёт' },
      { selector: '[class*="export"], [class*="download"]',event:'wb_finance_export',  label: 'Скачал документ' },
      { selector: '[class*="period"], [class*="date"]',     event:'wb_finance_period', label: 'Выбрал период' },
    ],
  },
  chat: {
    name: 'chat', label: 'Чат с покупателями',
    actions: [
      { selector: '[class*="send"], button[type="submit"]', event: 'wb_chat_send',    label: 'Отправил сообщение' },
      { selector: 'textarea, [contenteditable]',            event: 'wb_chat_typing',  label: 'Набирает сообщение' },
      { selector: '[class*="attach"], [class*="file"]',     event: 'wb_chat_attach',  label: 'Прикрепил файл' },
    ],
  },
  promotions: {
    name: 'promotions', label: 'Акции',
    actions: [
      { selector: '[class*="join"], [class*="participate"]',event:'wb_promo_join',     label: 'Вступил в акцию' },
      { selector: '[class*="leave"], [class*="exit"]',      event:'wb_promo_leave',    label: 'Вышел из акции' },
      { selector: '[class*="add"]',                         event:'wb_promo_add',      label: 'Добавил товар в акцию' },
    ],
  },
};

class WbTracker extends BaseTracker {
  platform = 'WILDBERRIES' as const;
  private currentSection = '';
  private sectionEnterTime = 0;
  private sectionListeners: { el: Element; fn: EventListener }[] = [];

  init() {
    super.init();
    this.watchNavigation();
    this.attachSectionListeners();
  }

  protected detectSection(): string {
    const path = location.pathname;
    if (path.includes('/orders'))      return 'orders';
    if (path.includes('/feedbacks'))   return 'feedbacks';
    if (path.includes('/questions'))   return 'questions';
    if (path.includes('/products'))    return 'products';
    if (path.includes('/prices'))      return 'prices';
    if (path.includes('/stocks') || path.includes('/remains')) return 'stocks';
    if (path.includes('/supplies'))    return 'supplies';
    if (path.includes('/advertising')) return 'advertising';
    if (path.includes('/analytics'))   return 'analytics';
    if (path.includes('/finance'))     return 'finance';
    if (path.includes('/chat'))        return 'chat';
    if (path.includes('/promotions'))  return 'promotions';
    if (path.includes('/glossary') || path.includes('/knowledge')) return 'knowledge';
    return 'other';
  }

  private getSectionLabel(section: string): string {
    return WB_SECTIONS[section]?.label ?? section;
  }

  private watchNavigation() {
    let lastUrl = location.href;
    const check = () => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        const section = this.detectSection();
        if (section !== this.currentSection) {
          if (this.currentSection) {
            const timeSpent = Math.round((Date.now() - this.sectionEnterTime) / 1000);
            this.sendEvent('wb_section_leave' as any, {
              section: this.currentSection,
              sectionLabel: this.getSectionLabel(this.currentSection),
              timeSpentSeconds: timeSpent,
            });
          }
          this.currentSection = section;
          this.sectionEnterTime = Date.now();
          this.sendEvent('wb_section_enter' as any, {
            section,
            sectionLabel: this.getSectionLabel(section),
            url: location.href.slice(0, 300),
          });
          this.attachSectionListeners();
        }
      }
    };
    setInterval(check, 500);
  }

  private attachSectionListeners() {
    // Remove old listeners
    this.sectionListeners.forEach(({ el, fn }) => el.removeEventListener('click', fn));
    this.sectionListeners = [];

    const section = this.detectSection();
    const config = WB_SECTIONS[section];
    if (!config) return;

    config.actions.forEach(action => {
      const elements = document.querySelectorAll(action.selector);
      elements.forEach(el => {
        const fn: EventListener = () => {
          this.sendEvent(action.event as any, {
            section,
            sectionLabel: config.label,
            actionLabel: action.label,
          });
        };
        el.addEventListener('click', fn);
        this.sectionListeners.push({ el, fn });
      });
    });

    // Re-attach after DOM mutations (SPA)
    const observer = new MutationObserver(() => {
      config.actions.forEach(action => {
        const elements = document.querySelectorAll(action.selector);
        elements.forEach(el => {
          if (!this.sectionListeners.find(l => l.el === el)) {
            const fn: EventListener = () => {
              this.sendEvent(action.event as any, {
                section,
                sectionLabel: config.label,
                actionLabel: action.label,
              });
            };
            el.addEventListener('click', fn);
            this.sectionListeners.push({ el, fn });
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

try {
  new WbTracker().init();
} catch(e) {
  console.error('[ET] WbTracker error:', e);
}
EOF

# ─── OZON TRACKER ─────────────────────────────────────────────
cat > "$BASE/content/ozon-tracker.ts" << 'EOF'
import { BaseTracker } from './base-tracker';

interface SectionConfig {
  name: string;
  label: string;
  actions: { selector: string; event: string; label: string }[];
}

const OZON_SECTIONS: Record<string, SectionConfig> = {
  orders: {
    name: 'orders', label: 'Заказы',
    actions: [
      { selector: '[data-widget="orderAccept"]',          event: 'ozon_order_accept',   label: 'Принял заказ' },
      { selector: '[class*="cancel"]',                    event: 'ozon_order_cancel',   label: 'Отменил заказ' },
      { selector: '[class*="filter"]',                    event: 'ozon_order_filter',   label: 'Применил фильтр' },
      { selector: '[class*="export"], [class*="download"]',event:'ozon_order_export',   label: 'Экспортировал заказы' },
      { selector: '[class*="label"], [class*="barcode"]', event: 'ozon_order_label',    label: 'Распечатал этикетку' },
      { selector: '[class*="search"] input',              event: 'ozon_order_search',   label: 'Поиск заказов' },
    ],
  },
  products: {
    name: 'products', label: 'Товары',
    actions: [
      { selector: '[class*="create"], [class*="add"]',    event: 'ozon_product_create', label: 'Создал товар' },
      { selector: '[class*="edit"]',                      event: 'ozon_product_edit',   label: 'Редактировал товар' },
      { selector: '[class*="delete"], [class*="archive"]',event: 'ozon_product_delete', label: 'Удалил товар' },
      { selector: '[class*="photo"], [class*="media"]',   event: 'ozon_product_photo',  label: 'Загрузил медиа' },
      { selector: '[class*="price"]',                     event: 'ozon_product_price',  label: 'Изменил цену' },
      { selector: '[class*="stock"]',                     event: 'ozon_product_stock',  label: 'Обновил остатки' },
      { selector: '[class*="export"]',                    event: 'ozon_product_export', label: 'Экспортировал товары' },
    ],
  },
  prices: {
    name: 'prices', label: 'Цены',
    actions: [
      { selector: '[class*="save"], [class*="apply"]',    event: 'ozon_price_save',     label: 'Сохранил цены' },
      { selector: '[class*="discount"], [class*="sale"]', event: 'ozon_price_discount', label: 'Установил скидку' },
      { selector: '[class*="upload"]',                    event: 'ozon_price_upload',   label: 'Загрузил файл цен' },
      { selector: 'input[type="number"]',                 event: 'ozon_price_edit',     label: 'Изменил цену' },
    ],
  },
  stocks: {
    name: 'stocks', label: 'Остатки',
    actions: [
      { selector: '[class*="update"], [class*="save"]',   event: 'ozon_stock_update',   label: 'Обновил остатки' },
      { selector: '[class*="upload"]',                    event: 'ozon_stock_upload',   label: 'Загрузил остатки' },
      { selector: '[class*="warehouse"]',                 event: 'ozon_stock_warehouse',label: 'Выбрал склад' },
    ],
  },
  analytics: {
    name: 'analytics', label: 'Аналитика',
    actions: [
      { selector: '[class*="period"], [class*="date"]',   event: 'ozon_analytics_period',label:'Изменил период' },
      { selector: '[class*="export"], [class*="download"]',event:'ozon_analytics_export',label:'Экспортировал отчёт' },
      { selector: '[class*="filter"]',                    event: 'ozon_analytics_filter',label:'Применил фильтр' },
      { selector: '[class*="metric"]',                    event: 'ozon_analytics_metric',label:'Выбрал метрику' },
    ],
  },
  finance: {
    name: 'finance', label: 'Финансы',
    actions: [
      { selector: '[class*="report"]',                    event: 'ozon_finance_report', label: 'Открыл отчёт' },
      { selector: '[class*="export"], [class*="download"]',event:'ozon_finance_export', label: 'Скачал документ' },
      { selector: '[class*="period"]',                    event: 'ozon_finance_period', label: 'Выбрал период' },
      { selector: '[class*="invoice"]',                   event: 'ozon_finance_invoice',label: 'Открыл счёт-фактуру' },
    ],
  },
  logistics: {
    name: 'logistics', label: 'Логистика',
    actions: [
      { selector: '[class*="create"], [class*="new"]',    event: 'ozon_logistics_create',label:'Создал отгрузку' },
      { selector: '[class*="schedule"]',                  event: 'ozon_logistics_schedule',label:'Назначил дату' },
      { selector: '[class*="print"], [class*="label"]',   event: 'ozon_logistics_print', label:'Распечатал документ' },
      { selector: '[class*="cancel"]',                    event: 'ozon_logistics_cancel',label:'Отменил отгрузку' },
    ],
  },
  reviews: {
    name: 'reviews', label: 'Отзывы',
    actions: [
      { selector: 'textarea, [contenteditable]',          event: 'ozon_review_reply',   label: 'Ответил на отзыв' },
      { selector: '[class*="complaint"]',                 event: 'ozon_review_complain',label: 'Жалоба на отзыв' },
      { selector: '[class*="filter"]',                    event: 'ozon_review_filter',  label: 'Фильтр отзывов' },
    ],
  },
  questions: {
    name: 'questions', label: 'Вопросы',
    actions: [
      { selector: 'textarea, [contenteditable]',          event: 'ozon_question_reply', label: 'Ответил на вопрос' },
      { selector: '[class*="filter"]',                    event: 'ozon_question_filter',label: 'Фильтр вопросов' },
    ],
  },
  promotion: {
    name: 'promotion', label: 'Продвижение',
    actions: [
      { selector: '[class*="create"], [class*="new"]',    event: 'ozon_ads_create',     label: 'Создал кампанию' },
      { selector: '[class*="pause"], [class*="stop"]',    event: 'ozon_ads_pause',      label: 'Приостановил рекламу' },
      { selector: '[class*="start"], [class*="resume"]',  event: 'ozon_ads_start',      label: 'Запустил рекламу' },
      { selector: '[class*="budget"]',                    event: 'ozon_ads_budget',     label: 'Изменил бюджет' },
      { selector: 'input[type="number"]',                 event: 'ozon_ads_bid',        label: 'Изменил ставку' },
    ],
  },
  rating: {
    name: 'rating', label: 'Рейтинг',
    actions: [
      { selector: '[class*="details"], [class*="info"]',  event: 'ozon_rating_details', label: 'Просмотрел детали' },
      { selector: '[class*="period"]',                    event: 'ozon_rating_period',  label: 'Выбрал период' },
    ],
  },
  chat: {
    name: 'chat', label: 'Чат с покупателями',
    actions: [
      { selector: '[class*="send"], button[type="submit"]',event:'ozon_chat_send',      label: 'Отправил сообщение' },
      { selector: 'textarea, [contenteditable]',           event:'ozon_chat_typing',    label: 'Набирает сообщение' },
      { selector: '[class*="attach"], [class*="file"]',    event:'ozon_chat_attach',    label: 'Прикрепил файл' },
    ],
  },
};

class OzonTracker extends BaseTracker {
  platform = 'OZON' as const;
  private currentSection = '';
  private sectionEnterTime = 0;
  private sectionListeners: { el: Element; fn: EventListener }[] = [];

  init() {
    super.init();
    this.watchNavigation();
    this.attachSectionListeners();
  }

  protected detectSection(): string {
    const path = location.pathname;
    if (path.includes('/orders'))    return 'orders';
    if (path.includes('/products'))  return 'products';
    if (path.includes('/prices'))    return 'prices';
    if (path.includes('/stocks') || path.includes('/remains')) return 'stocks';
    if (path.includes('/analytics')) return 'analytics';
    if (path.includes('/finance'))   return 'finance';
    if (path.includes('/logistics')) return 'logistics';
    if (path.includes('/reviews'))   return 'reviews';
    if (path.includes('/questions')) return 'questions';
    if (path.includes('/promotion')) return 'promotion';
    if (path.includes('/rating'))    return 'rating';
    if (path.includes('/chat'))      return 'chat';
    return 'other';
  }

  private getSectionLabel(section: string): string {
    return OZON_SECTIONS[section]?.label ?? section;
  }

  private watchNavigation() {
    let lastUrl = location.href;
    const check = () => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        const section = this.detectSection();
        if (section !== this.currentSection) {
          if (this.currentSection) {
            const timeSpent = Math.round((Date.now() - this.sectionEnterTime) / 1000);
            this.sendEvent('ozon_section_leave' as any, {
              section: this.currentSection,
              sectionLabel: this.getSectionLabel(this.currentSection),
              timeSpentSeconds: timeSpent,
            });
          }
          this.currentSection = section;
          this.sectionEnterTime = Date.now();
          this.sendEvent('ozon_section_enter' as any, {
            section,
            sectionLabel: this.getSectionLabel(section),
            url: location.href.slice(0, 300),
          });
          this.attachSectionListeners();
        }
      }
    };
    setInterval(check, 500);
  }

  private attachSectionListeners() {
    this.sectionListeners.forEach(({ el, fn }) => el.removeEventListener('click', fn));
    this.sectionListeners = [];

    const section = this.detectSection();
    const config = OZON_SECTIONS[section];
    if (!config) return;

    config.actions.forEach(action => {
      const elements = document.querySelectorAll(action.selector);
      elements.forEach(el => {
        const fn: EventListener = () => {
          this.sendEvent(action.event as any, {
            section,
            sectionLabel: config.label,
            actionLabel: action.label,
          });
        };
        el.addEventListener('click', fn);
        this.sectionListeners.push({ el, fn });
      });
    });

    const observer = new MutationObserver(() => {
      config.actions.forEach(action => {
        document.querySelectorAll(action.selector).forEach(el => {
          if (!this.sectionListeners.find(l => l.el === el)) {
            const fn: EventListener = () => {
              this.sendEvent(action.event as any, {
                section,
                sectionLabel: config.label,
                actionLabel: action.label,
              });
            };
            el.addEventListener('click', fn);
            this.sectionListeners.push({ el, fn });
          }
        });
      });
    });
    observer.observe(document.body, { childList: true, subtree: true });
  }
}

try {
  new OzonTracker().init();
} catch(e) {
  console.error('[ET] OzonTracker error:', e);
}
EOF

echo "✅ Trackers updated"

# ─── REBUILD EXTENSION ────────────────────────────────────────
cd ~/employee-tracker/apps/extension && npm run build && echo "✅ Extension rebuilt"
