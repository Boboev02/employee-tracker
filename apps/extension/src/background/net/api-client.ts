import { API_BASE_URL, MAX_RETRY_ATTEMPTS, RETRY_DELAY_MS } from '../../shared/constants';
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
