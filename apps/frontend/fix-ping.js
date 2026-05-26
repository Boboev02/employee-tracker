const fs = require('fs');
let c = fs.readFileSync('app/dashboard/analytics/sections/page.tsx', 'utf8');
c = c.replace(
  `const actions = Object.entries(s.actions).sort(([,a],[,b]) => b-a).slice(0,6);`,
  `const actions = Object.entries(s.actions).filter(([k]) => !k.includes('ping') && !k.includes('section_enter') && !k.includes('section_leave')).sort(([,a],[,b]) => (b as number)-(a as number)).slice(0,6);`
);
fs.writeFileSync('app/dashboard/analytics/sections/page.tsx', c);
console.log('Done');
