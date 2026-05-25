import { BaseTracker } from './base-tracker';

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
