const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

write('app/dashboard/settings/page.tsx', `'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/lib/usePermissions';

const DAYS = [
  { label: 'Пн', value: 1 },
  { label: 'Вт', value: 2 },
  { label: 'Ср', value: 3 },
  { label: 'Чт', value: 4 },
  { label: 'Пт', value: 5 },
  { label: 'Сб', value: 6 },
  { label: 'Вс', value: 0 },
];

const TIMEZONES = [
  { label: 'Москва (UTC+3)',        value: 'Europe/Moscow' },
  { label: 'Санкт-Петербург (UTC+3)', value: 'Europe/Moscow' },
  { label: 'Екатеринбург (UTC+5)',  value: 'Asia/Yekaterinburg' },
  { label: 'Новосибирск (UTC+7)',   value: 'Asia/Novosibirsk' },
  { label: 'Владивосток (UTC+10)',  value: 'Asia/Vladivostok' },
  { label: 'Калининград (UTC+2)',   value: 'Europe/Kaliningrad' },
  { label: 'UTC',                   value: 'UTC' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
  value: i,
  label: i.toString().padStart(2, '0') + ':00',
}));

export default function SettingsPage() {
  const router  = useRouter();
  const perms   = usePermissions();
  const [token, setToken]   = useState('');
  const [settings, setSettings] = useState<any>({
    enabled:    true,
    startHour:  9,
    endHour:    18,
    timezone:   'Europe/Moscow',
    workDays:   [1, 2, 3, 4, 5],
    lunchStart: 13,
    lunchEnd:   14,
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving]   = useState(false);
  const [saved, setSaved]     = useState(false);

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    if (!t) { router.push('/login'); return; }
    setToken(t);
    fetch('http://localhost:3001/api/v1/settings/work-hours', {
      headers: { Authorization: 'Bearer ' + t },
    }).then(r => r.json()).then(data => {
      setSettings(data);
      setLoading(false);
    });
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await fetch('http://localhost:3001/api/v1/settings/work-hours', {
        method:  'PUT',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body:    JSON.stringify(settings),
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally { setSaving(false); }
  };

  const toggleDay = (day: number) => {
    const days = settings.workDays.includes(day)
      ? settings.workDays.filter((d: number) => d !== day)
      : [...settings.workDays, day];
    setSettings({ ...settings, workDays: days });
  };

  const toggleLunch = () => {
    if (settings.lunchStart != null) {
      setSettings({ ...settings, lunchStart: null, lunchEnd: null });
    } else {
      setSettings({ ...settings, lunchStart: 13, lunchEnd: 14 });
    }
  };

  // Preview: current time status
  const [currentStatus, setCurrentStatus] = useState('');
  useEffect(() => {
    const check = () => {
      const now = new Date();
      try {
        const local = new Date(now.toLocaleString('en-US', { timeZone: settings.timezone }));
        const day   = local.getDay();
        const hour  = local.getHours() + local.getMinutes() / 60;
        const isWorkDay = settings.workDays.includes(day);
        const isWorkHour = hour >= settings.startHour && hour < settings.endHour;
        const isLunch = settings.lunchStart != null &&
          hour >= settings.lunchStart && hour < settings.lunchEnd;

        if (!settings.enabled)    setCurrentStatus('Рабочее время не ограничено');
        else if (!isWorkDay)      setCurrentStatus('Сейчас нерабочий день');
        else if (!isWorkHour)     setCurrentStatus('Сейчас нерабочее время');
        else if (isLunch)         setCurrentStatus('Сейчас обеденный перерыв');
        else                      setCurrentStatus('Сейчас рабочее время ✓');
      } catch { setCurrentStatus(''); }
    };
    check();
    const t = setInterval(check, 60_000);
    return () => clearInterval(t);
  }, [settings]);

  if (loading) return <div className="flex items-center justify-center h-64 text-gray-400">Загрузка...</div>;

  const canEdit = perms.isAdmin;

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Настройки</h1>
          <p className="text-sm text-gray-500 mt-0.5">Рабочее время организации</p>
        </div>
        {canEdit && (
          <button onClick={save} disabled={saving}
            className={"px-5 py-2 rounded-lg text-sm font-medium transition-all " +
              (saved ? 'bg-green-500 text-white' : 'bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-50')}>
            {saved ? '✓ Сохранено' : saving ? 'Сохраняю...' : 'Сохранить'}
          </button>
        )}
      </div>

      <div className="p-6 max-w-2xl flex flex-col gap-5">

        {/* Enable toggle */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Учёт рабочего времени</h3>
              <p className="text-sm text-gray-500 mt-0.5">Аналитика считает только активность в рабочее время</p>
            </div>
            <button onClick={() => canEdit && setSettings({ ...settings, enabled: !settings.enabled })}
              className={"relative w-12 h-6 rounded-full transition-colors " +
                (settings.enabled ? 'bg-indigo-600' : 'bg-gray-200') +
                (canEdit ? ' cursor-pointer' : ' cursor-default')}>
              <span className={"absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform " +
                (settings.enabled ? 'translate-x-6' : 'translate-x-0.5')} />
            </button>
          </div>

          {/* Status preview */}
          <div className={"mt-3 text-xs px-3 py-2 rounded-lg font-medium " +
            (currentStatus.includes('✓') ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500')}>
            {currentStatus}
          </div>
        </div>

        {settings.enabled && (
          <>
            {/* Timezone */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Часовой пояс</h3>
              <select
                value={settings.timezone}
                onChange={e => canEdit && setSettings({ ...settings, timezone: e.target.value })}
                disabled={!canEdit}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50">
                {TIMEZONES.map(tz => (
                  <option key={tz.value + tz.label} value={tz.value}>{tz.label}</option>
                ))}
              </select>
            </div>

            {/* Work days */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-3">Рабочие дни</h3>
              <div className="flex gap-2">
                {DAYS.map(day => (
                  <button key={day.value}
                    onClick={() => canEdit && toggleDay(day.value)}
                    disabled={!canEdit}
                    className={"w-10 h-10 rounded-lg text-sm font-medium transition-colors " +
                      (settings.workDays.includes(day.value)
                        ? 'bg-indigo-600 text-white'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200') +
                      (!canEdit ? ' cursor-default' : '')}>
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Work hours */}
            <div className="bg-white rounded-xl border border-gray-200 p-5">
              <h3 className="font-semibold text-gray-900 mb-4">Рабочие часы</h3>
              <div className="flex items-center gap-4">
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Начало</label>
                  <select value={settings.startHour}
                    onChange={e => canEdit && setSettings({ ...settings, startHour: parseInt(e.target.value) })}
                    disabled={!canEdit}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50">
                    {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                  </select>
                </div>
                <span className="text-gray-400 mt-4">—</span>
                <div className="flex-1">
                  <label className="text-xs text-gray-500 mb-1 block">Конец</label>
                  <select value={settings.endHour}
                    onChange={e => canEdit && setSettings({ ...settings, endHour: parseInt(e.target.value) })}
                    disabled={!canEdit}
                    className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50">
                    {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                  </select>
                </div>
              </div>

              {/* Lunch break */}
              <div className="mt-4 pt-4 border-t border-gray-100">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-sm font-medium text-gray-700">Обеденный перерыв</span>
                  <button onClick={() => canEdit && toggleLunch()}
                    disabled={!canEdit}
                    className={"relative w-10 h-5 rounded-full transition-colors " +
                      (settings.lunchStart != null ? 'bg-indigo-600' : 'bg-gray-200') +
                      (!canEdit ? ' cursor-default' : ' cursor-pointer')}>
                    <span className={"absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform " +
                      (settings.lunchStart != null ? 'translate-x-5' : 'translate-x-0.5')} />
                  </button>
                </div>
                {settings.lunchStart != null && (
                  <div className="flex items-center gap-4">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 mb-1 block">Начало</label>
                      <select value={settings.lunchStart}
                        onChange={e => canEdit && setSettings({ ...settings, lunchStart: parseInt(e.target.value) })}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50">
                        {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                      </select>
                    </div>
                    <span className="text-gray-400 mt-4">—</span>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 mb-1 block">Конец</label>
                      <select value={settings.lunchEnd}
                        onChange={e => canEdit && setSettings({ ...settings, lunchEnd: parseInt(e.target.value) })}
                        disabled={!canEdit}
                        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 disabled:bg-gray-50">
                        {HOURS.map(h => <option key={h.value} value={h.value}>{h.label}</option>)}
                      </select>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Summary */}
            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4">
              <p className="text-sm text-indigo-700 font-medium mb-1">Текущие настройки</p>
              <p className="text-xs text-indigo-600">
                Рабочее время: {DAYS.filter(d => settings.workDays.includes(d.value)).map(d => d.label).join(', ')} ·
                {String(settings.startHour).padStart(2,'0')}:00 — {String(settings.endHour).padStart(2,'0')}:00
                {settings.lunchStart != null && ' · Обед ' + String(settings.lunchStart).padStart(2,'0') + ':00—' + String(settings.lunchEnd).padStart(2,'0') + ':00'}
                {' · ' + (TIMEZONES.find(t => t.value === settings.timezone)?.label ?? settings.timezone)}
              </p>
            </div>
          </>
        )}

        {!canEdit && (
          <p className="text-sm text-gray-400 text-center">Только администратор может изменять настройки</p>
        )}
      </div>
    </div>
  );
}
`);

// Add to sidebar
const sidebar = fs.readFileSync('components/layouts/Sidebar.tsx', 'utf8');
if (!sidebar.includes('/dashboard/settings')) {
  const updated = sidebar.replace(
    `{ href: '/dashboard/export',       icon: '↓',  label: 'Экспорт',        adminOnly: true  },`,
    `{ href: '/dashboard/export',       icon: '↓',  label: 'Экспорт',        adminOnly: true  },
    { href: '/dashboard/settings',     icon: '⚙️',  label: 'Настройки',      adminOnly: true  },`
  );
  fs.writeFileSync('components/layouts/Sidebar.tsx', updated);
  console.log('✓ sidebar updated');
}

console.log('\n✅ Work hours frontend created');
