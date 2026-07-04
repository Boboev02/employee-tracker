'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCustomFields, CustomField } from '@/hooks/useCustomFields';
import { DeleteSectionButton } from '@/components/admin/DeleteSectionButton';

const FIELD_TYPE_LABELS: Record<string, string> = {
  TEXT:'Текст', TEXTAREA:'Большой текст', NUMBER:'Число', MONEY:'Деньги',
  PERCENT:'Процент', DATE:'Дата', DATETIME:'Дата и время',
  SELECT:'Выпадающий список', MULTISELECT:'Множественный выбор',
  CHECKBOX:'Чекбокс', TOGGLE:'Переключатель', USER:'Пользователь',
  TEAM:'Команда', COMPANY:'Компания', COUNTERPARTY:'Контрагент',
  LINK:'Ссылка', EMAIL:'Email', PHONE:'Телефон', SKU:'Артикул',
  BARCODE:'Штрихкод', COLOR:'Цвет', FILE:'Файл',
  FORMULA:'Формула', AUTO_NUMBER:'Авто-номер', RATING:'Рейтинг',
};
const FIELD_TYPES = Object.keys(FIELD_TYPE_LABELS);

const card: React.CSSProperties = { background:'white', borderRadius:'20px', padding:'20px 24px', boxShadow:'0 4px 16px rgba(127,119,221,0.08)', marginBottom:'12px' };
const inp: React.CSSProperties = { width:'100%', background:'#F8F7FF', border:'1px solid #EDE9FE', borderRadius:'10px', padding:'9px 14px', fontSize:'13px', color:'#1a1040', outline:'none', boxSizing:'border-box' };
const btn = (primary=true): React.CSSProperties => primary
  ? { background:'linear-gradient(135deg,#7F77DD,#5248C5)', color:'white', border:'none', borderRadius:'12px', padding:'10px 22px', fontSize:'13px', fontWeight:700, cursor:'pointer' }
  : { background:'#F8F7FF', color:'#6B7280', border:'1px solid #EDE9FE', borderRadius:'12px', padding:'10px 22px', fontSize:'13px', fontWeight:600, cursor:'pointer' };

export default function CustomFieldsSettingsPage() {
  const router = useRouter();
  const [token, setToken] = useState('');
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
  }, []);
  if (!mounted || !token) return null;
  return <CustomFieldsManager token={token} />;
}

function CustomFieldsManager({ token }: { token: string }) {
  const cf = useCustomFields(token);
  const [tab, setTab] = useState<'fields'|'groups'|'types'|'conditions'>('fields');
  const [showForm, setShowForm] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [form, setForm] = useState<any>({
    name:'', type:'TEXT', description:'', groupId:'',
    isRequired:false, showInTable:true, showInCard:true, showInFilter:true, showOnCreate:true,
    config:{ options:[], currency:'RUB', maxStars:5 },
  });
  const [optInput, setOptInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showGrpForm, setShowGrpForm] = useState(false);
  const [gForm, setGForm] = useState({ name:'', color:'#7F77DD' });
  const [showTtForm, setShowTtForm] = useState(false);
  const [ttForm, setTtForm] = useState({ name:'', icon:'📋', color:'#7F77DD' });

  const openCreate = () => {
    setEditingField(null);
    setForm({ name:'', type:'TEXT', description:'', groupId:'', isRequired:false, showInTable:true, showInCard:true, showInFilter:true, showOnCreate:true, config:{ options:[], currency:'RUB', maxStars:5 } });
    setError(''); setShowForm(true);
  };
  const openEdit = (f: CustomField) => {
    setEditingField(f);
    setForm({ name:f.name, type:f.type, description:f.description??'', groupId:f.groupId??'', isRequired:f.isRequired, showInTable:f.showInTable, showInCard:f.showInCard, showInFilter:f.showInFilter, showOnCreate:f.showOnCreate, config:{ options:(f.config as any)?.options??[], currency:(f.config as any)?.currency??'RUB', maxStars:(f.config as any)?.maxStars??5 } });
    setError(''); setShowForm(true);
  };
  const saveField = async () => {
    if (!form.name.trim()) { setError('Введите название'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        groupId: form.groupId || null, // convert empty string to null
        description: form.description || null,
        config: form.type==='SELECT'||form.type==='MULTISELECT' ? { options:form.config.options }
          : form.type==='MONEY' ? { currency:form.config.currency }
          : form.type==='RATING' ? { maxStars:form.config.maxStars }
          : null,
      };
      if (editingField) await cf.updateField(editingField.id, payload as any);
      else await cf.createField(payload as any);
      setShowForm(false);
    } catch(e:any) { setError(e.message??'Ошибка'); }
    setSaving(false);
  };

  const TABS = [{ k:'fields', l:'Поля' }, { k:'groups', l:'Группы' }, { k:'types', l:'Типы задач' }, { k:'conditions', l:'Условия' }];

  return (
    <div style={{ padding:'24px 28px', maxWidth:960, margin:'0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom:24, display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <h1 style={{ fontSize:22, fontWeight:800, color:'#1a1040', margin:0 }}>Пользовательские поля</h1>
          <p style={{ fontSize:13, color:'#9B97CC', margin:'4px 0 0' }}>Настройте карточку задачи под ваши процессы</p>
        </div>
        {tab==='fields' && <DeleteSectionButton section="custom-fields" label="все пользовательские поля" token={token} userRoles={JSON.parse(localStorage.getItem('user')??'{}').roles ?? []} onDeleted={()=>window.location.reload()} />}
        {tab==='types' && <DeleteSectionButton section="task-types" label="все типы задач" token={token} userRoles={JSON.parse(localStorage.getItem('user')??'{}').roles ?? []} onDeleted={()=>window.location.reload()} />}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, borderBottom:'2px solid #EDE9FE', marginBottom:20 }}>
        {TABS.map(t => (
          <button key={t.k} onClick={() => setTab(t.k as any)} style={{
            background:'none', border:'none', padding:'10px 18px', fontSize:'13px', fontWeight:700, cursor:'pointer',
            color: tab===t.k ? '#7F77DD' : '#9B97CC',
            borderBottom: tab===t.k ? '2px solid #7F77DD' : '2px solid transparent',
            marginBottom:-2, transition:'all 0.15s',
          }}>{t.l}</button>
        ))}
      </div>

      {/* ── FIELDS TAB ── */}
      {tab==='fields' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <span style={{ fontSize:13, color:'#9B97CC' }}>{cf.fields.length} полей</span>
            <button onClick={openCreate} style={btn()}>+ Добавить поле</button>
          </div>
          {cf.loading && <div style={{ textAlign:'center', padding:40, color:'#9B97CC' }}>Загрузка...</div>}
          {!cf.loading && cf.fields.length===0 && (
            <div style={{ ...card, textAlign:'center', padding:40, color:'#9B97CC' }}>
              <div style={{ fontSize:32, marginBottom:8 }}>🗂️</div>
              <p style={{ margin:0, fontWeight:600 }}>Нет полей</p>
              <p style={{ margin:'4px 0 0', fontSize:12 }}>Создайте первое поле чтобы расширить карточку задачи</p>
            </div>
          )}
          {cf.fields.map(f => (
            <div key={f.id} style={{ ...card, display:'flex', alignItems:'center', gap:12, padding:'14px 20px' }}>
              <div style={{ flex:1, minWidth:0 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                  <span style={{ fontSize:14, fontWeight:700, color:'#1a1040' }}>{f.name}</span>
                  {f.isSystem && <span style={{ fontSize:11, background:'#F3F4F6', color:'#6B7280', padding:'2px 8px', borderRadius:20, fontWeight:600 }}>системное</span>}
                  {f.isRequired && <span style={{ fontSize:11, background:'#FEE2E2', color:'#DC2626', padding:'2px 8px', borderRadius:20, fontWeight:600 }}>обязательное</span>}
                  {f.group && <span style={{ fontSize:11, color:'white', padding:'2px 8px', borderRadius:20, fontWeight:600, background: f.group.color??'#7F77DD' }}>{f.group.name}</span>}
                </div>
                {f.description && <p style={{ margin:'3px 0 0', fontSize:12, color:'#9B97CC' }}>{f.description}</p>}
              </div>
              <div style={{ display:'flex', alignItems:'center', gap:12, flexShrink:0 }}>
                <span style={{ fontSize:11, background:'#EDE9FE', color:'#7F77DD', padding:'4px 10px', borderRadius:8, fontWeight:700 }}>
                  {FIELD_TYPE_LABELS[f.type]??f.type}
                </span>
                <div style={{ display:'flex', gap:6, fontSize:14, color:'#C4C0E8' }}>
                  {f.showInTable && <span title="В таблице">⊞</span>}
                  {f.showInCard && <span title="В карточке">☰</span>}
                  {f.showInFilter && <span title="В фильтрах">⧙</span>}
                </div>
                {!f.isSystem && (
                  <div style={{ display:'flex', gap:4 }}>
                    <button onClick={() => openEdit(f)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9B97CC', fontSize:16, padding:'4px 8px', borderRadius:8 }}>✎</button>
                    <button onClick={() => { if(confirm(`Удалить поле "${f.name}"?`)) cf.deleteField(f.id); }} style={{ background:'none', border:'none', cursor:'pointer', color:'#9B97CC', fontSize:16, padding:'4px 8px', borderRadius:8 }}>✕</button>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── GROUPS TAB ── */}
      {tab==='groups' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <span style={{ fontSize:13, color:'#9B97CC' }}>{cf.groups.length} групп</span>
            <button onClick={() => setShowGrpForm(true)} style={btn()}>+ Создать группу</button>
          </div>
          {cf.groups.map(g => (
            <div key={g.id} style={{ ...card, display:'flex', alignItems:'center', gap:12, padding:'14px 20px' }}>
              <div style={{ width:12, height:12, borderRadius:'50%', background:g.color??'#7F77DD', flexShrink:0 }} />
              <div style={{ flex:1 }}>
                <p style={{ margin:0, fontWeight:700, color:'#1a1040', fontSize:14 }}>{g.name}</p>
                <p style={{ margin:'2px 0 0', fontSize:12, color:'#9B97CC' }}>{g.fields?.length??0} полей</p>
              </div>
              <button onClick={() => { if(confirm(`Удалить группу "${g.name}"?`)) cf.deleteGroup(g.id); }} style={{ background:'none', border:'none', cursor:'pointer', color:'#9B97CC', fontSize:16, padding:'4px 8px' }}>✕</button>
            </div>
          ))}
          {showGrpForm && (
            <Modal title="Новая группа" onClose={() => setShowGrpForm(false)}>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <input style={inp} placeholder="Название группы" value={gForm.name} onChange={e => setGForm({...gForm, name:e.target.value})} autoFocus />
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:13, color:'#6B7280' }}>Цвет:</span>
                  <input type="color" value={gForm.color} onChange={e => setGForm({...gForm, color:e.target.value})} style={{ width:36, height:36, border:'none', cursor:'pointer', borderRadius:8 }} />
                </div>
                <div style={{ display:'flex', gap:8, marginTop:4 }}>
                  <button onClick={async()=>{ await cf.createGroup(gForm); setShowGrpForm(false); setGForm({name:'',color:'#7F77DD'}); }} style={btn()}>Создать</button>
                  <button onClick={() => setShowGrpForm(false)} style={btn(false)}>Отмена</button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* ── TASK TYPES TAB ── */}
      {tab==='types' && (
        <div>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16 }}>
            <span style={{ fontSize:13, color:'#9B97CC' }}>Шаблоны задач с предустановленными полями</span>
            <button onClick={() => setShowTtForm(true)} style={btn()}>+ Создать тип</button>
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            {cf.taskTypes.map(tt => (
              <div key={tt.id} style={card}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <span style={{ fontSize:22 }}>{tt.icon??'📋'}</span>
                  <span style={{ fontWeight:700, color:'#1a1040', fontSize:14 }}>{tt.name}</span>
                  {tt.isDefault && <span style={{ fontSize:11, background:'#DCFCE7', color:'#16A34A', padding:'2px 8px', borderRadius:20, fontWeight:600 }}>по умолч.</span>}
                </div>
                <p style={{ margin:0, fontSize:12, color:'#9B97CC' }}>
                  {tt.fieldBindings.length>0 ? tt.fieldBindings.map((b:any)=>b.field.name).join(', ') : 'Нет привязанных полей'}
                </p>
              </div>
            ))}
          </div>
          {showTtForm && (
            <Modal title="Новый тип задачи" onClose={() => setShowTtForm(false)}>
              <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                <input style={inp} placeholder="Название (Закупка, Контент...)" value={ttForm.name} onChange={e => setTtForm({...ttForm, name:e.target.value})} autoFocus />
                <input style={inp} placeholder="Иконка (emoji)" value={ttForm.icon} onChange={e => setTtForm({...ttForm, icon:e.target.value})} />
                <div style={{ display:'flex', gap:8, marginTop:4 }}>
                  <button onClick={async()=>{ await cf.createTaskType(ttForm); setShowTtForm(false); setTtForm({name:'',icon:'📋',color:'#7F77DD'}); }} style={btn()}>Создать</button>
                  <button onClick={() => setShowTtForm(false)} style={btn(false)}>Отмена</button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* ── CONDITIONS TAB ── */}
      {tab==='conditions' && (
        <div>
          <p style={{ fontSize:13, color:'#9B97CC', marginBottom:16 }}>Показывайте, скрывайте или делайте поля обязательными в зависимости от значений других полей.</p>
          {cf.conditions.length===0 ? (
            <div style={{ ...card, textAlign:'center', padding:40, color:'#9B97CC' }}>
              <div style={{ fontSize:32, marginBottom:8 }}>⚡</div>
              <p style={{ margin:0, fontWeight:600 }}>Нет условий</p>
              <p style={{ margin:'4px 0 0', fontSize:12 }}>Условия создаются автоматически при настройке логики полей</p>
            </div>
          ) : cf.conditions.map(c => {
            const src = cf.fields.find(f=>f.id===c.sourceFieldId);
            const tgt = cf.fields.find(f=>f.id===c.targetFieldId);
            const actions: Record<string,string> = { SHOW:'показать', HIDE:'скрыть', REQUIRE:'сделать обязательным', UNREQUIRE:'снять обязательность' };
            return (
              <div key={c.id} style={{ ...card, display:'flex', alignItems:'center', gap:12, padding:'12px 20px' }}>
                <p style={{ flex:1, margin:0, fontSize:13, color:'#1a1040' }}>
                  <b>{src?.name??c.sourceFieldId}</b> <span style={{color:'#9B97CC'}}>{c.operator}</span> <code style={{background:'#F8F7FF',padding:'1px 6px',borderRadius:4,fontSize:11}}>{String(c.value??'')}</code>
                  {' → '}<span style={{color:'#7F77DD',fontWeight:700}}>{actions[c.action]??c.action}</span>{' поле '}<b>{tgt?.name??c.targetFieldId}</b>
                </p>
                <button onClick={() => cf.deleteCondition(c.id)} style={{ background:'none', border:'none', cursor:'pointer', color:'#9B97CC', fontSize:16 }}>✕</button>
              </div>
            );
          })}
        </div>
      )}

      {/* ── FIELD FORM MODAL ── */}
      {showForm && (
        <Modal title={editingField ? `Редактировать: ${editingField.name}` : 'Новое поле'} onClose={() => setShowForm(false)} wide>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {error && <div style={{ background:'#FEE2E2', color:'#DC2626', padding:'10px 14px', borderRadius:10, fontSize:13 }}>{error}</div>}
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              <div>
                <p style={{ margin:'0 0 6px', fontSize:12, color:'#6B7280', fontWeight:600 }}>Название *</p>
                <input style={inp} value={form.name} onChange={e=>setForm({...form,name:e.target.value})} placeholder="Название поля" autoFocus />
              </div>
              <div>
                <p style={{ margin:'0 0 6px', fontSize:12, color:'#6B7280', fontWeight:600 }}>Тип поля</p>
                <select style={inp} value={form.type} onChange={e=>setForm({...form,type:e.target.value})} disabled={!!editingField}>
                  {FIELD_TYPES.map(t => <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>)}
                </select>
              </div>
            </div>
            <div>
              <p style={{ margin:'0 0 6px', fontSize:12, color:'#6B7280', fontWeight:600 }}>Описание</p>
              <input style={inp} value={form.description} onChange={e=>setForm({...form,description:e.target.value})} placeholder="Подсказка для пользователя" />
            </div>
            <div>
              <p style={{ margin:'0 0 6px', fontSize:12, color:'#6B7280', fontWeight:600 }}>Группа</p>
              <select style={inp} value={form.groupId} onChange={e=>setForm({...form,groupId:e.target.value})}>
                <option value="">Без группы</option>
                {cf.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            {/* Type-specific config */}
            {(form.type==='SELECT'||form.type==='MULTISELECT') && (
              <div>
                <p style={{ margin:'0 0 8px', fontSize:12, color:'#6B7280', fontWeight:600 }}>Варианты выбора</p>
                <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginBottom:8 }}>
                  {form.config.options.map((opt:string,i:number) => (
                    <span key={i} style={{ display:'flex', alignItems:'center', gap:4, background:'#EDE9FE', color:'#7F77DD', fontSize:12, padding:'3px 10px', borderRadius:20, fontWeight:600 }}>
                      {opt}
                      <button type="button" onClick={() => setForm((f:any) => ({...f,config:{...f.config,options:f.config.options.filter((_:any,j:number)=>j!==i)}}))} style={{ background:'none', border:'none', cursor:'pointer', color:'#9B97CC', fontSize:12, padding:0 }}>✕</button>
                    </span>
                  ))}
                </div>
                <div style={{ display:'flex', gap:8 }}>
                  <input style={{...inp, flex:1}} value={optInput} onChange={e=>setOptInput(e.target.value)} placeholder="Добавить вариант..."
                    onKeyDown={e=>{ if(e.key==='Enter'&&optInput.trim()){ setForm((f:any)=>({...f,config:{...f.config,options:[...f.config.options,optInput.trim()]}})); setOptInput(''); }}} />
                  <button type="button" onClick={()=>{ if(optInput.trim()){ setForm((f:any)=>({...f,config:{...f.config,options:[...f.config.options,optInput.trim()]}})); setOptInput(''); }}} style={{...btn(), padding:'9px 16px'}}>+</button>
                </div>
              </div>
            )}
            {form.type==='MONEY' && (
              <div>
                <p style={{ margin:'0 0 6px', fontSize:12, color:'#6B7280', fontWeight:600 }}>Валюта</p>
                <select style={inp} value={form.config.currency} onChange={e=>setForm((f:any)=>({...f,config:{...f.config,currency:e.target.value}}))}>
                  <option value="RUB">RUB — Рубль (₽)</option>
                  <option value="USD">USD — Доллар ($)</option>
                  <option value="EUR">EUR — Евро (€)</option>
                  <option value="CNY">CNY — Юань (¥)</option>
                  <option value="KZT">KZT — Тенге (₸)</option>
                </select>
              </div>
            )}
            {form.type==='RATING' && (
              <div>
                <p style={{ margin:'0 0 6px', fontSize:12, color:'#6B7280', fontWeight:600 }}>Максимум звёзд</p>
                <input type="number" min={1} max={10} style={inp} value={form.config.maxStars} onChange={e=>setForm((f:any)=>({...f,config:{...f.config,maxStars:Number(e.target.value)}}))} />
              </div>
            )}

            {/* Visibility */}
            <div>
              <p style={{ margin:'0 0 10px', fontSize:12, color:'#6B7280', fontWeight:600 }}>Отображение</p>
              <div style={{ display:'flex', flexWrap:'wrap', gap:16 }}>
                {[
                  { k:'isRequired', l:'Обязательное' },
                  { k:'showInTable', l:'В таблице' },
                  { k:'showInCard', l:'В карточке' },
                  { k:'showInFilter', l:'В фильтрах' },
                  { k:'showOnCreate', l:'При создании' },
                ].map(({ k, l }) => (
                  <label key={k} style={{ display:'flex', alignItems:'center', gap:6, cursor:'pointer', fontSize:13, color:'#1a1040' }}>
                    <input type="checkbox" checked={form[k]} onChange={e=>setForm((f:any)=>({...f,[k]:e.target.checked}))} style={{ width:16, height:16, accentColor:'#7F77DD' }} />
                    {l}
                  </label>
                ))}
              </div>
            </div>

            <div style={{ display:'flex', gap:8, marginTop:4 }}>
              <button onClick={saveField} disabled={saving} style={btn()}>{saving ? 'Сохранение...' : editingField ? 'Сохранить' : 'Создать поле'}</button>
              <button onClick={() => setShowForm(false)} style={btn(false)}>Отмена</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children, wide=false }: { title:string; onClose:()=>void; children:React.ReactNode; wide?:boolean }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.4)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}>
      <div style={{ background:'white', borderRadius:20, boxShadow:'0 20px 60px rgba(0,0,0,0.2)', width:'100%', maxWidth: wide ? 640 : 440, maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'18px 24px', borderBottom:'1px solid #EDE9FE' }}>
          <h2 style={{ margin:0, fontSize:16, fontWeight:800, color:'#1a1040' }}>{title}</h2>
          <button onClick={onClose} style={{ background:'none', border:'none', cursor:'pointer', color:'#9B97CC', fontSize:20, lineHeight:1 }}>✕</button>
        </div>
        <div style={{ padding:'20px 24px' }}>{children}</div>
      </div>
    </div>
  );
}
