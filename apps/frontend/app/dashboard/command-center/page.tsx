'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = 'https://employee-tracker.ru';

// ─── Types ────────────────────────────────────────────────────────────────────
interface Node {
  id: string;
  type: string; // TASK | PROJECT | PRODUCT | DEAL | EMPLOYEE | DEPARTMENT | TEAM
  label: string;
  sublabel?: string;
  x: number; y: number;
  vx: number; vy: number;
  fx?: number; fy?: number; // fixed position
  pinned?: boolean;
  meta?: any;
}

interface Edge {
  id: string;
  source: string;
  target: string;
  label?: string;
  type?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────
const NODE_COLORS: Record<string, string> = {
  EMPLOYEE:   '#5b68f6',
  DEPARTMENT: '#7c3aed',
  TEAM:       '#0891b2',
  PROJECT:    '#16a34a',
  TASK:       '#ea8c00',
  PRODUCT:    '#dc2626',
  DEAL:       '#be185d',
  ORG:        '#374151',
};

const NODE_ICONS: Record<string, string> = {
  EMPLOYEE:   '👤',
  DEPARTMENT: '🏢',
  TEAM:       '👥',
  PROJECT:    '📁',
  TASK:       '✅',
  PRODUCT:    '📦',
  DEAL:       '💼',
  ORG:        '🏛️',
};

const NODE_RADIUS: Record<string, number> = {
  ORG:        36,
  DEPARTMENT: 28,
  TEAM:       24,
  EMPLOYEE:   22,
  PROJECT:    24,
  PRODUCT:    22,
  TASK:       18,
  DEAL:       20,
};

const VIEWS = [
  { id: 'company',   label: 'Компания',   icon: '🏛️' },
  { id: 'projects',  label: 'Проекты',    icon: '📁' },
  { id: 'employees', label: 'Сотрудники', icon: '👥' },
  { id: 'products',  label: 'Товары',     icon: '📦' },
  { id: 'timeline',  label: 'Timeline',   icon: '📅' },
];

// ─── Force simulation ─────────────────────────────────────────────────────────
function useForceGraph(nodes: Node[], edges: Edge[], width: number, height: number) {
  const nodesRef = useRef<Node[]>([]);
  const edgesRef = useRef<Edge[]>([]);
  const rafRef   = useRef<number>(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    // Merge: preserve positions of existing nodes
    const existing = new Map(nodesRef.current.map(n => [n.id, n]));
    nodesRef.current = nodes.map(n => {
      const ex = existing.get(n.id);
      if (ex) return { ...n, x: ex.x, y: ex.y, vx: ex.vx, vy: ex.vy, pinned: ex.pinned, fx: ex.fx, fy: ex.fy };
      return { ...n, x: width/2 + (Math.random()-0.5)*200, y: height/2 + (Math.random()-0.5)*200, vx:0, vy:0 };
    });
    edgesRef.current = edges;
  }, [nodes, edges]);

  useEffect(() => {
    const simulate = () => {
      const ns = nodesRef.current;
      const es = edgesRef.current;
      if (!ns.length) { rafRef.current = requestAnimationFrame(simulate); return; }

      const alpha = 0.3;
      const repulsion = 4000;
      const linkDist  = 160;
      const linkStr   = 0.08;
      const centerStr = 0.02;
      const damping   = 0.82;

      // Repulsion
      for (let i = 0; i < ns.length; i++) {
        for (let j = i+1; j < ns.length; j++) {
          const dx = ns[j].x - ns[i].x || 0.1;
          const dy = ns[j].y - ns[i].y || 0.1;
          const d2 = dx*dx + dy*dy;
          const d  = Math.sqrt(d2) || 0.1;
          const f  = repulsion / d2;
          const fx = f * dx / d;
          const fy = f * dy / d;
          if (!ns[i].pinned) { ns[i].vx -= fx; ns[i].vy -= fy; }
          if (!ns[j].pinned) { ns[j].vx += fx; ns[j].vy += fy; }
        }
      }

      // Link attraction
      const nodeMap = new Map(ns.map(n => [n.id, n]));
      for (const e of es) {
        const s = nodeMap.get(e.source), t = nodeMap.get(e.target);
        if (!s || !t) continue;
        const dx = t.x - s.x, dy = t.y - s.y;
        const d  = Math.sqrt(dx*dx + dy*dy) || 0.1;
        const f  = (d - linkDist) * linkStr;
        const fx = f * dx / d, fy = f * dy / d;
        if (!s.pinned) { s.vx += fx; s.vy += fy; }
        if (!t.pinned) { t.vx -= fx; t.vy -= fy; }
      }

      // Center gravity
      for (const n of ns) {
        if (n.pinned) continue;
        n.vx += (width/2 - n.x) * centerStr;
        n.vy += (height/2 - n.y) * centerStr;
      }

      // Integrate
      for (const n of ns) {
        if (n.pinned && n.fx !== undefined) { n.x = n.fx; n.y = n.fy!; continue; }
        n.vx *= damping; n.vy *= damping;
        n.x += n.vx * alpha; n.y += n.vy * alpha;
        n.x = Math.max(50, Math.min(width-50,  n.x));
        n.y = Math.max(50, Math.min(height-50, n.y));
      }

      setTick(t => t+1);
      rafRef.current = requestAnimationFrame(simulate);
    };

    rafRef.current = requestAnimationFrame(simulate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [width, height]);

  return { nodes: nodesRef.current, edges: edgesRef.current };
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function CommandCenterPage() {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const [token, setToken] = useState('');
  const [view, setView] = useState('company');
  const [rawNodes, setRawNodes] = useState<Node[]>([]);
  const [rawEdges, setRawEdges] = useState<Edge[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Node | null>(null);
  const [hovered, setHovered] = useState<Node | null>(null);
  const [search, setSearch] = useState('');
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [draggingNode, setDraggingNode] = useState<string | null>(null);
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const [size, setSize] = useState({ w: 1200, h: 700 });
  const containerRef = useRef<HTMLDivElement>(null);
  const [activityLog, setActivityLog] = useState<any[]>([]);

  const { nodes, edges } = useForceGraph(rawNodes, rawEdges, size.w, size.h);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
  }, []);

  useEffect(() => {
    const ro = new ResizeObserver(entries => {
      for (const e of entries) {
        setSize({ w: e.contentRect.width, h: e.contentRect.height });
      }
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => { if (token) loadView(view); }, [token, view]);

  const h = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const loadView = async (v: string) => {
    setLoading(true);
    setSelected(null);
    try {
      if (v === 'company')   await loadCompanyView();
      if (v === 'projects')  await loadProjectsView();
      if (v === 'employees') await loadEmployeesView();
      if (v === 'products')  await loadProductsView();
      if (v === 'timeline')  await loadTimeline();
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  // ── Company View ────────────────────────────────────────────────────────────
  const loadCompanyView = async () => {
    const [empR, projR, prodR, deptR] = await Promise.all([
      fetch(`${API}/api/v1/employees?limit=30`, { headers: h() }),
      fetch(`${API}/api/v1/projects?limit=20`,  { headers: h() }),
      fetch(`${API}/api/v1/products?limit=20`,  { headers: h() }),
      fetch(`${API}/api/v1/dictionaries/departments`, { headers: h() }),
    ]);
    const [empD, projD, prodD, deptD] = await Promise.all([empR.json(), projR.json(), prodR.json(), deptR.json()]);

    const emps  = empD.employees ?? empD ?? [];
    const projs = Array.isArray(projD) ? projD : projD.data ?? [];
    const prods = (Array.isArray(prodD) ? prodD : prodD.products ?? []).slice(0,15);
    const depts = Array.isArray(deptD) ? deptD : [];

    const ns: Node[] = [];
    const es: Edge[] = [];

    // Org center node
    ns.push({ id:'org', type:'ORG', label:'Компания', x:size.w/2, y:size.h/2, vx:0, vy:0, pinned:true, fx:size.w/2, fy:size.h/2 });

    // Departments
    depts.slice(0,6).forEach((d: any, i: number) => {
      const angle = (i / Math.max(depts.length,1)) * Math.PI * 2;
      ns.push({ id:`dept_${d.id}`, type:'DEPARTMENT', label:d.name, x: size.w/2 + Math.cos(angle)*180, y: size.h/2 + Math.sin(angle)*180, vx:0, vy:0 });
      es.push({ id:`org_dept_${d.id}`, source:'org', target:`dept_${d.id}`, type:'CONTAINS' });
    });

    // Projects
    projs.slice(0,12).forEach((p: any) => {
      ns.push({ id:`proj_${p.id}`, type:'PROJECT', label:p.name, sublabel:p.status, x: size.w/2+(Math.random()-0.5)*400, y: size.h/2+(Math.random()-0.5)*350, vx:0, vy:0, meta:p });
      es.push({ id:`org_proj_${p.id}`, source:'org', target:`proj_${p.id}`, type:'HAS' });
    });

    // Employees
    emps.slice(0,15).forEach((e: any) => {
      ns.push({ id:`emp_${e.id}`, type:'EMPLOYEE', label:e.name, sublabel:e.role, x: size.w/2+(Math.random()-0.5)*500, y: size.h/2+(Math.random()-0.5)*400, vx:0, vy:0, meta:e });
      if (e.departmentId) es.push({ id:`dept_emp_${e.id}`, source:`dept_${e.departmentId}`, target:`emp_${e.id}`, type:'MEMBER' });
      else es.push({ id:`org_emp_${e.id}`, source:'org', target:`emp_${e.id}`, type:'MEMBER' });
    });

    // Products
    prods.forEach((p: any) => {
      ns.push({ id:`prod_${p.id}`, type:'PRODUCT', label:p.name.slice(0,20), sublabel:p.marketplace, x: size.w/2+(Math.random()-0.5)*500, y: size.h/2+(Math.random()-0.5)*400, vx:0, vy:0, meta:p });
      es.push({ id:`org_prod_${p.id}`, source:'org', target:`prod_${p.id}`, type:'SELLS' });
    });

    setRawNodes(ns); setRawEdges(es);
  };

  // ── Projects View ───────────────────────────────────────────────────────────
  const loadProjectsView = async () => {
    const r = await fetch(`${API}/api/v1/projects?limit=30`, { headers: h() });
    const d = await r.json();
    const projs = Array.isArray(d) ? d : d.data ?? [];

    const ns: Node[] = [];
    const es: Edge[] = [];

    projs.forEach((p: any, i: number) => {
      const angle = (i / projs.length) * Math.PI * 2;
      const dist  = 220;
      ns.push({ id:`proj_${p.id}`, type:'PROJECT', label:p.name, sublabel:p.status, x: size.w/2+Math.cos(angle)*dist, y: size.h/2+Math.sin(angle)*dist, vx:0, vy:0, meta:p });
    });

    // Load members for each project
    await Promise.all(projs.slice(0,8).map(async (p: any) => {
      try {
        const mr = await fetch(`${API}/api/v1/projects/${p.id}`, { headers: h() });
        const md = await mr.json();
        (md.members ?? []).slice(0,3).forEach((m: any) => {
          const empId = `emp_${m.userId ?? m.id}`;
          if (!ns.find(n=>n.id===empId)) {
            ns.push({ id:empId, type:'EMPLOYEE', label:m.name ?? m.user?.name ?? 'Сотрудник', x: size.w/2+(Math.random()-0.5)*400, y: size.h/2+(Math.random()-0.5)*400, vx:0, vy:0 });
          }
          es.push({ id:`proj_mem_${p.id}_${m.userId}`, source:`proj_${p.id}`, target:empId, type:'MEMBER' });
        });
      } catch {}
    }));

    setRawNodes(ns); setRawEdges(es);
  };

  // ── Employees View ──────────────────────────────────────────────────────────
  const loadEmployeesView = async () => {
    const r = await fetch(`${API}/api/v1/employees?limit=50`, { headers: h() });
    const d = await r.json();
    const emps = d.employees ?? d ?? [];

    const ns: Node[] = [];
    const es: Edge[] = [];

    // Group by department
    const byDept: Record<string, any[]> = {};
    for (const e of emps) {
      const key = e.departmentId ?? 'none';
      if (!byDept[key]) byDept[key] = [];
      byDept[key].push(e);
    }

    const depts = Object.keys(byDept);
    depts.forEach((deptId, di) => {
      const angle = (di / depts.length) * Math.PI * 2;
      const deptNodeId = `dept_${deptId}`;
      ns.push({ id:deptNodeId, type:'DEPARTMENT', label: deptId==='none'?'Без отдела':'Отдел', x: size.w/2+Math.cos(angle)*200, y: size.h/2+Math.sin(angle)*200, vx:0, vy:0 });

      byDept[deptId].forEach((e, ei) => {
        const ea = angle + (ei - byDept[deptId].length/2) * 0.3;
        ns.push({ id:`emp_${e.id}`, type:'EMPLOYEE', label:e.name, sublabel:e.role, x: size.w/2+Math.cos(ea)*340, y: size.h/2+Math.sin(ea)*340, vx:0, vy:0, meta:e });
        es.push({ id:`dept_emp_${deptId}_${e.id}`, source:deptNodeId, target:`emp_${e.id}`, type:'MEMBER' });
      });
    });

    setRawNodes(ns); setRawEdges(es);
  };

  // ── Products View ───────────────────────────────────────────────────────────
  const loadProductsView = async () => {
    const r = await fetch(`${API}/api/v1/products?limit=40`, { headers: h() });
    const d = await r.json();
    const prods = Array.isArray(d) ? d : d.products ?? [];

    const ns: Node[] = [];
    const es: Edge[] = [];

    // Group by marketplace
    const byMp: Record<string, any[]> = {};
    for (const p of prods) {
      const key = p.marketplace ?? 'OTHER';
      if (!byMp[key]) byMp[key] = [];
      byMp[key].push(p);
    }

    const mps = Object.keys(byMp);
    mps.forEach((mp, mi) => {
      const angle = (mi / mps.length) * Math.PI * 2;
      const mpId  = `mp_${mp}`;
      ns.push({ id:mpId, type:'DEPARTMENT', label:mp, x: size.w/2+Math.cos(angle)*180, y: size.h/2+Math.sin(angle)*180, vx:0, vy:0 });

      byMp[mp].slice(0,10).forEach((p, pi) => {
        const pa = angle + (pi - byMp[mp].length/2) * 0.25;
        ns.push({ id:`prod_${p.id}`, type:'PRODUCT', label:p.name.slice(0,18), sublabel:`${p.price ? '₽'+Number(p.price).toLocaleString('ru') : ''}`, x: size.w/2+Math.cos(pa)*350, y: size.h/2+Math.sin(pa)*350, vx:0, vy:0, meta:p });
        es.push({ id:`mp_prod_${mp}_${p.id}`, source:mpId, target:`prod_${p.id}`, type:'LISTED' });
      });
    });

    setRawNodes(ns); setRawEdges(es);
  };

  // ── Timeline (activity log) ─────────────────────────────────────────────────
  const loadTimeline = async () => {
    try {
      const r = await fetch(`${API}/api/v1/relations/activity/ORG/company?limit=50`, { headers: h() });
      if (r.ok) {
        const d = await r.json();
        setActivityLog(d.logs ?? []);
      }
    } catch {}
    setRawNodes([]); setRawEdges([]);
  };

  // ── Node click → expand relations ───────────────────────────────────────────
  const expandNode = async (node: Node) => {
    if (node.type === 'ORG') return;
    const entityType = node.type;
    const entityId   = node.id.split('_').slice(1).join('_');
    try {
      const r = await fetch(`${API}/api/v1/relations/${entityType}/${entityId}`, { headers: h() });
      if (!r.ok) return;
      const d = await r.json();
      if (!d.relations?.length) return;

      const newNodes: Node[] = [];
      const newEdges: Edge[] = [];

      for (const rel of d.relations.slice(0,8)) {
        const nid = `${rel.entityType}_${rel.entityId}`;
        if (!rawNodes.find(n=>n.id===nid)) {
          newNodes.push({
            id: nid, type: rel.entityType,
            label: rel.entity?.title ?? rel.entity?.name ?? rel.entityId,
            sublabel: rel.entity?.status,
            x: node.x + (Math.random()-0.5)*200,
            y: node.y + (Math.random()-0.5)*200,
            vx:0, vy:0, meta: rel.entity,
          });
        }
        newEdges.push({ id:rel.id, source:node.id, target:nid, label:rel.label, type:rel.relationType });
      }

      setRawNodes(prev => [...prev, ...newNodes.filter(n=>!prev.find(p=>p.id===n.id))]);
      setRawEdges(prev => [...prev, ...newEdges.filter(e=>!prev.find(p=>p.id===e.id))]);
    } catch {}
  };

  // ── SVG interaction ─────────────────────────────────────────────────────────
  const svgPt = (e: React.MouseEvent) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: (e.clientX - rect.left - pan.x) / zoom, y: (e.clientY - rect.top - pan.y) / zoom };
  };

  const onNodeClick = (node: Node) => {
    setSelected(s => s?.id === node.id ? null : node);
    expandNode(node);
  };

  const onNodeDblClick = (node: Node) => {
    const type = node.type.toLowerCase();
    const id   = node.id.split('_').slice(1).join('_');
    const routes: Record<string,string> = {
      task: `/dashboard/tasks/${id}`,
      project: `/dashboard/projects/${id}`,
      product: `/dashboard/products/${id}`,
      employee: `/dashboard/employees/${id}`,
      deal: `/dashboard/crm/deals/${id}`,
    };
    if (routes[type]) router.push(routes[type]);
  };

  const onSvgMouseDown = (e: React.MouseEvent) => {
    if ((e.target as SVGElement).tagName === 'svg' || (e.target as SVGElement).tagName === 'rect') {
      setIsPanning(true);
      panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
    }
  };

  const onSvgMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: panStart.current.px + e.clientX - panStart.current.x, y: panStart.current.py + e.clientY - panStart.current.y });
    }
    if (draggingNode) {
      const pt = svgPt(e);
      const node = nodes.find(n=>n.id===draggingNode);
      if (node) { node.x = pt.x; node.y = pt.y; node.fx = pt.x; node.fy = pt.y; }
    }
  };

  const onSvgMouseUp = () => { setIsPanning(false); setDraggingNode(null); };

  const onWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 0.9 : 1.1;
    setZoom(z => Math.max(0.2, Math.min(3, z * factor)));
  };

  // ── Filter by search ─────────────────────────────────────────────────────────
  const filteredNodes = search
    ? nodes.filter(n => n.label.toLowerCase().includes(search.toLowerCase()))
    : nodes;
  const visibleNodeIds = new Set(filteredNodes.map(n=>n.id));
  const filteredEdges = search
    ? edges.filter(e => visibleNodeIds.has(e.source) && visibleNodeIds.has(e.target))
    : edges;

  // ─── Render ───────────────────────────────────────────────────────────────
  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'var(--bg-app)', overflow:'hidden' }}>

      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 20px', background:'var(--bg-primary)', borderBottom:'1px solid var(--border)', flexShrink:0, zIndex:10 }}>
        <div>
          <h1 style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', margin:0, letterSpacing:'-0.3px' }}>⚡ Command Center</h1>
          <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>Цифровая карта компании</p>
        </div>

        {/* View tabs */}
        <div style={{ display:'flex', gap:2, marginLeft:16, background:'var(--bg-secondary)', borderRadius:'var(--radius-md)', padding:3 }}>
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              style={{ display:'flex', alignItems:'center', gap:5, padding:'5px 12px', borderRadius:'var(--radius-sm)', border:'none', cursor:'pointer', fontSize:12, fontWeight:500, transition:'all var(--transition)',
                background: view===v.id ? 'var(--bg-primary)' : 'transparent',
                color: view===v.id ? 'var(--accent)' : 'var(--text-muted)',
                boxShadow: view===v.id ? 'var(--shadow-xs)' : 'none',
              }}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ display:'flex', alignItems:'center', gap:8, background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius)', padding:'6px 12px', marginLeft:'auto', minWidth:220 }}>
          <span style={{ fontSize:13, color:'var(--text-muted)' }}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск по графу..."
            style={{ background:'none', border:'none', outline:'none', fontSize:13, color:'var(--text-primary)', width:'100%' }} />
        </div>

        {/* Zoom controls */}
        <div style={{ display:'flex', gap:4 }}>
          <button onClick={() => setZoom(z=>Math.min(3,z*1.2))}
            style={{ width:30, height:30, borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'var(--bg-primary)', cursor:'pointer', fontSize:16, color:'var(--text-secondary)' }}>+</button>
          <button onClick={() => setZoom(z=>Math.max(0.2,z/1.2))}
            style={{ width:30, height:30, borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'var(--bg-primary)', cursor:'pointer', fontSize:16, color:'var(--text-secondary)' }}>−</button>
          <button onClick={() => { setZoom(1); setPan({x:0,y:0}); }}
            style={{ height:30, padding:'0 10px', borderRadius:'var(--radius-sm)', border:'1px solid var(--border)', background:'var(--bg-primary)', cursor:'pointer', fontSize:11, color:'var(--text-muted)', whiteSpace:'nowrap' }}>
            {Math.round(zoom*100)}%
          </button>
        </div>

        {/* Stats */}
        <div style={{ display:'flex', gap:12, fontSize:11, color:'var(--text-muted)', borderLeft:'1px solid var(--border)', paddingLeft:12 }}>
          <span>🔵 {nodes.length} объектов</span>
          <span>🔗 {edges.length} связей</span>
        </div>
      </div>

      {/* Main area */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* Graph canvas */}
        <div ref={containerRef} style={{ flex:1, position:'relative', overflow:'hidden' }}>
          {loading && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', zIndex:5, background:'rgba(255,255,255,0.7)', backdropFilter:'blur(4px)' }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:32, marginBottom:8 }}>⚡</div>
                <p style={{ fontSize:14, color:'var(--text-secondary)', fontWeight:500 }}>Строим карту компании...</p>
              </div>
            </div>
          )}

          {view === 'timeline' ? (
            <TimelineView logs={activityLog} />
          ) : (
            <svg ref={svgRef} width="100%" height="100%"
              onMouseDown={onSvgMouseDown}
              onMouseMove={onSvgMouseMove}
              onMouseUp={onSvgMouseUp}
              onMouseLeave={onSvgMouseUp}
              onWheel={onWheel}
              style={{ cursor: isPanning ? 'grabbing' : 'grab', userSelect:'none' }}>

              {/* Background */}
              <rect width="100%" height="100%" fill="var(--bg-app)" />

              {/* Dot grid */}
              <pattern id="grid" x={pan.x % (20*zoom)} y={pan.y % (20*zoom)} width={20*zoom} height={20*zoom} patternUnits="userSpaceOnUse">
                <circle cx={1} cy={1} r={0.8} fill="var(--border)" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#grid)" />

              <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
                {/* Edges */}
                {filteredEdges.map(e => {
                  const s = nodes.find(n=>n.id===e.source);
                  const t = nodes.find(n=>n.id===e.target);
                  if (!s || !t) return null;
                  const mx = (s.x+t.x)/2, my = (s.y+t.y)/2;
                  const isSelected = selected && (selected.id===e.source||selected.id===e.target);
                  return (
                    <g key={e.id}>
                      <line x1={s.x} y1={s.y} x2={t.x} y2={t.y}
                        stroke={isSelected ? 'var(--accent)' : 'var(--border-strong)'}
                        strokeWidth={isSelected ? 2 : 1}
                        strokeOpacity={isSelected ? 0.8 : 0.5}
                        strokeDasharray={e.type==='CUSTOM'?'4,3':undefined} />
                      {isSelected && e.label && (
                        <text x={mx} y={my-6} textAnchor="middle" fontSize={9} fill="var(--accent)" fontWeight={600}>{e.label}</text>
                      )}
                    </g>
                  );
                })}

                {/* Nodes */}
                {filteredNodes.map(node => {
                  const r = NODE_RADIUS[node.type] ?? 20;
                  const color = NODE_COLORS[node.type] ?? '#6b7280';
                  const isSelected = selected?.id === node.id;
                  const isHovered  = hovered?.id  === node.id;
                  const dimmed = selected && !isSelected && !edges.some(e=>(e.source===selected.id&&e.target===node.id)||(e.target===selected.id&&e.source===node.id));

                  return (
                    <g key={node.id}
                      transform={`translate(${node.x},${node.y})`}
                      onClick={()=>onNodeClick(node)}
                      onDoubleClick={()=>onNodeDblClick(node)}
                      onMouseEnter={()=>setHovered(node)}
                      onMouseLeave={()=>setHovered(null)}
                      onMouseDown={e=>{e.stopPropagation();setDraggingNode(node.id);node.pinned=true;}}
                      style={{ cursor:'pointer' }}>

                      {/* Glow ring on select */}
                      {isSelected && <circle r={r+8} fill={color} fillOpacity={0.15} />}
                      {isHovered && !isSelected && <circle r={r+5} fill={color} fillOpacity={0.08} />}

                      {/* Node circle */}
                      <circle r={r} fill={dimmed ? 'var(--bg-tertiary)' : color}
                        fillOpacity={dimmed ? 0.4 : 1}
                        stroke={isSelected ? 'white' : 'transparent'}
                        strokeWidth={isSelected ? 2.5 : 0} />

                      {/* Icon */}
                      <text textAnchor="middle" dominantBaseline="central" fontSize={r*0.7}
                        opacity={dimmed ? 0.3 : 1}>
                        {NODE_ICONS[node.type] ?? '•'}
                      </text>

                      {/* Label */}
                      <text y={r+12} textAnchor="middle" fontSize={10} fontWeight={500}
                        fill={dimmed ? 'var(--text-disabled)' : 'var(--text-primary)'}
                        style={{ pointerEvents:'none' }}>
                        {node.label.length > 18 ? node.label.slice(0,16)+'…' : node.label}
                      </text>

                      {/* Sublabel */}
                      {node.sublabel && (
                        <text y={r+23} textAnchor="middle" fontSize={9}
                          fill={dimmed ? 'var(--text-disabled)' : 'var(--text-muted)'}
                          style={{ pointerEvents:'none' }}>
                          {node.sublabel}
                        </text>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
        </div>

        {/* Sidebar panel — selected node info */}
        {selected && (
          <div style={{ width:280, background:'var(--bg-primary)', borderLeft:'1px solid var(--border)', overflowY:'auto', flexShrink:0 }}>
            <div style={{ padding:'14px 16px', borderBottom:'1px solid var(--border)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:6 }}>
                <span style={{ fontSize:20 }}>{NODE_ICONS[selected.type]}</span>
                <div>
                  <p style={{ fontSize:13, fontWeight:700, color:'var(--text-primary)', margin:0 }}>{selected.label}</p>
                  <p style={{ fontSize:11, color:'var(--text-muted)', margin:0 }}>{selected.type} {selected.sublabel ? `· ${selected.sublabel}` : ''}</p>
                </div>
                <button onClick={()=>setSelected(null)} style={{ marginLeft:'auto', background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', fontSize:16 }}>✕</button>
              </div>

              {/* Meta info */}
              {selected.meta && (
                <div style={{ display:'flex', flexDirection:'column', gap:4, marginTop:8 }}>
                  {Object.entries(selected.meta).filter(([k]) => ['status','priority','marketplace','articleId','price','email','role'].includes(k)).map(([k,v]) => (
                    <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:12 }}>
                      <span style={{ color:'var(--text-muted)' }}>{k}</span>
                      <span style={{ color:'var(--text-primary)', fontWeight:500 }}>{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}

              {/* Open button */}
              <button onClick={() => onNodeDblClick(selected)}
                style={{ width:'100%', marginTop:10, padding:'8px', background:'var(--accent)', color:'white', border:'none', borderRadius:'var(--radius)', fontSize:12, fontWeight:600, cursor:'pointer' }}>
                Открыть →
              </button>
            </div>

            {/* Connected nodes */}
            <div style={{ padding:'12px 16px' }}>
              <p style={{ fontSize:11, fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>
                Связанные объекты
              </p>
              {edges.filter(e=>e.source===selected.id||e.target===selected.id).map(e => {
                const otherId = e.source===selected.id ? e.target : e.source;
                const other   = nodes.find(n=>n.id===otherId);
                if (!other) return null;
                return (
                  <div key={e.id} onClick={() => setSelected(other)}
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:'var(--radius-sm)', cursor:'pointer', marginBottom:2, transition:'background var(--transition)' }}
                    onMouseEnter={el=>(el.currentTarget as HTMLElement).style.background='var(--bg-hover)'}
                    onMouseLeave={el=>(el.currentTarget as HTMLElement).style.background='transparent'}>
                    <span>{NODE_ICONS[other.type]}</span>
                    <div style={{ minWidth:0 }}>
                      <p style={{ fontSize:12, fontWeight:500, color:'var(--text-primary)', margin:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{other.label}</p>
                      {e.label && <p style={{ fontSize:10, color:'var(--accent)', margin:0 }}>{e.label}</p>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Legend */}
      <div style={{ display:'flex', gap:12, padding:'6px 20px', background:'var(--bg-primary)', borderTop:'1px solid var(--border)', flexShrink:0 }}>
        {Object.entries(NODE_ICONS).map(([type, icon]) => (
          <div key={type} style={{ display:'flex', alignItems:'center', gap:4, fontSize:11, color:'var(--text-muted)' }}>
            <div style={{ width:10, height:10, borderRadius:'50%', background:NODE_COLORS[type] }} />
            {icon} {type}
          </div>
        ))}
        <div style={{ marginLeft:'auto', fontSize:11, color:'var(--text-muted)' }}>
          Клик — детали · Двойной клик — открыть · Перетащи узел · Скролл — зум
        </div>
      </div>
    </div>
  );
}

// ─── Timeline View ────────────────────────────────────────────────────────────
function TimelineView({ logs }: { logs: any[] }) {
  const ACTION_ICONS: Record<string,string> = {
    CREATED:'✨', UPDATED:'✏️', STATUS_CHANGED:'🔄', ASSIGNED:'👤',
    LINKED:'🔗', COMMENTED:'💬', FILE_ADDED:'📎', DELETED:'🗑️',
  };
  const ACTION_LABELS: Record<string,string> = {
    CREATED:'Создано', UPDATED:'Обновлено', STATUS_CHANGED:'Статус изменён',
    ASSIGNED:'Назначен', LINKED:'Связь добавлена', COMMENTED:'Комментарий',
    FILE_ADDED:'Файл', DELETED:'Удалено',
  };

  if (!logs.length) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:8 }}>
      <div style={{ fontSize:40 }}>📅</div>
      <p style={{ fontSize:14, color:'var(--text-muted)' }}>История будет накапливаться по мере работы с системой</p>
    </div>
  );

  return (
    <div style={{ maxWidth:640, margin:'0 auto', padding:'24px 20px', overflowY:'auto', height:'100%' }}>
      <h2 style={{ fontSize:16, fontWeight:700, color:'var(--text-primary)', marginBottom:20 }}>📅 Timeline компании</h2>
      {logs.map((log, i) => (
        <div key={log.id} style={{ display:'flex', gap:12, paddingBottom:16, position:'relative' }}>
          {i < logs.length-1 && <div style={{ position:'absolute', left:15, top:28, bottom:0, width:1, background:'var(--border)' }} />}
          <div style={{ width:30, height:30, borderRadius:'50%', background:'var(--accent-light)', border:'2px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, flexShrink:0, zIndex:1 }}>
            {ACTION_ICONS[log.action] ?? '•'}
          </div>
          <div style={{ flex:1, paddingTop:4 }}>
            <div style={{ display:'flex', alignItems:'baseline', gap:8, flexWrap:'wrap' }}>
              <span style={{ fontSize:13, fontWeight:600, color:'var(--text-primary)' }}>{ACTION_LABELS[log.action] ?? log.action}</span>
              {log.actorName && <span style={{ fontSize:12, color:'var(--text-muted)' }}>· {log.actorName}</span>}
              <span style={{ fontSize:11, color:'var(--text-disabled)', marginLeft:'auto' }}>{new Date(log.createdAt).toLocaleString('ru')}</span>
            </div>
            {log.newValue && <p style={{ fontSize:12, color:'var(--text-secondary)', margin:'2px 0 0' }}>{log.newValue}</p>}
          </div>
        </div>
      ))}
    </div>
  );
}
