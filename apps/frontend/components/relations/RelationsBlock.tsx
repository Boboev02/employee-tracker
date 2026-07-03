'use client';
import { useState, useEffect, useCallback } from 'react';

const API = 'https://employee-tracker.ru';

const ENTITY_TYPES = [
  { value: 'TASK',              label: 'Задача',    icon: '✅' },
  { value: 'PROJECT',           label: 'Проект',    icon: '📁' },
  { value: 'PRODUCT',           label: 'Товар',     icon: '📦' },
  { value: 'DEAL',              label: 'Сделка',    icon: '💼' },
  { value: 'EMPLOYEE',          label: 'Сотрудник', icon: '👤' },
  { value: 'KNOWLEDGE_ARTICLE', label: 'Статья',    icon: '📄' },
];

const TASK_RELATION_TYPES = [
  { value: 'DEPENDS_ON',  label: 'Зависит от',  color: '#DC2626' },
  { value: 'BLOCKS',      label: 'Блокирует',   color: '#D97706' },
  { value: 'WAITING_FOR', label: 'Ожидает',     color: '#7F77DD' },
  { value: 'RELATED',     label: 'Связана',     color: '#2563EB' },
  { value: 'DUPLICATE',   label: 'Дубликат',    color: '#6B7280' },
];

const STATUS_LABELS: Record<string,string> = {
  NEW:'Новая', IN_PROGRESS:'В работе', REVIEW:'Проверка',
  BLOCKED:'Заблок.', DONE:'Готово', OVERDUE:'Просрочена',
};
const STATUS_COLORS: Record<string,string> = {
  NEW:'#EDE9FE', IN_PROGRESS:'#DBEAFE', REVIEW:'#FEF3C7',
  BLOCKED:'#FEE2E2', DONE:'#DCFCE7', OVERDUE:'#FEE2E2',
};

interface Props {
  entityType: string;
  entityId: string;
  token: string;
  compact?: boolean;
}

export function RelationsBlock({ entityType, entityId, token, compact = false }: Props) {
  const [relations, setRelations] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [activeTab, setActiveTab] = useState<string>('all');

  // Add form state
  const [targetEntityType, setTargetEntityType] = useState('TASK');
  const [relationType, setRelationType] = useState('RELATED');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [selectedEntity, setSelectedEntity] = useState<any>(null);
  const [adding, setAdding] = useState(false);

  const headers = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const load = useCallback(async () => {
    if (!entityId || !token) return;
    setLoading(true);
    try {
      const r = await fetch(`${API}/api/v1/relations/${entityType}/${entityId}`, { headers });
      if (r.ok) {
        const d = await r.json();
        setRelations(d.relations ?? []);
      }
    } catch {}
    setLoading(false);
  }, [entityId, entityType, token]);

  useEffect(() => { load(); }, [load]);

  const search = async (q: string) => {
    setSearchQuery(q);
    if (q.length < 1) { setSearchResults([]); return; }
    try {
      const r = await fetch(`${API}/api/v1/relations/search/${targetEntityType}?q=${encodeURIComponent(q)}`, { headers });
      if (r.ok) setSearchResults(await r.json());
    } catch {}
  };

  const addRelation = async () => {
    if (!selectedEntity) return;
    setAdding(true);
    try {
      const r = await fetch(`${API}/api/v1/relations`, {
        method: 'POST', headers,
        body: JSON.stringify({
          sourceType: entityType, sourceId: entityId,
          targetType: targetEntityType, targetId: selectedEntity.id,
          relationType: entityType === 'TASK' && targetEntityType === 'TASK' ? relationType : 'LINKED',
        }),
      });
      if (r.ok) {
        setShowAdd(false);
        setSelectedEntity(null);
        setSearchQuery('');
        setSearchResults([]);
        await load();
      }
    } catch {}
    setAdding(false);
  };

  const deleteRelation = async (id: string) => {
    await fetch(`${API}/api/v1/relations/${id}`, { method: 'DELETE', headers });
    await load();
  };

  // Group by relationType
  const grouped: Record<string, any[]> = {};
  for (const r of relations) {
    if (!grouped[r.relationType]) grouped[r.relationType] = [];
    grouped[r.relationType].push(r);
  }
  const tabs = ['all', ...Object.keys(grouped)];

  const displayRelations = activeTab === 'all'
    ? relations
    : grouped[activeTab] ?? [];

  if (compact && relations.length === 0 && !showAdd) {
    return (
      <button onClick={() => setShowAdd(true)}
        style={{ background:'none', border:'1px dashed #C4C0E8', borderRadius:8, padding:'4px 10px', fontSize:11, color:'#9B97CC', cursor:'pointer' }}>
        + Добавить связь
      </button>
    );
  }

  return (
    <div style={{ marginTop: compact ? 0 : 8 }}>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
        {!compact && (
          <div style={{ display:'flex', gap:4 }}>
            {tabs.map(t => (
              <button key={t} onClick={() => setActiveTab(t)}
                style={{ background: activeTab===t ? '#EDE9FE' : 'none', color: activeTab===t ? '#7F77DD' : '#9B97CC',
                  border:'none', borderRadius:6, padding:'3px 10px', fontSize:11, fontWeight:700, cursor:'pointer' }}>
                {t === 'all' ? `Все (${relations.length})` : `${TASK_RELATION_TYPES.find(x=>x.value===t)?.label ?? t} (${grouped[t]?.length ?? 0})`}
              </button>
            ))}
          </div>
        )}
        <button onClick={() => setShowAdd(v => !v)}
          style={{ background:'#7F77DD', color:'white', border:'none', borderRadius:8, padding:'4px 12px', fontSize:12, fontWeight:700, cursor:'pointer', marginLeft:'auto' }}>
          + Связь
        </button>
      </div>

      {/* Add form */}
      {showAdd && (
        <div style={{ background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:12, padding:14, marginBottom:10 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8, marginBottom:8 }}>
            <select value={targetEntityType} onChange={e => { setTargetEntityType(e.target.value); setSearchResults([]); setSearchQuery(''); setSelectedEntity(null); }}
              style={sel}>
              {ENTITY_TYPES.map(t => <option key={t.value} value={t.value}>{t.icon} {t.label}</option>)}
            </select>
            {entityType === 'TASK' && targetEntityType === 'TASK' && (
              <select value={relationType} onChange={e => setRelationType(e.target.value)} style={sel}>
                {TASK_RELATION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            )}
          </div>

          {selectedEntity ? (
            <div style={{ display:'flex', alignItems:'center', gap:8, background:'white', border:'1px solid #EDE9FE', borderRadius:8, padding:'6px 10px', marginBottom:8 }}>
              <span style={{ flex:1, fontSize:13, fontWeight:600, color:'#1a1040' }}>{selectedEntity.title ?? selectedEntity.name ?? selectedEntity.email}</span>
              <button onClick={() => setSelectedEntity(null)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9B97CC' }}>✕</button>
            </div>
          ) : (
            <div style={{ position:'relative', marginBottom:8 }}>
              <input value={searchQuery} onChange={e => search(e.target.value)}
                placeholder="Поиск..." autoFocus
                style={{ ...sel, width:'100%', boxSizing:'border-box' as const }} />
              {searchResults.length > 0 && (
                <div style={{ position:'absolute', top:'100%', left:0, right:0, background:'white', border:'1px solid #EDE9FE', borderRadius:8, boxShadow:'0 8px 24px rgba(0,0,0,0.1)', zIndex:50, maxHeight:200, overflowY:'auto', marginTop:2 }}>
                  {searchResults.map((r:any) => (
                    <div key={r.id} onClick={() => { setSelectedEntity(r); setSearchResults([]); }}
                      style={{ padding:'8px 12px', cursor:'pointer', fontSize:13, borderBottom:'1px solid #F8F7FF', color:'#1a1040' }}
                      onMouseEnter={e => (e.currentTarget as HTMLDivElement).style.background='#F8F7FF'}
                      onMouseLeave={e => (e.currentTarget as HTMLDivElement).style.background='white'}>
                      {r.title ?? r.name ?? r.email}
                      {r.status && <span style={{ marginLeft:6, fontSize:11, color:'#9B97CC' }}>{STATUS_LABELS[r.status] ?? r.status}</span>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          <div style={{ display:'flex', gap:6 }}>
            <button onClick={addRelation} disabled={!selectedEntity || adding}
              style={{ background: selectedEntity ? 'linear-gradient(135deg,#7F77DD,#5248C5)' : '#C4C0E8', color:'white', border:'none', borderRadius:8, padding:'7px 16px', fontSize:12, fontWeight:700, cursor: selectedEntity ? 'pointer' : 'not-allowed' }}>
              {adding ? 'Добавляю...' : 'Добавить'}
            </button>
            <button onClick={() => { setShowAdd(false); setSelectedEntity(null); setSearchQuery(''); setSearchResults([]); }}
              style={{ background:'none', border:'1px solid #EDE9FE', borderRadius:8, padding:'7px 14px', fontSize:12, color:'#6B7280', cursor:'pointer' }}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Relations list */}
      {loading && <div style={{ fontSize:12, color:'#9B97CC', padding:'8px 0' }}>Загрузка...</div>}
      {!loading && displayRelations.length === 0 && !showAdd && (
        <div style={{ fontSize:12, color:'#C4C0E8', padding:'8px 0' }}>Нет связанных объектов</div>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
        {displayRelations.map((r:any) => {
          const relDef = TASK_RELATION_TYPES.find(x => x.value === r.relationType);
          const entity = r.entity;
          return (
            <div key={r.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'7px 10px', background:'#F8F7FF', borderRadius:8, border:'1px solid #EDE9FE' }}>
              <span style={{ fontSize:10, fontWeight:700, color: relDef?.color ?? '#7F77DD', background: (relDef?.color ?? '#7F77DD')+'18', padding:'2px 6px', borderRadius:4, whiteSpace:'nowrap', flexShrink:0 }}>
                {r.label ?? r.relationType}
              </span>
              <span style={{ fontSize:11, color:'#9B97CC', flexShrink:0 }}>
                {ENTITY_TYPES.find(t => t.value === r.entityType)?.icon}
              </span>
              <span style={{ fontSize:13, fontWeight:600, color:'#1a1040', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                {entity?.title ?? entity?.name ?? entity?.email ?? r.entityId}
              </span>
              {entity?.status && (
                <span style={{ fontSize:10, fontWeight:700, background: STATUS_COLORS[entity.status] ?? '#F8F7FF', color:'#1a1040', padding:'2px 6px', borderRadius:4, flexShrink:0 }}>
                  {STATUS_LABELS[entity.status] ?? entity.status}
                </span>
              )}
              <button onClick={() => deleteRelation(r.id)}
                style={{ background:'none', border:'none', cursor:'pointer', color:'#C4C0E8', fontSize:14, flexShrink:0, padding:'0 2px' }}
                title="Удалить связь">✕</button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

const sel: React.CSSProperties = {
  background:'white', border:'1px solid #EDE9FE', borderRadius:8,
  padding:'7px 10px', fontSize:12, color:'#1a1040', outline:'none', width:'100%',
};
