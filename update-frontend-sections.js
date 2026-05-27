const fs = require('fs');
const os = require('os');
const home = os.homedir();
const path = home + '/employee-tracker/apps/frontend/app/dashboard/analytics/sections/page.tsx';

let c = fs.readFileSync(path, 'utf8');

// Заменяем WB_SECTIONS
c = c.replace(
  /const WB_SECTIONS: Record<string, string> = \{[\s\S]*?\};/,
  `const WB_SECTIONS: Record<string, string> = {
  // Товары
  products:'Товары', brands:'Бренды', content:'Контент', abtest:'A/B тест карточки',
  recommendations:'Рекомендации', substitution:'Подмена артикула',
  // Цены
  prices:'Цены и скидки', cashback:'Кэшбэк', promotions:'Акции',
  // Отзывы
  feedbacks:'Отзывы', questions:'Вопросы', claims:'Претензии покупателей', chat:'Чат с покупателями',
  // Склад
  supplies:'Поставки', stocks:'Остатки', orders:'Заказы (FBS)', returns:'Возвраты', logistics:'Логистика',
  // Аналитика
  analytics:'Аналитика', content_analytics:'Аналитика контента',
  search_analytics:'Поисковая аналитика', platform_analytics:'Аналитика платформы',
  // Финансы
  finance:'Финансы', income:'Доходы и расходы', calculator:'Калькулятор прибыли',
  // Реклама
  advertising:'Реклама',
  // Прочее
  tariffs:'Тарифы', levels:'Уровни продавца', showcase:'Витрина продавца',
  monetization:'Монетизация данных', support:'Поддержка', knowledge:'База знаний', other:'Прочее',
};`
);

// Заменяем OZON_SECTIONS
c = c.replace(
  /const OZON_SECTIONS: Record<string, string> = \{[\s\S]*?\};/,
  `const OZON_SECTIONS: Record<string, string> = {
  // Товары
  products:'Товары', certificates:'Сертификаты', merge:'Объединение товаров',
  // Заказы
  orders_fbo:'Заказы FBO', orders_fbs:'Заказы FBS', returns:'Возвраты',
  // Склад
  stocks:'Остатки', warehouse:'Склад', supplies:'Поставки', logistics:'Логистика',
  // Цены
  prices:'Цены', highlights:'Акции и хайлайты',
  // Отзывы
  reviews:'Отзывы', questions:'Вопросы', complaints:'Жалобы',
  // Аналитика
  analytics:'Аналитика', analytics_search:'Поисковая аналитика',
  // Финансы
  finance:'Финансы',
  // Продвижение
  promotion:'Продвижение',
  // Прочее
  rating:'Рейтинг', chat:'Чат', dashboard:'Дашборд', other:'Прочее',
};`
);

// Заменяем ACTION_LABELS — добавляем новые
c = c.replace(
  /const ACTION_LABELS: Record<string, string> = \{[\s\S]*?\};/,
  `const ACTION_LABELS: Record<string, string> = {
  // WB Заказы
  wb_order_accept:'Принял заказ', wb_order_cancel:'Отменил заказ',
  wb_order_filter:'Фильтр заказов', wb_order_export:'Экспорт заказов',
  // WB Отзывы/Вопросы
  wb_review_reply:'Ответил на отзыв', wb_review_complain:'Жалоба на отзыв',
  wb_question_reply:'Ответил на вопрос',
  // WB Товары
  wb_product_create:'Создал товар', wb_product_edit:'Редактировал товар',
  wb_product_delete:'Удалил товар', wb_product_upload:'Загрузил файл',
  // WB Цены
  wb_price_save:'Сохранил цены', wb_price_edit:'Изменил цену', wb_price_upload:'Загрузил файл',
  // WB Остатки/Поставки
  wb_stock_update:'Обновил остатки', wb_stock_upload:'Загрузил остатки',
  wb_supply_create:'Создал поставку', wb_supply_confirm:'Подтвердил поставку', wb_supply_print:'Напечатал этикетки',
  // WB Реклама
  wb_ads_create:'Создал кампанию', wb_ads_pause:'Приостановил рекламу',
  wb_ads_start:'Запустил рекламу', wb_ads_budget:'Изменил бюджет', wb_ads_filter:'Фильтр рекламы',
  // WB Прочее
  wb_chat_send:'Отправил сообщение', wb_promo_join:'Вступил в акцию',
  wb_analytics_export:'Экспорт отчёта', wb_analytics_filter:'Применил фильтр',
  wb_finance_export:'Скачал документ',
  // Ozon Заказы
  ozon_order_accept:'Принял заказ', ozon_order_cancel:'Отменил заказ',
  ozon_order_export:'Экспорт заказов', ozon_order_label:'Напечатал этикетку',
  ozon_fbo_filter:'Фильтр FBO', ozon_fbo_export:'Экспорт FBO',
  ozon_fbs_filter:'Фильтр FBS', ozon_fbs_export:'Экспорт FBS',
  // Ozon Товары
  ozon_product_create:'Создал товар', ozon_product_edit:'Редактировал товар',
  ozon_product_upload:'Загрузил файл',
  // Ozon Цены/Остатки
  ozon_price_save:'Сохранил цены', ozon_price_edit:'Изменил цену', ozon_price_upload:'Загрузил файл',
  ozon_stock_update:'Обновил остатки', ozon_stock_upload:'Загрузил файл',
  // Ozon Поставки
  ozon_supply_create:'Создал поставку', ozon_supply_confirm:'Подтвердил поставку',
  // Ozon Отзывы/Вопросы
  ozon_review_reply:'Ответил на отзыв', ozon_review_complain:'Жалоба на отзыв',
  ozon_question_reply:'Ответил на вопрос',
  // Ozon Аналитика/Финансы/Реклама
  ozon_analytics_export:'Экспорт', ozon_analytics_filter:'Применил фильтр',
  ozon_finance_export:'Скачал документ',
  ozon_ads_create:'Создал кампанию', ozon_ads_pause:'Приостановил', ozon_ads_budget:'Изменил бюджет',
  ozon_chat_send:'Отправил сообщение', ozon_promo_join:'Вступил в акцию',
};`
);

fs.writeFileSync(path, c);
console.log('✅ sections/page.tsx updated');
