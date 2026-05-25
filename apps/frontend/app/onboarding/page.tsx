'use client';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const STEPS = [
  { id: 'welcome',    title: 'Добро пожаловать',       icon: '👋' },
  { id: 'org',        title: 'Ваша организация',        icon: '🏢' },
  { id: 'invite',     title: 'Пригласите команду',      icon: '👥' },
  { id: 'extension',  title: 'Установите расширение',   icon: '🔌' },
  { id: 'done',       title: 'Всё готово!',             icon: '🎉' },
];

export default function OnboardingPage() {
  const router  = useRouter();
  const [step, setStep]     = useState(0);
  const [token, setToken]   = useState('');
  const [user, setUser]     = useState<any>(null);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole]   = useState('EMPLOYEE');
  const [inviting, setInviting]       = useState(false);
  const [invitedCount, setInvitedCount] = useState(0);
  const [inviteError, setInviteError]   = useState('');
  const [inviteSuccess, setInviteSuccess] = useState('');

  useEffect(() => {
    const t = localStorage.getItem('access_token');
    const u = localStorage.getItem('user');
    if (!t || !u) { router.push('/login'); return; }
    setToken(t);
    setUser(JSON.parse(u));

    // Check if already onboarded
    const onboarded = localStorage.getItem('onboarded');
    if (onboarded) router.push('/dashboard');
  }, []);

  const invite = async () => {
    if (!inviteEmail.trim()) return;
    setInviting(true);
    setInviteError('');
    setInviteSuccess('');
    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/employees/invite', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + token },
        body:    JSON.stringify({ email: inviteEmail.trim(), role: inviteRole, name: inviteEmail.split('@')[0] }),
      });
      if (res.ok) {
        setInviteSuccess(inviteEmail + ' добавлен');
        setInviteEmail('');
        setInvitedCount(c => c + 1);
      } else {
        const d = await res.json();
        setInviteError(d.message ?? 'Ошибка');
      }
    } finally { setInviting(false); }
  };

  const finish = () => {
    localStorage.setItem('onboarded', '1');
    router.push('/dashboard');
  };

  const next = () => setStep(s => Math.min(s + 1, STEPS.length - 1));
  const prev = () => setStep(s => Math.max(s - 1, 0));

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">

        {/* Progress */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div className={"w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all " +
                (i < step  ? 'bg-indigo-600 text-white' :
                 i === step ? 'bg-indigo-600 text-white ring-4 ring-indigo-100' :
                              'bg-gray-100 text-gray-400')}>
                {i < step ? '✓' : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={"w-8 h-0.5 " + (i < step ? 'bg-indigo-400' : 'bg-gray-200')} />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl p-8">

          {/* Step 0: Welcome */}
          {step === 0 && (
            <div className="text-center">
              <div className="text-6xl mb-4">👋</div>
              <h1 className="text-3xl font-bold text-gray-900 mb-3">
                Добро пожаловать, {user?.name}!
              </h1>
              <p className="text-gray-500 mb-6 max-w-md mx-auto">
                Employee Tracker поможет вам отслеживать активность команды на Wildberries и Ozon,
                управлять задачами и анализировать продуктивность.
              </p>
              <div className="grid grid-cols-3 gap-4 mb-8 text-sm">
                {[
                  { icon: '📊', title: 'Аналитика', desc: 'Активность на WB и Ozon' },
                  { icon: '✓',  title: 'Задачи',    desc: 'Канбан доска для команды' },
                  { icon: '⏱',  title: 'Табель',    desc: 'Учёт рабочего времени' },
                ].map(f => (
                  <div key={f.title} className="bg-indigo-50 rounded-xl p-4">
                    <div className="text-2xl mb-2">{f.icon}</div>
                    <p className="font-semibold text-gray-800">{f.title}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{f.desc}</p>
                  </div>
                ))}
              </div>
              <button onClick={next}
                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors">
                Начать настройку →
              </button>
            </div>
          )}

          {/* Step 1: Org info */}
          {step === 1 && (
            <div>
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">🏢</div>
                <h2 className="text-2xl font-bold text-gray-900">Ваша организация</h2>
                <p className="text-gray-500 mt-1">Вот что мы знаем о вашей компании</p>
              </div>
              <div className="bg-gray-50 rounded-xl p-5 mb-6 flex flex-col gap-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Название</span>
                  <span className="font-medium text-gray-900">Test Company</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Администратор</span>
                  <span className="font-medium text-gray-900">{user?.name}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Email</span>
                  <span className="font-medium text-gray-900">{user?.email}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-500">Роль</span>
                  <span className="px-2 py-0.5 bg-purple-100 text-purple-700 rounded text-xs font-medium">ADMIN</span>
                </div>
              </div>
              <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-6">
                <p className="text-sm text-blue-700">
                  💡 Рабочие часы по умолчанию: Пн–Пт, 09:00–18:00 (Москва).
                  Вы можете изменить их в разделе <strong>Настройки</strong>.
                </p>
              </div>
              <div className="flex gap-3 justify-end">
                <button onClick={prev} className="px-5 py-2 text-gray-500 hover:text-gray-700">← Назад</button>
                <button onClick={next} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700">
                  Далее →
                </button>
              </div>
            </div>
          )}

          {/* Step 2: Invite */}
          {step === 2 && (
            <div>
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">👥</div>
                <h2 className="text-2xl font-bold text-gray-900">Пригласите команду</h2>
                <p className="text-gray-500 mt-1">Добавьте сотрудников — они смогут отмечать рабочее время</p>
              </div>

              <div className="flex gap-2 mb-3">
                <input value={inviteEmail} onChange={e => setInviteEmail(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && invite()}
                  placeholder="email@company.ru"
                  className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                <select value={inviteRole} onChange={e => setInviteRole(e.target.value)}
                  className="border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400">
                  <option value="EMPLOYEE">Сотрудник</option>
                  <option value="MANAGER">Менеджер</option>
                  <option value="VIEWER">Наблюдатель</option>
                </select>
                <button onClick={invite} disabled={inviting || !inviteEmail}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-medium hover:bg-indigo-700 disabled:opacity-50">
                  {inviting ? '...' : '+ Добавить'}
                </button>
              </div>

              {inviteError   && <p className="text-xs text-red-500 mb-2">{inviteError}</p>}
              {inviteSuccess && <p className="text-xs text-green-600 mb-2">✓ {inviteSuccess}</p>}

              {invitedCount > 0 && (
                <div className="bg-green-50 border border-green-100 rounded-lg p-3 mb-4 text-sm text-green-700">
                  ✓ Добавлено сотрудников: {invitedCount}. Пароль по умолчанию: <strong>password123</strong>
                </div>
              )}

              <div className="bg-yellow-50 border border-yellow-100 rounded-xl p-4 mb-6">
                <p className="text-sm text-yellow-700">
                  💡 Можно пропустить этот шаг и добавить сотрудников позже в разделе <strong>Сотрудники</strong>.
                </p>
              </div>

              <div className="flex gap-3 justify-end">
                <button onClick={prev} className="px-5 py-2 text-gray-500 hover:text-gray-700">← Назад</button>
                <button onClick={next} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700">
                  {invitedCount > 0 ? 'Далее →' : 'Пропустить →'}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Extension */}
          {step === 3 && (
            <div>
              <div className="text-center mb-6">
                <div className="text-4xl mb-3">🔌</div>
                <h2 className="text-2xl font-bold text-gray-900">Установите расширение Chrome</h2>
                <p className="text-gray-500 mt-1">Расширение отслеживает активность сотрудников на WB и Ozon</p>
              </div>

              <div className="flex flex-col gap-3 mb-6">
                {[
                  { num: '1', text: 'Откройте Chrome и перейдите в chrome://extensions' },
                  { num: '2', text: 'Включите "Режим разработчика" (переключатель вверху справа)' },
                  { num: '3', text: 'Нажмите "Загрузить распакованное расширение"' },
                  { num: '4', text: 'Выберите папку: apps/extension/dist' },
                  { num: '5', text: 'Кликните на иконку расширения и войдите с вашим email' },
                ].map(item => (
                  <div key={item.num} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <span className="w-6 h-6 rounded-full bg-indigo-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">
                      {item.num}
                    </span>
                    <p className="text-sm text-gray-700">{item.text}</p>
                  </div>
                ))}
              </div>

              <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-4 mb-6">
                <p className="text-sm text-indigo-700">
                  💡 После установки откройте seller.wildberries.ru или seller.ozon.ru —
                  данные начнут поступать автоматически в течение 5 минут.
                </p>
              </div>

              <div className="flex gap-3 justify-end">
                <button onClick={prev} className="px-5 py-2 text-gray-500 hover:text-gray-700">← Назад</button>
                <button onClick={next} className="px-6 py-2.5 bg-indigo-600 text-white rounded-xl font-medium hover:bg-indigo-700">
                  Готово! Далее →
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Done */}
          {step === 4 && (
            <div className="text-center">
              <div className="text-6xl mb-4">🎉</div>
              <h2 className="text-3xl font-bold text-gray-900 mb-3">Всё готово!</h2>
              <p className="text-gray-500 mb-8 max-w-md mx-auto">
                Employee Tracker настроен и готов к работе. Начните с дашборда — там видна вся статистика организации.
              </p>

              <div className="grid grid-cols-2 gap-3 mb-8 text-left">
                {[
                  { href: '/dashboard',              icon: '⊞', label: 'Дашборд',        desc: 'Обзор организации' },
                  { href: '/dashboard/employees',    icon: '👥', label: 'Сотрудники',     desc: 'Управление командой' },
                  { href: '/dashboard/analytics',    icon: '📊', label: 'Аналитика',      desc: 'Графики и KPI' },
                  { href: '/dashboard/timesheet',    icon: '🗓️', label: 'Табель',          desc: 'Рабочее время' },
                ].map(item => (
                  <button key={item.href}
                    onClick={() => { localStorage.setItem('onboarded', '1'); router.push(item.href); }}
                    className="flex items-center gap-3 p-3 bg-gray-50 hover:bg-indigo-50 hover:border-indigo-200 border border-gray-100 rounded-xl transition-colors text-left">
                    <span className="text-2xl">{item.icon}</span>
                    <div>
                      <p className="font-semibold text-gray-900 text-sm">{item.label}</p>
                      <p className="text-xs text-gray-500">{item.desc}</p>
                    </div>
                  </button>
                ))}
              </div>

              <button onClick={finish}
                className="px-8 py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors">
                Перейти на дашборд →
              </button>
            </div>
          )}
        </div>

        {/* Step label */}
        <p className="text-center text-xs text-gray-400 mt-4">
          Шаг {step + 1} из {STEPS.length} — {STEPS[step].title}
        </p>
      </div>
    </div>
  );
}
