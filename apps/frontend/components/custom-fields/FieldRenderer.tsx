'use client';
import { CustomField } from '@/hooks/useCustomFields';

interface Props {
  field: CustomField;
  value: any;
  onChange: (val: any) => void;
  readOnly?: boolean;
  employees?: { id: string; name: string }[];
  compact?: boolean;
}

const inp = (compact=false): React.CSSProperties => compact
  ? { width:'100%', background:'transparent', border:'none', outline:'none', fontSize:'12px', color:'#1a1040', padding:'2px 4px' }
  : { width:'100%', background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'10px', padding:'9px 14px', fontSize:'13px', color:'#1a1040', outline:'none', boxSizing:'border-box' as const };

export function FieldRenderer({ field, value, onChange, readOnly=false, employees=[], compact=false }: Props) {
  if (readOnly) return <FieldDisplay field={field} value={value} employees={employees} />;

  switch (field.type) {
    case 'TEXT': case 'EMAIL': case 'PHONE': case 'SKU': case 'BARCODE': case 'LINK':
      return <input type={field.type==='EMAIL'?'email':field.type==='PHONE'?'tel':'text'} style={inp(compact)} value={value??''} onChange={e=>onChange(e.target.value||null)} placeholder={field.description??field.name} />;

    case 'TEXTAREA':
      return <textarea style={{...inp(compact), resize:'none', minHeight: compact?24:72}} rows={compact?1:3} value={value??''} onChange={e=>onChange(e.target.value||null)} placeholder={field.description??field.name} />;

    case 'NUMBER': case 'PERCENT':
      return (
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <input type="number" style={inp(compact)} value={value??''} onChange={e=>onChange(e.target.value?Number(e.target.value):null)} placeholder="0" />
          {field.type==='PERCENT' && <span style={{ color:'#9B97CC', fontSize:13 }}>%</span>}
        </div>
      );

    case 'MONEY': {
      const sym: Record<string,string> = { RUB:'₽', USD:'$', EUR:'€', CNY:'¥', KZT:'₸' };
      const cur = (field.config as any)?.currency ?? 'RUB';
      return (
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <span style={{ color:'#9B97CC', fontSize:13, flexShrink:0 }}>{sym[cur]??cur}</span>
          <input type="number" style={inp(compact)} value={value??''} onChange={e=>onChange(e.target.value?Number(e.target.value):null)} placeholder="0" />
        </div>
      );
    }

    case 'DATE':
      return <input type="date" style={inp(compact)} value={value?value.slice(0,10):''} onChange={e=>onChange(e.target.value||null)} />;

    case 'DATETIME':
      return <input type="datetime-local" style={inp(compact)} value={value?value.slice(0,16):''} onChange={e=>onChange(e.target.value||null)} />;

    case 'SELECT': {
      const opts: string[] = (field.config as any)?.options ?? [];
      return (
        <select style={inp(compact)} value={value??''} onChange={e=>onChange(e.target.value||null)}>
          <option value="">— выбрать —</option>
          {opts.map(o=><option key={o} value={o}>{o}</option>)}
        </select>
      );
    }

    case 'MULTISELECT': {
      const opts: string[] = (field.config as any)?.options ?? [];
      const sel: string[] = Array.isArray(value)?value:[];
      return (
        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
          {opts.map(o=>(
            <button key={o} type="button" onClick={()=>{ const n=sel.includes(o)?sel.filter(s=>s!==o):[...sel,o]; onChange(n.length?n:null); }}
              style={{ fontSize:11, padding:'3px 10px', borderRadius:20, border:'1px solid', cursor:'pointer', fontWeight:600, transition:'all 0.15s',
                borderColor: sel.includes(o)?'#7F77DD':'#EDE9FE',
                background: sel.includes(o)?'#EDE9FE':'#F8F7FF',
                color: sel.includes(o)?'#7F77DD':'#9B97CC' }}>
              {o}
            </button>
          ))}
        </div>
      );
    }

    case 'CHECKBOX': case 'TOGGLE':
      return (
        <label style={{ display:'flex', alignItems:'center', gap:8, cursor:'pointer' }}>
          <input type="checkbox" checked={Boolean(value)} onChange={e=>onChange(e.target.checked)} style={{ width:16, height:16, accentColor:'#7F77DD' }} />
          {!compact && <span style={{ fontSize:13, color:'#6B7280' }}>{value?'Да':'Нет'}</span>}
        </label>
      );

    case 'USER': {
      const ids: string[] = Array.isArray(value)?value:(value?[value]:[]);
      return (
        <select style={inp(compact)} value={ids[0]??''} onChange={e=>onChange(e.target.value?[e.target.value]:null)}>
          <option value="">— не выбран —</option>
          {employees.map(e=><option key={e.id} value={e.id}>{e.name}</option>)}
        </select>
      );
    }

    case 'RATING': {
      const max = (field.config as any)?.maxStars ?? 5;
      const cur = Number(value)||0;
      return (
        <div style={{ display:'flex', gap:2 }}>
          {Array.from({length:max},(_,i)=>i+1).map(star=>(
            <button key={star} type="button" onClick={()=>onChange(star===cur?null:star)}
              style={{ background:'none', border:'none', cursor:'pointer', fontSize:compact?16:20, color:star<=cur?'#F59E0B':'#D1D5DB', padding:1, transition:'color 0.1s' }}>★</button>
          ))}
        </div>
      );
    }

    case 'COLOR':
      return (
        <div style={{ display:'flex', alignItems:'center', gap:8 }}>
          <input type="color" value={value??'#7F77DD'} onChange={e=>onChange(e.target.value)} style={{ width:32, height:32, border:'none', cursor:'pointer', borderRadius:8 }} />
          <span style={{ fontSize:12, color:'#9B97CC' }}>{value??'—'}</span>
        </div>
      );

    case 'AUTO_NUMBER':
      return <span style={{ fontSize:13, fontFamily:'monospace', color:'#9B97CC', background:'#F8F7FF', padding:'6px 12px', borderRadius:8 }}>{value??'Авто'}</span>;

    case 'FORMULA':
      return <span style={{ fontSize:13, color:'#6B7280' }}>{value??'—'}</span>;

    default:
      return <input type="text" style={inp(compact)} value={value??''} onChange={e=>onChange(e.target.value||null)} />;
  }
}

function FieldDisplay({ field, value, employees }: { field: CustomField; value: any; employees: { id: string; name: string }[] }) {
  if (value==null||value==='') return <span style={{ color:'#C4C0E8', fontSize:13 }}>—</span>;
  const sym: Record<string,string> = { RUB:'₽', USD:'$', EUR:'€', CNY:'¥', KZT:'₸' };

  switch (field.type) {
    case 'CHECKBOX': case 'TOGGLE':
      return <span style={{ fontSize:14 }}>{value?'✅':'❌'}</span>;
    case 'DATE':
      return <span style={{ fontSize:13 }}>{new Date(value).toLocaleDateString('ru')}</span>;
    case 'DATETIME':
      return <span style={{ fontSize:13 }}>{new Date(value).toLocaleString('ru')}</span>;
    case 'MONEY': {
      const cur = (field.config as any)?.currency ?? 'RUB';
      return <span style={{ fontSize:13 }}>{sym[cur]}{Number(value).toLocaleString('ru')}</span>;
    }
    case 'PERCENT':
      return <span style={{ fontSize:13 }}>{value}%</span>;
    case 'RATING': {
      const max = (field.config as any)?.maxStars ?? 5;
      const cur = Number(value)||0;
      return <span style={{ color:'#F59E0B', fontSize:14 }}>{'★'.repeat(cur)}{'☆'.repeat(Math.max(0,max-cur))}</span>;
    }
    case 'MULTISELECT':
      return (
        <div style={{ display:'flex', flexWrap:'wrap', gap:4 }}>
          {(Array.isArray(value)?value:[value]).map((v:string)=>(
            <span key={v} style={{ fontSize:11, background:'#EDE9FE', color:'#7F77DD', padding:'2px 8px', borderRadius:20, fontWeight:600 }}>{v}</span>
          ))}
        </div>
      );
    case 'COLOR':
      return (
        <div style={{ display:'flex', alignItems:'center', gap:6 }}>
          <div style={{ width:14, height:14, borderRadius:4, background:value, border:'1px solid #EDE9FE' }} />
          <span style={{ fontSize:12, color:'#9B97CC' }}>{value}</span>
        </div>
      );
    case 'LINK':
      return <a href={value} target="_blank" rel="noopener noreferrer" style={{ fontSize:13, color:'#2563EB', textDecoration:'none' }}>{value}</a>;
    case 'USER': {
      const ids = Array.isArray(value)?value:[value];
      const names = ids.map((id:string) => employees.find(e=>e.id===id)?.name ?? id);
      return <span style={{ fontSize:13 }}>{names.join(', ')}</span>;
    }
    default:
      return <span style={{ fontSize:13, color:'#1a1040' }}>{String(value)}</span>;
  }
}

export const FIELD_TYPE_LABELS: Record<string, string> = {
  TEXT:'Текст', TEXTAREA:'Большой текст', NUMBER:'Число', MONEY:'Деньги',
  PERCENT:'Процент', DATE:'Дата', DATETIME:'Дата и время',
  SELECT:'Выпадающий список', MULTISELECT:'Множественный выбор',
  CHECKBOX:'Чекбокс', TOGGLE:'Переключатель', USER:'Пользователь',
  TEAM:'Команда', COMPANY:'Компания', COUNTERPARTY:'Контрагент',
  LINK:'Ссылка', EMAIL:'Email', PHONE:'Телефон', SKU:'Артикул',
  BARCODE:'Штрихкод', COLOR:'Цвет', FILE:'Файл',
  FORMULA:'Формула', AUTO_NUMBER:'Авто-номер', RATING:'Рейтинг',
};
