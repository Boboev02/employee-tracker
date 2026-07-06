'use client';
import { useState } from 'react';
import {
  FILTER_FIELDS, operatorsForType, VALUELESS_OPERATORS,
  FilterGroupState, FilterRule, EMPTY_FILTER_GROUP,
} from '@/lib/taskFilterEngine';

const inp: React.CSSProperties = { background:'white', border:'1px solid #EDE9FE', borderRadius:8, padding:'6px 10px', fontSize:12, color:'#1a1040', outline:'none' };

interface Props {
  value: FilterGroupState;
  onChange: (v: FilterGroupState) => void;
  employees: { id: string; name: string }[];
  onClose: () => void;
}

export function FilterBuilder({ value, onChange, employees, onClose }: Props) {
  const [draft, setDraft] = useState<FilterGroupState>(value);

  const addRule = () => {
    const newRule: FilterRule = { id: Math.random().toString(36).slice(2), field: 'status', operator: 'is', value: '' };
    setDraft(d => ({ ...d, rules: [...d.rules, newRule] }));
  };

  const updateRule = (id: string, patch: Partial<FilterRule>) => {
    setDraft(d => ({ ...d, rules: d.rules.map(r => r.id===id ? { ...r, ...patch } : r) }));
  };

  const removeRule = (id: string) => {
    setDraft(d => ({ ...d, rules: d.rules.filter(r => r.id!==id) }));
  };

  const apply = () => { onChange(draft); onClose(); };
  const clearAll = () => { const empty = { ...EMPTY_FILTER_GROUP }; setDraft(empty); onChange(empty); onClose(); };

  return (
    <div style={{ position:'absolute', top:'100%', left:0, marginTop:8, background:'white', borderRadius:16, boxShadow:'0 16px 48px rgba(127,119,221,0.2)', border:'1px solid #EDE9FE', width:480, zIndex:200, padding:16 }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:12 }}>
        <h3 style={{ fontSize:14, fontWeight:800, color:'#1a1040', margin:0 }}>Расширенный фильтр</h3>
        <button onClick={onClose} style={{ background:'none', border:'none', color:'#9B97CC', fontSize:16, cursor:'pointer' }}>✕</button>
      </div>

      {draft.rules.length === 0 && (
        <p style={{ fontSize:12, color:'#9B97CC', marginBottom:12 }}>Нет условий. Добавьте первое правило.</p>
      )}

      <div style={{ display:'flex', flexDirection:'column', gap:8, marginBottom:12 }}>
        {draft.rules.map((rule, idx) => {
          const field = FILTER_FIELDS.find(f => f.key === rule.field)!;
          const operators = operatorsForType(field.type);
          const needsValue = !VALUELESS_OPERATORS.has(rule.operator);

          return (
            <div key={rule.id} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:11, fontWeight:700, color:'#9B97CC', width:44, flexShrink:0 }}>
                {idx===0 ? 'Где' : (
                  <select value={draft.conjunction} onChange={e=>setDraft(d=>({...d, conjunction: e.target.value as 'AND'|'OR'}))}
                    style={{ ...inp, padding:'3px 6px', fontSize:11, fontWeight:700, color:'#7F77DD', width:44 }}>
                    <option value="AND">И</option>
                    <option value="OR">ИЛИ</option>
                  </select>
                )}
              </span>

              <select value={rule.field} onChange={e=>{
                const newField = FILTER_FIELDS.find(f=>f.key===e.target.value)!;
                const newOps = operatorsForType(newField.type);
                updateRule(rule.id, { field: e.target.value, operator: newOps[0].value, value: '' });
              }} style={{ ...inp, flex:1 }}>
                {FILTER_FIELDS.map(f => <option key={f.key} value={f.key}>{f.label}</option>)}
              </select>

              <select value={rule.operator} onChange={e=>updateRule(rule.id, { operator: e.target.value, value:'' })} style={{ ...inp, width:150 }}>
                {operators.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>

              {needsValue && field.type === 'enum' && (
                <select value={rule.value} onChange={e=>updateRule(rule.id, { value: e.target.value })} style={{ ...inp, width:120 }}>
                  <option value="">—</option>
                  {field.options?.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              )}
              {needsValue && field.type === 'user' && (
                <select value={rule.value} onChange={e=>updateRule(rule.id, { value: e.target.value })} style={{ ...inp, width:120 }}>
                  <option value="">—</option>
                  {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
                </select>
              )}
              {needsValue && field.type === 'text' && (
                <input value={rule.value} onChange={e=>updateRule(rule.id, { value: e.target.value })} placeholder="Значение" style={{ ...inp, width:120 }} />
              )}
              {needsValue && field.type === 'date' && (
                <input type="date" value={rule.value} onChange={e=>updateRule(rule.id, { value: e.target.value })} style={{ ...inp, width:130 }} />
              )}

              <button onClick={()=>removeRule(rule.id)} style={{ background:'none', border:'none', color:'#C4C0E8', cursor:'pointer', fontSize:14, flexShrink:0 }}>✕</button>
            </div>
          );
        })}
      </div>

      <button onClick={addRule} style={{ background:'#F8F7FF', border:'1px dashed #C4C0E8', borderRadius:8, padding:'6px 14px', fontSize:12, color:'#7F77DD', fontWeight:600, cursor:'pointer', marginBottom:14 }}>
        + Добавить условие
      </button>

      <div style={{ display:'flex', gap:8, borderTop:'1px solid #F0EDFC', paddingTop:12 }}>
        <button onClick={apply} style={{ flex:1, background:'linear-gradient(135deg,#7F77DD,#5248C5)', color:'white', border:'none', borderRadius:10, padding:'9px', fontSize:13, fontWeight:700, cursor:'pointer' }}>Применить</button>
        <button onClick={clearAll} style={{ background:'#F8F7FF', color:'#6B7280', border:'1px solid #EDE9FE', borderRadius:10, padding:'9px 16px', fontSize:13, cursor:'pointer' }}>Сбросить всё</button>
      </div>
    </div>
  );
}
