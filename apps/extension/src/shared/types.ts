export type Platform = 'WILDBERRIES' | 'OZON' | 'OTHER';

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
