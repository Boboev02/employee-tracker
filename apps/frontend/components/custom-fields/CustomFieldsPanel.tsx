'use client';
import { useState, useEffect, useMemo } from 'react';
import { CustomField, FieldGroup, useCustomFields } from '@/hooks/useCustomFields';
import { FieldRenderer } from './FieldRenderer';

interface Props {
  taskId: string;
  token: string;
  projectId?: string;
  taskTypeId?: string;
  readOnly?: boolean;
  employees?: { id: string; name: string }[];
  initialValues?: Record<string, any>;
  onChange?: (values: Record<string, any>) => void; // for create form (no taskId yet)
}

export function CustomFieldsPanel({
  taskId, token, projectId, taskTypeId, readOnly = false,
  employees = [], initialValues, onChange,
}: Props) {
  const cf = useCustomFields(token);
  const [values, setValues] = useState<Record<string, any>>(initialValues ?? {});
  const [saving, setSaving] = useState<string | null>(null);
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string>>(new Set());

  // Load existing values when editing existing task
  useEffect(() => {
    if (!taskId || !token || initialValues !== undefined) return;
    cf.getTaskFieldValues(taskId).then(v => setValues(v));
  }, [taskId, token]);

  // Apply conditions to get visibility/required state
  const { visibility, required } = useMemo(() => {
    return cf.applyConditions(
      new Set(cf.fields.map(f => f.id)),
      new Set(cf.fields.filter(f => f.isRequired).map(f => f.id)),
      values,
    );
  }, [cf.fields, cf.conditions, values]);

  // Filter fields: project binding + task type + card visibility
  const visibleFields = useMemo(() => {
    return cf.fields.filter(f => {
      if (!f.showInCard) return false;
      if (!visibility.get(f.id)) return false;
      // Project filter
      if (projectId && f.projectBindings && f.projectBindings.length > 0) {
        if (!f.projectBindings.some(b => b.projectId === projectId)) return false;
      }
      // Task type filter
      if (taskTypeId && cf.taskTypes.length > 0) {
        const tt = cf.taskTypes.find(t => t.id === taskTypeId);
        if (tt && tt.fieldBindings.length > 0) {
          if (!tt.fieldBindings.some(b => b.field.id === f.id)) return false;
        }
      }
      return true;
    });
  }, [cf.fields, cf.taskTypes, visibility, projectId, taskTypeId]);

  const handleChange = async (fieldId: string, val: any) => {
    const next = { ...values, [fieldId]: val };
    setValues(next);

    // If create-mode (no taskId), just notify parent
    if (!taskId || onChange) {
      onChange?.(next);
      return;
    }

    // Auto-save
    setSaving(fieldId);
    try {
      await cf.setTaskFieldValues(taskId, { [fieldId]: val });
    } catch {}
    setSaving(null);
  };

  const toggleGroup = (groupId: string) => {
    setCollapsedGroups(prev => {
      const next = new Set(prev);
      next.has(groupId) ? next.delete(groupId) : next.add(groupId);
      return next;
    });
  };

  if (cf.loading && visibleFields.length === 0) {
    return <div className="text-sm text-gray-400 py-4 text-center">Загрузка полей...</div>;
  }

  if (visibleFields.length === 0) return null;

  // Group fields
  const grouped = new Map<string | null, CustomField[]>();
  for (const f of visibleFields) {
    const key = f.groupId ?? null;
    if (!grouped.has(key)) grouped.set(key, []);
    grouped.get(key)!.push(f);
  }

  return (
    <div className="space-y-4">
      {/* Ungrouped fields */}
      {grouped.get(null) && (
        <div className="space-y-3">
          {grouped.get(null)!.map(field => (
            <FieldRow
              key={field.id}
              field={field}
              value={values[field.id]}
              isRequired={required.get(field.id) ?? false}
              saving={saving === field.id}
              readOnly={readOnly}
              employees={employees}
              onChange={v => handleChange(field.id, v)}
            />
          ))}
        </div>
      )}

      {/* Grouped fields */}
      {cf.groups
        .filter(g => grouped.has(g.id))
        .map(group => {
          const isCollapsed = collapsedGroups.has(group.id);
          const groupFields = grouped.get(group.id) ?? [];
          return (
            <div key={group.id} className="border border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden">
              <button
                type="button"
                onClick={() => toggleGroup(group.id)}
                className="w-full flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
              >
                <span
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: group.color ?? '#7F77DD' }}
                />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-200 flex-1 text-left">
                  {group.name}
                </span>
                <span className="text-xs text-gray-400">{isCollapsed ? '▶' : '▼'}</span>
              </button>
              {!isCollapsed && (
                <div className="px-4 py-3 space-y-3">
                  {groupFields.map(field => (
                    <FieldRow
                      key={field.id}
                      field={field}
                      value={values[field.id]}
                      isRequired={required.get(field.id) ?? false}
                      saving={saving === field.id}
                      readOnly={readOnly}
                      employees={employees}
                      onChange={v => handleChange(field.id, v)}
                    />
                  ))}
                </div>
              )}
            </div>
          );
        })}
    </div>
  );
}

function FieldRow({
  field, value, isRequired, saving, readOnly, employees, onChange,
}: {
  field: CustomField;
  value: any;
  isRequired: boolean;
  saving: boolean;
  readOnly: boolean;
  employees: { id: string; name: string }[];
  onChange: (v: any) => void;
}) {
  return (
    <div className="grid grid-cols-[140px_1fr] gap-3 items-start">
      <label className="text-sm text-gray-500 dark:text-gray-400 pt-2 leading-tight">
        {field.name}
        {isRequired && <span className="text-red-400 ml-0.5">*</span>}
        {saving && <span className="ml-1 text-xs text-purple-400">↑</span>}
      </label>
      <div className="min-w-0">
        <FieldRenderer
          field={field}
          value={value}
          onChange={onChange}
          readOnly={readOnly}
          employees={employees}
        />
        {field.description && (
          <p className="text-xs text-gray-400 mt-1">{field.description}</p>
        )}
      </div>
    </div>
  );
}
