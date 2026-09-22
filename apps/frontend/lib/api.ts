'use client';

// Simple toast notification system using Sonner (already in package.json)
// Usage: import { toast } from 'sonner';
// toast.error('Ошибка загрузки данных')
// toast.success('Сохранено')

// API error handler helper
export async function apiCall<T>(
  fn: () => Promise<Response>,
  options?: {
    successMsg?: string;
    errorMsg?: string;
    onSuccess?: (data: T) => void;
  }
): Promise<T | null> {
  try {
    const res = await fn();
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      const msg = body?.message ?? body?.error ?? options?.errorMsg ?? 'Ошибка сервера';

      // Dynamic import to avoid SSR issues
      if (typeof window !== 'undefined') {
        const { toast } = await import('sonner');
        toast.error(msg, { duration: 4000 });
      }
      return null;
    }
    const data: T = await res.json();
    if (options?.successMsg && typeof window !== 'undefined') {
      const { toast } = await import('sonner');
      toast.success(options.successMsg, { duration: 2000 });
    }
    options?.onSuccess?.(data);
    return data;
  } catch (e: any) {
    if (typeof window !== 'undefined') {
      const { toast } = await import('sonner');
      toast.error(options?.errorMsg ?? 'Ошибка подключения к серверу', { duration: 4000 });
    }
    return null;
  }
}

// Auth-aware fetch: auto-redirect on 401
export function authFetch(token: string) {
  return async (url: string, opts: RequestInit = {}): Promise<Response> => {
    const res = await fetch(url, {
      ...opts,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        ...(opts.headers ?? {}),
      },
    });

    if (res.status === 401 && typeof window !== 'undefined') {
      localStorage.removeItem('access_token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }

    return res;
  };
}


/* ═══════════════════════════════════════════════════════════════════════
   Основной клиент API.

   Заменяет голый fetch почти один в один:

     было:  await fetch('/api/v1/teams', { headers: { Authorization: 'Bearer '+token } })
     стало: await api.get('/teams')

   Что берёт на себя:
     • токен из localStorage
     • проверку res.ok и показ ошибки от сервера через toast
     • 401 → очистка хранилища и переход на /login
     • 204 и пустые ответы

   Возвращает данные либо null. Ошибку уже показал пользователю,
   вызывающему коду достаточно проверить результат:

     const data = await api.get<Team[]>('/teams');
     if (!data) return;            // ошибка уже на экране
   ═══════════════════════════════════════════════════════════════════════ */

const BASE = '/api/v1';

async function notify(kind: 'error' | 'success', msg: string) {
  if (typeof window === 'undefined') return;
  try {
    const { toast } = await import('sonner');
    kind === 'error'
      ? toast.error(msg, { duration: 4000 })
      : toast.success(msg, { duration: 2000 });
  } catch {
    // sonner недоступен — молчим, лучше без уведомления, чем с падением
  }
}

/** Достаёт понятное сообщение из ответа бэкенда. */
async function errorMessage(res: Response): Promise<string> {
  try {
    const body = await res.json();
    const m = body?.message ?? body?.error;
    if (Array.isArray(m)) return m.join('. ');
    if (typeof m === 'string') return m;
  } catch {
    // тело не JSON — обойдёмся статусом
  }
  if (res.status === 403) return 'Недостаточно прав для этого действия';
  if (res.status === 404) return 'Не найдено';
  if (res.status === 429) return 'Слишком много запросов, попробуйте через минуту';
  if (res.status >= 500) return 'Ошибка на сервере, попробуйте позже';
  return `Ошибка ${res.status}`;
}

export interface ApiOptions {
  /** Показать это сообщение при успехе. */
  success?: string;
  /** Не показывать ошибку пользователю (например, фоновый опрос). */
  silent?: boolean;
  /** Дополнительные заголовки. */
  headers?: Record<string, string>;
  /** FormData вместо JSON — Content-Type выставит браузер. */
  raw?: boolean;
}

async function request<T>(
  method: string,
  path: string,
  body?: any,
  opts: ApiOptions = {},
): Promise<T | null> {
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('access_token')
    : null;

  const url = path.startsWith('http') || path.startsWith('/api/')
    ? path
    : BASE + (path.startsWith('/') ? path : '/' + path);

  const headers: Record<string, string> = { ...(opts.headers ?? {}) };
  if (token) headers.Authorization = 'Bearer ' + token;
  if (body !== undefined && !opts.raw) headers['Content-Type'] = 'application/json';

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : (opts.raw ? body : JSON.stringify(body)),
    });
  } catch {
    if (!opts.silent) await notify('error', 'Нет связи с сервером');
    return null;
  }

  if (res.status === 401 && typeof window !== 'undefined') {
    localStorage.removeItem('access_token');
    localStorage.removeItem('user');
    window.location.href = '/login';
    return null;
  }

  if (!res.ok) {
    if (!opts.silent) await notify('error', await errorMessage(res));
    return null;
  }

  if (opts.success) await notify('success', opts.success);

  // 204 и пустое тело — валидный успех, а не повод падать на JSON.parse
  if (res.status === 204) return {} as T;
  const text = await res.text();
  if (!text) return {} as T;
  try {
    return JSON.parse(text) as T;
  } catch {
    return text as unknown as T;
  }
}

export const api = {
  get:    <T = any>(path: string, opts?: ApiOptions) => request<T>('GET', path, undefined, opts),
  post:   <T = any>(path: string, body?: any, opts?: ApiOptions) => request<T>('POST', path, body, opts),
  patch:  <T = any>(path: string, body?: any, opts?: ApiOptions) => request<T>('PATCH', path, body, opts),
  put:    <T = any>(path: string, body?: any, opts?: ApiOptions) => request<T>('PUT', path, body, opts),
  delete: <T = any>(path: string, opts?: ApiOptions) => request<T>('DELETE', path, undefined, opts),
  /** Загрузка файлов: тело уходит как FormData. */
  upload: <T = any>(path: string, form: FormData, opts?: ApiOptions) =>
    request<T>('POST', path, form, { ...opts, raw: true }),
};
