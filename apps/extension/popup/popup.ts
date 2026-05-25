async function init() {
  const dot        = document.getElementById('dot')!;
  const statusText = document.getElementById('status-text')!;
  const statusSub  = document.getElementById('status-sub')!;
  const loginForm  = document.getElementById('login-form')!;
  const logoutSec  = document.getElementById('logout-section')!;
  const userInfo   = document.getElementById('user-info')!;
  const errorEl    = document.getElementById('error')!;

  // Check auth from chrome.storage directly
  const result = await chrome.storage.local.get('et_auth');
  const auth = result['et_auth'] as any;

  if (auth?.accessToken) {
    dot.classList.add('online');
    statusText.textContent  = 'Подключено';
    statusSub.textContent   = 'Трекинг активен';
    userInfo.textContent    = auth.userId ? 'User: ' + auth.userId.slice(0, 8) + '...' : '';
    logoutSec.style.display = 'block';
  } else {
    dot.classList.add('offline');
    statusText.textContent  = 'Не подключено';
    statusSub.textContent   = 'Войдите для начала работы';
    loginForm.style.display = 'block';
  }

  document.getElementById('login-btn')?.addEventListener('click', async () => {
    const email    = (document.getElementById('email') as HTMLInputElement).value.trim();
    const password = (document.getElementById('password') as HTMLInputElement).value;
    if (!email || !password) return;

    errorEl.textContent = '';
    const btn = document.getElementById('login-btn') as HTMLButtonElement;
    btn.textContent = 'Вхожу...';
    btn.disabled = true;

    try {
      const res = await fetch('https://employee-tracker.ru/api/v1/auth/login', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ email, password }),
      });

      if (!res.ok) {
        const d = await res.json();
        errorEl.textContent = d.message ?? 'Неверный email или пароль';
        btn.textContent = 'Войти';
        btn.disabled = false;
        return;
      }

      const data = await res.json();
      await chrome.storage.local.set({
        et_auth: {
          accessToken: data.accessToken,
          signingKey:  data.accessToken,
          userId:      data.user.id,
          orgId:       data.user.orgId,
          expiresAt:   Date.now() + (data.expiresIn ?? 900) * 1000,
        }
      });
      window.location.reload();
    } catch {
      errorEl.textContent = 'Ошибка подключения к серверу';
      btn.textContent = 'Войти';
      btn.disabled = false;
    }
  });

  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    await chrome.storage.local.remove('et_auth');
    window.location.reload();
  });
}

init();
