const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

// ─── manifest.json ────────────────────────────────────────────
write('manifest.json', JSON.stringify({
  manifest_version: 3,
  name: "Employee Tracker — WB & Ozon",
  version: "1.0.0",
  description: "Корпоративный трекер активности для Wildberries и Ozon Seller",
  minimum_chrome_version: "116",
  background: {
    service_worker: "background/service-worker.js",
    type: "module"
  },
  content_scripts: [
    {
      matches: [
        "https://seller.wildberries.ru/*",
        "https://seller-express.wildberries.ru/*",
        "https://supplier.wildberries.ru/*"
      ],
      js: ["content/wb-tracker.js"],
      run_at: "document_idle",
      all_frames: false
    },
    {
      matches: [
        "https://seller.ozon.ru/*",
        "https://seller-portal.ozon.ru/*"
      ],
      js: ["content/ozon-tracker.js"],
      run_at: "document_idle",
      all_frames: false
    }
  ],
  action: {
    default_popup: "popup/popup.html",
    default_title: "Employee Tracker"
  },
  permissions: ["storage", "tabs", "alarms", "identity"],
  host_permissions: [
    "https://seller.wildberries.ru/*",
    "https://seller-express.wildberries.ru/*",
    "https://supplier.wildberries.ru/*",
    "https://seller.ozon.ru/*",
    "http://localhost:3001/*"
  ]
}, null, 2));

// ─── shared/constants.ts ──────────────────────────────────────
write('src/shared/constants.ts', `export const API_BASE_URL = 'http://localhost:3001';
export const WS_URL       = 'ws://localhost:3001';

export const FLUSH_INTERVAL_MS   = 5_000;
export const MAX_BUFFER_SIZE     = 50;
export const IDLE_THRESHOLD_MS   = 60_000;
export const HEARTBEAT_MS        = 30_000;
export const MAX_RETRY_ATTEMPTS  = 3;
export const RETRY_DELAY_MS      = 2_000;

export const STORAGE_KEYS = {
  AUTH_STATE:     'et_auth',
  DEVICE_ID:      'et_device_id',
  SESSION_TOKEN:  'et_session',
} as const;
`);

// ─── shared/types.ts ──────────────────────────────────────────
write('src/shared/types.ts', `export type Platform = 'WILDBERRIES' | 'OZON' | 'OTHER';

export const EventType = {
  CLICK:           'click',
  KEYDOWN:         'keydown',
  SCROLL:          'scroll',
  PAGE_LOAD:       'page_load',
  PAGE_UNLOAD:     'page_unload',
  URL_CHANGE:      'url_change',
  TAB_FOCUS:       'tab_focus',
  TAB_BLUR:        'tab_blur',
  SECTION_ENTER:   'section_enter',
  WENT_IDLE:       'went_idle',
  ACTIVITY_RESUME: 'activity_resume',
  HEARTBEAT:       'heartbeat',
  WB_PAGE_VIEW:    'wb_page_view',
  OZON_PAGE_VIEW:  'ozon_page_view',
} as const;
export type EventType = typeof EventType[keyof typeof EventType];

export interface RawEvent {
  eventId:         string;
  sessionToken:    string;
  eventType:       EventType;
  platform:        Platform;
  clientTimestamp: number;
  url?:            string;
  pageTitle?:      string;
  platformData?:   Record<string, string | number | boolean>;
}

export interface BatchPayload {
  batchId:          string;
  signature:        string;
  extensionVersion: string;
  sessionToken:     string;
  events:           RawEvent[];
}

export interface AuthState {
  accessToken:  string;
  signingKey:   string;
  userId:       string;
  orgId:        string;
  expiresAt:    number;
}
`);

// ─── background/db/indexed-db.manager.ts ─────────────────────
write('src/background/db/indexed-db.manager.ts', `const DB_NAME    = 'EmployeeTracker';
const DB_VERSION = 1;
const STORE_NAME = 'events';

export class IndexedDbManager {
  private db: IDBDatabase | null = null;

  async open(): Promise<void> {
    return new Promise((resolve, reject) => {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'eventId' });
        }
      };
      req.onsuccess = () => { this.db = req.result; resolve(); };
      req.onerror   = () => reject(req.error);
    });
  }

  async append(event: any): Promise<void> {
    if (!this.db) await this.open();
    return new Promise((resolve, reject) => {
      const tx    = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.put({ ...event, bufferedAt: Date.now() });
      req.onsuccess = () => resolve();
      req.onerror   = () => reject(req.error);
    });
  }

  async getOldest(limit = 100): Promise<any[]> {
    if (!this.db) await this.open();
    return new Promise((resolve, reject) => {
      const tx    = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.getAll();
      req.onsuccess = () => resolve((req.result ?? []).slice(0, limit));
      req.onerror   = () => reject(req.error);
    });
  }

  async deleteMany(eventIds: string[]): Promise<void> {
    if (!this.db) await this.open();
    return new Promise((resolve, reject) => {
      const tx    = this.db!.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      let pending = eventIds.length;
      if (!pending) { resolve(); return; }
      eventIds.forEach(id => {
        const req = store.delete(id);
        req.onsuccess = () => { if (--pending === 0) resolve(); };
        req.onerror   = () => reject(req.error);
      });
    });
  }

  async count(): Promise<number> {
    if (!this.db) await this.open();
    return new Promise((resolve, reject) => {
      const tx    = this.db!.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req   = store.count();
      req.onsuccess = () => resolve(req.result);
      req.onerror   = () => reject(req.error);
    });
  }
}
`);

// ─── background/net/auth-manager.ts ──────────────────────────
write('src/background/net/auth-manager.ts', `import { API_BASE_URL, STORAGE_KEYS } from '../../shared/constants';
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
`);

// ─── background/net/api-client.ts ────────────────────────────
write('src/background/net/api-client.ts', `import { API_BASE_URL, MAX_RETRY_ATTEMPTS, RETRY_DELAY_MS } from '../../shared/constants';
import type { BatchPayload } from '../../shared/types';

export class ApiClient {
  constructor(private readonly getToken: () => Promise<string | null>) {}

  async sendBatch(payload: BatchPayload): Promise<boolean> {
    const token = await this.getToken();
    if (!token) return false;

    for (let attempt = 0; attempt < MAX_RETRY_ATTEMPTS; attempt++) {
      try {
        const res = await fetch(API_BASE_URL + '/api/v1/events/batch', {
          method:  'POST',
          headers: {
            'Content-Type':  'application/json',
            'Authorization': 'Bearer ' + token,
          },
          body: JSON.stringify(payload),
        });
        if (res.ok || res.status === 409) return true;
        if (res.status === 401) return false;
        if (res.status < 500) return false;
      } catch { /* network error — retry */ }

      if (attempt < MAX_RETRY_ATTEMPTS - 1) {
        await new Promise(r => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
      }
    }
    return false;
  }
}
`);

// ─── background/sync/flush-engine.ts ─────────────────────────
write('src/background/sync/flush-engine.ts', `import { IndexedDbManager } from '../db/indexed-db.manager';
import { ApiClient }         from '../net/api-client';
import { MAX_BUFFER_SIZE }   from '../../shared/constants';
import type { BatchPayload } from '../../shared/types';

export class FlushEngine {
  private flushing = false;

  constructor(
    private readonly db:  IndexedDbManager,
    private readonly api: ApiClient,
  ) {}

  async flush(): Promise<void> {
    if (this.flushing) return;
    this.flushing = true;
    try {
      const events = await this.db.getOldest(MAX_BUFFER_SIZE);
      if (!events.length) return;

      const batchId = crypto.randomUUID();
      const payload: BatchPayload = {
        batchId,
        signature:        this.sign(batchId, events),
        extensionVersion: '1.0.0',
        sessionToken:     events[0].sessionToken ?? 'unknown',
        events,
      };

      const ok = await this.api.sendBatch(payload);
      if (ok) await this.db.deleteMany(events.map(e => e.eventId));
    } finally {
      this.flushing = false;
    }
  }

  private sign(batchId: string, events: any[]): string {
    // Simple signature for dev — production uses HMAC-SHA256
    return btoa(batchId + ':' + events.length);
  }
}
`);

// ─── background/service-worker.ts ────────────────────────────
write('src/background/service-worker.ts', `import { IndexedDbManager } from './db/indexed-db.manager';
import { AuthManager }       from './net/auth-manager';
import { ApiClient }         from './net/api-client';
import { FlushEngine }       from './sync/flush-engine';
import { FLUSH_INTERVAL_MS, STORAGE_KEYS } from '../shared/constants';

const db    = new IndexedDbManager();
const auth  = new AuthManager();
const api   = new ApiClient(() => auth.getAuth().then(a => a?.accessToken ?? null));
const flush = new FlushEngine(db, api);

// ─── Message handler (from content scripts) ───────────────────
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
`);

// ─── content/base-tracker.ts ─────────────────────────────────
write('src/content/base-tracker.ts', `import { IDLE_THRESHOLD_MS, HEARTBEAT_MS, STORAGE_KEYS } from '../shared/constants';
import type { RawEvent, Platform } from '../shared/types';

export abstract class BaseTracker {
  protected sessionToken = crypto.randomUUID();
  protected lastActivity = Date.now();
  protected idleTimer: ReturnType<typeof setTimeout> | null = null;
  protected isIdle = false;

  abstract platform: Platform;

  init() {
    this.attachListeners();
    this.startHeartbeat();
    this.sendEvent('page_load');
    console.log('[ET] Tracker initialized:', this.platform, location.href);
  }

  protected attachListeners() {
    ['click', 'keydown', 'scroll'].forEach(type => {
      document.addEventListener(type, () => this.handleActivity(type as any), { passive: true });
    });
    window.addEventListener('beforeunload', () => this.sendEvent('page_unload'));
    window.addEventListener('focus', () => this.handleActivity('tab_focus' as any));
    window.addEventListener('blur',  () => this.sendEvent('tab_blur'));
  }

  protected handleActivity(eventType: any) {
    const now = Date.now();
    if (this.isIdle) {
      this.isIdle = false;
      this.sendEvent('activity_resume');
    }
    this.lastActivity = now;
    this.sendEvent(eventType);
    this.resetIdleTimer();
  }

  protected resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.isIdle = true;
      this.sendEvent('went_idle');
    }, IDLE_THRESHOLD_MS);
  }

  protected startHeartbeat() {
    setInterval(() => {
      if (!this.isIdle) this.sendEvent('heartbeat');
    }, HEARTBEAT_MS);
  }

  protected sendEvent(eventType: any, extra: Record<string, any> = {}) {
    const event: RawEvent = {
      eventId:         crypto.randomUUID(),
      sessionToken:    this.sessionToken,
      eventType,
      platform:        this.platform,
      clientTimestamp: Date.now(),
      url:             location.href.slice(0, 500),
      pageTitle:       document.title.slice(0, 200),
      platformData:    { ...extra, section: this.detectSection() },
    };

    navigator.serviceWorker.controller?.postMessage({ type: 'EVENT', payload: event });
  }

  protected detectSection(): string {
    return 'unknown';
  }
}
`);

// ─── content/wb-tracker.ts ───────────────────────────────────
write('src/content/wb-tracker.ts', `import { BaseTracker } from './base-tracker';

class WbTracker extends BaseTracker {
  platform = 'WILDBERRIES' as const;

  protected detectSection(): string {
    const path = location.pathname;
    if (path.includes('/orders'))      return 'orders';
    if (path.includes('/products'))    return 'products';
    if (path.includes('/analytics'))   return 'analytics';
    if (path.includes('/supplies'))    return 'supply';
    if (path.includes('/prices'))      return 'pricing';
    if (path.includes('/promotions'))  return 'promotions';
    if (path.includes('/finance'))     return 'finance';
    if (path.includes('/advertising')) return 'advertising';
    if (path.includes('/feedbacks'))   return 'reviews';
    return 'other';
  }
}

// Wait for SW to be ready then start tracking
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(() => {
    new WbTracker().init();
  });
}
`);

// ─── content/ozon-tracker.ts ─────────────────────────────────
write('src/content/ozon-tracker.ts', `import { BaseTracker } from './base-tracker';

class OzonTracker extends BaseTracker {
  platform = 'OZON' as const;

  protected detectSection(): string {
    const path = location.pathname;
    if (path.includes('/orders'))    return 'orders';
    if (path.includes('/products'))  return 'products';
    if (path.includes('/analytics')) return 'analytics';
    if (path.includes('/finance'))   return 'finance';
    if (path.includes('/logistics')) return 'logistics';
    if (path.includes('/rating'))    return 'rating';
    if (path.includes('/promotion')) return 'promotion';
    if (path.includes('/reviews'))   return 'reviews';
    return 'other';
  }
}

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.ready.then(() => {
    new OzonTracker().init();
  });
}
`);

// ─── popup/popup.html ─────────────────────────────────────────
write('popup/popup.html', `<!DOCTYPE html>
<html lang="ru">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Employee Tracker</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; width: 300px; background: #f9fafb; }
    .header { background: #4f46e5; color: white; padding: 16px; }
    .header h1 { font-size: 15px; font-weight: 600; }
    .header p { font-size: 11px; opacity: 0.8; margin-top: 2px; }
    .content { padding: 16px; }
    .status { display: flex; align-items: center; gap: 8px; margin-bottom: 16px; padding: 10px 12px; background: white; border-radius: 8px; border: 1px solid #e5e7eb; }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #9ca3af; }
    .dot.online { background: #22c55e; box-shadow: 0 0 0 3px rgba(34,197,94,0.2); }
    .dot.offline { background: #ef4444; }
    .status-text { font-size: 13px; color: #374151; font-weight: 500; }
    .status-sub { font-size: 11px; color: #6b7280; margin-top: 1px; }
    .form { display: flex; flex-direction: column; gap: 10px; }
    input { width: 100%; padding: 8px 10px; border: 1px solid #d1d5db; border-radius: 6px; font-size: 13px; outline: none; }
    input:focus { border-color: #4f46e5; box-shadow: 0 0 0 2px rgba(79,70,229,0.15); }
    button { width: 100%; padding: 8px; background: #4f46e5; color: white; border: none; border-radius: 6px; font-size: 13px; font-weight: 500; cursor: pointer; }
    button:hover { background: #4338ca; }
    button.secondary { background: #ef4444; margin-top: 8px; }
    button.secondary:hover { background: #dc2626; }
    .error { font-size: 12px; color: #ef4444; text-align: center; }
    .info { font-size: 11px; color: #6b7280; text-align: center; margin-top: 8px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>Employee Tracker</h1>
    <p>WB & Ozon мониторинг</p>
  </div>
  <div class="content" id="app">
    <div class="status">
      <div class="dot" id="dot"></div>
      <div>
        <div class="status-text" id="status-text">Проверка...</div>
        <div class="status-sub" id="status-sub"></div>
      </div>
    </div>
    <div id="login-form" style="display:none">
      <div class="form">
        <input type="email" id="email" placeholder="Email" />
        <input type="password" id="password" placeholder="Пароль" />
        <button id="login-btn">Войти</button>
        <div class="error" id="error"></div>
      </div>
    </div>
    <div id="logout-section" style="display:none">
      <p class="info" id="user-info"></p>
      <button class="secondary" id="logout-btn">Выйти</button>
    </div>
  </div>
  <script src="popup.js"></script>
</body>
</html>
`);

// ─── popup/popup.ts ───────────────────────────────────────────
write('popup/popup.ts', `async function getAuth() {
  return new Promise<any>(resolve => {
    chrome.runtime.sendMessage({ type: 'GET_AUTH' }, resolve);
  });
}

async function init() {
  const dot        = document.getElementById('dot')!;
  const statusText = document.getElementById('status-text')!;
  const statusSub  = document.getElementById('status-sub')!;
  const loginForm  = document.getElementById('login-form')!;
  const logoutSec  = document.getElementById('logout-section')!;
  const userInfo   = document.getElementById('user-info')!;
  const errorEl    = document.getElementById('error')!;

  const auth = await getAuth();

  if (auth?.accessToken) {
    dot.classList.add('online');
    statusText.textContent = 'Подключено';
    statusSub.textContent  = 'Трекинг активен';
    userInfo.textContent   = 'ID: ' + auth.userId;
    logoutSec.style.display = 'block';
  } else {
    dot.classList.add('offline');
    statusText.textContent = 'Не подключено';
    statusSub.textContent  = 'Войдите для начала работы';
    loginForm.style.display = 'block';
  }

  document.getElementById('login-btn')?.addEventListener('click', async () => {
    const email    = (document.getElementById('email') as HTMLInputElement).value;
    const password = (document.getElementById('password') as HTMLInputElement).value;
    errorEl.textContent = '';

    chrome.runtime.sendMessage({ type: 'LOGIN', payload: { email, password } }, (res: any) => {
      if (res?.type === 'LOGIN_OK') {
        window.location.reload();
      } else {
        errorEl.textContent = res?.error ?? 'Ошибка входа';
      }
    });
  });

  document.getElementById('logout-btn')?.addEventListener('click', () => {
    chrome.runtime.sendMessage({ type: 'LOGOUT' }, () => window.location.reload());
  });
}

init();
`);

// ─── package.json ─────────────────────────────────────────────
write('package.json', JSON.stringify({
  name: "employee-tracker-extension",
  version: "1.0.0",
  scripts: {
    build: "webpack --mode production",
    dev:   "webpack --mode development --watch"
  },
  devDependencies: {
    webpack:             "^5.88.0",
    "webpack-cli":       "^5.1.0",
    "ts-loader":         "^9.4.4",
    typescript:          "^5.0.0",
    "copy-webpack-plugin": "^11.0.0"
  }
}, null, 2));

// ─── tsconfig.json ────────────────────────────────────────────
write('tsconfig.json', JSON.stringify({
  compilerOptions: {
    target: "ES2022",
    module: "ES2022",
    moduleResolution: "bundler",
    lib: ["ES2022", "DOM", "WebWorker"],
    strict: false,
    skipLibCheck: true,
    outDir: "./dist"
  },
  include: ["src/**/*", "popup/**/*"]
}, null, 2));

// ─── webpack.config.js ────────────────────────────────────────
write('webpack.config.js', `const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
  entry: {
    'background/service-worker': './src/background/service-worker.ts',
    'content/wb-tracker':        './src/content/wb-tracker.ts',
    'content/ozon-tracker':      './src/content/ozon-tracker.ts',
    'popup/popup':               './popup/popup.ts',
  },
  output: {
    path:     path.resolve(__dirname, 'dist'),
    filename: '[name].js',
  },
  module: {
    rules: [{
      test: /\\.tsx?$/,
      use:  'ts-loader',
      exclude: /node_modules/,
    }],
  },
  resolve: { extensions: ['.ts', '.js'] },
  plugins: [
    new CopyPlugin({
      patterns: [
        { from: 'manifest.json', to: '.' },
        { from: 'popup/popup.html', to: 'popup/popup.html' },
      ],
    }),
  ],
};
`);

console.log('\n✅ Extension files created');
console.log('\nНазидание:');
console.log('  cd apps/extension');
console.log('  npm install');
console.log('  npm run build');
console.log('  Открой chrome://extensions → Load unpacked → выбери dist/');
