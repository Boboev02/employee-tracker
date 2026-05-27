import { BaseTracker } from './base-tracker';

interface ActionConfig { selector: string; event: string; label: string; }
interface SectionConfig { name: string; label: string; actions: ActionConfig[]; }

const OZON_SECTIONS: Record<string, SectionConfig> = {
  // Товары
  products:      { name:'products',      label:'Товары',              actions:[
    {selector:'[class*="create"],[class*="add"]', event:'ozon_product_create', label:'Создал товар'},
    {selector:'[class*="edit"]',                  event:'ozon_product_edit',   label:'Редактировал товар'},
    {selector:'[class*="upload"]',                event:'ozon_product_upload', label:'Загрузил файл'},
  ]},
  certificates:  { name:'certificates',  label:'Сертификаты',         actions:[] },
  merge:         { name:'merge',         label:'Объединение товаров', actions:[] },

  // Заказы
  orders_fbo:    { name:'orders_fbo',    label:'Заказы FBO',          actions:[
    {selector:'[class*="filter"]', event:'ozon_fbo_filter', label:'Применил фильтр'},
    {selector:'[class*="export"]', event:'ozon_fbo_export', label:'Экспорт'},
  ]},
  orders_fbs:    { name:'orders_fbs',    label:'Заказы FBS',          actions:[
    {selector:'[class*="filter"]', event:'ozon_fbs_filter', label:'Применил фильтр'},
    {selector:'[class*="export"]', event:'ozon_fbs_export', label:'Экспорт'},
  ]},
  returns:       { name:'returns',       label:'Возвраты',            actions:[] },

  // Склад и остатки
  stocks:        { name:'stocks',        label:'Остатки',             actions:[
    {selector:'[class*="upload"]', event:'ozon_stock_upload', label:'Загрузил файл'},
    {selector:'[class*="update"]', event:'ozon_stock_update', label:'Обновил остатки'},
  ]},
  warehouse:     { name:'warehouse',     label:'Склад',               actions:[] },
  supplies:      { name:'supplies',      label:'Поставки',            actions:[
    {selector:'[class*="create"]',  event:'ozon_supply_create',  label:'Создал поставку'},
    {selector:'[class*="confirm"]', event:'ozon_supply_confirm', label:'Подтвердил'},
  ]},
  logistics:     { name:'logistics',     label:'Логистика',           actions:[] },

  // Цены
  prices:        { name:'prices',        label:'Цены',                actions:[
    {selector:'[class*="save"],[class*="apply"]', event:'ozon_price_save',   label:'Сохранил цены'},
    {selector:'input[type="number"]',             event:'ozon_price_edit',   label:'Изменил цену'},
    {selector:'[class*="upload"]',                event:'ozon_price_upload', label:'Загрузил файл'},
  ]},
  highlights:    { name:'highlights',    label:'Акции и хайлайты',    actions:[
    {selector:'[class*="join"],[class*="participate"]', event:'ozon_promo_join', label:'Вступил в акцию'},
  ]},

  // Отзывы и вопросы
  reviews:       { name:'reviews',       label:'Отзывы',              actions:[
    {selector:'textarea,[contenteditable]', event:'ozon_review_reply',    label:'Ответил на отзыв'},
    {selector:'[class*="complaint"]',       event:'ozon_review_complain', label:'Пожаловался'},
  ]},
  questions:     { name:'questions',     label:'Вопросы',             actions:[
    {selector:'textarea,[contenteditable]', event:'ozon_question_reply', label:'Ответил на вопрос'},
  ]},
  complaints:    { name:'complaints',    label:'Жалобы',              actions:[] },

  // Аналитика
  analytics:     { name:'analytics',     label:'Аналитика',           actions:[
    {selector:'[class*="export"]', event:'ozon_analytics_export', label:'Экспорт'},
    {selector:'[class*="filter"]', event:'ozon_analytics_filter', label:'Применил фильтр'},
  ]},
  analytics_search: { name:'analytics_search', label:'Поисковая аналитика', actions:[] },

  // Финансы
  finance:       { name:'finance',       label:'Финансы',             actions:[
    {selector:'[class*="export"],[class*="download"]', event:'ozon_finance_export', label:'Скачал документ'},
  ]},

  // Продвижение
  promotion:     { name:'promotion',     label:'Продвижение',         actions:[
    {selector:'[class*="create"]', event:'ozon_ads_create', label:'Создал кампанию'},
    {selector:'[class*="pause"]',  event:'ozon_ads_pause',  label:'Приостановил'},
    {selector:'[class*="budget"]', event:'ozon_ads_budget', label:'Изменил бюджет'},
  ]},

  // Рейтинг
  rating:        { name:'rating',        label:'Рейтинг',             actions:[] },

  // Чат
  chat:          { name:'chat',          label:'Чат',                 actions:[
    {selector:'button[type="submit"],[class*="send"]', event:'ozon_chat_send', label:'Отправил сообщение'},
  ]},

  // Дашборд
  dashboard:     { name:'dashboard',     label:'Дашборд',             actions:[] },
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

    // Дашборд
    if (path.includes('/dashboard')) return 'dashboard';

    // Товары
    if (path.includes('/products/certificates')) return 'certificates';
    if (path.includes('/products-merge')) return 'merge';
    if (path.includes('/items/transfer')) return 'products';
    if (path.includes('/products')) return 'products';

    // Заказы
    if (path.includes('/postings/fbo')) return 'orders_fbo';
    if (path.includes('/postings/fbs')) return 'orders_fbs';
    if (path.includes('/fbo-operations/returns')) return 'returns';
    if (path.includes('/returns')) return 'returns';

    // Склад и остатки — ВАЖНО: /supply/goods ДО /supply
    if (path.includes('/supply/goods')) return 'stocks';
    if (path.includes('/fbo-stocks')) return 'stocks';
    if (path.includes('/fbo-operations/my-warehouses')) return 'stocks';
    if (path.includes('/stocks')) return 'stocks';
    if (path.includes('/warehouse')) return 'warehouse';

    // Поставки
    if (path.includes('/fbo-operations/replenishment-orders')) return 'supplies';
    if (path.includes('/supply/orders')) return 'logistics';
    if (path.includes('/supply')) return 'logistics';
    if (path.includes('/logistics')) return 'logistics';

    // Цены
    if (path.includes('/prices/discount-requests')) return 'prices';
    if (path.includes('/prices')) return 'prices';
    if (path.includes('/highlights')) return 'highlights';

    // Отзывы и вопросы
    if (path.includes('/reviews/analytics')) return 'reviews';
    if (path.includes('/reviews/questions')) return 'questions';
    if (path.includes('/reviews')) return 'reviews';
    if (path.includes('/complaints')) return 'complaints';
    if (path.includes('/questions')) return 'questions';

    // Аналитика
    if (path.includes('/analytics-search')) return 'analytics_search';
    if (path.includes('/analytics')) return 'analytics';

    // Финансы
    if (path.includes('/finances')) return 'finance';
    if (path.includes('/fintech')) return 'finance';
    if (path.includes('/payments')) return 'finance';

    // Продвижение
    if (path.includes('/advertisement')) return 'promotion';
    if (path.includes('/promotion-info')) return 'promotion';
    if (path.includes('/promotion')) return 'promotion';

    // Рейтинг
    if (path.includes('/rating')) return 'rating';

    // Чат
    if (path.includes('/messenger')) return 'chat';
    if (path.includes('/chat')) return 'chat';

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

  private sectionObserver: MutationObserver | null = null;

  protected attachSectionListeners() {
    this.sectionListeners.forEach(({ el, fn }) => el.removeEventListener('click', fn));
    this.sectionListeners = [];
    if (this.sectionObserver) { this.sectionObserver.disconnect(); this.sectionObserver = null; }
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
    this.sectionObserver = new MutationObserver(attach);
    this.sectionObserver.observe(document.body, { childList: true, subtree: true });
  }
}

try { new OzonTracker().init(); } catch(e) { console.error('[ET] OzonTracker error:', e); }
