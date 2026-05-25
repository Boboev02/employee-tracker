import { IndexedDbManager } from '../db/indexed-db.manager';
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
