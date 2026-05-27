import { BaseTracker } from './base-tracker';

interface ActionConfig { selector: string; event: string; label: string; }
interface SectionConfig { name: string; label: string; actions: ActionConfig[]; }

const WB_SECTIONS: Record<string, SectionConfig> = {
  // Товары
  products:      { name:'products',      label:'Товары',              actions:[
    {selector:'[class*="create"],[class*="add"]', event:'wb_product_create', label:'Создал товар'},
    {selector:'[class*="edit"]',                  event:'wb_product_edit',   label:'Редактировал товар'},
    {selector:'[class*="delete"]',                event:'wb_product_delete', label:'Удалил товар'},
    {selector:'[class*="upload"]',                event:'wb_product_upload', label:'Загрузил файл'},
  ]},
  brands:        { name:'brands',        label:'Бренды',              actions:[] },
  content:       { name:'content',       label:'Контент',             actions:[] },
  abtest:        { name:'abtest',        label:'A/B тест карточки',   actions:[] },
  recommendations:{ name:'recommendations', label:'Рекомендации',     actions:[] },
  substitution:  { name:'substitution',  label:'Подмена артикула',    actions:[] },

  // Цены
  prices:        { name:'prices',        label:'Цены и скидки',       actions:[
    {selector:'[class*="save"],[class*="apply"]',  event:'wb_price_save',   label:'Сохранил цены'},
    {selector:'input[type="number"]',              event:'wb_price_edit',   label:'Изменил цену'},
    {selector:'[class*="upload"]',                 event:'wb_price_upload', label:'Загрузил файл'},
  ]},
  cashback:      { name:'cashback',      label:'Кэшбэк',              actions:[] },
  promotions:    { name:'promotions',    label:'Акции',               actions:[
    {selector:'[class*="join"],[class*="participate"]', event:'wb_promo_join', label:'Вступил в акцию'},
  ]},

  // Отзывы и вопросы
  feedbacks:     { name:'feedbacks',     label:'Отзывы',              actions:[
    {selector:'textarea,[contenteditable]', event:'wb_review_reply',    label:'Ответил на отзыв'},
    {selector:'[class*="complaint"]',       event:'wb_review_complain', label:'Пожаловался'},
  ]},
  questions:     { name:'questions',     label:'Вопросы',             actions:[
    {selector:'textarea,[contenteditable]', event:'wb_question_reply', label:'Ответил на вопрос'},
  ]},
  claims:        { name:'claims',        label:'Претензии покупателей', actions:[] },
  chat:          { name:'chat',          label:'Чат с покупателями',  actions:[
    {selector:'button[type="submit"],[class*="send"]', event:'wb_chat_send', label:'Отправил сообщение'},
  ]},

  // Поставки и склад
  supplies:      { name:'supplies',      label:'Поставки',            actions:[
    {selector:'[class*="create"]',  event:'wb_supply_create',  label:'Создал поставку'},
    {selector:'[class*="confirm"]', event:'wb_supply_confirm', label:'Подтвердил поставку'},
    {selector:'[class*="print"]',   event:'wb_supply_print',   label:'Распечатал'},
  ]},
  stocks:        { name:'stocks',        label:'Остатки',             actions:[
    {selector:'[class*="save"],[class*="update"]', event:'wb_stock_update', label:'Обновил остатки'},
    {selector:'[class*="upload"]',                 event:'wb_stock_upload', label:'Загрузил файл'},
  ]},
  orders:        { name:'orders',        label:'Заказы (FBS)',        actions:[
    {selector:'[class*="cancel"]',  event:'wb_order_cancel', label:'Отменил заказ'},
    {selector:'[class*="filter"]',  event:'wb_order_filter', label:'Применил фильтр'},
    {selector:'[class*="export"]',  event:'wb_order_export', label:'Экспорт'},
  ]},
  returns:       { name:'returns',       label:'Возвраты',            actions:[] },
  logistics:     { name:'logistics',     label:'Логистика',           actions:[] },

  // Аналитика
  analytics:     { name:'analytics',     label:'Аналитика',           actions:[
    {selector:'[class*="export"]', event:'wb_analytics_export', label:'Экспорт отчёта'},
    {selector:'[class*="filter"]', event:'wb_analytics_filter', label:'Применил фильтр'},
  ]},
  content_analytics:  { name:'content_analytics',  label:'Аналитика контента',  actions:[] },
  search_analytics:   { name:'search_analytics',   label:'Поисковая аналитика', actions:[] },
  platform_analytics: { name:'platform_analytics', label:'Аналитика платформы', actions:[] },

  // Финансы
  finance:       { name:'finance',       label:'Финансы',             actions:[
    {selector:'[class*="export"],[class*="download"]', event:'wb_finance_export', label:'Скачал документ'},
  ]},
  income:        { name:'income',        label:'Доходы и расходы',    actions:[] },
  calculator:    { name:'calculator',    label:'Калькулятор прибыли', actions:[] },

  // Реклама
  advertising:   { name:'advertising',   label:'Реклама',             actions:[
    {selector:'[class*="create"]', event:'wb_ads_create',  label:'Создал кампанию'},
    {selector:'[class*="pause"]',  event:'wb_ads_pause',   label:'Приостановил'},
    {selector:'[class*="budget"]', event:'wb_ads_budget',  label:'Изменил бюджет'},
    {selector:'[class*="filter"]', event:'wb_ads_filter',  label:'Применил фильтр'},
  ]},

  // Прочее
  tariffs:       { name:'tariffs',       label:'Тарифы',              actions:[] },
  levels:        { name:'levels',        label:'Уровни продавца',     actions:[] },
  showcase:      { name:'showcase',      label:'Витрина продавца',    actions:[] },
  monetization:  { name:'monetization',  label:'Монетизация данных',  actions:[] },
  support:       { name:'support',       label:'Поддержка',           actions:[] },
  knowledge:     { name:'knowledge',     label:'База знаний',         actions:[] },
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

    // Реклама (отдельный домен cmp.wildberries.ru)
    if (host.includes('cmp.wildberries.ru')) return 'advertising';
    if (path.includes('/campaigns')) return 'advertising';
    if (path.includes('/cmpf')) return 'advertising';

    // Товары
    if (path.includes('/new-goods')) return 'products';
    if (path.includes('/product-card-a-b')) return 'abtest';
    if (path.includes('/product-card')) return 'products';
    if (path.includes('/suppliers-product-verification')) return 'claims';
    if (path.includes('/content-rating')) return 'content';
    if (path.includes('/content-ratings')) return 'content';
    if (path.includes('/media-content')) return 'content';
    if (path.includes('/brands')) return 'brands';
    if (path.includes('/create-brand')) return 'brands';
    if (path.includes('/recommendations')) return 'recommendations';
    if (path.includes('/article-substitution')) return 'substitution';
    if (path.includes('/sellers-showcase')) return 'showcase';
    if (path.includes('/profit-calculator')) return 'calculator';

    // Цены
    if (path.includes('/discount-and-prices')) return 'prices';
    if (path.includes('/prices-index')) return 'prices';
    if (path.includes('/price')) return 'prices';
    if (path.includes('/cashback')) return 'cashback';
    if (path.includes('/dp-promo-calendar')) return 'promotions';
    if (path.includes('/promotions')) return 'promotions';
    if (path.includes('/actions')) return 'promotions';

    // Отзывы
    if (path.includes('/feedbacks-summarization')) return 'feedbacks';
    if (path.includes('/pinned-feedbacks')) return 'feedbacks';
    if (path.includes('/feedbacks')) return 'feedbacks';
    if (path.includes('/points-for-reviews')) return 'feedbacks';
    if (path.includes('/questions')) return 'questions';

    // Чат
    if (path.includes('/chat-with-clients')) return 'chat';
    if (path.includes('/chat')) return 'chat';

    // Поставки и склад
    if (path.includes('/supplies-management')) return 'supplies';
    if (path.includes('/supplies')) return 'supplies';
    if (path.includes('/supply')) return 'supplies';
    if (path.includes('/stock-control')) return 'stocks';
    if (path.includes('/stocks')) return 'stocks';
    if (path.includes('/remains')) return 'stocks';
    if (path.includes('/warehouses')) return 'logistics';
    if (path.includes('/warehouse-addresses')) return 'logistics';
    if (path.includes('/marketplace-pass')) return 'logistics';
    if (path.includes('/dynamic-product-categories')) return 'logistics';
    if (path.includes('/marketplace-orders-fbs')) return 'orders';
    if (path.includes('/marketplace-stocks-management')) return 'stocks';
    if (path.includes('/orders')) return 'orders';
    if (path.includes('/sales')) return 'orders';
    if (path.includes('/return-transfer-reports')) return 'returns';

    // Аналитика
    if (path.includes('/content-analytics')) return 'content_analytics';
    if (path.includes('/search-analytics')) return 'search_analytics';
    if (path.includes('/platform-analytics')) return 'platform_analytics';
    if (path.includes('/analytics-reports')) return 'analytics';
    if (path.includes('/remains-analytics')) return 'analytics';
    if (path.includes('/analytics')) return 'analytics';

    // Финансы
    if (path.includes('/income-analytics')) return 'income';
    if (path.includes('/suppliers-mutual-settlements')) return 'finance';
    if (path.includes('/payment-history')) return 'finance';
    if (path.includes('/finance')) return 'finance';

    // Прочее
    if (path.includes('/tariff-constructor')) return 'tariffs';
    if (path.includes('/tariff')) return 'tariffs';
    if (path.includes('/seller-levels-program')) return 'levels';
    if (path.includes('/monetization')) return 'monetization';
    if (path.includes('/data-monetization')) return 'monetization';
    if (path.includes('/service-desk')) return 'support';
    if (path.includes('/knowledge')) return 'knowledge';
    if (path.includes('/help')) return 'knowledge';

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

  private sectionObserver: MutationObserver | null = null;

  protected attachSectionListeners() {
    this.sectionListeners.forEach(({ el, fn }) => el.removeEventListener('click', fn));
    this.sectionListeners = [];
    if (this.sectionObserver) { this.sectionObserver.disconnect(); this.sectionObserver = null; }
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
    this.sectionObserver = new MutationObserver(attach);
    this.sectionObserver.observe(document.body, { childList: true, subtree: true });
  }
}

try { new WbTracker().init(); } catch(e) { console.error('[ET] WbTracker error:', e); }
