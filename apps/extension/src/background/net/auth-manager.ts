import { API_BASE_URL, STORAGE_KEYS } from '../../shared/constants';
import type { AuthState } from '../../shared/types';

export class AuthManager {
  async getAuth(): Promise<AuthState | null> {
    const result = await chrome.storage.local.get(STORAGE_KEYS.AUTH_STATE);
    const auth = result[STORAGE_KEYS.AUTH_STATE] as AuthState | undefined;
    if (!auth) return null;
    if (Date.now() > auth.expiresAt - 60_000) {
      const refreshed = await this.refresh(auth.accessToken);
      return refreshed;
    }
    return auth;
  }

  async login(email: string, password: string): Promise<AuthState> {
    const res = await fetch(API_BASE_URL + '/api/v1/auth/login', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message ?? 'Login failed');
    }
    const data = await res.json();
    const auth: AuthState = {
      accessToken: data.accessToken,
      signingKey:  data.accessToken,
      userId:      data.user.id,
      orgId:       data.user.orgId,
      expiresAt:   Date.now() + (data.expiresIn ?? 900) * 1000,
    };
    await chrome.storage.local.set({ [STORAGE_KEYS.AUTH_STATE]: auth });
    return auth;
  }

  async refresh(token: string): Promise<AuthState | null> {
    try {
      const res = await fetch(API_BASE_URL + '/api/v1/auth/refresh', {
        method:  'POST',
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!res.ok) { await this.logout(); return null; }
      const data = await res.json();
      const auth: AuthState = {
        accessToken: data.accessToken,
        signingKey:  data.accessToken,
        userId:      data.user?.id ?? '',
        orgId:       data.user?.orgId ?? '',
        expiresAt:   Date.now() + (data.expiresIn ?? 900) * 1000,
      };
      await chrome.storage.local.set({ [STORAGE_KEYS.AUTH_STATE]: auth });
      return auth;
    } catch { return null; }
  }

  async logout(): Promise<void> {
    await chrome.storage.local.remove(STORAGE_KEYS.AUTH_STATE);
  }

  isExpired(auth: AuthState): boolean {
    return Date.now() > auth.expiresAt;
  }
}
