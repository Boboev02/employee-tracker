export const FIELD_TYPES = [
  'TEXT', 'TEXTAREA', 'NUMBER', 'MONEY', 'PERCENT',
  'DATE', 'DATETIME', 'SELECT', 'MULTISELECT', 'CHECKBOX',
  'TOGGLE', 'USER', 'TEAM', 'COMPANY', 'COUNTERPARTY',
  'LINK', 'EMAIL', 'PHONE', 'SKU', 'BARCODE',
  'COLOR', 'FILE', 'FORMULA', 'AUTO_NUMBER', 'RATING',
] as const;

export type FieldType = typeof FIELD_TYPES[number];

// Which DB column stores the value for each type
export const FIELD_COL: Record<string, 'strVal' | 'numVal' | 'boolVal' | 'dateVal' | 'jsonVal'> = {
  TEXT: 'strVal', TEXTAREA: 'strVal', EMAIL: 'strVal', PHONE: 'strVal',
  LINK: 'strVal', SKU: 'strVal', BARCODE: 'strVal', COLOR: 'strVal',
  NUMBER: 'numVal', MONEY: 'numVal', PERCENT: 'numVal', RATING: 'numVal',
  CHECKBOX: 'boolVal', TOGGLE: 'boolVal',
  DATE: 'dateVal', DATETIME: 'dateVal',
  SELECT: 'strVal',
  MULTISELECT: 'jsonVal', USER: 'jsonVal', TEAM: 'jsonVal',
  COMPANY: 'jsonVal', COUNTERPARTY: 'jsonVal', FILE: 'jsonVal',
  FORMULA: 'numVal', AUTO_NUMBER: 'strVal',
};

export const FILTER_OPS = [
  'EQ', 'NEQ', 'GT', 'LT', 'GTE', 'LTE',
  'CONTAINS', 'NOT_CONTAINS', 'STARTS_WITH',
  'IS_EMPTY', 'NOT_EMPTY', 'IN', 'NOT_IN', 'BETWEEN',
] as const;

export type FilterOp = typeof FILTER_OPS[number];

export const CONDITION_ACTIONS = [
  'SHOW', 'HIDE', 'REQUIRE', 'UNREQUIRE', 'SET_VALUE', 'CLEAR_VALUE',
] as const;

export interface FieldFilter {
  fieldId: string;
  type: string;
  op: FilterOp;
  val?: any;
}

export interface FieldConditionDto {
  sourceFieldId: string;
  operator: string;
  value?: any;
  logicGroup?: number;
  action: string;
  targetFieldId: string;
  actionValue?: any;
}
