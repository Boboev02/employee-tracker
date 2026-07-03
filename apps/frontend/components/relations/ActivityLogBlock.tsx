'use client';
import { useState, useEffect, useCallback } from 'react';

const API = 'https://employee-tracker.ru';

const ACTION_LABELS: Record<string, string> = {
  CREATED:          'Создано',
  UPDATED:          'Обновлено',
  DELETED:          'Удалено',
  STATUS_CHANGED:   'Статус изменён',
  ASSIGNED:         'Назначен исполнитель',
  UNASSIGNED:       'Исполнитель снят',
  LINKED:           'Добавлена связь',
  UNLINKED:         'Связь удалена',
  COMMENTED:        'Комментарий',
  FILE_ADDED:       'Файл добавлен',
  FILE_REMOVED:     'Файл удалён',
  FIELD_CHANGED:    'Поле изменено',
  PRIORITY_CHANGED: 'Приоритет изменён',
  DUE_DATE_CHANGED: 'Дедлайн изменён',
};

const ACTION_ICONS: Record<string, string> = {
  CREATED:          '✨',
  UPDATED:          '✏️',
  DELETED:          '🗑️',
  STATUS_CHANGED:   '🔄',
  ASSIGNED:         '👤',
  UNASSIGNED:       '👤',
  LINKED:           '🔗',
  UNLINKED:         '🔗',
  COMMENTED:        '💬',
  FILE_ADDED:       '📎',
  FILE_REMOVED:     '📎',
  FIELD_CHANGED:    '📝',
  PRIORITY_CHANGED: '🚦',
  DUE_DATE_CHANGED: '📅',
};

const ACTION_COLORS: Record<string, string> = {
  CREATED:          '#16A34A',
  DELETED:          '#DC2626',
  STATUS_CHANGED:   '#7F77DD',
  LINKED:           '#2563EB',
  COMMENTED:        '#0891B2',
  FILE_ADDED:       '#D97706',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'только что';
  if (m < 60) return `${m} мин назад`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h} ч назад`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d} дн назад`;
  return new Date(dateStr).toLocaleDateString('ru');
}

interface Props {
  entityType: string;
  entityId: string;
  token: string;
  limit?: number;
}

export function ActivityLogBlock({ entityType, entityId, token, limit = 30 }: Props) {
  const [logs, setLogs] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [offset, setOffset] = useState(0);

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async (off = 0) => {
    if (!entityId || !token) return;
    setLoading(true);
    try {
      const r = await fetch(
        `${API}/api/v1/relations/activity/${entityType}/${entityId}?limit=${limit}&offset=${off}`,
        { headers }
      );
      if (r.ok) {
        const d = await r.json();
        if (off === 0) {
          setLogs(d.logs ?? []);
        } else {
          setLogs(prev => [...prev, ...(d.logs ?? [])]);
        }
        setTotal(d.total ?? 0);
      }
    } catch {}
    setLoading(false);
  }, [entityId, entityType, token, limit]);

  useEffect(() => { load(0); }, [load]);

  const loadMore = () => {
    const next = offset + limit;
    setOffset(next);
    load(next);
  };

  if (loading && logs.length === 0) {
    return <div style={{ fontSize:12, color:'#9B97CC', padding:'8px 0' }}>Загрузка...</div>;
  }

  if (logs.length === 0) {
    return <div style={{ fontSize:12, color:'#C4C0E8', padding:'8px 0' }}>История пуста</div>;
  }

  return (
    <div>
      <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
        {logs.map((log, i) => {
          const color = ACTION_COLORS[log.action] ?? '#9B97CC';
          const icon  = ACTION_ICONS[log.action]  ?? '•';
          const label = ACTION_LABELS[log.action]  ?? log.action;
          const isLast = i === logs.length - 1;

          return (
            <div key={log.id} style={{ display:'flex', gap:10, paddingBottom: isLast ? 0 : 12, position:'relative' }}>
              {/* Timeline line */}
              {!isLast && (
                <div style={{ position:'absolute', left:14, top:24, bottom:0, width:1, background:'#EDE9FE' }} />
              )}

              {/* Icon bubble */}
              <div style={{ width:28, height:28, borderRadius:'50%', background: color+'18', border:`1.5px solid ${color}40`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, flexShrink:0, zIndex:1 }}>
                {icon}
              </div>

              {/* Content */}
              <div style={{ flex:1, minWidth:0, paddingTop:3 }}>
                <div style={{ display:'flex', alignItems:'baseline', gap:6, flexWrap:'wrap' }}>
                  <span style={{ fontSize:13, fontWeight:700, color: color }}>{label}</span>
                  {log.actorName && (
                    <span style={{ fontSize:12, color:'#6B7280' }}>· {log.actorName}</span>
                  )}
                  <span style={{ fontSize:11, color:'#C4C0E8', marginLeft:'auto' }}>{timeAgo(log.createdAt)}</span>
                </div>

                {/* Field change */}
                {log.field && (
                  <div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>
                    <span style={{ fontWeight:600 }}>{log.field}:</span>
                    {log.oldValue && (
                      <span style={{ textDecoration:'line-through', color:'#DC2626', margin:'0 4px' }}>{log.oldValue}</span>
                    )}
                    {log.newValue && (
                      <span style={{ color:'#16A34A' }}>→ {log.newValue}</span>
                    )}
                  </div>
                )}

                {/* Old/new without field */}
                {!log.field && (log.oldValue || log.newValue) && (
                  <div style={{ fontSize:12, color:'#6B7280', marginTop:2 }}>
                    {log.oldValue && <span style={{ textDecoration:'line-through', color:'#DC2626', marginRight:6 }}>{log.oldValue}</span>}
                    {log.newValue && <span style={{ color:'#16A34A' }}>→ {log.newValue}</span>}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Load more */}
      {logs.length < total && (
        <button onClick={loadMore} disabled={loading}
          style={{ marginTop:8, background:'none', border:'1px solid #EDE9FE', borderRadius:8, padding:'6px 14px', fontSize:12, color:'#7F77DD', cursor:'pointer', width:'100%' }}>
          {loading ? 'Загрузка...' : `Показать ещё (${total - logs.length})`}
        </button>
      )}
    </div>
  );
}
