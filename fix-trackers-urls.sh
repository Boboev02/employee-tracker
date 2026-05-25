#!/bin/bash
BASE=~/employee-tracker/apps/extension/src

# Fix Ozon tracker - more URL patterns
node << 'JSEOF'
const fs = require('fs');
const base = require('os').homedir() + '/employee-tracker/apps/extension/src';

let ozon = fs.readFileSync(base + '/content/ozon-tracker.ts', 'utf8');

// Fix detectSection for Ozon
ozon = ozon.replace(
  `  protected detectSection(): string {
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
  }`,
  `  protected detectSection(): string {
    const path = location.pathname;
    if (path.includes('/orders') || path.includes('/fbs') || path.includes('/fbo')) return 'orders';
    if (path.includes('/products') || path.includes('/goods') || path.includes('/items')) return 'products';
    if (path.includes('/prices') || path.includes('/price'))    return 'prices';
    if (path.includes('/stocks') || path.includes('/remains') || path.includes('/warehouse')) return 'stocks';
    if (path.includes('/analytics') || path.includes('/statistics') || path.includes('/reports')) return 'analytics';
    if (path.includes('/finance') || path.includes('/payments') || path.includes('/invoices')) return 'finance';
    if (path.includes('/logistics') || path.includes('/supply') || path.includes('/delivery')) return 'logistics';
    if (path.includes('/reviews') || path.includes('/feedbacks') || path.includes('/review')) return 'reviews';
    if (path.includes('/questions') || path.includes('/question')) return 'questions';
    if (path.includes('/promotion') || path.includes('/promo') || path.includes('/advertising') || path.includes('/boost')) return 'promotion';
    if (path.includes('/rating') || path.includes('/score')) return 'rating';
    if (path.includes('/chat') || path.includes('/messages') || path.includes('/inbox')) return 'chat';
    if (path.includes('/brand') || path.includes('/showcase')) return 'brand';
    return 'other';
  }`
);
fs.writeFileSync(base + '/content/ozon-tracker.ts', ozon);
console.log('✓ ozon-tracker fixed');
JSEOF

# Fix WB tracker - add cmp.wildberries.ru support in manifest
node << 'JSEOF'
const fs = require('fs');
const base = require('os').homedir() + '/employee-tracker/apps/extension/src';
const manifestPath = require('os').homedir() + '/employee-tracker/apps/extension/manifest.json';

let manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

// Add cmp.wildberries.ru to content scripts and permissions
const wbScript = manifest.content_scripts.find(s => 
  s.js && s.js.some(j => j.includes('wb-tracker'))
);
if (wbScript && !wbScript.matches.includes('https://cmp.wildberries.ru/*')) {
  wbScript.matches.push('https://cmp.wildberries.ru/*');
  console.log('✓ Added cmp.wildberries.ru to wb content script');
}

// Add to host_permissions if exists
if (manifest.host_permissions && !manifest.host_permissions.includes('https://cmp.wildberries.ru/*')) {
  manifest.host_permissions.push('https://cmp.wildberries.ru/*');
  console.log('✓ Added cmp.wildberries.ru to host_permissions');
}

fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
console.log('✓ manifest.json updated');

// Fix WB tracker detectSection
let wb = fs.readFileSync(base + '/content/wb-tracker.ts', 'utf8');
wb = wb.replace(
  `  protected detectSection(): string {
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
  }`,
  `  protected detectSection(): string {
    const path = location.pathname;
    const host = location.hostname;
    // cmp.wildberries.ru - advertising platform
    if (host.includes('cmp.wildberries.ru') || path.includes('/campaigns') || path.includes('/campaign')) return 'advertising';
    if (path.includes('/orders') || path.includes('/sales')) return 'orders';
    if (path.includes('/feedbacks') || path.includes('/reviews') || path.includes('/review')) return 'feedbacks';
    if (path.includes('/questions') || path.includes('/question')) return 'questions';
    if (path.includes('/products') || path.includes('/goods') || path.includes('/catalog')) return 'products';
    if (path.includes('/prices') || path.includes('/price') || path.includes('/discount')) return 'prices';
    if (path.includes('/stocks') || path.includes('/remains') || path.includes('/warehouses')) return 'stocks';
    if (path.includes('/supplies') || path.includes('/supply') || path.includes('/logistics')) return 'supplies';
    if (path.includes('/advertising') || path.includes('/promo')) return 'advertising';
    if (path.includes('/analytics') || path.includes('/statistics')) return 'analytics';
    if (path.includes('/finance') || path.includes('/payments')) return 'finance';
    if (path.includes('/chat') || path.includes('/messages')) return 'chat';
    if (path.includes('/promotions') || path.includes('/actions')) return 'promotions';
    if (path.includes('/glossary') || path.includes('/knowledge') || path.includes('/help')) return 'knowledge';
    return 'other';
  }`
);
fs.writeFileSync(base + '/content/wb-tracker.ts', wb);
console.log('✓ wb-tracker fixed');
JSEOF

cd ~/employee-tracker/apps/extension && npm run build && echo "✅ Extension rebuilt"
