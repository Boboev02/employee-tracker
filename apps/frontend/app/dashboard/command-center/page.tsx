'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = 'https://employee-tracker.ru';

// ─── Types ────────────────────────────────────────────────────────────────────
interface GNode {
  id: string;
  type: string;
  label: string;
  sublabel?: string;
  parentId?: string | null;
  children: string[];
  x: number; y: number;
  depth: number;
  meta?: any;
}

interface GEdge {
  id: string;
  source: string;
  target: string;
  kind: 'hierarchy' | 'relation' | 'work' | 'document';
  label?: string;
}

// ─── Visual config ────────────────────────────────────────────────────────────
const NODE_COLOR: Record<string, string> = {
  ORG:        '#6b5ce7',
  DEPARTMENT: '#e8a020',
  PROJECT:    '#9b59b6',
  PRODUCT:    '#27ae60',
  TASK:       '#3498db',
  SUBTASK:    '#2980b9',
  EMPLOYEE:   '#27ae60',
  DOCUMENT:   '#e67e22',
  SUPPLIER:   '#16a085',
  DEAL:       '#e74c3c',
  MARKETPLACE:'#2c3e50',
  FILE:       '#95a5a6',
};

const NODE_ICONS: Record<string, string> = {
  ORG:'🏛️', DEPARTMENT:'🏢', PROJECT:'📁', PRODUCT:'📦',
  TASK:'✅', SUBTASK:'☑️', EMPLOYEE:'👤', DOCUMENT:'📄',
  SUPPLIER:'🚚', DEAL:'💼', MARKETPLACE:'🛒', FILE:'📎',
};

const NODE_W = 140;
const NODE_H = 52;
const H_GAP  = 30;
const V_GAP  = 90;

const VIEWS = [
  { id:'hierarchy',  label:'Иерархия',  icon:'🏛️' },
  { id:'relation',   label:'Связи',     icon:'🔗' },
  { id:'projects',   label:'Проекты',   icon:'📁' },
  { id:'employees',  label:'Сотрудники',icon:'👥' },
  { id:'products',   label:'Товары',    icon:'📦' },
  { id:'timeline',   label:'Timeline',  icon:'📅' },
];

const EDGE_STYLE: Record<string, { stroke: string; dash?: string; width: number }> = {
  hierarchy: { stroke: '#555', width: 1.5 },
  relation:  { stroke: '#6b5ce7', dash: '4,3', width: 1 },
  work:      { stroke: '#27ae60', dash: '2,2', width: 1 },
  document:  { stroke: '#e67e22', dash: '5,3', width: 1 },
};

// ─── Tree layout (top-down Reingold–Tilford simplified) ───────────────────────
function layoutTree(nodes: GNode[]): GNode[] {
  const map = new Map(nodes.map(n => [n.id, n]));
  const roots = nodes.filter(n => !n.parentId || !map.has(n.parentId));

  // Assign depths
  const assignDepth = (id: string, depth: number) => {
    const n = map.get(id);
    if (!n) return;
    n.depth = depth;
    n.children.forEach(cid => assignDepth(cid, depth + 1));
  };
  roots.forEach(r => assignDepth(r.id, 0));

  // Group by depth
  const byDepth: Map<number, GNode[]> = new Map();
  nodes.forEach(n => {
    if (!byDepth.has(n.depth)) byDepth.set(n.depth, []);
    byDepth.get(n.depth)!.push(n);
  });

  // Assign x positions per depth row - spread evenly
  byDepth.forEach((row, depth) => {
    const totalW = row.length * (NODE_W + H_GAP) - H_GAP;
    const startX = -totalW / 2 + NODE_W / 2;
    row.forEach((n, i) => {
      n.x = startX + i * (NODE_W + H_GAP);
      n.y = depth * (NODE_H + V_GAP) + NODE_H / 2;
    });
  });

  return nodes;
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function CommandCenterPage() {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState('');
  const [view, setView] = useState('hierarchy');
  const [displayMode, setDisplayMode] = useState<'hierarchy'|'relation'>('hierarchy');
  const [nodes, setNodes] = useState<GNode[]>([]);
  const [edges, setEdges] = useState<GEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<GNode | null>(null);
  const [search, setSearch] = useState('');
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.85);
  const [size, setSize] = useState({ w: 1200, h: 700 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const [activityLog, setActivityLog] = useState<any[]>([]);
  const [dragging, setDragging] = useState<{id:string;ox:number;oy:number}|null>(null);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
  }, []);

  useEffect(() => {
    const ro = new ResizeObserver(e => {
      for (const en of e) setSize({ w: en.contentRect.width, h: en.contentRect.height });
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const h = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const apiFetch = useCallback(async (url: string): Promise<any> => {
    for (let i = 0; i < 3; i++) {
      try {
        const r = await fetch(url, { headers: h() });
        if (r.status === 429) { await new Promise(res => setTimeout(res, 600*(i+1))); continue; }
        if (!r.ok) return {};
        return r.json();
      } catch { return {}; }
    }
    return {};
  }, [h]);

  useEffect(() => { if (token) load(view); }, [token, view]);

  // ── Wheel zoom (passive:false) ─────────────────────────────────────────────
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    const f = e.deltaY > 0 ? 0.93 : 1.08;
    setZoom(z => Math.max(0.1, Math.min(4, z * f)));
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  // ── Fit to screen ──────────────────────────────────────────────────────────
  const fitScreen = useCallback((ns: GNode[]) => {
    if (!ns.length) return;
    const xs = ns.map(n => n.x), ys = ns.map(n => n.y);
    const minX = Math.min(...xs) - NODE_W/2 - 40;
    const maxX = Math.max(...xs) + NODE_W/2 + 40;
    const minY = Math.min(...ys) - NODE_H/2 - 40;
    const maxY = Math.max(...ys) + NODE_H/2 + 40;
    const cw = size.w, ch = size.h;
    const scaleX = cw / (maxX - minX);
    const scaleY = ch / (maxY - minY);
    const newZoom = Math.min(scaleX, scaleY, 1.2);
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    setZoom(newZoom);
    setPan({ x: cw/2 - cx*newZoom, y: ch/2 - cy*newZoom });
  }, [size]);

  // ── Load views ─────────────────────────────────────────────────────────────
  const load = async (v: string) => {
    setLoading(true); setSelected(null);
    try {
      if (v === 'hierarchy')  { const r = await buildHierarchy(); fitScreen(r); }
      else if (v === 'projects')  { const r = await buildProjects();  fitScreen(r); }
      else if (v === 'employees') { const r = await buildEmployees(); fitScreen(r); }
      else if (v === 'products')  { const r = await buildProducts();  fitScreen(r); }
      else if (v === 'relation')  { const r = await buildHierarchy(true); fitScreen(r); }
      else if (v === 'timeline')  { await loadTimeline(); }
    } catch(e) { console.error(e); }
    setLoading(false);
  };

  // ── Hierarchy builder ──────────────────────────────────────────────────────
  const buildHierarchy = async (withRelations = false) => {
    const [empD, projD, prodD, deptD, taskD] = await Promise.all([
      apiFetch(`${API}/api/v1/employees?limit=50`),
      apiFetch(`${API}/api/v1/projects?limit=30`),
      apiFetch(`${API}/api/v1/products?limit=30`),
      apiFetch(`${API}/api/v1/dictionaries/departments`),
      apiFetch(`${API}/api/v1/tasks?limit=30`),
    ]);

    const emps  = empD.employees  ?? (Array.isArray(empD)  ? empD  : []);
    const projs = Array.isArray(projD) ? projD : (projD.data ?? []);
    const prods = Array.isArray(prodD) ? prodD : (prodD.products ?? []);
    const depts = Array.isArray(deptD) ? deptD : [];
    const tasks = Array.isArray(taskD) ? taskD : (taskD.data ?? []);

    const ns: GNode[] = [];
    const es: GEdge[] = [];

    // ORG root
    ns.push({ id:'org', type:'ORG', label:'Компания', sublabel:'К-Трейд', parentId:null, children:[], x:0, y:0, depth:0 });

    // Departments → children of ORG
    depts.slice(0,6).forEach((d: any) => {
      const nid = `dept_${d.id}`;
      ns.push({ id:nid, type:'DEPARTMENT', label:d.name, sublabel:`${emps.filter((e:any)=>e.departmentId===d.id).length} сотр.`, parentId:'org', children:[], x:0, y:0, depth:1, meta:d });
      ns.find(n=>n.id==='org')!.children.push(nid);
      es.push({ id:`e_org_${nid}`, source:'org', target:nid, kind:'hierarchy' });
    });

    // If no departments, create virtual ones by project
    const deptIds = new Set(depts.slice(0,6).map((d:any) => `dept_${d.id}`));

    // Projects → children of departments or org
    projs.slice(0,12).forEach((p: any) => {
      const pid = `proj_${p.id}`;
      // Try to find a dept for this project
      const deptNode = deptIds.size > 0 ? [...deptIds][Math.floor(Math.random() * Math.min(deptIds.size, 3))] : 'org';
      const parent = ns.find(n=>n.id===deptNode) || ns.find(n=>n.id==='org')!;
      ns.push({ id:pid, type:'PROJECT', label:p.name.slice(0,20), sublabel:p.status, parentId:parent.id, children:[], x:0, y:0, depth:parent.depth+1, meta:p });
      parent.children.push(pid);
      es.push({ id:`e_${parent.id}_${pid}`, source:parent.id, target:pid, kind:'hierarchy' });
    });

    // Products → children of projects
    prods.slice(0,12).forEach((p: any, i: number) => {
      const prodId = `prod_${p.id}`;
      const projNodes = ns.filter(n=>n.type==='PROJECT');
      const parent = projNodes.length > 0 ? projNodes[i % projNodes.length] : ns.find(n=>n.id==='org')!;
      ns.push({ id:prodId, type:'PRODUCT', label:p.name.slice(0,18), sublabel:p.marketplace, parentId:parent.id, children:[], x:0, y:0, depth:parent.depth+1, meta:p });
      parent.children.push(prodId);
      es.push({ id:`e_${parent.id}_${prodId}`, source:parent.id, target:prodId, kind:'hierarchy' });
    });

    // Tasks → children of projects
    tasks.filter((t:any)=>!t.parentId).slice(0,16).forEach((t: any) => {
      const tid = `task_${t.id}`;
      const projNodes = ns.filter(n=>n.type==='PROJECT');
      if (projNodes.length === 0) return;
      const parent = t.projectId ? (ns.find(n=>n.id===`proj_${t.projectId}`) ?? projNodes[0]) : projNodes[Math.floor(Math.random()*projNodes.length)];
      ns.push({ id:tid, type:'TASK', label:t.title.slice(0,20), sublabel:t.status, parentId:parent.id, children:[], x:0, y:0, depth:parent.depth+1, meta:t });
      parent.children.push(tid);
      es.push({ id:`e_${parent.id}_${tid}`, source:parent.id, target:tid, kind:'hierarchy' });
    });

    // Relation mode: add employees as associated nodes
    if (withRelations) {
      emps.slice(0,10).forEach((e: any) => {
        const eid = `emp_${e.id}`;
        const deptNode = e.departmentId ? ns.find(n=>n.id===`dept_${e.departmentId}`) : null;
        const parent = deptNode || ns.find(n=>n.id==='org')!;
        if (!ns.find(n=>n.id===eid)) {
          ns.push({ id:eid, type:'EMPLOYEE', label:e.name, sublabel:e.role, parentId:parent.id, children:[], x:0, y:0, depth:parent.depth+1 });
          parent.children.push(eid);
          es.push({ id:`e_${parent.id}_${eid}`, source:parent.id, target:eid, kind:'work' });
        }
      });
    }

    const laid = layoutTree(ns);
    setNodes(laid);
    setEdges(es);
    return laid;
  };

  // ── Projects view ──────────────────────────────────────────────────────────
  const buildProjects = async () => {
    const projD = await apiFetch(`${API}/api/v1/projects?limit=20`);
    const projs = Array.isArray(projD) ? projD : (projD.data ?? []);

    const ns: GNode[] = [];
    const es: GEdge[] = [];

    ns.push({ id:'root', type:'ORG', label:'Проекты', parentId:null, children:[], x:0, y:0, depth:0 });

    for (const p of projs) {
      const pid = `proj_${p.id}`;
      ns.push({ id:pid, type:'PROJECT', label:p.name.slice(0,22), sublabel:p.status, parentId:'root', children:[], x:0, y:0, depth:1, meta:p });
      ns.find(n=>n.id==='root')!.children.push(pid);
      es.push({ id:`e_root_${pid}`, source:'root', target:pid, kind:'hierarchy' });

      // Load project members
      try {
        const pd = await apiFetch(`${API}/api/v1/projects/${p.id}`);
        (pd.members ?? []).slice(0,3).forEach((m: any) => {
          const mid = `emp_${m.userId ?? m.id}_${p.id}`;
          ns.push({ id:mid, type:'EMPLOYEE', label:(m.name??m.user?.name??'Сотрудник').slice(0,16), parentId:pid, children:[], x:0, y:0, depth:2 });
          ns.find(n=>n.id===pid)!.children.push(mid);
          es.push({ id:`e_${pid}_${mid}`, source:pid, target:mid, kind:'work' });
        });
      } catch {}
    }

    const laid = layoutTree(ns);
    setNodes(laid); setEdges(es);
    return laid;
  };

  // ── Employees view ─────────────────────────────────────────────────────────
  const buildEmployees = async () => {
    const [empD, deptD] = await Promise.all([
      apiFetch(`${API}/api/v1/employees?limit=50`),
      apiFetch(`${API}/api/v1/dictionaries/departments`),
    ]);
    const emps  = empD.employees ?? (Array.isArray(empD) ? empD : []);
    const depts = Array.isArray(deptD) ? deptD : [];

    const ns: GNode[] = [];
    const es: GEdge[] = [];

    ns.push({ id:'org', type:'ORG', label:'Организация', parentId:null, children:[], x:0, y:0, depth:0 });

    depts.slice(0,8).forEach((d: any) => {
      const did = `dept_${d.id}`;
      const deptEmps = emps.filter((e:any)=>e.departmentId===d.id);
      ns.push({ id:did, type:'DEPARTMENT', label:d.name, sublabel:`${deptEmps.length} сотр.`, parentId:'org', children:[], x:0, y:0, depth:1, meta:d });
      ns.find(n=>n.id==='org')!.children.push(did);
      es.push({ id:`e_org_${did}`, source:'org', target:did, kind:'hierarchy' });

      deptEmps.slice(0,5).forEach((e: any) => {
        const eid = `emp_${e.id}`;
        ns.push({ id:eid, type:'EMPLOYEE', label:e.name, sublabel:e.role ?? e.position, parentId:did, children:[], x:0, y:0, depth:2, meta:e });
        ns.find(n=>n.id===did)!.children.push(eid);
        es.push({ id:`e_${did}_${eid}`, source:did, target:eid, kind:'work' });
      });
    });

    // Employees without department
    const noDept = emps.filter((e:any) => !e.departmentId || !depts.find((d:any)=>d.id===e.departmentId)).slice(0,5);
    if (noDept.length) {
      const oid = 'dept_other';
      ns.push({ id:oid, type:'DEPARTMENT', label:'Без отдела', sublabel:`${noDept.length} сотр.`, parentId:'org', children:[], x:0, y:0, depth:1 });
      ns.find(n=>n.id==='org')!.children.push(oid);
      es.push({ id:`e_org_${oid}`, source:'org', target:oid, kind:'hierarchy' });
      noDept.forEach((e: any) => {
        const eid = `emp_${e.id}`;
        ns.push({ id:eid, type:'EMPLOYEE', label:e.name, sublabel:e.role, parentId:oid, children:[], x:0, y:0, depth:2, meta:e });
        ns.find(n=>n.id===oid)!.children.push(eid);
        es.push({ id:`e_${oid}_${eid}`, source:oid, target:eid, kind:'work' });
      });
    }

    const laid = layoutTree(ns);
    setNodes(laid); setEdges(es);
    return laid;
  };

  // ── Products view ──────────────────────────────────────────────────────────
  const buildProducts = async () => {
    const prodD = await apiFetch(`${API}/api/v1/products?limit=40`);
    const prods = Array.isArray(prodD) ? prodD : (prodD.products ?? []);

    const ns: GNode[] = [];
    const es: GEdge[] = [];

    ns.push({ id:'root', type:'ORG', label:'Товары', parentId:null, children:[], x:0, y:0, depth:0 });

    // Group by marketplace
    const byMp: Record<string, any[]> = {};
    prods.forEach((p: any) => {
      const k = p.marketplace ?? 'Другое';
      if (!byMp[k]) byMp[k] = [];
      byMp[k].push(p);
    });

    Object.entries(byMp).forEach(([mp, items]) => {
      const mid = `mp_${mp}`;
      ns.push({ id:mid, type:'MARKETPLACE', label:mp, sublabel:`${items.length} товаров`, parentId:'root', children:[], x:0, y:0, depth:1 });
      ns.find(n=>n.id==='root')!.children.push(mid);
      es.push({ id:`e_root_${mid}`, source:'root', target:mid, kind:'hierarchy' });

      items.slice(0,8).forEach((p: any) => {
        const pid = `prod_${p.id}`;
        ns.push({ id:pid, type:'PRODUCT', label:p.name.slice(0,18), sublabel:p.price?`₽${Number(p.price).toLocaleString('ru')}`:undefined, parentId:mid, children:[], x:0, y:0, depth:2, meta:p });
        ns.find(n=>n.id===mid)!.children.push(pid);
        es.push({ id:`e_${mid}_${pid}`, source:mid, target:pid, kind:'hierarchy' });
      });
    });

    const laid = layoutTree(ns);
    setNodes(laid); setEdges(es);
    return laid;
  };

  // ── Timeline ───────────────────────────────────────────────────────────────
  const loadTimeline = async () => {
    setNodes([]); setEdges([]);
    const d = await apiFetch(`${API}/api/v1/relations/activity/TASK/org?limit=50`);
    setActivityLog(d.logs ?? []);
  };

  // ── SVG interactions ───────────────────────────────────────────────────────
  const svgToWorld = (ex: number, ey: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: (ex - rect.left - pan.x) / zoom, y: (ey - rect.top - pan.y) / zoom };
  };

  const onBgMouseDown = (e: React.MouseEvent) => {
    if ((e.target as SVGElement).closest('g[data-node]')) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (isPanning) {
      setPan({ x: panStart.current.px + e.clientX - panStart.current.x, y: panStart.current.py + e.clientY - panStart.current.y });
    }
    if (dragging) {
      const wp = svgToWorld(e.clientX, e.clientY);
      setNodes(prev => prev.map(n => n.id === dragging.id ? { ...n, x: wp.x - dragging.ox, y: wp.y - dragging.oy } : n));
    }
  };

  const onMouseUp = () => { setIsPanning(false); setDragging(null); };

  const onNodeMouseDown = (e: React.MouseEvent, node: GNode) => {
    e.stopPropagation();
    const wp = svgToWorld(e.clientX, e.clientY);
    setDragging({ id: node.id, ox: wp.x - node.x, oy: wp.y - node.y });
  };

  const onNodeClick = (e: React.MouseEvent, node: GNode) => {
    if (dragging) return;
    e.stopPropagation();
    setSelected(s => s?.id === node.id ? null : node);
  };

  const onNodeDblClick = (node: GNode) => {
    const id = node.id.split('_').slice(1).join('_');
    const routes: Record<string,string> = {
      PROJECT: `/dashboard/projects/${id}`,
      PRODUCT: `/dashboard/products/${id}`,
      TASK:    `/dashboard/tasks/${id}`,
      EMPLOYEE:`/dashboard/employees/${id}`,
      DEAL:    `/dashboard/crm/deals/${id}`,
    };
    if (routes[node.type]) router.push(routes[node.type]);
  };

  // Filter by search
  const visibleNodes = search
    ? nodes.filter(n => n.label.toLowerCase().includes(search.toLowerCase()))
    : nodes;
  const visibleIds = new Set(visibleNodes.map(n => n.id));
  const visibleEdges = edges.filter(e => visibleIds.has(e.source) && visibleIds.has(e.target));

  // ─── Edge path: straight lines with elbow joints for hierarchy ──────────────
  const edgePath = (e: GEdge): string => {
    const s = nodes.find(n=>n.id===e.source);
    const t = nodes.find(n=>n.id===e.target);
    if (!s || !t) return '';
    const sx = s.x, sy = s.y + NODE_H/2;
    const tx = t.x, ty = t.y - NODE_H/2;
    const my = (sy + ty) / 2;
    if (e.kind === 'hierarchy') {
      return `M ${sx} ${sy} L ${sx} ${my} L ${tx} ${my} L ${tx} ${ty}`;
    }
    return `M ${sx} ${sy} C ${sx} ${sy+40} ${tx} ${ty-40} ${tx} ${ty}`;
  };

  const maxDepth = nodes.length ? Math.max(...nodes.map(n=>n.depth)) : 0;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'#0f1117', color:'#e8eaf0', overflow:'hidden', fontFamily:'Inter,sans-serif' }}>

      {/* ── Top bar ── */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 16px', background:'#151820', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0 }}>
        <div>
          <div style={{ fontSize:15, fontWeight:700, color:'#e8eaf0', letterSpacing:'-0.3px' }}>⚡ Command Center</div>
          <div style={{ fontSize:10, color:'#4a5168' }}>Цифровая карта компании</div>
        </div>

        {/* View tabs */}
        <div style={{ display:'flex', gap:2, marginLeft:16, background:'#0f1117', borderRadius:8, padding:3, border:'1px solid rgba(255,255,255,0.07)' }}>
          {VIEWS.map(v => (
            <button key={v.id} onClick={() => setView(v.id)}
              style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 12px', borderRadius:6, border:'none', cursor:'pointer', fontSize:12, fontWeight:500, transition:'all 0.15s',
                background: view===v.id ? '#6b5ce7' : 'transparent',
                color: view===v.id ? 'white' : '#5a6480' }}>
              {v.icon} {v.label}
            </button>
          ))}
        </div>

        {/* Display mode toggle (for hierarchy view) */}
        {view === 'hierarchy' && (
          <div style={{ display:'flex', gap:2, background:'#0f1117', borderRadius:8, padding:3, border:'1px solid rgba(255,255,255,0.07)' }}>
            {(['hierarchy','relation'] as const).map(m => (
              <button key={m} onClick={() => { setDisplayMode(m); load(m==='relation'?'relation':'hierarchy'); }}
                style={{ padding:'4px 10px', borderRadius:5, border:'none', cursor:'pointer', fontSize:11, fontWeight:500,
                  background: displayMode===m ? 'rgba(107,92,231,0.3)' : 'transparent',
                  color: displayMode===m ? '#a89bf8' : '#4a5168' }}>
                {m==='hierarchy' ? '🏛️ Иерархия' : '🔗 Связи'}
              </button>
            ))}
          </div>
        )}

        {/* Search */}
        <div style={{ display:'flex', alignItems:'center', gap:6, background:'#0f1117', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'5px 10px', marginLeft:'auto', minWidth:200 }}>
          <span style={{ fontSize:12, color:'#4a5168' }}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск..."
            style={{ background:'none', border:'none', outline:'none', fontSize:12, color:'#e8eaf0', width:'100%' }} />
        </div>

        {/* Zoom controls */}
        <div style={{ display:'flex', gap:4, alignItems:'center' }}>
          <button onClick={() => setZoom(z=>Math.min(4,z*1.15))}
            style={{ width:28, height:28, borderRadius:6, border:'1px solid rgba(255,255,255,0.1)', background:'#1a1e2a', cursor:'pointer', fontSize:16, color:'#8892aa' }}>+</button>
          <span style={{ fontSize:11, color:'#4a5168', minWidth:38, textAlign:'center' }}>{Math.round(zoom*100)}%</span>
          <button onClick={() => setZoom(z=>Math.max(0.1,z/1.15))}
            style={{ width:28, height:28, borderRadius:6, border:'1px solid rgba(255,255,255,0.1)', background:'#1a1e2a', cursor:'pointer', fontSize:16, color:'#8892aa' }}>−</button>
          <button onClick={() => fitScreen(nodes)}
            style={{ height:28, padding:'0 8px', borderRadius:6, border:'1px solid rgba(255,255,255,0.1)', background:'#1a1e2a', cursor:'pointer', fontSize:11, color:'#8892aa' }}>⊡ Fit</button>
        </div>

        {/* Stats */}
        <div style={{ fontSize:11, color:'#4a5168', borderLeft:'1px solid rgba(255,255,255,0.07)', paddingLeft:10 }}>
          {nodes.length} узлов · {edges.length} связей
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* Left legend panel */}
        <div style={{ width:160, background:'#151820', borderRight:'1px solid rgba(255,255,255,0.07)', padding:'12px 10px', flexShrink:0, overflowY:'auto' }}>
          <div style={{ fontSize:10, fontWeight:700, color:'#4a5168', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>Легенда</div>
          {Object.entries(NODE_ICONS).map(([type, icon]) => (
            <div key={type} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
              <div style={{ width:10, height:10, borderRadius:'50%', background:NODE_COLOR[type]??'#666', flexShrink:0 }} />
              <span style={{ fontSize:11, color:'#5a6480' }}>{icon} {type}</span>
            </div>
          ))}

          <div style={{ height:1, background:'rgba(255,255,255,0.07)', margin:'10px 0' }} />
          <div style={{ fontSize:10, fontWeight:700, color:'#4a5168', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>Связи</div>
          {Object.entries(EDGE_STYLE).map(([kind, s]) => (
            <div key={kind} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
              <svg width={30} height={10}>
                <line x1={0} y1={5} x2={30} y2={5} stroke={s.stroke} strokeWidth={s.width} strokeDasharray={s.dash} />
              </svg>
              <span style={{ fontSize:11, color:'#5a6480' }}>{
                kind==='hierarchy'?'Иерархия':kind==='relation'?'Связь':kind==='work'?'Рабочая':'Документ'
              }</span>
            </div>
          ))}

          <div style={{ height:1, background:'rgba(255,255,255,0.07)', margin:'10px 0' }} />
          <div style={{ fontSize:10, color:'#4a5168', lineHeight:1.5 }}>
            Клик — детали<br/>
            Двойной клик — открыть<br/>
            Перетащи — переместить<br/>
            Скролл — зум
          </div>
        </div>

        {/* Graph area */}
        <div ref={containerRef} style={{ flex:1, position:'relative', overflow:'hidden' }}>
          {loading && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', zIndex:5, background:'rgba(15,17,23,0.8)', backdropFilter:'blur(8px)' }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:36, marginBottom:8 }}>⚡</div>
                <div style={{ fontSize:14, color:'#8892aa', fontWeight:500 }}>Строим карту...</div>
              </div>
            </div>
          )}

          {view === 'timeline' ? (
            <TimelineView logs={activityLog} />
          ) : (
            <svg ref={svgRef} width="100%" height="100%"
              onMouseDown={onBgMouseDown}
              onMouseMove={onMouseMove}
              onMouseUp={onMouseUp}
              onMouseLeave={onMouseUp}
              style={{ cursor: isPanning ? 'grabbing' : dragging ? 'grabbing' : 'grab' }}>

              {/* Background */}
              <rect width="100%" height="100%" fill="#0f1117" />

              {/* Dot grid */}
              <pattern id="dots" x={(pan.x % (24*zoom))} y={(pan.y % (24*zoom))} width={24*zoom} height={24*zoom} patternUnits="userSpaceOnUse">
                <circle cx={1} cy={1} r={0.7} fill="rgba(255,255,255,0.06)" />
              </pattern>
              <rect width="100%" height="100%" fill="url(#dots)" />

              {/* Depth bands */}
              <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
                {Array.from({length:maxDepth+1},(_,d)=>{
                  const bandNodes = nodes.filter(n=>n.depth===d);
                  if (!bandNodes.length) return null;
                  const minY = Math.min(...bandNodes.map(n=>n.y)) - NODE_H/2 - 12;
                  const maxY = Math.max(...bandNodes.map(n=>n.y)) + NODE_H/2 + 12;
                  return (
                    <rect key={d} x={-3000} y={minY} width={6000} height={maxY-minY}
                      fill={d%2===0?'rgba(255,255,255,0.01)':'rgba(255,255,255,0.015)'} />
                  );
                })}

                {/* Edges */}
                <g>
                  {visibleEdges.map(e => {
                    const st = EDGE_STYLE[e.kind] ?? EDGE_STYLE.hierarchy;
                    const d = edgePath(e);
                    if (!d) return null;
                    const isHighlighted = selected && (selected.id===e.source||selected.id===e.target);
                    return (
                      <path key={e.id} d={d} fill="none"
                        stroke={isHighlighted ? '#a89bf8' : st.stroke}
                        strokeWidth={isHighlighted ? 2 : st.width}
                        strokeDasharray={st.dash}
                        strokeOpacity={isHighlighted ? 0.9 : 0.5}
                        markerEnd={e.kind==='hierarchy'?'url(#arrow)':undefined} />
                    );
                  })}
                </g>

                {/* Arrow marker */}
                <defs>
                  <marker id="arrow" viewBox="0 0 8 8" refX={7} refY={4} markerWidth={6} markerHeight={6} orient="auto">
                    <path d="M1 1L7 4L1 7" fill="none" stroke="#555" strokeWidth={1.2} strokeLinecap="round" strokeLinejoin="round" />
                  </marker>
                </defs>

                {/* Nodes */}
                {visibleNodes.map(node => {
                  const color = NODE_COLOR[node.type] ?? '#6b7280';
                  const isSelected = selected?.id === node.id;
                  const isConnected = selected && edges.some(e=>(e.source===selected.id&&e.target===node.id)||(e.target===selected.id&&e.source===node.id));
                  const dimmed = selected && !isSelected && !isConnected;

                  return (
                    <g key={node.id} data-node="true"
                      transform={`translate(${node.x - NODE_W/2},${node.y - NODE_H/2})`}
                      onClick={e => onNodeClick(e, node)}
                      onDoubleClick={() => onNodeDblClick(node)}
                      onMouseDown={e => onNodeMouseDown(e, node)}
                      style={{ cursor:'pointer', userSelect:'none', opacity: dimmed ? 0.25 : 1, transition:'opacity 0.2s' }}>

                      {/* Card shadow */}
                      {isSelected && <rect x={-3} y={-3} width={NODE_W+6} height={NODE_H+6} rx={10} fill={color} fillOpacity={0.2} />}

                      {/* Card background */}
                      <rect width={NODE_W} height={NODE_H} rx={8}
                        fill={'#1a1e2a'}
                        stroke={isSelected ? color : isConnected ? color+'80' : 'rgba(255,255,255,0.1)'}
                        strokeWidth={isSelected ? 2 : isConnected ? 1.5 : 1} />

                      {/* Left accent bar */}
                      <rect x={0} y={0} width={4} height={NODE_H} rx={4} fill={color} />
                      <rect x={0} y={0} width={4} height={NODE_H} rx={0} fill={color} />
                      <rect x={0} y={0} width={4} height={NODE_H} rx={4} ry={4} fill={color}
                        style={{ borderRadius:'4px 0 0 4px' }} />

                      {/* Icon */}
                      <text x={18} y={NODE_H/2} textAnchor="middle" dominantBaseline="central" fontSize={14}>
                        {NODE_ICONS[node.type] ?? '•'}
                      </text>

                      {/* Type label */}
                      <text x={28} y={14} fontSize={8} fontWeight={700} fill={color} letterSpacing={0.3}>
                        {node.type}
                      </text>

                      {/* Main label */}
                      <text x={28} y={30} fontSize={11} fontWeight={600} fill="#e8eaf0">
                        {node.label.length > 14 ? node.label.slice(0,13)+'…' : node.label}
                      </text>

                      {/* Sublabel */}
                      {node.sublabel && (
                        <text x={28} y={43} fontSize={9} fill="#4a5168">
                          {node.sublabel.length > 18 ? node.sublabel.slice(0,17)+'…' : node.sublabel}
                        </text>
                      )}

                      {/* Children count badge */}
                      {node.children.length > 0 && (
                        <g transform={`translate(${NODE_W-14}, ${NODE_H/2-7})`}>
                          <rect width={14} height={14} rx={7} fill={color} fillOpacity={0.3} />
                          <text x={7} y={7} textAnchor="middle" dominantBaseline="central" fontSize={8} fontWeight={700} fill={color}>
                            {node.children.length}
                          </text>
                        </g>
                      )}
                    </g>
                  );
                })}
              </g>
            </svg>
          )}
        </div>

        {/* Right detail panel */}
        {selected && (
          <div style={{ width:260, background:'#151820', borderLeft:'1px solid rgba(255,255,255,0.07)', overflowY:'auto', flexShrink:0 }}>
            <div style={{ padding:'14px 14px 10px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:8, marginBottom:8 }}>
                <span style={{ fontSize:22 }}>{NODE_ICONS[selected.type]}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:12, fontWeight:700, color:NODE_COLOR[selected.type], marginBottom:1 }}>{selected.type}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#e8eaf0', lineHeight:1.3 }}>{selected.label}</div>
                  {selected.sublabel && <div style={{ fontSize:11, color:'#4a5168', marginTop:2 }}>{selected.sublabel}</div>}
                </div>
                <button onClick={()=>setSelected(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#4a5168', fontSize:16, flexShrink:0 }}>✕</button>
              </div>

              {/* Meta fields */}
              {selected.meta && (
                <div style={{ display:'flex', flexDirection:'column', gap:4, marginBottom:10 }}>
                  {Object.entries(selected.meta)
                    .filter(([k]) => ['status','priority','marketplace','articleId','price','email','role','position'].includes(k))
                    .map(([k,v]) => (
                    <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:11, gap:8 }}>
                      <span style={{ color:'#4a5168' }}>{k}</span>
                      <span style={{ color:'#8892aa', fontWeight:500, textAlign:'right', overflow:'hidden', textOverflow:'ellipsis' }}>{String(v)}</span>
                    </div>
                  ))}
                </div>
              )}

              <button onClick={()=>onNodeDblClick(selected)}
                style={{ width:'100%', padding:'8px', background:'#6b5ce7', color:'white', border:'none', borderRadius:7, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                Открыть карточку →
              </button>
            </div>

            {/* Connected nodes */}
            <div style={{ padding:'10px 14px' }}>
              <div style={{ fontSize:10, fontWeight:700, color:'#4a5168', textTransform:'uppercase', letterSpacing:'0.5px', marginBottom:8 }}>
                Связанные ({edges.filter(e=>e.source===selected.id||e.target===selected.id).length})
              </div>
              {edges.filter(e=>e.source===selected.id||e.target===selected.id).map(e => {
                const otherId = e.source===selected.id ? e.target : e.source;
                const other = nodes.find(n=>n.id===otherId);
                if (!other) return null;
                const st = EDGE_STYLE[e.kind];
                return (
                  <div key={e.id} onClick={() => setSelected(other)}
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 8px', borderRadius:6, cursor:'pointer', marginBottom:2 }}
                    onMouseEnter={el=>(el.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.05)'}
                    onMouseLeave={el=>(el.currentTarget as HTMLElement).style.background='transparent'}>
                    <div style={{ width:8, height:8, borderRadius:'50%', background:NODE_COLOR[other.type]??'#666', flexShrink:0 }} />
                    <span style={{ fontSize:12, color:'#8892aa', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{other.label}</span>
                    <svg width={20} height={8}><line x1={0} y1={4} x2={20} y2={4} stroke={st.stroke} strokeWidth={st.width} strokeDasharray={st.dash} /></svg>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Timeline View ────────────────────────────────────────────────────────────
function TimelineView({ logs }: { logs: any[] }) {
  const ICONS: Record<string,string> = { CREATED:'✨', UPDATED:'✏️', STATUS_CHANGED:'🔄', ASSIGNED:'👤', LINKED:'🔗', COMMENTED:'💬', DELETED:'🗑️' };
  const LABELS: Record<string,string> = { CREATED:'Создано', UPDATED:'Обновлено', STATUS_CHANGED:'Статус', ASSIGNED:'Назначен', LINKED:'Связь', COMMENTED:'Комментарий', DELETED:'Удалено' };

  if (!logs.length) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100%', flexDirection:'column', gap:8, background:'#0f1117' }}>
      <div style={{ fontSize:40 }}>📅</div>
      <p style={{ fontSize:14, color:'#4a5168' }}>История будет накапливаться по мере работы</p>
    </div>
  );

  return (
    <div style={{ overflowY:'auto', height:'100%', background:'#0f1117', padding:'24px 32px' }}>
      <div style={{ maxWidth:600, margin:'0 auto' }}>
        <h2 style={{ fontSize:16, fontWeight:700, color:'#e8eaf0', marginBottom:20 }}>📅 Timeline компании</h2>
        {logs.map((log, i) => (
          <div key={log.id} style={{ display:'flex', gap:12, paddingBottom:14, position:'relative' }}>
            {i < logs.length-1 && <div style={{ position:'absolute', left:14, top:28, bottom:0, width:1, background:'rgba(255,255,255,0.07)' }} />}
            <div style={{ width:28, height:28, borderRadius:'50%', background:'rgba(107,92,231,0.2)', border:'1px solid rgba(107,92,231,0.4)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0, zIndex:1 }}>
              {ICONS[log.action]??'•'}
            </div>
            <div style={{ flex:1, paddingTop:3 }}>
              <div style={{ display:'flex', alignItems:'baseline', gap:8, flexWrap:'wrap' }}>
                <span style={{ fontSize:13, fontWeight:600, color:'#a89bf8' }}>{LABELS[log.action]??log.action}</span>
                {log.actorName && <span style={{ fontSize:11, color:'#4a5168' }}>· {log.actorName}</span>}
                <span style={{ fontSize:10, color:'#2e3348', marginLeft:'auto' }}>{new Date(log.createdAt).toLocaleString('ru')}</span>
              </div>
              {log.newValue && <p style={{ fontSize:12, color:'#5a6480', margin:'2px 0 0' }}>{log.newValue}</p>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
