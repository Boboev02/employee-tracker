'use client';
import { useState, useEffect, useMemo } from 'react';
import { CustomField, useCustomFields } from '@/hooks/useCustomFields';
import { FieldRenderer } from './FieldRenderer';

interface Props {
  taskId: string;
  token: string;
  projectId?: string;
  taskTypeId?: string;
  readOnly?: boolean;
  employees?: { id: string; name: string }[];
  initialValues?: Record<string, any>;
  onChange?: (values: Record<string, any>) => void;
}

export function CustomFieldsPanel({ taskId, token, projectId, taskTypeId, readOnly=false, employees=[], initialValues, onChange }: Props) {
  const cf = useCustomFields(token);
  const [values, setValues] = useState<Record<string,any>>(initialValues??{});
  const [saving, setSaving] = useState<string|null>(null);
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!taskId || !token || initialValues!==undefined) return;
    cf.getTaskFieldValues(taskId).then(v => setValues(v));
  }, [taskId, token]);

  const { visibility, required } = useMemo(() =>
    cf.applyConditions(new Set(cf.fields.map(f=>f.id)), new Set(cf.fields.filter(f=>f.isRequired).map(f=>f.id)), values),
    [cf.fields, cf.conditions, values]
  );

  const isCreateMode = !taskId || onChange !== undefined;

  const visibleFields = useMemo(() => cf.fields.filter(f => {
    // In create mode — show fields with showOnCreate; in edit mode — showInCard
    if (isCreateMode) {
      if (!f.showOnCreate) return false;
    } else {
      if (!f.showInCard) return false;
    }
    if (!visibility.get(f.id)) return false;
    if (projectId && f.projectBindings && f.projectBindings.length>0) {
      if (!f.projectBindings.some(b=>b.projectId===projectId)) return false;
    }
    if (taskTypeId) {
      const tt = cf.taskTypes.find(t=>t.id===taskTypeId);
      if (tt && tt.fieldBindings.length>0 && !tt.fieldBindings.some((b:any)=>b.field.id===f.id)) return false;
    }
    return true;
  }), [cf.fields, cf.taskTypes, visibility, projectId, taskTypeId, isCreateMode]);

  const handleChange = async (fieldId: string, val: any) => {
    const next = { ...values, [fieldId]: val };
    setValues(next);
    if (!taskId || onChange) { onChange?.(next); return; }
    setSaving(fieldId);
    try { await cf.setTaskFieldValues(taskId, { [fieldId]: val }); } catch {}
    setSaving(null);
  };

  if (cf.loading && visibleFields.length===0) return <div style={{ fontSize:13, color:'#9B97CC', padding:'12px 0', textAlign:'center' }}>Загрузка полей...</div>;
  if (visibleFields.length===0) return null;

  // Group fields
  const grouped = new Map<string|null, CustomField[]>();
  for (const f of visibleFields) {
    const k = f.groupId??null;
    if (!grouped.has(k)) grouped.set(k, []);
    grouped.get(k)!.push(f);
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      {/* Ungrouped */}
      {grouped.get(null) && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {grouped.get(null)!.map(field => (
            <FieldRow key={field.id} field={field} value={values[field.id]} isRequired={required.get(field.id)??false}
              saving={saving===field.id} readOnly={readOnly} employees={employees} onChange={v=>handleChange(field.id,v)} />
          ))}
        </div>
      )}
      {/* Grouped */}
      {cf.groups.filter(g=>grouped.has(g.id)).map(group => {
        const isCol = collapsed.has(group.id);
        return (
          <div key={group.id} style={{ border:'1px solid #EDE9FE', borderRadius:12, overflow:'hidden' }}>
            <button type="button" onClick={()=>setCollapsed(p=>{ const n=new Set(p); n.has(group.id)?n.delete(group.id):n.add(group.id); return n; })}
              style={{ width:'100%', display:'flex', alignItems:'center', gap:8, padding:'10px 14px', background:'#F8F7FF', border:'none', cursor:'pointer', textAlign:'left' }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:group.color??'#7F77DD', flexShrink:0 }} />
              <span style={{ flex:1, fontSize:13, fontWeight:700, color:'#1a1040' }}>{group.name}</span>
              <span style={{ fontSize:11, color:'#9B97CC' }}>{isCol?'▶':'▼'}</span>
            </button>
            {!isCol && (
              <div style={{ padding:'12px 14px', display:'flex', flexDirection:'column', gap:10 }}>
                {(grouped.get(group.id)??[]).map(field => (
                  <FieldRow key={field.id} field={field} value={values[field.id]} isRequired={required.get(field.id)??false}
                    saving={saving===field.id} readOnly={readOnly} employees={employees} onChange={v=>handleChange(field.id,v)} />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FieldRow({ field, value, isRequired, saving, readOnly, employees, onChange }: {
  field: CustomField; value: any; isRequired: boolean; saving: boolean;
  readOnly: boolean; employees: { id: string; name: string }[]; onChange: (v:any)=>void;
}) {
  return (
    <div style={{ display:'grid', gridTemplateColumns:'140px 1fr', gap:10, alignItems:'start' }}>
      <label style={{ fontSize:12, color:'#9B97CC', paddingTop:8, lineHeight:1.3 }}>
        {field.name}
        {isRequired && <span style={{ color:'#DC2626', marginLeft:2 }}>*</span>}
        {saving && <span style={{ color:'#7F77DD', marginLeft:4, fontSize:11 }}>↑</span>}
      </label>
      <div>
        <FieldRenderer field={field} value={value} onChange={onChange} readOnly={readOnly} employees={employees} />
        {field.description && <p style={{ margin:'3px 0 0', fontSize:11, color:'#9B97CC' }}>{field.description}</p>}
      </div>
    </div>
  );
}
