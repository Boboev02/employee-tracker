'use client';
import { useState, useEffect, useCallback } from 'react';

const API = 'https://employee-tracker.ru';

export type FieldType =
  | 'TEXT' | 'TEXTAREA' | 'NUMBER' | 'MONEY' | 'PERCENT'
  | 'DATE' | 'DATETIME' | 'SELECT' | 'MULTISELECT' | 'CHECKBOX'
  | 'TOGGLE' | 'USER' | 'TEAM' | 'COMPANY' | 'COUNTERPARTY'
  | 'LINK' | 'EMAIL' | 'PHONE' | 'SKU' | 'BARCODE'
  | 'COLOR' | 'FILE' | 'FORMULA' | 'AUTO_NUMBER' | 'RATING';

export interface CustomField {
  id: string;
  orgId: string;
  groupId?: string | null;
  type: FieldType;
  name: string;
  description?: string;
  isRequired: boolean;
  isSystem: boolean;
  showInTable: boolean;
  showInCard: boolean;
  showInFilter: boolean;
  showOnCreate: boolean;
  sortOrder: number;
  defaultValue?: any;
  config?: any;
  group?: { id: string; name: string; color?: string; icon?: string; isCollapsed: boolean };
  projectBindings?: { projectId: string }[];
}

export interface FieldGroup {
  id: string;
  name: string;
  color?: string;
  icon?: string;
  sortOrder: number;
  isCollapsed: boolean;
  fields: CustomField[];
}

export interface TaskType {
  id: string;
  name: string;
  icon?: string;
  color?: string;
  isDefault: boolean;
  fieldBindings: Array<{ field: CustomField; sortOrder: number }>;
}

export interface FieldCondition {
  id: string;
  sourceFieldId: string;
  operator: string;
  value?: any;
  logicGroup: number;
  action: string;
  targetFieldId: string;
  actionValue?: any;
}

// Cache fields per org to avoid refetching
const fieldsCache = new Map<string, { data: CustomField[]; ts: number }>();
const CACHE_TTL = 60_000; // 1 min

export function useCustomFields(token: string) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [groups, setGroups] = useState<FieldGroup[]>([]);
  const [taskTypes, setTaskTypes] = useState<TaskType[]>([]);
  const [conditions, setConditions] = useState<FieldCondition[]>([]);
  const [loading, setLoading] = useState(false);

  const headers = { Authorization: `Bearer ${token}` };

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    try {
      const [fRes, gRes, ttRes, cRes] = await Promise.all([
        fetch(`${API}/api/v1/custom-fields`, { headers }),
        fetch(`${API}/api/v1/custom-fields/groups`, { headers }),
        fetch(`${API}/api/v1/custom-fields/task-types`, { headers }),
        fetch(`${API}/api/v1/custom-fields/conditions`, { headers }),
      ]);
      const [f, g, tt, c] = await Promise.all([fRes.json(), gRes.json(), ttRes.json(), cRes.json()]);
      setFields(Array.isArray(f) ? f : []);
      setGroups(Array.isArray(g) ? g : []);
      setTaskTypes(Array.isArray(tt) ? tt : []);
      setConditions(Array.isArray(c) ? c : []);
    } catch {}
    setLoading(false);
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const createField = async (data: Partial<CustomField>) => {
    const r = await fetch(`${API}/api/v1/custom-fields`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(await r.text());
    await load();
    return r.json();
  };

  const updateField = async (id: string, data: Partial<CustomField>) => {
    const r = await fetch(`${API}/api/v1/custom-fields/${id}`, {
      method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!r.ok) throw new Error(await r.text());
    await load();
  };

  const deleteField = async (id: string) => {
    await fetch(`${API}/api/v1/custom-fields/${id}`, { method: 'DELETE', headers });
    await load();
  };

  const reorderFields = async (orders: { id: string; sortOrder: number }[]) => {
    await fetch(`${API}/api/v1/custom-fields/reorder`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify({ orders }),
    });
    await load();
  };

  const createGroup = async (data: any) => {
    const r = await fetch(`${API}/api/v1/custom-fields/groups`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await load();
    return r.json();
  };

  const updateGroup = async (id: string, data: any) => {
    await fetch(`${API}/api/v1/custom-fields/groups/${id}`, {
      method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await load();
  };

  const deleteGroup = async (id: string) => {
    await fetch(`${API}/api/v1/custom-fields/groups/${id}`, { method: 'DELETE', headers });
    await load();
  };

  const setTaskFieldValues = async (taskId: string, values: Record<string, any>) => {
    const r = await fetch(`${API}/api/v1/custom-fields/values/${taskId}`, {
      method: 'PATCH', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(values),
    });
    if (!r.ok) throw new Error(await r.text());
    return r.json();
  };

  const getTaskFieldValues = async (taskId: string): Promise<Record<string, any>> => {
    const r = await fetch(`${API}/api/v1/custom-fields/values/${taskId}`, { headers });
    if (!r.ok) return {};
    return r.json();
  };

  const createCondition = async (data: any) => {
    await fetch(`${API}/api/v1/custom-fields/conditions`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await load();
  };

  const deleteCondition = async (id: string) => {
    await fetch(`${API}/api/v1/custom-fields/conditions/${id}`, { method: 'DELETE', headers });
    await load();
  };

  const createTaskType = async (data: any) => {
    await fetch(`${API}/api/v1/custom-fields/task-types`, {
      method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    await load();
  };

  // Compute visible/required fields based on conditions and current values
  const applyConditions = (
    visibleFieldIds: Set<string>,
    requiredFieldIds: Set<string>,
    currentValues: Record<string, any>,
  ) => {
    const visibility = new Map<string, boolean>();
    const required   = new Map<string, boolean>();

    for (const f of fields) {
      visibility.set(f.id, true);
      required.set(f.id, f.isRequired);
    }

    for (const cond of conditions) {
      const srcVal = currentValues[cond.sourceFieldId];
      if (!evalCondition(cond, srcVal)) continue;

      switch (cond.action) {
        case 'SHOW':      visibility.set(cond.targetFieldId, true);  break;
        case 'HIDE':      visibility.set(cond.targetFieldId, false); break;
        case 'REQUIRE':   required.set(cond.targetFieldId, true);    break;
        case 'UNREQUIRE': required.set(cond.targetFieldId, false);   break;
      }
    }
    return { visibility, required };
  };

  return {
    fields, groups, taskTypes, conditions, loading,
    reload: load,
    createField, updateField, deleteField, reorderFields,
    createGroup, updateGroup, deleteGroup,
    setTaskFieldValues, getTaskFieldValues,
    createCondition, deleteCondition,
    createTaskType,
    applyConditions,
  };
}

function evalCondition(cond: FieldCondition, val: any): boolean {
  const { operator, value } = cond;
  if (operator === 'IS_EMPTY')  return val == null || val === '';
  if (operator === 'NOT_EMPTY') return val != null && val !== '';
  if (val == null) return false;
  switch (operator) {
    case 'EQ':  return String(val) === String(value);
    case 'NEQ': return String(val) !== String(value);
    case 'GT':  return Number(val) > Number(value);
    case 'LT':  return Number(val) < Number(value);
    case 'GTE': return Number(val) >= Number(value);
    case 'LTE': return Number(val) <= Number(value);
    case 'CONTAINS': return String(val).toLowerCase().includes(String(value).toLowerCase());
    case 'IN':  return Array.isArray(value) && value.includes(val);
    default:    return false;
  }
}
