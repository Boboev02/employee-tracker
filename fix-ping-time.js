const fs = require('fs');
const path = require('os').homedir() + '/employee-tracker/apps/backend/src/analytics/active-time.service.ts';
let c = fs.readFileSync(path, 'utf8');

c = c.replace(
  `        // Also count section_ping events for real-time time tracking
        if (e.eventType === 'wb_section_ping' || e.eventType === 'ozon_section_ping') {
          const activeS = pd?.activeSeconds;
          if (activeS && activeS > 0 && activeS < 7200) {
            // Don't double-count: only add if no previous leave recorded
            // pings are incremental, just update the running total marker
          }
        }`,
  `        // Use section_ping to track time for sessions without navigation
        if (e.eventType === 'wb_section_ping' || e.eventType === 'ozon_section_ping') {
          const activeS = pd?.activeSeconds;
          if (activeS && activeS > 0 && activeS < 7200) {
            // Only update if current recorded time is less (avoid double-counting with section_leave)
            if (sec.timeSeconds < activeS) {
              sec.timeSeconds = activeS;
            }
          }
        }`
);

fs.writeFileSync(path, c);
console.log('Done');
