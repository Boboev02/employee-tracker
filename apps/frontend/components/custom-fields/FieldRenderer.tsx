'use client';
import { useState } from 'react';
import { CustomField } from '@/hooks/useCustomFields';

interface Props {
  field: CustomField;
  value: any;
  onChange: (val: any) => void;
  readOnly?: boolean;
  employees?: { id: string; name: string }[];
  compact?: boolean; // for table cells
}

export function FieldRenderer({ field, value, onChange, readOnly = false, employees = [], compact = false }: Props) {
  const cls = compact
    ? 'w-full text-sm bg-transparent border-0 outline-none px-1 py-0.5'
    : 'w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-gray-800 dark:border-gray-600 dark:text-white';

  if (readOnly) return <FieldDisplay field={field} value={value} />;

  switch (field.type) {
    case 'TEXT':
    case 'EMAIL':
    case 'PHONE':
    case 'SKU':
    case 'BARCODE':
    case 'LINK':
      return (
        <input
          type={field.type === 'EMAIL' ? 'email' : field.type === 'PHONE' ? 'tel' : 'text'}
          className={cls}
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
          placeholder={field.description ?? field.name}
        />
      );

    case 'TEXTAREA':
      return (
        <textarea
          className={cls + ' resize-none'}
          rows={compact ? 1 : 3}
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
          placeholder={field.description ?? field.name}
        />
      );

    case 'NUMBER':
    case 'PERCENT':
      return (
        <div className="flex items-center gap-1">
          <input
            type="number"
            className={cls}
            value={value ?? ''}
            onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
            placeholder="0"
          />
          {field.type === 'PERCENT' && <span className="text-gray-400 text-sm">%</span>}
        </div>
      );

    case 'MONEY': {
      const currency = field.config?.currency ?? 'RUB';
      return (
        <div className="flex items-center gap-1">
          <span className="text-gray-400 text-sm">{CURRENCY_SYMBOLS[currency] ?? currency}</span>
          <input
            type="number"
            className={cls}
            value={value ?? ''}
            onChange={e => onChange(e.target.value ? Number(e.target.value) : null)}
            placeholder="0"
          />
        </div>
      );
    }

    case 'DATE':
      return (
        <input
          type="date"
          className={cls}
          value={value ? value.slice(0, 10) : ''}
          onChange={e => onChange(e.target.value || null)}
        />
      );

    case 'DATETIME':
      return (
        <input
          type="datetime-local"
          className={cls}
          value={value ? value.slice(0, 16) : ''}
          onChange={e => onChange(e.target.value || null)}
        />
      );

    case 'SELECT': {
      const options: string[] = field.config?.options ?? [];
      return (
        <select
          className={cls}
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
        >
          <option value="">— выбрать —</option>
          {options.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      );
    }

    case 'MULTISELECT': {
      const options: string[] = field.config?.options ?? [];
      const selected: string[] = Array.isArray(value) ? value : [];
      const toggle = (opt: string) => {
        const next = selected.includes(opt)
          ? selected.filter(s => s !== opt)
          : [...selected, opt];
        onChange(next.length ? next : null);
      };
      return (
        <div className="flex flex-wrap gap-1">
          {options.map(o => (
            <button
              key={o}
              type="button"
              onClick={() => toggle(o)}
              className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                selected.includes(o)
                  ? 'bg-purple-100 border-purple-400 text-purple-700 dark:bg-purple-900 dark:text-purple-200'
                  : 'bg-gray-100 border-gray-200 text-gray-600 dark:bg-gray-700 dark:text-gray-300'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      );
    }

    case 'CHECKBOX':
    case 'TOGGLE':
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 rounded accent-purple-600"
            checked={Boolean(value)}
            onChange={e => onChange(e.target.checked)}
          />
          {!compact && <span className="text-sm text-gray-600 dark:text-gray-300">{value ? 'Да' : 'Нет'}</span>}
        </label>
      );

    case 'USER': {
      const ids: string[] = Array.isArray(value) ? value : (value ? [value] : []);
      return (
        <select
          className={cls}
          value={ids[0] ?? ''}
          onChange={e => onChange(e.target.value ? [e.target.value] : null)}
        >
          <option value="">— не выбран —</option>
          {employees.map(e => <option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      );
    }

    case 'RATING': {
      const max = field.config?.maxStars ?? 5;
      const cur = Number(value) || 0;
      return (
        <div className="flex gap-0.5">
          {Array.from({ length: max }, (_, i) => i + 1).map(star => (
            <button
              key={star}
              type="button"
              onClick={() => onChange(star === cur ? null : star)}
              className={`text-lg transition-colors ${star <= cur ? 'text-yellow-400' : 'text-gray-300 hover:text-yellow-300'}`}
            >
              ★
            </button>
          ))}
        </div>
      );
    }

    case 'COLOR':
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            className="w-8 h-8 rounded cursor-pointer border-0"
            value={value ?? '#7F77DD'}
            onChange={e => onChange(e.target.value)}
          />
          <span className="text-sm text-gray-500">{value ?? '—'}</span>
        </div>
      );

    case 'AUTO_NUMBER':
      return <span className="text-sm font-mono text-gray-500">{value ?? 'Авто'}</span>;

    case 'FORMULA':
      return <span className="text-sm text-gray-600 dark:text-gray-300">{value ?? '—'}</span>;

    default:
      return (
        <input
          type="text"
          className={cls}
          value={value ?? ''}
          onChange={e => onChange(e.target.value || null)}
        />
      );
  }
}

// Read-only display
function FieldDisplay({ field, value }: { field: CustomField; value: any }) {
  if (value == null || value === '') return <span className="text-gray-400 text-sm">—</span>;

  switch (field.type) {
    case 'CHECKBOX':
    case 'TOGGLE':
      return <span className="text-sm">{value ? '✅' : '❌'}</span>;
    case 'DATE':
      return <span className="text-sm">{new Date(value).toLocaleDateString('ru')}</span>;
    case 'DATETIME':
      return <span className="text-sm">{new Date(value).toLocaleString('ru')}</span>;
    case 'MONEY': {
      const currency = field.config?.currency ?? 'RUB';
      return <span className="text-sm">{CURRENCY_SYMBOLS[currency]}{Number(value).toLocaleString('ru')}</span>;
    }
    case 'PERCENT':
      return <span className="text-sm">{value}%</span>;
    case 'RATING': {
      const cur = Number(value) || 0;
      return <span className="text-yellow-400">{'★'.repeat(cur)}{'☆'.repeat(Math.max(0, (field.config?.maxStars ?? 5) - cur))}</span>;
    }
    case 'MULTISELECT':
      return (
        <div className="flex flex-wrap gap-1">
          {(Array.isArray(value) ? value : [value]).map((v: string) => (
            <span key={v} className="text-xs bg-purple-100 text-purple-700 px-2 py-0.5 rounded-full">{v}</span>
          ))}
        </div>
      );
    case 'COLOR':
      return (
        <div className="flex items-center gap-1">
          <div className="w-4 h-4 rounded border" style={{ backgroundColor: value }} />
          <span className="text-xs text-gray-500">{value}</span>
        </div>
      );
    case 'LINK':
      return <a href={value} target="_blank" rel="noopener noreferrer" className="text-sm text-blue-600 hover:underline truncate">{value}</a>;
    default:
      return <span className="text-sm">{String(value)}</span>;
  }
}

const CURRENCY_SYMBOLS: Record<string, string> = {
  RUB: '₽', USD: '$', EUR: '€', CNY: '¥', KZT: '₸',
};

export const FIELD_TYPE_LABELS: Record<string, string> = {
  TEXT: 'Текст', TEXTAREA: 'Большой текст', NUMBER: 'Число', MONEY: 'Деньги',
  PERCENT: 'Процент', DATE: 'Дата', DATETIME: 'Дата и время',
  SELECT: 'Выпадающий список', MULTISELECT: 'Множественный выбор',
  CHECKBOX: 'Чекбокс', TOGGLE: 'Переключатель', USER: 'Пользователь',
  TEAM: 'Команда', COMPANY: 'Компания', COUNTERPARTY: 'Контрагент',
  LINK: 'Ссылка', EMAIL: 'Email', PHONE: 'Телефон', SKU: 'Артикул',
  BARCODE: 'Штрихкод', COLOR: 'Цвет', FILE: 'Файл',
  FORMULA: 'Формула', AUTO_NUMBER: 'Авто-номер', RATING: 'Рейтинг',
};
