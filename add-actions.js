const fs = require('fs');
const os = require('os');
const home = os.homedir();

// ─── WB SECTIONS с действиями ─────────────────────────────────────────────────

const wbSectionsNew = `const WB_SECTIONS: Record<string, SectionConfig> = {
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
};`;

// ─── OZON SECTIONS с действиями ───────────────────────────────────────────────

const ozonSectionsNew = `const OZON_SECTIONS: Record<string, SectionConfig> = {
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
};`;

// ─── Обновляем wb-tracker.ts ──────────────────────────────────────────────────

let wb = fs.readFileSync(home + '/employee-tracker/apps/extension/src/content/wb-tracker.ts', 'utf8');
wb = wb.replace(/const WB_SECTIONS[\s\S]*?^};/m, wbSectionsNew + '\n');
fs.writeFileSync(home + '/employee-tracker/apps/extension/src/content/wb-tracker.ts', wb);
console.log('✅ wb-tracker.ts updated with actions');

// ─── Обновляем ozon-tracker.ts ────────────────────────────────────────────────

let oz = fs.readFileSync(home + '/employee-tracker/apps/extension/src/content/ozon-tracker.ts', 'utf8');
oz = oz.replace(/const OZON_SECTIONS[\s\S]*?^};/m, ozonSectionsNew + '\n');
fs.writeFileSync(home + '/employee-tracker/apps/extension/src/content/ozon-tracker.ts', oz);
console.log('✅ ozon-tracker.ts updated with actions');
console.log('✅ Done');
