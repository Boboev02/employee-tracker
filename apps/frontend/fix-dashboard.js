const fs = require('fs');
let c = fs.readFileSync(require('os').homedir() + '/employee-tracker/apps/frontend/app/dashboard/page.tsx', 'utf8');

// Fix 1: load employees to get names for presence
// Fix 2: use days=7 for sections to get more data
// Fix 3: fix tasks endpoint  
// Fix 4: fix presence name mapping

c = c.replace(
  `const [sections, setSections] = useState<any[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);`,
  `const [sections, setSections] = useState<any[]>([]);
  const [totalEvents, setTotalEvents] = useState(0);
  const [employees, setEmployees] = useState<any[]>([]);`
);

// Fix loadAll to include employees and fix endpoints
c = c.replace(
  `const [s, a, p, tk, ev, sec] = await Promise.all([
        fetch('http://localhost:3001/api/v1/analytics/stats', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
        fetch('http://localhost:3001/api/v1/analytics/employees', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
        fetch('http://localhost:3001/api/v1/presence', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
        fetch('http://localhost:3001/api/v1/tasks?limit=5&sortBy=dueDate', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
        fetch('http://localhost:3001/api/v1/analytics/activity/total', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
        fetch('http://localhost:3001/api/v1/analytics/activity/summary?days=1', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
      ]);`,
  `const [s, a, p, tk, ev, sec, emps] = await Promise.all([
        fetch('http://localhost:3001/api/v1/analytics/stats', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
        fetch('http://localhost:3001/api/v1/analytics/employees', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
        fetch('http://localhost:3001/api/v1/presence', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
        fetch('http://localhost:3001/api/v1/tasks', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
        fetch('http://localhost:3001/api/v1/analytics/activity/total', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
        fetch('http://localhost:3001/api/v1/analytics/activity/summary?days=7', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
        fetch('http://localhost:3001/api/v1/employees', { headers: { Authorization: 'Bearer ' + t } }).then(r => r.json()),
      ]);`
);

// Fix: save employees  
c = c.replace(
  `if (Array.isArray(tk)) setTasks(tk);`,
  `if (Array.isArray(tk)) setTasks(tk);
      else if (tk?.data && Array.isArray(tk.data)) setTasks(tk.data);
      if (Array.isArray(emps)) setEmployees(emps);`
);

// Fix presence with employee names
c = c.replace(
  `if (Array.isArray(p)) setPresence(p);
      else if (p && typeof p === 'object' && !p.error) setPresence(Object.values(p).map((v: any) => ({
        userId: v.userId,
        name: v.name ?? v.userId?.slice(0,8),
        isOnline: v.status === 'ONLINE',
        lastSeen: v.lastActivityAt ? new Date(v.lastActivityAt).toISOString() : null,
      })));`,
  `if (Array.isArray(p)) {
        setPresence(p);
      } else if (p && typeof p === 'object' && !p.error) {
        const empArr = Array.isArray(emps) ? emps : [];
        const empMap = Object.fromEntries(empArr.map((e: any) => [e.id, e.name]));
        setPresence(Object.values(p).map((v: any) => ({
          userId: v.userId,
          name: empMap[v.userId] ?? v.name ?? 'Сотрудник',
          isOnline: v.status === 'ONLINE',
          lastSeen: v.lastActivityAt ? new Date(v.lastActivityAt).toISOString() : null,
        })));
      }`
);

// Fix sections - also count from clicks in events  
c = c.replace(
  `const sorted = Object.entries(sectionMap)
          .map(([key, val]) => ({ key, section: key.split(':')[1], ...val }))
          .sort((a, b) => b.clicks - a.clicks)
          .slice(0, 5);`,
  `const sorted = Object.entries(sectionMap)
          .map(([key, val]) => ({ key, section: key.split(':')[1], ...val }))
          .filter(s => s.clicks > 0 || s.timeSeconds > 0)
          .sort((a, b) => (b.clicks + b.timeSeconds/60) - (a.clicks + a.timeSeconds/60))
          .slice(0, 5);`
);

// Fix sections to also sum events not just clicks
c = c.replace(
  `sectionMap[key].clicks += val.clicks ?? 0;`,
  `sectionMap[key].clicks += (val.clicks ?? 0) + (val.events ?? 0);`
);

fs.writeFileSync(require('os').homedir() + '/employee-tracker/apps/frontend/app/dashboard/page.tsx', c);
console.log('✅ Dashboard fixed');
