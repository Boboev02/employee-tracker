export const API_BASE_URL = 'https://employee-tracker.ru';
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
