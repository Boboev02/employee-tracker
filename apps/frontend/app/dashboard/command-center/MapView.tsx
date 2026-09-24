'use client';
import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const API = '/api/v1';

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

// ─── Новые задачи ─────────────────────────────────────────────────────────────
/** Окно «свежести»: задача считается новой столько часов после создания. */
const NEW_TASK_WINDOW_H = 12;

/** Возраст задачи в часах, либо null если даты нет или тип не задача. */
function taskAgeHours(node: GNode): number | null {
  if (node.type !== 'TASK' && node.type !== 'SUBTASK') return null;
  const raw = node.meta?.createdAt;
  if (!raw) return null;
  const ms = Date.now() - new Date(raw).getTime();
  if (Number.isNaN(ms) || ms < 0) return null;
  return ms / 3600000;
}

/** Короткая подпись возраста: «только что», «3 ч назад». */
function ageLabel(h: number): string {
  if (h < 1) {
    const m = Math.max(1, Math.round(h * 60));
    return `${m} мин назад`;
  }
  return `${Math.round(h)} ч назад`;
}

const NEW_COLOR = '#ff8a3d';

/** Скорость бегущего пунктира по типам связей, секунд на цикл. */
const EDGE_FLOW_SPEED: Record<string, number> = {
  parent:     2.2,
  subtask:    1.6,
  assignee:   1.2,
  member:     1.8,
  attachment: 2.6,
};

/** Инициалы: «Иван Петров» → «ИП», «Boboev» → «BO». */
function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0] ?? '?').slice(0, 2).toUpperCase();
}

// ─── Состояния задачи ─────────────────────────────────────────────────────────
type NodeState = 'blocked' | 'overdue' | 'unassigned' | 'done' | null;

const STATE_COLOR: Record<string, string> = {
  blocked:    '#ba7517',
  overdue:    '#e24b4a',
  unassigned: '#ba7517',
};

/**
 * Что именно не так с задачей. Приоритет: заблокирована важнее просрочки,
 * просрочка важнее отсутствия исполнителя — показываем самое серьёзное.
 */
function nodeState(node: GNode): NodeState {
  if (node.type !== 'TASK' && node.type !== 'SUBTASK') return null;
  const m = node.meta;
  if (!m) return null;
  if (m.status === 'DONE') return 'done';
  if (m.status === 'BLOCKED') return 'blocked';
  if (m.dueDate && new Date(m.dueDate).getTime() < Date.now()) return 'overdue';
  const hasAssignee = !!m.assignee || !!m.assigneeId ||
    (Array.isArray(m.assigneeIds) && m.assigneeIds.length > 0);
  if (!hasAssignee) return 'unassigned';
  return null;
}

/** На сколько дней просрочена. */
function overdueDays(node: GNode): number {
  const raw = node.meta?.dueDate;
  if (!raw) return 0;
  return Math.max(1, Math.floor((Date.now() - new Date(raw).getTime()) / 86400000));
}

const NODE_W = 150;
const NODE_H = 54;
const H_GAP  = 24;
const V_GAP  = 80;

// ─── Tree layout ──────────────────────────────────────────────────────────────
/** Вертикальный шаг между задачами в столбике. */
const STACK_V_GAP = 12;

/** Типы, которые складываются столбиком под родителем, а не в строку. */
const STACKABLE = new Set(['TASK', 'SUBTASK']);

function treeLayout(nodes: GNode[]): GNode[] {
  const map = new Map(nodes.map(n => [n.id, n]));

  /** Дети — сплошь задачи без собственных детей: такие кладём столбиком. */
  const isStack = (n: GNode): boolean =>
    n.children.length > 1 &&
    n.children.every(cid => {
      const c = map.get(cid);
      return !!c && STACKABLE.has(c.type) && c.children.length === 0;
    });

  // Ширина поддерева. У столбика ширина всегда одна карточка —
  // именно это и убирает бесконечное растягивание вправо.
  const subtreeWidth = (id: string): number => {
    const n = map.get(id);
    if (!n || !n.children.length) return NODE_W + H_GAP;
    if (isStack(n)) return NODE_W + H_GAP;
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

    // Столбик: дети под родителем, друг под другом
    if (isStack(n)) {
      n.x = x;
      let cy = n.y + NODE_H / 2 + V_GAP;
      for (const cid of n.children) {
        const c = map.get(cid);
        if (!c) continue;
        c.depth = depth + 1;
        c.x = x;
        c.y = cy + NODE_H / 2;
        cy += NODE_H + STACK_V_GAP;
      }
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
export default function MapView() {
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
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const [appearedIds, setAppearedIds] = useState<Set<string>>(new Set());
  const [showOrphans, setShowOrphans] = useState(true);
  // Узлы сотрудников по умолчанию скрыты: их связи превращали карту в паутину.
  // Исполнитель виден кружком с инициалами прямо на карточке задачи.
  const [showPeople, setShowPeople] = useState(false);
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
        apiFetch(`${API}/dictionaries/departments`),
        apiFetch(`${API}/projects?limit=50`),
        apiFetch(`${API}/employees?limit=100`),
        apiFetch(`${API}/tasks?limit=100&parentId=null`),
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

      // ── Projects → Departments (using real Project.departmentId) ───────────────
      for (const p of projs) {
        const pid = `proj_${p.id}`;
        const deptId = p.departmentId ?? p.department?.id;
        const parentId = (deptId && added.has(`dept_${deptId}`)) ? `dept_${deptId}` : 'org';

        addNode({ id: pid, type: 'PROJECT', label: p.name.slice(0, 22), sublabel: p.status, parentId, children: [], depth: 0, x: 0, y: 0, meta: p, isOrphan: parentId === 'org' });
        const parentNode = ns.find(n => n.id === parentId);
        if (parentNode) parentNode.children.push(pid);
        addEdge({ id: `${parentId}_${pid}`, source: parentId, target: pid, kind: 'parent' });

        // Project members → associative edges to project (not new tree nodes, just links)
        try {
          const pd = await apiFetch(`${API}/projects/${p.id}`);
          const members = pd.members ?? [];
          members.slice(0, 5).forEach((m: any) => {
            const mId = m.userId ?? m.id;
            const eid = `emp_${mId}`;
            if (added.has(eid)) {
              addEdge({ id: `${pid}_mem_${mId}`, source: eid, target: pid, kind: 'member' });
            } else {
              const emp = emps.find((e: any) => e.id === mId);
              if (emp) {
                addNode({ id: eid, type: 'EMPLOYEE', label: emp.name, sublabel: emp.role ?? '', parentId: pid, children: [], depth: 0, x: 0, y: 0, meta: emp, isOrphan: true });
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
          const subtasksD = await apiFetch(`${API}/tasks?parentId=${t.id}&limit=10`);
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
          const attD = await apiFetch(`${API}/tasks/${t.id}/attachments`);
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
      setAppearedIds(new Set());
      setTimeout(() => fitScreen(laid), 100);

      // Cascading appear animation: reveal nodes depth by depth
      const maxD = laid.length ? Math.max(...laid.map(n => n.depth)) : 0;
      for (let d = 0; d <= maxD; d++) {
        setTimeout(() => {
          setAppearedIds(prev => {
            const next = new Set(prev);
            laid.filter(n => n.depth === d).forEach(n => next.add(n.id));
            return next;
          });
        }, 150 + d * 120);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  };

  const floorRef = useRef<HTMLDivElement>(null);
  const prefersReducedMotion = () =>
    typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

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
    if (floorRef.current && !prefersReducedMotion()) {
      const fr = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const fx = (e.clientX - fr.left) / fr.width, fy = (e.clientY - fr.top) / fr.height;
      floorRef.current.style.transform =
        'rotateX(' + (60 + (fy - 0.5) * 6).toFixed(2) + 'deg) rotateZ(' +
        ((fx - 0.5) * 4).toFixed(2) + 'deg) scale(1.9) translateY(6%)';
    }
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
    if (!showPeople && n.type === 'EMPLOYEE') return false;
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
    <>
    <style>{`
      /* Бегущий пунктир по связям */
      @keyframes cc-flow { to { stroke-dashoffset: -100; } }
      .cc-edge-flow { animation: cc-flow linear infinite; }

      /* Пульс вокруг новой задачи */
      @keyframes cc-pulse {
        0%   { opacity: 0.55; transform: scale(1); }
        70%  { opacity: 0;    transform: scale(1.12); }
        100% { opacity: 0;    transform: scale(1.12); }
      }
      .cc-new-pulse {
        animation: cc-pulse 2s ease-out infinite;
        transform-origin: center;
        transform-box: fill-box;
      }

      /* Мягкое мерцание бейджа NEW */
      @keyframes cc-badge { 0%,100% { opacity: 1; } 50% { opacity: 0.55; } }
      .cc-new-badge { animation: cc-badge 1.8s ease-in-out infinite; }

      @media (prefers-reduced-motion: reduce) {
        .cc-edge-flow, .cc-new-pulse, .cc-new-badge { animation: none; }
      }
    `}</style>
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

        {/* Люди на карте: вернуть узлы сотрудников и связи исполнителей */}
        <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:12, color:'#5a6480' }}>
          <input type="checkbox" checked={showPeople} onChange={e=>setShowPeople(e.target.checked)} style={{ accentColor:'#6b5ce7' }} />
          Люди
        </label>

        <label style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:12, color:'#5a6480' }}>
          <input type="checkbox" checked={showOrphans} onChange={e=>setShowOrphans(e.target.checked)} style={{ accentColor:'#6b5ce7' }} />
          Без связей
        </label>

        {/* Zoom */}
        <div style={{ display:'flex', gap:4, alignItems:'center', marginLeft:'auto' }}>
          <button onClick={() => setZoom(z=>Math.min(4,z*1.15))} style={zBtn}>+</button>
          <span style={{ fontSize:11, color:'#4a5168', minWidth:36, textAlign:'center' }}>{Math.round(zoom*100)}%</span>
          <button onClick={() => setZoom(z=>Math.max(0.1,z/1.15))} style={zBtn}>−</button>
          <button onClick={() => fitScreen(nodes)}
            title="Клик — детали · Двойной клик — открыть · Тащи — переместить · Скролл — зум"
            style={{ ...zBtn, width:'auto', padding:'0 8px', fontSize:10 }}>⊡ Fit</button>
          <button onClick={build} style={{ ...zBtn, width:'auto', padding:'0 8px', fontSize:10 }}>↺ Обновить</button>
        </div>

        <div style={{ fontSize:11, color:'#4a5168', borderLeft:'1px solid rgba(255,255,255,0.07)', paddingLeft:10 }}>
          {visible.length} узлов · {visEdges.length} связей
        </div>
      </div>

      {/* ── Main ── */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

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

          <div style={{ position:'absolute', inset:0, overflow:'hidden', perspective:'700px',
                        pointerEvents:'none', background:'#0d0f14' }} aria-hidden="true">
            <div ref={floorRef} className="cc-floor" />
          </div>

          <svg ref={svgRef} width="100%" height="100%"
            onMouseDown={onBgDown} onMouseMove={onMouseMove}
            onMouseUp={onMouseUp} onMouseLeave={onMouseUp}
            style={{ cursor: isPanning ? 'grabbing' : dragging ? 'grabbing' : 'grab' }}>

            <rect width="100%" height="100%" fill="rgba(13,15,20,0.72)" />
            <pattern id="dots" x={pan.x%(20*zoom)} y={pan.y%(20*zoom)} width={20*zoom} height={20*zoom} patternUnits="userSpaceOnUse">
              <circle cx={1} cy={1} r={0.6} fill="rgba(255,255,255,0.05)" />
            </pattern>
            <rect width="100%" height="100%" fill="url(#dots)" />

            <defs>
              <filter id="fx-depth" x="-40%" y="-40%" width="180%" height="180%">
                <feDropShadow dx="0" dy="6" stdDeviation="7" floodColor="#000" floodOpacity="0.55" />
              </filter>
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
                  <g key={e.id}>
                    {/* Основная линия */}
                    <path d={d} fill="none"
                      stroke={hl ? '#a89bf8' : EDGE_COLOR[e.kind]}
                      strokeWidth={hl ? 2 : 1}
                      strokeDasharray={EDGE_DASH[e.kind]}
                      strokeOpacity={hl ? 1 : 0.45}
                      markerEnd={e.kind==='parent'||e.kind==='subtask'?'url(#arr)':undefined} />
                    {/* Бегущий пунктир поверх: показывает направление связи */}
                    <path d={d} fill="none"
                      className="cc-edge-flow"
                      stroke={hl ? '#c9beff' : EDGE_COLOR[e.kind]}
                      strokeWidth={hl ? 2.4 : 1.6}
                      strokeLinecap="round"
                      strokeDasharray="6,14"
                      strokeOpacity={hl ? 0.95 : 0.5}
                      style={{ animationDuration: `${EDGE_FLOW_SPEED[e.kind] ?? 2}s` }} />
                  </g>
                );
              })}

              {/* Nodes */}
              {visible.map(node => {
                const color = COLOR[node.type] ?? '#666';
                const isSel = selected?.id === node.id;
                const isConn = selected && visEdges.some(e=>(e.source===selected.id&&e.target===node.id)||(e.target===selected.id&&e.source===node.id));
                const dim = selected && !isSel && !isConn;
                const isHovered = hoveredId === node.id && !dragging;
                const assigneeName: string | null =
                  (node.type === 'TASK' || node.type === 'SUBTASK')
                    ? (node.meta?.assignee?.name ?? null)
                    : null;
                const ageH = taskAgeHours(node);
                const isNew = ageH !== null && ageH < NEW_TASK_WINDOW_H;
                const hasAppeared = appearedIds.has(node.id);
                const state = nodeState(node);
                const stateColor = state && state !== 'done' ? STATE_COLOR[state] : null;
                const depthScale = state === 'overdue' ? 1.06 : state === 'blocked' ? 1.03 : state === 'done' ? 0.97 : 1;
                const hoverScale = (isHovered ? 1.045 : 1) * depthScale;

                return (
                  <g key={node.id} data-node="true"
                    transform={`translate(${node.x-NODE_W/2},${node.y-NODE_H/2}) scale(${hasAppeared ? hoverScale : 0.4})`}
                    filter={state === 'overdue' || state === 'blocked' ? 'url(#fx-depth)' : undefined}
                    style={{
                      cursor:'pointer',
                      opacity: hasAppeared ? (dim?0.18:1) : 0,
                      transformOrigin: `${NODE_W/2}px ${NODE_H/2}px`,
                      transformBox: 'fill-box',
                      transition: hasAppeared
                        ? 'opacity 0.2s ease, transform 0.18s cubic-bezier(0.34,1.56,0.64,1)'
                        : 'opacity 0.35s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1)',
                    }}
                    onClick={e=>onNodeClick(e,node)}
                    onDoubleClick={()=>onNodeDblClick(node)}
                    onMouseDown={e=>onNodeDown(e,node)}
                    onMouseEnter={()=>setHoveredId(node.id)}
                    onMouseLeave={()=>setHoveredId(null)}>

                    {/* Новая задача: пульсирующее кольцо */}
                    {isNew && (
                      <rect className="cc-new-pulse"
                        x={-5} y={-5} width={NODE_W+10} height={NODE_H+10} rx={12}
                        fill="none" stroke={NEW_COLOR} strokeWidth={2} />
                    )}

                    {isHovered && !isSel && (
                      <rect x={-6} y={-6} width={NODE_W+12} height={NODE_H+12} rx={12} fill={color} fillOpacity={0.12}
                        style={{ transition:'opacity 0.15s ease' }} />
                    )}
                    {isSel && <rect x={-4} y={-4} width={NODE_W+8} height={NODE_H+8} rx={11} fill={color} fillOpacity={0.18} />}

                    {/* Card */}
                    <rect width={NODE_W} height={NODE_H} rx={8} fill="#1a1e2a"
                      fillOpacity={state === 'done' ? 0.55 : 1}
                      stroke={isSel ? color : isHovered ? color+'c0' : stateColor ? stateColor : isConn ? color+'90' : node.isOrphan ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.1)'}
                      strokeWidth={isSel?2:isHovered?1.8:stateColor?1.6:isConn?1.5:1}
                      strokeDasharray={state === 'unassigned' ? '5,3' : node.isOrphan ? '4,3' : undefined}
                      style={{ transition:'stroke 0.15s ease, stroke-width 0.15s ease', filter: isHovered ? `drop-shadow(0 4px 12px ${color}50)` : 'none' }} />

                    {/* Left bar — у новой задачи окрашена в цвет «новизны» */}
                    <rect x={0} y={0} width={4} height={NODE_H} rx={2} fill={isNew ? NEW_COLOR : color} />

                    {/* Бейдж NEW + возраст */}
                    {isNew && (
                      <g className="cc-new-badge">
                        <rect x={NODE_W-40} y={-7} width={38} height={14} rx={7} fill={NEW_COLOR} />
                        <text x={NODE_W-21} y={0} textAnchor="middle" dominantBaseline="central"
                          fontSize={8} fontWeight={800} fill="#1a1e2a" letterSpacing={0.4}>NEW</text>
                      </g>
                    )}
                    {isNew && ageH !== null && (
                      <text x={NODE_W-6} y={NODE_H-6} textAnchor="end"
                        fontSize={7.5} fill={NEW_COLOR} fillOpacity={0.9}>{ageLabel(ageH)}</text>
                    )}

                    {/* Бейдж состояния: слева сверху, чтобы не спорить с NEW справа */}
                    {stateColor && (
                      <g>
                        <title>{state === 'overdue' ? `Просрочена на ${overdueDays(node)} дн.`
                              : state === 'blocked' ? 'Заблокирована'
                              : 'Нет исполнителя'}</title>
                        <rect x={6} y={-7} width={state === 'overdue' ? 40 : 16} height={14} rx={7} fill={stateColor} />
                        <text x={state === 'overdue' ? 26 : 14} y={0} textAnchor="middle" dominantBaseline="central"
                          fontSize={8} fontWeight={800} fill="#0d0f14">
                          {state === 'overdue' ? `−${overdueDays(node)} дн` : state === 'blocked' ? '!' : '?'}
                        </text>
                      </g>
                    )}

                    {/* Icon */}
                    <text x={18} y={NODE_H/2} textAnchor="middle" dominantBaseline="central" fontSize={15}>{ICON[node.type]??'•'}</text>

                    {/* Исполнитель кружком — вместо отдельного узла и связи к нему */}
                    {assigneeName && (
                      <g>
                        <title>{assigneeName}</title>
                        <circle cx={NODE_W-15} cy={NODE_H-15} r={9} fill="#27ae60" fillOpacity={0.9} />
                        <text x={NODE_W-15} y={NODE_H-15} textAnchor="middle" dominantBaseline="central"
                          fontSize={8} fontWeight={700} fill="#0d0f14">{initials(assigneeName)}</text>
                      </g>
                    )}

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
    </>
  );
}

const zBtn: React.CSSProperties = { width:28, height:28, borderRadius:6, border:'1px solid rgba(255,255,255,0.1)', background:'#1a1e2a', cursor:'pointer', fontSize:15, color:'#8892aa', display:'flex', alignItems:'center', justifyContent:'center' };
const sectionLabel: React.CSSProperties = { fontSize:9, fontWeight:700, color:'#4a5168', textTransform:'uppercase', letterSpacing:'0.6px', marginBottom:7 };
