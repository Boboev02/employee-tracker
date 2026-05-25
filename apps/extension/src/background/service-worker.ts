import { IndexedDbManager } from './db/indexed-db.manager';
import { AuthManager }       from './net/auth-manager';
import { ApiClient }         from './net/api-client';
import { FlushEngine }       from './sync/flush-engine';
import { FLUSH_INTERVAL_MS, STORAGE_KEYS } from '../shared/constants';

const db    = new IndexedDbManager();
const auth  = new AuthManager();
const api   = new ApiClient(() => auth.getAuth().then(a => a?.accessToken ?? null));
const flush = new FlushEngine(db, api);

// ─── Message handler (from content scripts) ───────────────────
// Handle messages from content scripts via chrome.runtime
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const { type, payload } = message ?? {};
  if (type === 'EVENT') {
    db.append(payload).then(() => db.count()).then(count => {
      if (count >= 50) flush.flush();
    });
    sendResponse({ ok: true });
  }
  if (type === 'GET_TOKEN') {
    chrome.storage.local.get('et_auth', (result) => {
      sendResponse({ token: (result['et_auth'] as any)?.accessToken ?? null });
    });
    return true; // async response
  }
  return false;
});

self.addEventListener('message', async (e: any) => {
  const { type, payload } = e.data ?? {};

  if (type === 'EVENT') {
    await db.append(payload);
    const count = await db.count();
    if (count >= 50) await flush.flush();
  }

  if (type === 'LOGIN') {
    try {
      await auth.login(payload.email, payload.password);
      e.source?.postMessage({ type: 'LOGIN_OK' });
    } catch (err: any) {
      e.source?.postMessage({ type: 'LOGIN_ERROR', error: err.message });
    }
  }

  if (type === 'GET_AUTH') {
    const a = await auth.getAuth();
    e.source?.postMessage({ type: 'AUTH_STATE', auth: a });
  }

  if (type === 'LOGOUT') {
    await auth.logout();
    e.source?.postMessage({ type: 'LOGOUT_OK' });
  }
});

// ─── Periodic flush ────────────────────────────────────────────
chrome.alarms.create('flush', { periodInMinutes: 1 });
chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === 'flush') await flush.flush();
});

// ─── Startup flush ────────────────────────────────────────────
(async () => {
  await db.open();
  await flush.flush();
})();
