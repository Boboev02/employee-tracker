'use client';
// Глобальное обновление сессии. Подключается один раз (components/AuthSessionInit).
// 1) Во все запросы к /api/ с заголовком Bearer подставляется актуальный токен из localStorage.
// 2) При 401 токен обновляется через /api/v1/auth/refresh-extension и запрос повторяется.
// 3) За 30 минут до истечения токен обновляется заранее (и при возврате на вкладку).
// 4) Если обновить не удалось — выход на /login.

const REFRESH_URL = '/api/v1/auth/refresh-extension';
const SKIP = ['/api/v1/auth/login', '/api/v1/auth/register', '/api/v1/auth/refresh'];
const EARLY_MS = 30 * 60 * 1000;

let refreshing: Promise<string | null> | null = null;
let origFetch: typeof fetch;

function tokenExp(token: string): number | null {
  try {
    const part = token.split('.')[1];
    const json = atob(part.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = JSON.parse(json)?.exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch { return null; }
}

function refreshToken(oldToken: string): Promise<string | null> {
  if (refreshing) return refreshing;
  refreshing = (async () => {
    try {
      const res = await origFetch(REFRESH_URL, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + oldToken },
      });
      if (!res.ok) return null;
      const data = await res.json().catch(() => null);
      const t = data?.accessToken;
      if (typeof t !== 'string' || !t) return null;
      localStorage.setItem('access_token', t);
      return t;
    } catch {
      return null;
    } finally {
      setTimeout(() => { refreshing = null; }, 0);
    }
  })();
  return refreshing;
}

function logout(): boolean {
  try {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
  } catch {}
  if (!window.location.pathname.startsWith('/login')) {
    window.location.href = '/login';
    return true;
  }
  return false;
}

// Идёт переход на /login — «замораживаем» запрос, чтобы страница не упала на ответе 401
const PENDING = () => new Promise<Response>(() => {});

function apiPath(input: RequestInfo | URL): string | null {
  try {
    const raw = typeof input === 'string' ? input : input instanceof URL ? input.href : null;
    if (!raw) return null;
    const u = new URL(raw, window.location.origin);
    if (u.origin !== window.location.origin) return null;
    return u.pathname.startsWith('/api/') ? u.pathname : null;
  } catch { return null; }
}

async function maybeRefreshEarly() {
  const t = localStorage.getItem('access_token');
  if (!t) return;
  const exp = tokenExp(t);
  if (exp && exp - Date.now() < EARLY_MS) await refreshToken(t);
}

function install() {
  const w = window as any;
  if (w.__etAuthFetchInstalled) return;
  w.__etAuthFetchInstalled = true;
  origFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const path = apiPath(input);
    if (!path || SKIP.some(s => path.startsWith(s))) return origFetch(input, init);

    const headers = new Headers(init?.headers);
    const auth = headers.get('Authorization') ?? '';
    if (!auth.startsWith('Bearer ')) return origFetch(input, init);

    // старый токен, «запомненный» страницей, заменяем актуальным
    const current = localStorage.getItem('access_token');
    if (current && auth !== 'Bearer ' + current) headers.set('Authorization', 'Bearer ' + current);
    const used = headers.get('Authorization')!.slice(7);

    const res = await origFetch(input, { ...init, headers });
    if (res.status !== 401) return res;

    // вдруг токен уже обновил параллельный запрос
    const latest = localStorage.getItem('access_token');
    const fresh = latest && latest !== used ? latest : await refreshToken(used);
    if (!fresh) return logout() ? PENDING() : res;

    headers.set('Authorization', 'Bearer ' + fresh);
    const retry = await origFetch(input, { ...init, headers });
    if (retry.status === 401 && logout()) return PENDING();
    return retry;
  };

  maybeRefreshEarly();
  setInterval(maybeRefreshEarly, 5 * 60 * 1000);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') maybeRefreshEarly();
  });
}

if (typeof window !== 'undefined') install();

export {};
