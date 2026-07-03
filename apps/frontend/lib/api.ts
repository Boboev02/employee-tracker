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
