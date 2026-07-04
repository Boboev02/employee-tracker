'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = 'https://employee-tracker.ru';

// ─── Types ────────────────────────────────────────────────────────────────────
interface GNode {
  id: string;
  type: 'ORG' | 'DEPARTMENT' | 'PROJECT' | 'TASK' | 'SUBTASK' | 'EMPLOYEE' | 'ATTACHMENT' | 'ORPHAN';
  label: string;
  sublabel?: string;
  parentId: string | null;
  children: string[];
  depth: number;
  x: number;
  y: number;
  meta?: any;
  isOrphan?: boolean;
}

interface GEdge {
  id: string;
  source: string;
  target: string;
  kind: 'parent' | 'assignee' | 'member' | 'subtask' | 'attachment';
}

// ─── Visual ───────────────────────────────────────────────────────────────────
const COLOR: Record<string, string> = {
  ORG:        '#6b5ce7',
  DEPARTMENT: '#d4a017',
  PROJECT:    '#9b59b6',
  TASK:       '#3498db',
  SUBTASK:    '#2980b9',
  EMPLOYEE:   '#27ae60',
  ATTACHMENT: '#95a5a6',
  ORPHAN:     '#444',
};
const ICON: Record<string, string> = {
  ORG:'🏛️', DEPARTMENT:'🏢', PROJECT:'📁', TASK:'✅',
  SUBTASK:'☑️', EMPLOYEE:'👤', ATTACHMENT:'📎', ORPHAN:'❓',
};
const EDGE_COLOR: Record<string, string> = {
  parent:     '#555',
  assignee:   '#27ae60',
  member:     '#16a085',
  subtask:    '#3498db',
  attachment: '#95a5a6',
};
const EDGE_DASH: Record<string, string | undefined> = {
  parent:     undefined,
  assignee:   '4,3',
  member:     '4,3',
  subtask:    undefined,
  attachment: '2,3',
};

const NODE_W = 150;
const NODE_H = 54;
const H_GAP  = 24;
const V_GAP  = 80;

// ─── Tree layout ──────────────────────────────────────────────────────────────
function treeLayout(nodes: GNode[]): GNode[] {
  const map = new Map(nodes.map(n => [n.id, n]));

  // Compute subtree widths bottom-up
  const subtreeWidth = (id: string): number => {
    const n = map.get(id);
    if (!n || !n.children.length) return NODE_W + H_GAP;
    return Math.max(NODE_W + H_GAP, n.children.reduce((s, c) => s + subtreeWidth(c), 0));
  };

  // Place nodes recursively
  const place = (id: string, x: number, depth: number) => {
    const n = map.get(id);
    if (!n) return;
    n.depth = depth;
    n.y = depth * (NODE_H + V_GAP) + NODE_H / 2;

    if (!n.children.length) {
      n.x = x;
      return;
    }
    const totalW = n.children.reduce((s, c) => s + subtreeWidth(c), 0);
    let cx = x - totalW / 2;
    for (const cid of n.children) {
      const w = subtreeWidth(cid);
      place(cid, cx + w / 2, depth + 1);
      cx += w;
    }
    n.x = n.children.reduce((s, c) => s + (map.get(c)?.x ?? 0), 0) / n.children.length;
  };

  const roots = nodes.filter(n => !n.parentId || !map.has(n.parentId));
  let totalW = roots.reduce((s, r) => s + subtreeWidth(r.id), 0);
  let cx = -totalW / 2;
  for (const r of roots) {
    const w = subtreeWidth(r.id);
    place(r.id, cx + w / 2, 0);
    cx += w;
  }
  return nodes;
}

// ─── Main ─────────────────────────────────────────────────────────────────────
export default function CommandCenterPage() {
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [token, setToken] = useState('');
  const [nodes, setNodes] = useState<GNode[]>([]);
  const [edges, setEdges] = useState<GEdge[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<GNode | null>(null);
  const [search, setSearch] = useState('');
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(0.75);
  const [size, setSize] = useState({ w: 1200, h: 700 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0, px: 0, py: 0 });
  const [dragging, setDragging] = useState<{ id: string; ox: number; oy: number } | null>(null);
  const [showOrphans, setShowOrphans] = useState(true);
  const [filterType, setFilterType] = useState<string>('ALL');

  const h = useCallback(() => ({ Authorization: `Bearer ${token}` }), [token]);

  const apiFetch = useCallback(async (url: string): Promise<any> => {
    try {
      const r = await fetch(url, { headers: h() });
      if (!r.ok) return {};
      return r.json();
    } catch { return {}; }
  }, [h]);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
  }, []);

  useEffect(() => { if (token) build(); }, [token]);

  // ── Wheel zoom ───────────────────────────────────────────────────────────────
  const onWheel = useCallback((e: WheelEvent) => {
    e.preventDefault();
    setZoom(z => Math.max(0.1, Math.min(4, z * (e.deltaY > 0 ? 0.93 : 1.08))));
  }, []);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [onWheel]);

  useEffect(() => {
    const ro = new ResizeObserver(entries => {
      for (const e of entries) setSize({ w: e.contentRect.width, h: e.contentRect.height });
    });
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  const fitScreen = useCallback((ns: GNode[]) => {
    if (!ns.length) return;
    const xs = ns.map(n => n.x), ys = ns.map(n => n.y);
    const minX = Math.min(...xs) - NODE_W / 2 - 60;
    const maxX = Math.max(...xs) + NODE_W / 2 + 60;
    const minY = Math.min(...ys) - NODE_H / 2 - 40;
    const maxY = Math.max(...ys) + NODE_H / 2 + 40;
    const z = Math.min(size.w / (maxX - minX), size.h / (maxY - minY), 1.2);
    const cx = (minX + maxX) / 2, cy = (minY + maxY) / 2;
    setZoom(z);
    setPan({ x: size.w / 2 - cx * z, y: size.h / 2 - cy * z });
  }, [size]);

  // ── Build graph from real data ────────────────────────────────────────────────
  const build = async () => {
    setLoading(true);
    try {
      // Fetch all data
      const [deptD, projD, empD, taskD] = await Promise.all([
        apiFetch(`${API}/api/v1/dictionaries/departments`),
        apiFetch(`${API}/api/v1/projects?limit=50`),
        apiFetch(`${API}/api/v1/employees?limit=100`),
        apiFetch(`${API}/api/v1/tasks?limit=100&parentId=null`),
      ]);

      const depts = Array.isArray(deptD) ? deptD : [];
      const projs = Array.isArray(projD) ? projD : (projD.data ?? []);
      const emps  = empD.employees ?? (Array.isArray(empD) ? empD : []);
      const tasks = Array.isArray(taskD) ? taskD : (taskD.data ?? []);

      const ns: GNode[] = [];
      const es: GEdge[] = [];
      const added = new Set<string>();

      const addNode = (n: GNode) => { if (!added.has(n.id)) { ns.push(n); added.add(n.id); } };
      const addEdge = (e: GEdge) => { if (!es.find(x => x.id === e.id)) es.push(e); };

      // ── Org root ──────────────────────────────────────────────────────────────
      addNode({ id: 'org', type: 'ORG', label: 'Компания', parentId: null, children: [], depth: 0, x: 0, y: 0 });

      // ── Departments ───────────────────────────────────────────────────────────
      depts.forEach((d: any) => {
        const did = `dept_${d.id}`;
        addNode({ id: did, type: 'DEPARTMENT', label: d.name, sublabel: '', parentId: 'org', children: [], depth: 1, x: 0, y: 0, meta: d });
        ns.find(n => n.id === 'org')!.children.push(did);
        addEdge({ id: `org_${did}`, source: 'org', target: did, kind: 'parent' });
      });

      // ── Employees → Departments ───────────────────────────────────────────────
      const empAdded = new Set<string>();
      emps.forEach((e: any) => {
        const eid = `emp_${e.id}`;
        const parentDept = depts.find((d: any) => d.id === e.departmentId);
        if (parentDept) {
          const did = `dept_${parentDept.id}`;
          const sublabel = e.role ?? e.position ?? '';
          addNode({ id: eid, type: 'EMPLOYEE', label: e.name, sublabel, parentId: did, children: [], depth: 2, x: 0, y: 0, meta: e });
          const dept = ns.find(n => n.id === did);
          if (dept) dept.children.push(eid);
          addEdge({ id: `${did}_${eid}`, source: did, target: eid, kind: 'member' });
          empAdded.add(e.id);
        }
      });

      // ── Projects → Departments ────────────────────────────────────────────────
      for (const p of projs) {
        const pid = `proj_${p.id}`;
        // Try to find dept from project members
        let parentId = 'org';
        // Load project details to get members
        try {
          const pd = await apiFetch(`${API}/api/v1/projects/${p.id}`);
          const members = pd.members ?? [];
          // Find dept from first member
          if (members.length > 0) {
            const firstMember = emps.find((e: any) => e.id === (members[0].userId ?? members[0].id));
            if (firstMember?.departmentId) {
              parentId = `dept_${firstMember.departmentId}`;
            }
          }

          addNode({ id: pid, type: 'PROJECT', label: p.name.slice(0, 22), sublabel: p.status, parentId, children: [], depth: 0, x: 0, y: 0, meta: p });
          const parentNode = ns.find(n => n.id === parentId);
          if (parentNode) parentNode.children.push(pid);
          addEdge({ id: `${parentId}_${pid}`, source: parentId, target: pid, kind: 'parent' });

          // Project members → edges to project (not new nodes if already added)
          members.slice(0, 5).forEach((m: any) => {
            const mId = m.userId ?? m.id;
            const eid = `emp_${mId}`;
            if (added.has(eid)) {
              addEdge({ id: `${pid}_mem_${mId}`, source: eid, target: pid, kind: 'member' });
            } else {
              const emp = emps.find((e: any) => e.id === mId);
              if (emp) {
                addNode({ id: eid, type: 'EMPLOYEE', label: emp.name, sublabel: emp.role ?? '', parentId: pid, children: [], depth: 0, x: 0, y: 0, meta: emp });
                ns.find(n => n.id === pid)!.children.push(eid);
                addEdge({ id: `${pid}_${eid}`, source: pid, target: eid, kind: 'member' });
                empAdded.add(mId);
              }
            }
          });
        } catch {}
      }

      // ── Tasks → Projects ──────────────────────────────────────────────────────
      for (const t of tasks) {
        const tid = `task_${t.id}`;
        const parentProj = t.projectId ? `proj_${t.projectId}` : null;
        const parentId = parentProj && added.has(parentProj) ? parentProj : null;

        addNode({
          id: tid, type: 'TASK',
          label: t.title.slice(0, 22),
          sublabel: t.status,
          parentId,
          children: [], depth: 0, x: 0, y: 0, meta: t,
          isOrphan: !parentId,
        });

        if (parentId) {
          const parent = ns.find(n => n.id === parentId);
          if (parent) parent.children.push(tid);
          addEdge({ id: `${parentId}_${tid}`, source: parentId, target: tid, kind: 'parent' });
        }

        // Assignee → task
        if (t.assigneeId) {
          const eid = `emp_${t.assigneeId}`;
          if (added.has(eid)) {
            addEdge({ id: `${eid}_${tid}_assignee`, source: eid, target: tid, kind: 'assignee' });
          } else {
            const emp = emps.find((e: any) => e.id === t.assigneeId);
            if (emp) {
              addNode({ id: eid, type: 'EMPLOYEE', label: emp.name, sublabel: 'Исполнитель', parentId: tid, children: [], depth: 0, x: 0, y: 0, meta: emp });
              ns.find(n => n.id === tid)!.children.push(eid);
              addEdge({ id: `${tid}_${eid}`, source: tid, target: eid, kind: 'assignee' });
              empAdded.add(t.assigneeId);
            }
          }
        }

        // Participants (multiple assignees)
        if (t.participants && Array.isArray(t.participants)) {
          t.participants.slice(0, 3).forEach((p: any) => {
            const pid2 = p.userId ?? p.id;
            const eid = `emp_${pid2}`;
            if (pid2 !== t.assigneeId) {
              if (added.has(eid)) {
                addEdge({ id: `${eid}_${tid}_part`, source: eid, target: tid, kind: 'assignee' });
              } else {
                const emp = emps.find((e: any) => e.id === pid2);
                if (emp) {
                  addNode({ id: eid, type: 'EMPLOYEE', label: emp.name, sublabel: 'Участник', parentId: tid, children: [], depth: 0, x: 0, y: 0, meta: emp });
                  ns.find(n => n.id === tid)!.children.push(eid);
                  addEdge({ id: `${tid}_${eid}_part`, source: tid, target: eid, kind: 'assignee' });
                }
              }
            }
          });
        }

        // Load subtasks + attachments
        try {
          const subtasksD = await apiFetch(`${API}/api/v1/tasks?parentId=${t.id}&limit=10`);
          const subtasks = Array.isArray(subtasksD) ? subtasksD : (subtasksD.data ?? []);
          subtasks.forEach((st: any) => {
            const stid = `task_${st.id}`;
            addNode({ id: stid, type: 'SUBTASK', label: st.title.slice(0, 20), sublabel: st.status, parentId: tid, children: [], depth: 0, x: 0, y: 0, meta: st });
            ns.find(n => n.id === tid)!.children.push(stid);
            addEdge({ id: `${tid}_${stid}`, source: tid, target: stid, kind: 'subtask' });

            // Subtask assignee
            if (st.assigneeId) {
              const seid = `emp_${st.assigneeId}`;
              if (added.has(seid)) {
                addEdge({ id: `${seid}_${stid}_a`, source: seid, target: stid, kind: 'assignee' });
              }
            }
          });

          // Attachments
          const attD = await apiFetch(`${API}/api/v1/tasks/${t.id}/attachments`);
          const atts = Array.isArray(attD) ? attD : [];
          atts.slice(0, 3).forEach((a: any) => {
            const aid = `att_${a.id}`;
            addNode({ id: aid, type: 'ATTACHMENT', label: a.fileName.slice(0, 18), sublabel: a.mimeType?.split('/')[1], parentId: tid, children: [], depth: 0, x: 0, y: 0, meta: a });
            ns.find(n => n.id === tid)!.children.push(aid);
            addEdge({ id: `${tid}_${aid}`, source: tid, target: aid, kind: 'attachment' });
          });
        } catch {}
      }

      // ── Orphan employees (no dept, no project) ────────────────────────────────
      emps.filter((e: any) => !empAdded.has(e.id)).forEach((e: any) => {
        const eid = `emp_${e.id}`;
        addNode({ id: eid, type: 'EMPLOYEE', label: e.name, sublabel: 'Без отдела', parentId: null, children: [], depth: 0, x: 0, y: 0, meta: e, isOrphan: true });
      });

      // Update sublabel for depts with employee count
      depts.forEach((d: any) => {
        const did = `dept_${d.id}`;
        const node = ns.find(n => n.id === did);
        if (node) {
          const cnt = emps.filter((e: any) => e.departmentId === d.id).length;
          node.sublabel = `${cnt} сотр.`;
        }
      });

      // Layout
      const laid = treeLayout(ns);
      setNodes(laid);
      setEdges(es);
      setTimeout(() => fitScreen(laid), 100);
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  // ── SVG interactions ──────────────────────────────────────────────────────────
  const svgToWorld = (ex: number, ey: number) => {
    const rect = svgRef.current!.getBoundingClientRect();
    return { x: (ex - rect.left - pan.x) / zoom, y: (ey - rect.top - pan.y) / zoom };
  };

  const onBgDown = (e: React.MouseEvent) => {
    if ((e.target as Element).closest('[data-node]')) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX, y: e.clientY, px: pan.x, py: pan.y };
  };

  const onMouseMove = (e: React.MouseEvent) => {
    if (isPanning) setPan({ x: panStart.current.px + e.clientX - panStart.current.x, y: panStart.current.py + e.clientY - panStart.current.y });
    if (dragging) {
      const wp = svgToWorld(e.clientX, e.clientY);
      setNodes(prev => prev.map(n => n.id === dragging.id ? { ...n, x: wp.x - dragging.ox, y: wp.y - dragging.oy } : n));
    }
  };
  const onMouseUp = () => { setIsPanning(false); setDragging(null); };

  const onNodeDown = (e: React.MouseEvent, node: GNode) => {
    e.stopPropagation();
    const wp = svgToWorld(e.clientX, e.clientY);
    setDragging({ id: node.id, ox: wp.x - node.x, oy: wp.y - node.y });
  };

  const onNodeClick = (e: React.MouseEvent, node: GNode) => {
    e.stopPropagation();
    setSelected(s => s?.id === node.id ? null : node);
  };

  const onNodeDblClick = (node: GNode) => {
    const id = node.id.split('_').slice(1).join('_');
    const routes: Record<string, string> = {
      PROJECT: `/dashboard/projects/${id}`,
      TASK:    `/dashboard/tasks/${id}`,
      SUBTASK: `/dashboard/tasks/${id}`,
      EMPLOYEE:`/dashboard/employees/${id}`,
    };
    if (routes[node.type]) router.push(routes[node.type]);
  };

  // ── Filter ─────────────────────────────────────────────────────────────────
  const visible = nodes.filter(n => {
    if (!showOrphans && n.isOrphan) return false;
    if (filterType !== 'ALL' && n.type !== filterType && n.type !== 'ORG') return false;
    if (search && !n.label.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });
  const visIds = new Set(visible.map(n => n.id));
  const visEdges = edges.filter(e => visIds.has(e.source) && visIds.has(e.target));

  // ── Edge path ──────────────────────────────────────────────────────────────
  const edgePath = (e: GEdge): string => {
    const s = nodes.find(n => n.id === e.source);
    const t = nodes.find(n => n.id === e.target);
    if (!s || !t) return '';
    if (e.kind === 'parent' || e.kind === 'subtask') {
      const sx = s.x, sy = s.y + NODE_H / 2;
      const tx = t.x, ty = t.y - NODE_H / 2;
      const my = (sy + ty) / 2;
      return `M${sx},${sy} L${sx},${my} L${tx},${my} L${tx},${ty}`;
    }
    // Curved for relations
    const sx = s.x + NODE_W / 2, sy = s.y;
    const tx = t.x - NODE_W / 2, ty = t.y;
    return `M${sx},${sy} C${sx + 40},${sy} ${tx - 40},${ty} ${tx},${ty}`;
  };

  const maxDepth = visible.length ? Math.max(...visible.map(n => n.depth)) : 0;

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'#0d0f14', color:'#e8eaf0', fontFamily:'Inter,sans-serif', overflow:'hidden' }}>

      {/* ── Top bar ── */}
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'8px 16px', background:'#151820', borderBottom:'1px solid rgba(255,255,255,0.07)', flexShrink:0, flexWrap:'wrap' }}>
        <div>
          <div style={{ fontSize:15, fontWeight:700, letterSpacing:'-0.3px' }}>⚡ Command Center</div>
          <div style={{ fontSize:10, color:'#4a5168' }}>Карта связей компании</div>
        </div>

        {/* Filters */}
        <div style={{ display:'flex', gap:2, background:'#0d0f14', borderRadius:8, padding:3, border:'1px solid rgba(255,255,255,0.07)' }}>
          {['ALL','DEPARTMENT','PROJECT','TASK','EMPLOYEE'].map(t => (
            <button key={t} onClick={() => setFilterType(t)}
              style={{ padding:'4px 10px', borderRadius:5, border:'none', cursor:'pointer', fontSize:11, fontWeight:500, transition:'all 0.15s',
                background: filterType===t ? '#6b5ce7' : 'transparent',
                color: filterType===t ? 'white' : '#4a5168' }}>
              {ICON[t] ?? ''} {t === 'ALL' ? 'Все' : t}
            </button>
          ))}
        </div>

        {/* Search */}
        <div style={{ display:'flex', alignItems:'center', gap:6, background:'#0d0f14', border:'1px solid rgba(255,255,255,0.1)', borderRadius:8, padding:'5px 10px', minWidth:180 }}>
          <span style={{ color:'#4a5168' }}>🔍</span>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Поиск..."
            style={{ background:'none', border:'none', outline:'none', fontSize:12, color:'#e8eaf0', width:'100%' }} />
        </div>

        {/* Orphans toggle */}
        <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:12, color:'#5a6480' }}>
          <input type="checkbox" checked={showOrphans} onChange={e=>setShowOrphans(e.target.checked)} style={{ accentColor:'#6b5ce7' }} />
          Без связей
        </label>

        {/* Zoom */}
        <div style={{ display:'flex', gap:4, alignItems:'center', marginLeft:'auto' }}>
          <button onClick={() => setZoom(z=>Math.min(4,z*1.15))} style={zBtn}>+</button>
          <span style={{ fontSize:11, color:'#4a5168', minWidth:36, textAlign:'center' }}>{Math.round(zoom*100)}%</span>
          <button onClick={() => setZoom(z=>Math.max(0.1,z/1.15))} style={zBtn}>−</button>
          <button onClick={() => fitScreen(nodes)} style={{ ...zBtn, width:'auto', padding:'0 8px', fontSize:10 }}>⊡ Fit</button>
          <button onClick={build} style={{ ...zBtn, width:'auto', padding:'0 8px', fontSize:10 }}>↺ Обновить</button>
        </div>

        <div style={{ fontSize:11, color:'#4a5168', borderLeft:'1px solid rgba(255,255,255,0.07)', paddingLeft:10 }}>
          {visible.length} узлов · {visEdges.length} связей
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* Legend */}
        <div style={{ width:150, background:'#151820', borderRight:'1px solid rgba(255,255,255,0.07)', padding:'12px 10px', flexShrink:0, overflowY:'auto' }}>
          <div style={sectionLabel}>Объекты</div>
          {Object.entries(ICON).map(([type, icon]) => (
            <div key={type} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
              <div style={{ width:8, height:8, borderRadius:'50%', background:COLOR[type]??'#666', flexShrink:0 }} />
              <span style={{ fontSize:11, color:'#5a6480' }}>{icon} {type}</span>
            </div>
          ))}
          <div style={{ height:1, background:'rgba(255,255,255,0.07)', margin:'10px 0' }} />
          <div style={sectionLabel}>Связи</div>
          {(['parent','member','assignee','subtask','attachment'] as const).map(k => (
            <div key={k} style={{ display:'flex', alignItems:'center', gap:6, marginBottom:5 }}>
              <svg width={28} height={8}><line x1={0} y1={4} x2={28} y2={4} stroke={EDGE_COLOR[k]} strokeWidth={1.5} strokeDasharray={EDGE_DASH[k]} /></svg>
              <span style={{ fontSize:10, color:'#4a5168' }}>{{parent:'Иерархия',member:'Участие',assignee:'Исполнитель',subtask:'Подзадача',attachment:'Вложение'}[k]}</span>
            </div>
          ))}
          <div style={{ height:1, background:'rgba(255,255,255,0.07)', margin:'10px 0' }} />
          <div style={{ fontSize:10, color:'#2e3348', lineHeight:1.6 }}>
            Клик — детали<br/>Двойной — открыть<br/>Тащи — перемест.<br/>Скролл — зум
          </div>
        </div>

        {/* Graph */}
        <div ref={containerRef} style={{ flex:1, position:'relative', overflow:'hidden' }}>
          {loading && (
            <div style={{ position:'absolute', inset:0, display:'flex', alignItems:'center', justifyContent:'center', zIndex:10, background:'rgba(13,15,20,0.85)', backdropFilter:'blur(8px)' }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:36, marginBottom:10 }}>⚡</div>
                <div style={{ fontSize:14, color:'#8892aa', fontWeight:500 }}>Загружаем данные из базы...</div>
                <div style={{ fontSize:11, color:'#4a5168', marginTop:4 }}>Компания → Отделы → Проекты → Задачи</div>
              </div>
            </div>
          )}

          <svg ref={svgRef} width="100%" height="100%"
            onMouseDown={onBgDown} onMouseMove={onMouseMove}
            onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            style={{ cursor: isPanning ? 'grabbing' : dragging ? 'grabbing' : 'grab' }}>

            <rect width="100%" height="100%" fill="#0d0f14" />
            <pattern id="dots" x={pan.x%(20*zoom)} y={pan.y%(20*zoom)} width={20*zoom} height={20*zoom} patternUnits="userSpaceOnUse">
              <circle cx={1} cy={1} r={0.6} fill="rgba(255,255,255,0.05)" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#dots)" />

            <defs>
              <marker id="arr" viewBox="0 0 8 8" refX={7} refY={4} markerWidth={5} markerHeight={5} orient="auto">
                <path d="M1 1L7 4L1 7" fill="none" stroke="#555" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
              </marker>
            </defs>

            <g transform={`translate(${pan.x},${pan.y}) scale(${zoom})`}>
              {/* Depth bands */}
              {Array.from({length:maxDepth+1},(_,d)=>{
                const band = visible.filter(n=>n.depth===d);
                if (!band.length) return null;
                const minY = Math.min(...band.map(n=>n.y))-NODE_H/2-10;
                const maxY = Math.max(...band.map(n=>n.y))+NODE_H/2+10;
                return <rect key={d} x={-9999} y={minY} width={19998} height={maxY-minY} fill={d%2===0?'rgba(255,255,255,0.008)':'rgba(255,255,255,0.014)'} />;
              })}

              {/* Edges */}
              {visEdges.map(e => {
                const d = edgePath(e);
                if (!d) return null;
                const hl = selected && (selected.id===e.source||selected.id===e.target);
                return (
                  <path key={e.id} d={d} fill="none"
                    stroke={hl ? '#a89bf8' : EDGE_COLOR[e.kind]}
                    strokeWidth={hl ? 2 : 1}
                    strokeDasharray={EDGE_DASH[e.kind]}
                    strokeOpacity={hl ? 1 : 0.45}
                    markerEnd={e.kind==='parent'||e.kind==='subtask'?'url(#arr)':undefined} />
                );
              })}

              {/* Nodes */}
              {visible.map(node => {
                const color = COLOR[node.type] ?? '#666';
                const isSel = selected?.id === node.id;
                const isConn = selected && visEdges.some(e=>(e.source===selected.id&&e.target===node.id)||(e.target===selected.id&&e.source===node.id));
                const dim = selected && !isSel && !isConn;

                return (
                  <g key={node.id} data-node="true"
                    transform={`translate(${node.x-NODE_W/2},${node.y-NODE_H/2})`}
                    style={{ cursor:'pointer', opacity: dim?0.18:1, transition:'opacity 0.2s' }}
                    onClick={e=>onNodeClick(e,node)}
                    onDoubleClick={()=>onNodeDblClick(node)}
                    onMouseDown={e=>onNodeDown(e,node)}>

                    {isSel && <rect x={-4} y={-4} width={NODE_W+8} height={NODE_H+8} rx={11} fill={color} fillOpacity={0.18} />}

                    {/* Card */}
                    <rect width={NODE_W} height={NODE_H} rx={8} fill="#1a1e2a"
                      stroke={isSel ? color : isConn ? color+'90' : node.isOrphan ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.1)'}
                      strokeWidth={isSel?2:isConn?1.5:1}
                      strokeDasharray={node.isOrphan?'4,3':undefined} />

                    {/* Left bar */}
                    <rect x={0} y={0} width={4} height={NODE_H} rx={2} fill={color} />

                    {/* Icon */}
                    <text x={18} y={NODE_H/2} textAnchor="middle" dominantBaseline="central" fontSize={15}>{ICON[node.type]??'•'}</text>

                    {/* Type */}
                    <text x={28} y={13} fontSize={8} fontWeight={700} fill={color} letterSpacing={0.3}>{node.type}</text>

                    {/* Label */}
                    <text x={28} y={29} fontSize={11} fontWeight={600} fill="#e8eaf0">
                      {node.label.length>14?node.label.slice(0,13)+'…':node.label}
                    </text>

                    {/* Sublabel */}
                    {node.sublabel && (
                      <text x={28} y={44} fontSize={9} fill="#4a5168">
                        {node.sublabel.length>18?node.sublabel.slice(0,17)+'…':node.sublabel}
                      </text>
                    )}

                    {/* Children badge */}
                    {node.children.length > 0 && (
                      <g transform={`translate(${NODE_W-14},${NODE_H/2-7})`}>
                        <rect width={14} height={14} rx={7} fill={color} fillOpacity={0.25} />
                        <text x={7} y={7} textAnchor="middle" dominantBaseline="central" fontSize={8} fontWeight={700} fill={color}>{node.children.length}</text>
                      </g>
                    )}

                    {/* Orphan indicator */}
                    {node.isOrphan && (
                      <text x={NODE_W-8} y={10} fontSize={9} fill="#4a5168" textAnchor="middle">?</text>
                    )}
                  </g>
                );
              })}
            </g>
          </svg>
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{ width:250, background:'#151820', borderLeft:'1px solid rgba(255,255,255,0.07)', overflowY:'auto', flexShrink:0 }}>
            <div style={{ padding:'14px', borderBottom:'1px solid rgba(255,255,255,0.07)' }}>
              <div style={{ display:'flex', alignItems:'flex-start', gap:8 }}>
                <span style={{ fontSize:22 }}>{ICON[selected.type]}</span>
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:COLOR[selected.type], marginBottom:1 }}>{selected.type}</div>
                  <div style={{ fontSize:13, fontWeight:600, color:'#e8eaf0', lineHeight:1.3 }}>{selected.label}</div>
                  {selected.sublabel && <div style={{ fontSize:11, color:'#4a5168', marginTop:2 }}>{selected.sublabel}</div>}
                  {selected.isOrphan && <div style={{ fontSize:10, color:'#e67e22', marginTop:4 }}>⚠ Нет связей</div>}
                </div>
                <button onClick={()=>setSelected(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#4a5168', fontSize:16 }}>✕</button>
              </div>

              {selected.meta && (
                <div style={{ marginTop:10, display:'flex', flexDirection:'column', gap:3 }}>
                  {Object.entries(selected.meta)
                    .filter(([k]) => ['status','priority','marketplace','email','role','position','price'].includes(k))
                    .map(([k,v]) => (
                      <div key={k} style={{ display:'flex', justifyContent:'space-between', fontSize:11 }}>
                        <span style={{ color:'#4a5168' }}>{k}</span>
                        <span style={{ color:'#8892aa' }}>{String(v)}</span>
                      </div>
                  ))}
                </div>
              )}

              {['PROJECT','TASK','SUBTASK','EMPLOYEE'].includes(selected.type) && (
                <button onClick={()=>onNodeDblClick(selected)}
                  style={{ width:'100%', marginTop:10, padding:'7px', background:'#6b5ce7', color:'white', border:'none', borderRadius:6, fontSize:12, fontWeight:600, cursor:'pointer' }}>
                  Открыть →
                </button>
              )}
            </div>

            <div style={{ padding:'10px 14px' }}>
              <div style={sectionLabel}>Связанные ({visEdges.filter(e=>e.source===selected.id||e.target===selected.id).length})</div>
              {visEdges.filter(e=>e.source===selected.id||e.target===selected.id).map(e => {
                const oid = e.source===selected.id?e.target:e.source;
                const other = nodes.find(n=>n.id===oid);
                if (!other) return null;
                return (
                  <div key={e.id} onClick={()=>setSelected(other)}
                    style={{ display:'flex', alignItems:'center', gap:8, padding:'5px 6px', borderRadius:5, cursor:'pointer' }}
                    onMouseEnter={el=>(el.currentTarget as HTMLElement).style.background='rgba(255,255,255,0.05)'}
                    onMouseLeave={el=>(el.currentTarget as HTMLElement).style.background='transparent'}>
                    <div style={{ width:7, height:7, borderRadius:'50%', background:COLOR[other.type]??'#666', flexShrink:0 }} />
                    <span style={{ fontSize:11, color:'#8892aa', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{other.label}</span>
                    <svg width={18} height={6}><line x1={0} y1={3} x2={18} y2={3} stroke={EDGE_COLOR[e.kind]} strokeWidth={1.2} strokeDasharray={EDGE_DASH[e.kind]} /></svg>
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

const zBtn: React.CSSProperties = { width:28, height:28, borderRadius:6, border:'1px solid rgba(255,255,255,0.1)', background:'#1a1e2a', cursor:'pointer', fontSize:15, color:'#8892aa', display:'flex', alignItems:'center', justifyContent:'center' };
const sectionLabel: React.CSSProperties = { fontSize:9, fontWeight:700, color:'#4a5168', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:7 };
