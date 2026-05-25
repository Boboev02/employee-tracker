const fs = require('fs');

// ─── Dashboard page — auto-refresh stats every 30s ───────────
let c = fs.readFileSync('app/dashboard/page.tsx', 'utf8');
c = c.replace(
  `  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token  = localStorage.getItem('access_token');
    if (!stored || !token) { router.push('/login'); return; }
    setUser(JSON.parse(stored));

    fetch('http://localhost:3001/api/v1/analytics/stats', {
      headers: { Authorization: 'Bearer ' + token },
    }).then(r => r.json()).then(setStats).catch(() => {});
  }, []);`,
  `  useEffect(() => {
    const stored = localStorage.getItem('user');
    const token  = localStorage.getItem('access_token');
    if (!stored || !token) { router.push('/login'); return; }
    setUser(JSON.parse(stored));

    const loadStats = () => {
      fetch('http://localhost:3001/api/v1/analytics/stats', {
        headers: { Authorization: 'Bearer ' + token },
      }).then(r => r.json()).then(setStats).catch(() => {});
    };

    loadStats();
    const interval = setInterval(loadStats, 30_000);
    return () => clearInterval(interval);
  }, []);`
);
fs.writeFileSync('app/dashboard/page.tsx', c);
console.log('✓ dashboard auto-refresh');

// ─── Analytics page — auto-refresh every 60s ─────────────────
let a = fs.readFileSync('app/dashboard/analytics/page.tsx', 'utf8');

// Add refresh state
a = a.replace(
  `  const [loading, setLoading]         = useState(true);`,
  `  const [loading, setLoading]         = useState(true);
  const [lastUpdated, setLastUpdated]   = useState<Date | null>(null);`
);

// Add auto-refresh in useEffect
a = a.replace(
  `    loadEmployeeList(t);
    loadAll(t, '7', '', '');
  }, []);`,
  `    loadEmployeeList(t);
    loadAll(t, '7', '', '');

    // Auto-refresh every 60s
    const interval = setInterval(() => {
      const currentToken = localStorage.getItem('access_token');
      if (currentToken) loadAll(currentToken, period, selectedEmployee, selectedPlatform);
    }, 60_000);
    return () => clearInterval(interval);
  }, []);`
);

// Update setLoading(false) to also set lastUpdated
a = a.replace(
  `    } finally { setLoading(false); }`,
  `    } finally { setLoading(false); setLastUpdated(new Date()); }`
);

// Add last updated indicator in filter bar
a = a.replace(
  `        {loading && <span className="text-xs text-gray-400 ml-auto">Обновление...</span>}`,
  `        <span className="text-xs text-gray-400 ml-auto flex items-center gap-2">
          {loading && <span className="w-2 h-2 rounded-full bg-indigo-400 animate-pulse inline-block" />}
          {lastUpdated && !loading && 'Обновлено ' + lastUpdated.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
          {loading && 'Обновление...'}
        </span>`
);

fs.writeFileSync('app/dashboard/analytics/page.tsx', a);
console.log('✓ analytics auto-refresh');

// ─── Employees page — auto-refresh presence every 15s ────────
let e = fs.readFileSync('app/dashboard/employees/page.tsx', 'utf8');

// Add lastUpdated state
e = e.replace(
  `  const { connected, presence, getStatus } = useSocket(token);`,
  `  const { connected, presence, getStatus } = useSocket(token);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);`
);

// Auto-refresh employee list every 15s
e = e.replace(
  `    load(t);
  }, []);`,
  `    load(t);
    const interval = setInterval(() => {
      const t2 = localStorage.getItem('access_token');
      if (t2) load(t2);
    }, 15_000);
    return () => clearInterval(interval);
  }, []);`
);

// Update load to set lastUpdated
e = e.replace(
  `      setEmployees(Array.isArray(data) ? data : []);
    } finally {
      setLoading(false);
    }`,
  `      setEmployees(Array.isArray(data) ? data : []);
      setLastUpdated(new Date());
    } finally {
      setLoading(false);
    }`
);

// Add last updated in header
e = e.replace(
  `          {connected && (
            <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {onlineCount} онлайн
            </span>
          )}`,
  `          {connected && (
            <span className="flex items-center gap-1.5 text-xs text-green-600 font-medium">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              {onlineCount} онлайн
            </span>
          )}
          {lastUpdated && (
            <span className="text-xs text-gray-400">
              обновлено {lastUpdated.toLocaleTimeString('ru', { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}`
);

fs.writeFileSync('app/dashboard/employees/page.tsx', e);
console.log('✓ employees auto-refresh');

console.log('\n✅ Auto-refresh added to all pages');
console.log('  Dashboard:  every 30s');
console.log('  Analytics:  every 60s');
console.log('  Employees:  every 15s');
