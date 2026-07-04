'use client';
import { useState } from 'react';

interface Props {
  section: string;         // 'tasks' | 'projects' | 'products' | 'crm' | 'analytics' | 'knowledge' | 'kpi' | 'relations'
  label: string;           // 'все задачи' 
  token: string;
  userRoles?: string[];
  onDeleted?: () => void;
}

const SECTION_LABELS: Record<string, string> = {
  tasks:         'задачи',
  projects:      'проекты',
  products:      'карточки товаров',
  crm:           'данные CRM',
  analytics:     'аналитику',
  knowledge:     'базу знаний',
  kpi:           'KPI данные',
  relations:     'связи и историю',
  departments:   'отделы',
  employees:     'сотрудников',
  'task-types':  'типы задач',
  'custom-fields': 'пользовательские поля',
};

export function DeleteSectionButton({ section, label, token, userRoles = [], onDeleted }: Props) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  // Only show for admins
  const isAdmin = userRoles.some(r => ['ADMIN','SUPER_ADMIN','OWNER'].includes(r));
  if (!isAdmin) return null;

  const handleDelete = async () => {
    setLoading(true);
    try {
      const r = await fetch(`https://employee-tracker.ru/api/v1/reset/${section}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${token}` },
      });
      if (r.ok) {
        setDone(true);
        setShowConfirm(false);
        onDeleted?.();
        setTimeout(() => setDone(false), 3000);
      }
    } catch {}
    setLoading(false);
  };

  if (done) {
    return (
      <span style={{ fontSize:11, color:'#16A34A', fontWeight:600 }}>✓ {SECTION_LABELS[section] ?? label} удалены</span>
    );
  }

  return (
    <>
      <button onClick={() => setShowConfirm(true)}
        style={{ display:'flex', alignItems:'center', gap:4, padding:'5px 10px', borderRadius:6, border:'1px solid #FEE2E2', background:'#FEF2F2', color:'#DC2626', cursor:'pointer', fontSize:11, fontWeight:600, transition:'all 0.15s' }}
        title={`Удалить ${SECTION_LABELS[section] ?? label}`}>
        🗑 Удалить {SECTION_LABELS[section] ?? label}
      </button>

      {showConfirm && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
          <div style={{ background:'white', borderRadius:16, padding:24, maxWidth:400, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.2)' }}>
            <div style={{ fontSize:24, marginBottom:8, textAlign:'center' }}>⚠️</div>
            <h3 style={{ fontSize:16, fontWeight:700, color:'#1a1040', margin:'0 0 8px', textAlign:'center' }}>
              Удалить {SECTION_LABELS[section] ?? label}?
            </h3>
            <p style={{ fontSize:13, color:'#6B7280', margin:'0 0 20px', textAlign:'center', lineHeight:1.5 }}>
              Это действие необратимо. Все {SECTION_LABELS[section] ?? label} будут удалены навсегда.
            </p>
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setShowConfirm(false)}
                style={{ flex:1, padding:'9px', background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:10, fontSize:13, color:'#6B7280', cursor:'pointer', fontWeight:600 }}>
                Отмена
              </button>
              <button onClick={handleDelete} disabled={loading}
                style={{ flex:1, padding:'9px', background:'#DC2626', border:'none', borderRadius:10, fontSize:13, color:'white', cursor:'pointer', fontWeight:700, opacity: loading ? 0.7 : 1 }}>
                {loading ? 'Удаление...' : '🗑 Удалить'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
