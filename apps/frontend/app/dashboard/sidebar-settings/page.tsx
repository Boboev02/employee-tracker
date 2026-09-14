'use client';
import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import {
  REGISTRY, DEFAULT_CONFIG, GROUP_ICONS, normalize,
  readCache, fetchConfig, saveConfig, resetConfig,
  type SidebarConfig, type SidebarGroup,
} from '@/lib/sidebarConfig';

type DragRef = { from: 'pinned' | 'hidden' | string; index: number } | null;

export default function SidebarSettingsPage() {
  const router = useRouter();
  const [token, setToken]   = useState('');
  const [cfg, setCfg]       = useState<SidebarConfig>(DEFAULT_CONFIG);
  const [saved, setSaved]   = useState(false);
  const [dirty, setDirty]   = useState(false);
  const [editGroup, setEditGroup] = useState<string|null>(null);
  const drag = useRef<DragRef>(null);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    const cached = readCache();
    if (cached) setCfg(cached);
    fetchConfig(t).then(r => { if (r) setCfg(r); });
  }, []);

  const update = (next: SidebarConfig) => { setCfg(normalize(next)); setDirty(true); setSaved(false); };

  /* ---- операции ---- */
  const move = (to: 'pinned' | 'hidden' | string, toIndex: number) => {
    const d = drag.current; if (!d) return;
    const clone: SidebarConfig = JSON.parse(JSON.stringify(cfg));

    const bucket = (key: string): string[] =>
      key === 'pinned' ? clone.pinned
      : key === 'hidden' ? clone.hidden
      : (clone.groups.find(g => g.id === key)?.items ?? []);

    const src = bucket(d.from);
    const [href] = src.splice(d.index, 1);
    if (!href) return;
    const dst = bucket(to);
    dst.splice(Math.min(toIndex, dst.length), 0, href);
    drag.current = null;
    update(clone);
  };

  const addGroup = () => {
    const id = 'g' + Date.now().toString(36);
    update({ ...cfg, groups: [...cfg.groups, { id, label: 'Новая группа', icon: 'ti-folder', items: [] }] });
    setEditGroup(id);
  };

  const patchGroup = (id: string, patch: Partial<SidebarGroup>) =>
    update({ ...cfg, groups: cfg.groups.map(g => g.id === id ? { ...g, ...patch } : g) });

  const removeGroup = (id: string) => {
    const g = cfg.groups.find(x => x.id === id); if (!g) return;
    if (g.items.length && !confirm(`Удалить группу «${g.label}»? Разделы уйдут в скрытые.`)) return;
    update({ ...cfg, groups: cfg.groups.filter(x => x.id !== id), hidden: [...cfg.hidden, ...g.items] });
  };

  const moveGroup = (id: string, dir: -1 | 1) => {
    const i = cfg.groups.findIndex(g => g.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= cfg.groups.length) return;
    const groups = [...cfg.groups];
    [groups[i], groups[j]] = [groups[j], groups[i]];
    update({ ...cfg, groups });
  };

  const hide = (from: string, index: number) => { drag.current = { from, index }; move('hidden', cfg.hidden.length); };

  const onSave  = async () => { await saveConfig(token, cfg); setSaved(true); setDirty(false); setTimeout(() => setSaved(false), 2500); };
  const onReset = async () => {
    if (!confirm('Вернуть меню к виду по умолчанию?')) return;
    await resetConfig(token); setCfg(DEFAULT_CONFIG); setDirty(true); setSaved(false);
  };

  /* ---- стили ---- */
  const card: React.CSSProperties = { background:'var(--bg-primary)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', padding:'14px 16px' };
  const chip: React.CSSProperties = {
    display:'flex', alignItems:'center', gap:'8px', padding:'7px 10px', borderRadius:'var(--radius)',
    background:'var(--bg-secondary)', border:'1px solid var(--border)', cursor:'grab', marginBottom:'5px', fontSize:'13px',
  };
  const inp: React.CSSProperties = {
    background:'var(--bg-secondary)', border:'1px solid var(--border)', borderRadius:'var(--radius)',
    padding:'6px 10px', fontSize:'13px', outline:'none', color:'var(--text-primary)', font:'inherit',
  };

  const Row = ({ href, from, index }: { href: string; from: string; index: number }) => {
    const it = REGISTRY[href]; if (!it) return null;
    return (
      <div draggable
        onDragStart={() => { drag.current = { from, index }; }}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); e.stopPropagation(); move(from, index); }}
        style={chip}>
        <i className="ti ti-grip-vertical" style={{ fontSize:'13px', color:'var(--text-muted)' }} aria-hidden="true" />
        <i className={'ti ' + it.icon} style={{ fontSize:'15px', color:'var(--accent)' }} aria-hidden="true" />
        <span style={{ flex:1, color:'var(--text-primary)' }}>{it.label}</span>
        {it.admin && <span style={{ fontSize:'10px', fontWeight:700, color:'#C77A05', background:'#FBF0DC', borderRadius:'6px', padding:'2px 6px' }}>ADMIN</span>}
        {from !== 'hidden' && (
          <button onClick={() => hide(from, index)} title="Скрыть из меню"
            style={{ background:'none', border:'none', color:'var(--text-muted)', cursor:'pointer', fontSize:'14px', lineHeight:1 }}>×</button>
        )}
      </div>
    );
  };

  const DropZone = ({ id, children, empty }: { id: string; children: React.ReactNode; empty: string }) => (
    <div
      onDragOver={e => e.preventDefault()}
      onDrop={e => {
        e.preventDefault();
        const len = id === 'pinned' ? cfg.pinned.length : id === 'hidden' ? cfg.hidden.length : (cfg.groups.find(g => g.id === id)?.items.length ?? 0);
        move(id, len);
      }}
      style={{ minHeight:'44px' }}>
      {children}
      {!children || (Array.isArray(children) && children.length === 0)
        ? <div style={{ fontSize:'12px', color:'var(--text-muted)', fontStyle:'italic', padding:'8px 2px' }}>{empty}</div>
        : null}
    </div>
  );

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg-secondary)' }}>
      <div style={{ background:'var(--bg-primary)', borderBottom:'1px solid var(--border)', padding:'14px 24px', display:'flex', alignItems:'center', gap:'12px', position:'sticky', top:0, zIndex:10 }}>
        <div style={{ flex:1 }}>
          <h1 style={{ fontSize:'18px', fontWeight:800, margin:0, color:'var(--text-primary)' }}>Настройка меню</h1>
          <p style={{ fontSize:'11px', color:'var(--text-muted)', margin:'2px 0 0' }}>
            Раскладка личная — у каждого сотрудника своя
          </p>
        </div>
        <button onClick={onReset} style={{ ...inp, cursor:'pointer', color:'var(--text-muted)' }}>По умолчанию</button>
        <button onClick={onSave} disabled={!dirty && !saved}
          style={{ ...inp, cursor:'pointer', background: saved ? '#E3F5EC' : 'var(--accent)', color: saved ? '#0F9E6A' : '#fff', border:'none', fontWeight:700, opacity: (!dirty && !saved) ? 0.5 : 1 }}>
          {saved ? '✓ Сохранено' : 'Сохранить'}
        </button>
      </div>

      <div style={{ padding:'20px 24px', display:'grid', gridTemplateColumns:'1fr 300px', gap:'16px', maxWidth:'1100px' }}>
        <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
          {/* закреплённые */}
          <div style={card}>
            <p style={{ fontSize:'11px', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 10px' }}>
              Наверху меню
            </p>
            <DropZone id="pinned" empty="Перетащите сюда разделы">
              {cfg.pinned.map((href, i) => <Row key={href} href={href} from="pinned" index={i} />)}
            </DropZone>
          </div>

          {/* группы */}
          {cfg.groups.map((g, gi) => (
            <div key={g.id} style={card}>
              <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'10px' }}>
                <select value={g.icon} onChange={e => patchGroup(g.id, { icon: e.target.value })} style={{ ...inp, width:'52px' }}>
                  {GROUP_ICONS.map(ic => <option key={ic} value={ic}>{ic.replace('ti-', '')}</option>)}
                </select>
                {editGroup === g.id ? (
                  <input autoFocus value={g.label}
                    onChange={e => patchGroup(g.id, { label: e.target.value })}
                    onBlur={() => setEditGroup(null)}
                    onKeyDown={e => e.key === 'Enter' && setEditGroup(null)}
                    style={{ ...inp, flex:1, fontWeight:700 }} />
                ) : (
                  <span onDoubleClick={() => setEditGroup(g.id)}
                    title="Двойной клик — переименовать"
                    style={{ flex:1, fontSize:'14px', fontWeight:700, cursor:'text', color:'var(--text-primary)' }}>
                    {g.label}
                  </span>
                )}
                <button onClick={() => moveGroup(g.id, -1)} disabled={gi === 0}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', opacity: gi === 0 ? 0.3 : 1 }}>↑</button>
                <button onClick={() => moveGroup(g.id, 1)} disabled={gi === cfg.groups.length - 1}
                  style={{ background:'none', border:'none', cursor:'pointer', color:'var(--text-muted)', opacity: gi === cfg.groups.length - 1 ? 0.3 : 1 }}>↓</button>
                <button onClick={() => removeGroup(g.id)} title="Удалить группу"
                  style={{ background:'none', border:'none', cursor:'pointer', color:'#D6455D' }}>🗑</button>
              </div>
              <DropZone id={g.id} empty="Перетащите сюда разделы">
                {g.items.map((href, i) => <Row key={href} href={href} from={g.id} index={i} />)}
              </DropZone>
            </div>
          ))}

          <button onClick={addGroup}
            style={{ ...inp, cursor:'pointer', color:'var(--accent)', background:'var(--accent-light)', border:'none', fontWeight:600, padding:'10px' }}>
            ＋ Новая группа
          </button>
        </div>

        {/* скрытые */}
        <div>
          <div style={{ ...card, position:'sticky', top:'80px' }}>
            <p style={{ fontSize:'11px', fontWeight:700, color:'var(--text-muted)', textTransform:'uppercase', letterSpacing:'0.5px', margin:'0 0 4px' }}>
              Скрытые разделы
            </p>
            <p style={{ fontSize:'11px', color:'var(--text-muted)', margin:'0 0 10px' }}>
              Не показываются в меню. Перетащите обратно, чтобы вернуть.
            </p>
            <DropZone id="hidden" empty="Пусто — показаны все разделы">
              {cfg.hidden.map((href, i) => <Row key={href} href={href} from="hidden" index={i} />)}
            </DropZone>
          </div>
        </div>
      </div>
    </div>
  );
}
