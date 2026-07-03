'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useCustomFields, CustomField, FieldGroup } from '@/hooks/useCustomFields';
import { FIELD_TYPE_LABELS } from '@/components/custom-fields/FieldRenderer';

const FIELD_TYPES = Object.keys(FIELD_TYPE_LABELS);

export default function CustomFieldsSettingsPage() {
  const router = useRouter();
  const [token, setToken]   = useState('');
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

  const [tab, setTab] = useState<'fields' | 'groups' | 'types' | 'conditions'>('fields');
  const [showFieldForm, setShowFieldForm] = useState(false);
  const [editingField, setEditingField] = useState<CustomField | null>(null);
  const [showGroupForm, setShowGroupForm] = useState(false);
  const [showTypeForm, setShowTypeForm] = useState(false);

  // Field form state
  const [form, setForm] = useState({
    name: '', type: 'TEXT', description: '', groupId: '',
    isRequired: false, showInTable: true, showInCard: true,
    showInFilter: true, showOnCreate: true,
    config: { options: [] as string[], currency: 'RUB', maxStars: 5 },
  });
  const [optionInput, setOptionInput] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const openCreate = () => {
    setEditingField(null);
    setForm({ name: '', type: 'TEXT', description: '', groupId: '',
      isRequired: false, showInTable: true, showInCard: true, showInFilter: true, showOnCreate: true,
      config: { options: [], currency: 'RUB', maxStars: 5 } });
    setShowFieldForm(true);
  };

  const openEdit = (f: CustomField) => {
    setEditingField(f);
    setForm({
      name: f.name, type: f.type, description: f.description ?? '',
      groupId: f.groupId ?? '',
      isRequired: f.isRequired, showInTable: f.showInTable, showInCard: f.showInCard,
      showInFilter: f.showInFilter, showOnCreate: f.showOnCreate,
      config: { options: (f.config as any)?.options ?? [], currency: (f.config as any)?.currency ?? 'RUB', maxStars: (f.config as any)?.maxStars ?? 5 },
    });
    setShowFieldForm(true);
  };

  const saveField = async () => {
    if (!form.name.trim()) { setError('Введите название поля'); return; }
    setSaving(true); setError('');
    try {
      const payload = {
        ...form,
        config: form.type === 'SELECT' || form.type === 'MULTISELECT'
          ? { options: form.config.options }
          : form.type === 'MONEY'
          ? { currency: form.config.currency }
          : form.type === 'RATING'
          ? { maxStars: form.config.maxStars }
          : undefined,
      };
      if (editingField) {
        await cf.updateField(editingField.id, payload as any);
      } else {
        await cf.createField(payload as any);
      }
      setShowFieldForm(false);
    } catch (e: any) {
      setError(e.message ?? 'Ошибка сохранения');
    }
    setSaving(false);
  };

  const deleteField = async (f: CustomField) => {
    if (f.isSystem) return;
    if (!confirm(`Удалить поле "${f.name}"? Все значения будут потеряны.`)) return;
    await cf.deleteField(f.id);
  };

  // Group form
  const [gForm, setGForm] = useState({ name: '', color: '#7F77DD', description: '' });
  const saveGroup = async () => {
    if (!gForm.name.trim()) return;
    await cf.createGroup(gForm);
    setShowGroupForm(false);
    setGForm({ name: '', color: '#7F77DD', description: '' });
  };

  // TaskType form
  const [ttForm, setTtForm] = useState({ name: '', icon: '📋', color: '#7F77DD' });
  const saveTaskType = async () => {
    if (!ttForm.name.trim()) return;
    await cf.createTaskType(ttForm);
    setShowTypeForm(false);
    setTtForm({ name: '', icon: '📋', color: '#7F77DD' });
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">Пользовательские поля</h1>
        <p className="text-gray-500 text-sm mt-1">Настройте карточку задачи под ваши процессы</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        {[
          { key: 'fields',     label: 'Поля' },
          { key: 'groups',     label: 'Группы' },
          { key: 'types',      label: 'Типы задач' },
          { key: 'conditions', label: 'Условия' },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key as any)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              tab === t.key
                ? 'border-purple-500 text-purple-600 dark:text-purple-400'
                : 'border-transparent text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* FIELDS TAB */}
      {tab === 'fields' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500">{cf.fields.length} полей</p>
            <button onClick={openCreate}
              className="flex items-center gap-2 bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
              + Добавить поле
            </button>
          </div>

          <div className="space-y-2">
            {cf.fields.map(f => (
              <div key={f.id}
                className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl hover:border-gray-300 transition-colors">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-gray-800 dark:text-white text-sm">{f.name}</span>
                    {f.isSystem && (
                      <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-500 px-2 py-0.5 rounded-full">системное</span>
                    )}
                    {f.isRequired && (
                      <span className="text-xs bg-red-50 text-red-500 px-2 py-0.5 rounded-full">обязательное</span>
                    )}
                    {f.group && (
                      <span className="text-xs px-2 py-0.5 rounded-full text-white" style={{ backgroundColor: f.group.color ?? '#7F77DD' }}>
                        {f.group.name}
                      </span>
                    )}
                  </div>
                  {f.description && <p className="text-xs text-gray-400 mt-0.5">{f.description}</p>}
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-600 dark:text-purple-300 px-2 py-1 rounded-lg font-mono">
                    {FIELD_TYPE_LABELS[f.type] ?? f.type}
                  </span>
                  <div className="flex gap-1 text-xs text-gray-400">
                    {f.showInTable  && <span title="В таблице">⊞</span>}
                    {f.showInCard   && <span title="В карточке">☰</span>}
                    {f.showInFilter && <span title="В фильтрах">⧙</span>}
                  </div>
                  {!f.isSystem && (
                    <div className="flex gap-1">
                      <button onClick={() => openEdit(f)}
                        className="text-gray-400 hover:text-purple-600 text-sm px-2 py-1 rounded hover:bg-purple-50 dark:hover:bg-purple-900/30 transition-colors">
                        ✎
                      </button>
                      <button onClick={() => deleteField(f)}
                        className="text-gray-400 hover:text-red-500 text-sm px-2 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors">
                        ✕
                      </button>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* GROUPS TAB */}
      {tab === 'groups' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500">{cf.groups.length} групп</p>
            <button onClick={() => setShowGroupForm(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              + Создать группу
            </button>
          </div>
          <div className="space-y-2">
            {cf.groups.map(g => (
              <div key={g.id}
                className="flex items-center gap-3 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
                <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: g.color ?? '#7F77DD' }} />
                <div className="flex-1">
                  <p className="font-medium text-gray-800 dark:text-white">{g.name}</p>
                  <p className="text-xs text-gray-400">{g.fields?.length ?? 0} полей</p>
                </div>
                <button onClick={() => cf.deleteGroup(g.id)}
                  className="text-gray-400 hover:text-red-500 text-sm px-2">✕</button>
              </div>
            ))}
          </div>
          {showGroupForm && (
            <Modal title="Новая группа" onClose={() => setShowGroupForm(false)}>
              <div className="space-y-3">
                <input className={INPUT} placeholder="Название группы" value={gForm.name}
                  onChange={e => setGForm({ ...gForm, name: e.target.value })} autoFocus />
                <div className="flex items-center gap-3">
                  <label className="text-sm text-gray-600">Цвет:</label>
                  <input type="color" value={gForm.color}
                    onChange={e => setGForm({ ...gForm, color: e.target.value })}
                    className="w-8 h-8 rounded cursor-pointer" />
                </div>
                <div className="flex gap-2 pt-2">
                  <button onClick={saveGroup} className={BTN_PRIMARY}>Сохранить</button>
                  <button onClick={() => setShowGroupForm(false)} className={BTN_GHOST}>Отмена</button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* TASK TYPES TAB */}
      {tab === 'types' && (
        <div>
          <div className="flex justify-between items-center mb-4">
            <p className="text-sm text-gray-500">Шаблоны задач с предустановленными полями</p>
            <button onClick={() => setShowTypeForm(true)}
              className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg text-sm font-medium">
              + Создать тип
            </button>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {cf.taskTypes.map(tt => (
              <div key={tt.id}
                className="p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-xl">{tt.icon ?? '📋'}</span>
                  <span className="font-medium text-gray-800 dark:text-white">{tt.name}</span>
                  {tt.isDefault && <span className="text-xs bg-green-100 text-green-600 px-2 py-0.5 rounded-full">по умолч.</span>}
                </div>
                <p className="text-xs text-gray-400">
                  {tt.fieldBindings.length > 0
                    ? tt.fieldBindings.map(b => b.field.name).join(', ')
                    : 'Нет привязанных полей'}
                </p>
              </div>
            ))}
          </div>
          {showTypeForm && (
            <Modal title="Новый тип задачи" onClose={() => setShowTypeForm(false)}>
              <div className="space-y-3">
                <input className={INPUT} placeholder="Название (Закупка, Контент...)" value={ttForm.name}
                  onChange={e => setTtForm({ ...ttForm, name: e.target.value })} autoFocus />
                <input className={INPUT} placeholder="Иконка (emoji)" value={ttForm.icon}
                  onChange={e => setTtForm({ ...ttForm, icon: e.target.value })} />
                <div className="flex gap-2 pt-2">
                  <button onClick={saveTaskType} className={BTN_PRIMARY}>Создать</button>
                  <button onClick={() => setShowTypeForm(false)} className={BTN_GHOST}>Отмена</button>
                </div>
              </div>
            </Modal>
          )}
        </div>
      )}

      {/* CONDITIONS TAB */}
      {tab === 'conditions' && (
        <div>
          <div className="mb-4">
            <p className="text-sm text-gray-500">Показывайте, скрывайте или делайте поля обязательными в зависимости от значений других полей.</p>
          </div>
          {cf.conditions.length === 0 ? (
            <div className="text-center py-12 text-gray-400">
              <p className="text-lg mb-2">Нет условий</p>
              <p className="text-sm">Условная логика настраивается через кнопку «Добавить условие» на странице редактирования поля</p>
            </div>
          ) : (
            <div className="space-y-2">
              {cf.conditions.map(c => {
                const src = cf.fields.find(f => f.id === c.sourceFieldId);
                const tgt = cf.fields.find(f => f.id === c.targetFieldId);
                return (
                  <div key={c.id} className="flex items-center gap-3 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl text-sm">
                    <span className="text-gray-600 dark:text-gray-300 flex-1">
                      <span className="font-medium">{src?.name ?? c.sourceFieldId}</span>
                      {' '}<span className="text-gray-400">{c.operator}</span>{' '}
                      <span className="font-mono text-xs bg-gray-100 dark:bg-gray-700 px-1 rounded">{String(c.value ?? '')}</span>
                      {' → '}
                      <span className="text-purple-600 dark:text-purple-400 font-medium">{ACTION_LABELS[c.action] ?? c.action}</span>
                      {' '}поле <span className="font-medium">{tgt?.name ?? c.targetFieldId}</span>
                    </span>
                    <button onClick={() => cf.deleteCondition(c.id)}
                      className="text-gray-400 hover:text-red-500 px-2">✕</button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* FIELD FORM MODAL */}
      {showFieldForm && (
        <Modal
          title={editingField ? `Редактировать: ${editingField.name}` : 'Новое поле'}
          onClose={() => setShowFieldForm(false)}
          wide
        >
          <div className="space-y-4">
            {error && <div className="text-sm text-red-500 bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-lg">{error}</div>}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className={LABEL}>Название *</label>
                <input className={INPUT} value={form.name} onChange={e => setForm({ ...form, name: e.target.value })}
                  placeholder="Название поля" autoFocus />
              </div>
              <div>
                <label className={LABEL}>Тип поля</label>
                <select className={INPUT} value={form.type}
                  onChange={e => setForm({ ...form, type: e.target.value })}
                  disabled={!!editingField}>
                  {FIELD_TYPES.map(t => <option key={t} value={t}>{FIELD_TYPE_LABELS[t]}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className={LABEL}>Описание</label>
              <input className={INPUT} value={form.description}
                onChange={e => setForm({ ...form, description: e.target.value })}
                placeholder="Подсказка для пользователя" />
            </div>

            <div>
              <label className={LABEL}>Группа</label>
              <select className={INPUT} value={form.groupId}
                onChange={e => setForm({ ...form, groupId: e.target.value })}>
                <option value="">Без группы</option>
                {cf.groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
              </select>
            </div>

            {/* Type-specific config */}
            {(form.type === 'SELECT' || form.type === 'MULTISELECT') && (
              <div>
                <label className={LABEL}>Варианты выбора</label>
                <div className="flex flex-wrap gap-2 mb-2">
                  {form.config.options.map((opt, i) => (
                    <span key={i} className="flex items-center gap-1 bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 text-sm px-2 py-1 rounded-full">
                      {opt}
                      <button type="button" onClick={() => setForm(f => ({
                        ...f, config: { ...f.config, options: f.config.options.filter((_, j) => j !== i) }
                      }))} className="text-purple-400 hover:text-red-500 ml-1">✕</button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input className={INPUT} value={optionInput} onChange={e => setOptionInput(e.target.value)}
                    placeholder="Добавить вариант..."
                    onKeyDown={e => {
                      if (e.key === 'Enter' && optionInput.trim()) {
                        setForm(f => ({ ...f, config: { ...f.config, options: [...f.config.options, optionInput.trim()] } }));
                        setOptionInput('');
                      }
                    }} />
                  <button type="button" onClick={() => {
                    if (optionInput.trim()) {
                      setForm(f => ({ ...f, config: { ...f.config, options: [...f.config.options, optionInput.trim()] } }));
                      setOptionInput('');
                    }
                  }} className="px-3 py-2 bg-purple-600 text-white rounded-lg text-sm">+</button>
                </div>
              </div>
            )}

            {form.type === 'MONEY' && (
              <div>
                <label className={LABEL}>Валюта</label>
                <select className={INPUT} value={form.config.currency}
                  onChange={e => setForm(f => ({ ...f, config: { ...f.config, currency: e.target.value } }))}>
                  <option value="RUB">RUB — Рубль (₽)</option>
                  <option value="USD">USD — Доллар ($)</option>
                  <option value="EUR">EUR — Евро (€)</option>
                  <option value="CNY">CNY — Юань (¥)</option>
                  <option value="KZT">KZT — Тенге (₸)</option>
                </select>
              </div>
            )}

            {form.type === 'RATING' && (
              <div>
                <label className={LABEL}>Максимум звёзд</label>
                <input type="number" min={1} max={10} className={INPUT} value={form.config.maxStars}
                  onChange={e => setForm(f => ({ ...f, config: { ...f.config, maxStars: Number(e.target.value) } }))} />
              </div>
            )}

            {/* Visibility checkboxes */}
            <div>
              <label className={LABEL}>Отображение</label>
              <div className="flex flex-wrap gap-4">
                {[
                  { key: 'isRequired',   label: 'Обязательное' },
                  { key: 'showInTable',  label: 'В таблице' },
                  { key: 'showInCard',   label: 'В карточке' },
                  { key: 'showInFilter', label: 'В фильтрах' },
                  { key: 'showOnCreate', label: 'При создании' },
                ].map(({ key, label }) => (
                  <label key={key} className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" className="w-4 h-4 accent-purple-600 rounded"
                      checked={(form as any)[key]}
                      onChange={e => setForm(f => ({ ...f, [key]: e.target.checked }))} />
                    <span className="text-sm text-gray-600 dark:text-gray-300">{label}</span>
                  </label>
                ))}
              </div>
            </div>

            <div className="flex gap-2 pt-2">
              <button onClick={saveField} disabled={saving} className={BTN_PRIMARY}>
                {saving ? 'Сохранение...' : editingField ? 'Сохранить' : 'Создать поле'}
              </button>
              <button onClick={() => setShowFieldForm(false)} className={BTN_GHOST}>Отмена</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children, wide = false }: {
  title: string; onClose: () => void; children: React.ReactNode; wide?: boolean;
}) {
  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className={`bg-white dark:bg-gray-900 rounded-2xl shadow-2xl w-full ${wide ? 'max-w-2xl' : 'max-w-md'} max-h-[90vh] overflow-y-auto`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="font-semibold text-gray-900 dark:text-white">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 text-xl">✕</button>
        </div>
        <div className="px-6 py-4">{children}</div>
      </div>
    </div>
  );
}

const INPUT = 'w-full text-sm border border-gray-200 dark:border-gray-600 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-purple-400 bg-white dark:bg-gray-800 dark:text-white';
const LABEL = 'block text-sm text-gray-600 dark:text-gray-400 mb-1';
const BTN_PRIMARY = 'bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors';
const BTN_GHOST = 'border border-gray-200 dark:border-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 px-4 py-2 rounded-lg text-sm transition-colors';

const ACTION_LABELS: Record<string, string> = {
  SHOW: 'показать', HIDE: 'скрыть', REQUIRE: 'сделать обязательным',
  UNREQUIRE: 'снять обязательность', SET_VALUE: 'установить значение', CLEAR_VALUE: 'очистить',
};
