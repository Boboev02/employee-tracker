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
    const path = location.pathname;
    const host = location.hostname;

    // Реклама
    if (host.includes('cmp.wildberries.ru')) return 'advertising';
    if (path.includes('/campaigns')) return 'advertising';

    // Товары
    if (path.includes('/new-goods')) return 'products';
    if (path.includes('/product-card')) return 'products';
    if (path.includes('/suppliers-product-verification')) return 'products';

    // Цены и скидки
    if (path.includes('/discount-and-prices')) return 'prices';
    if (path.includes('/dp-promo-calendar')) return 'prices';
    if (path.includes('/prices-index')) return 'prices';

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
    if (path.includes('/promotions') || path.includes('/actions')) return 'promotions';

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
