const fs = require('fs');
const os = require('os');
const home = os.homedir();

// ─── WB TRACKER ───────────────────────────────────────────────────────────────

const wbSections = `
const WB_SECTIONS: Record<string, SectionConfig> = {
  // Товары
  products:      { name:'products',      label:'Товары',              actions:[] },
  brands:        { name:'brands',        label:'Бренды',              actions:[] },
  content:       { name:'content',       label:'Контент',             actions:[] },
  abtest:        { name:'abtest',        label:'A/B тест карточки',   actions:[] },
  recommendations:{ name:'recommendations', label:'Рекомендации',     actions:[] },
  substitution:  { name:'substitution',  label:'Подмена артикула',    actions:[] },

  // Цены
  prices:        { name:'prices',        label:'Цены и скидки',       actions:[] },
  cashback:      { name:'cashback',      label:'Кэшбэк',              actions:[] },
  promotions:    { name:'promotions',    label:'Акции',               actions:[] },

  // Отзывы и вопросы
  feedbacks:     { name:'feedbacks',     label:'Отзывы',              actions:[] },
  questions:     { name:'questions',     label:'Вопросы',             actions:[] },
  claims:        { name:'claims',        label:'Претензии покупателей', actions:[] },
  chat:          { name:'chat',          label:'Чат с покупателями',  actions:[] },

  // Поставки и склад
  supplies:      { name:'supplies',      label:'Поставки',            actions:[] },
  stocks:        { name:'stocks',        label:'Остатки',             actions:[] },
  orders:        { name:'orders',        label:'Заказы (FBS)',        actions:[] },
  returns:       { name:'returns',       label:'Возвраты',            actions:[] },
  logistics:     { name:'logistics',     label:'Логистика',           actions:[] },

  // Аналитика
  analytics:     { name:'analytics',     label:'Аналитика',           actions:[] },
  content_analytics: { name:'content_analytics', label:'Аналитика контента', actions:[] },
  search_analytics:  { name:'search_analytics',  label:'Поисковая аналитика', actions:[] },
  platform_analytics:{ name:'platform_analytics',label:'Аналитика платформы', actions:[] },

  // Финансы
  finance:       { name:'finance',       label:'Финансы',             actions:[] },
  income:        { name:'income',        label:'Доходы и расходы',    actions:[] },
  calculator:    { name:'calculator',    label:'Калькулятор прибыли', actions:[] },

  // Реклама
  advertising:   { name:'advertising',   label:'Реклама',             actions:[] },

  // Прочее
  tariffs:       { name:'tariffs',       label:'Тарифы',              actions:[] },
  levels:        { name:'levels',        label:'Уровни продавца',     actions:[] },
  showcase:      { name:'showcase',      label:'Витрина продавца',    actions:[] },
  monetization:  { name:'monetization',  label:'Монетизация данных',  actions:[] },
  support:       { name:'support',       label:'Поддержка',           actions:[] },
  knowledge:     { name:'knowledge',     label:'База знаний',         actions:[] },
};`;

const wbDetectSection = `
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
  }`;

// ─── OZON TRACKER ─────────────────────────────────────────────────────────────

const ozonSections = `
const OZON_SECTIONS: Record<string, SectionConfig> = {
  // Товары
  products:      { name:'products',      label:'Товары',              actions:[] },
  certificates:  { name:'certificates',  label:'Сертификаты',         actions:[] },
  merge:         { name:'merge',         label:'Объединение товаров', actions:[] },

  // Заказы
  orders_fbo:    { name:'orders_fbo',    label:'Заказы FBO',          actions:[] },
  orders_fbs:    { name:'orders_fbs',    label:'Заказы FBS',          actions:[] },
  returns:       { name:'returns',       label:'Возвраты',            actions:[] },

  // Склад и остатки
  stocks:        { name:'stocks',        label:'Остатки',             actions:[] },
  warehouse:     { name:'warehouse',     label:'Склад',               actions:[] },
  supplies:      { name:'supplies',      label:'Поставки',            actions:[] },
  logistics:     { name:'logistics',     label:'Логистика',           actions:[] },

  // Цены
  prices:        { name:'prices',        label:'Цены',                actions:[] },
  highlights:    { name:'highlights',    label:'Акции и хайлайты',    actions:[] },

  // Отзывы и вопросы
  reviews:       { name:'reviews',       label:'Отзывы',              actions:[] },
  questions:     { name:'questions',     label:'Вопросы',             actions:[] },
  complaints:    { name:'complaints',    label:'Жалобы',              actions:[] },

  // Аналитика
  analytics:     { name:'analytics',     label:'Аналитика',           actions:[] },
  analytics_search: { name:'analytics_search', label:'Поисковая аналитика', actions:[] },

  // Финансы
  finance:       { name:'finance',       label:'Финансы',             actions:[] },

  // Продвижение
  promotion:     { name:'promotion',     label:'Продвижение',         actions:[] },

  // Рейтинг
  rating:        { name:'rating',        label:'Рейтинг',             actions:[] },

  // Чат
  chat:          { name:'chat',          label:'Чат',                 actions:[] },

  // Дашборд
  dashboard:     { name:'dashboard',     label:'Дашборд',             actions:[] },
};`;

const ozonDetectSection = `
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
  }`;

// ─── Обновляем wb-tracker.ts ──────────────────────────────────────────────────

let wb = fs.readFileSync(home + '/employee-tracker/apps/extension/src/content/wb-tracker.ts', 'utf8');

// Заменяем WB_SECTIONS
wb = wb.replace(/const WB_SECTIONS[\s\S]*?^};/m, wbSections.trim() + '\n');

// Заменяем detectSection
wb = wb.replace(/protected detectSection\(\): string \{[\s\S]*?\n  \}/m, wbDetectSection.trim());

// Убираем SectionConfig если не используется actions напрямую
fs.writeFileSync(home + '/employee-tracker/apps/extension/src/content/wb-tracker.ts', wb);
console.log('✅ wb-tracker.ts updated');

// ─── Обновляем ozon-tracker.ts ────────────────────────────────────────────────

let oz = fs.readFileSync(home + '/employee-tracker/apps/extension/src/content/ozon-tracker.ts', 'utf8');

// Заменяем OZON_SECTIONS
oz = oz.replace(/const OZON_SECTIONS[\s\S]*?^};/m, ozonSections.trim() + '\n');

// Заменяем detectSection
oz = oz.replace(/protected detectSection\(\): string \{[\s\S]*?\n  \}/m, ozonDetectSection.trim());

fs.writeFileSync(home + '/employee-tracker/apps/extension/src/content/ozon-tracker.ts', oz);
console.log('✅ ozon-tracker.ts updated');
console.log('✅ Done');
