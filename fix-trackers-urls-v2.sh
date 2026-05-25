#!/bin/bash
BASE=~/employee-tracker/apps/extension/src

node << 'JSEOF'
const fs = require('fs');
const base = require('os').homedir() + '/employee-tracker/apps/extension/src';

// ─── WB TRACKER ───────────────────────────────────────────────
let wb = fs.readFileSync(base + '/content/wb-tracker.ts', 'utf8');

// Replace detectSection
wb = wb.replace(
  /protected detectSection\(\): string \{[\s\S]*?return 'other';\s*\}/,
  `protected detectSection(): string {
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
  }`
);

fs.writeFileSync(base + '/content/wb-tracker.ts', wb);
console.log('✓ wb-tracker.ts updated');

// ─── OZON TRACKER ─────────────────────────────────────────────
let ozon = fs.readFileSync(base + '/content/ozon-tracker.ts', 'utf8');

ozon = ozon.replace(
  /protected detectSection\(\): string \{[\s\S]*?return 'other';\s*\}/,
  `protected detectSection(): string {
    const path = location.pathname;

    // Заказы
    if (path.includes('/orders') || path.includes('/fbs') || path.includes('/fbo')) return 'orders';

    // Товары
    if (path.includes('/products') || path.includes('/goods')) return 'products';

    // Цены
    if (path.includes('/prices')) return 'prices';

    // Финансы / банк
    if (path.includes('/finances') || path.includes('/payments') || path.includes('/fintech')) return 'finance';

    // Аналитика (все варианты)
    if (path.includes('/analytics') || path.includes('/analytics-search')) return 'analytics';

    // Остатки
    if (path.includes('/stocks') || path.includes('/remains') || path.includes('/supply/goods')) return 'stocks';

    // Логистика
    if (path.includes('/logistics') || path.includes('/supply')) return 'logistics';

    // Отзывы
    if (path.includes('/reviews') || path.includes('/feedbacks')) return 'reviews';

    // Вопросы
    if (path.includes('/questions')) return 'questions';

    // Продвижение и реклама (все варианты)
    if (path.includes('/advertisement') || path.includes('/promotion') || path.includes('/promo')) return 'promotion';

    // Рейтинг
    if (path.includes('/rating')) return 'rating';

    // Чат
    if (path.includes('/chat') || path.includes('/messages')) return 'chat';

    return 'other';
  }`
);

fs.writeFileSync(base + '/content/ozon-tracker.ts', ozon);
console.log('✓ ozon-tracker.ts updated');
JSEOF

cd ~/employee-tracker/apps/extension && npm run build && echo "✅ Extension rebuilt"
