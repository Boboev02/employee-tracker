const fs = require('fs');

// Count markers and fix
let c = fs.readFileSync('app/dashboard/timesheet/page.tsx', 'utf8');
const marker = 'todaySessions.length > 0';
const indices = [];
let pos = 0;
while ((pos = c.indexOf(marker, pos)) !== -1) {
  indices.push(pos);
  pos++;
}
console.log('Found blocks at positions:', indices);

if (indices.length > 1) {
  // Find start of second block - go back to find opening {
  let start = indices[1];
  while (start > 0 && c[start] !== '{') start--;
  
  // Find end - find matching closing structure
  // The block ends with </div>\n          )}
  let searchFrom = indices[1];
  let endMarker = '          )}\n\n          {/* Summary';
  let end = c.indexOf(endMarker, searchFrom);
  if (end === -1) {
    endMarker = '          )}\n\n';
    end = c.indexOf(endMarker, searchFrom);
  }
  
  if (end !== -1) {
    c = c.slice(0, start) + c.slice(end + endMarker.indexOf('\n\n') + 2);
    console.log('Removed second block');
  } else {
    // Manual removal - just remove everything between the two blocks
    const firstEnd = c.indexOf('</div>\n          )}', indices[0]);
    const secondEnd = c.indexOf('</div>\n          )}', firstEnd + 1);
    if (secondEnd !== -1) {
      c = c.slice(0, indices[1] - 10) + c.slice(secondEnd + 20);
      console.log('Removed via manual method');
    }
  }
}

fs.writeFileSync('app/dashboard/timesheet/page.tsx', c);
console.log('Done, remaining markers:', (c.match(/todaySessions\.length > 0/g) || []).length);
