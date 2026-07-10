import { Injectable, Logger } from '@nestjs/common';

/**
 * Отправка email через Resend HTTP-API (порт 443) вместо классического SMTP (465/587).
 * Причина: SMTP-порты заблокированы на уровне сети сервера, а обычный HTTPS — нет.
 * Resend: бесплатно до 3000 писем/мес, домен по умолчанию onboarding@resend.dev
 * подходит для старта; свой домен можно верифицировать позже в личном кабинете Resend.
 */
@Injectable()
export class EmailNotifyService {
  private readonly logger = new Logger('EmailNotify');

  async sendMail(to: string, subject: string, text: string): Promise<{ ok: boolean; error?: string }> {
    const apiKey = process.env.RESEND_API_KEY;
    if (!apiKey) {
      this.logger.warn('RESEND_API_KEY не задан в .env — письмо не отправлено');
      return { ok: false, error: 'RESEND_API_KEY не настроен' };
    }
    const from = process.env.EMAIL_FROM_ADDRESS ?? 'KingStats CRM <onboarding@resend.dev>';
    try {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ from, to: [to], subject, text }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        this.logger.error(`Email send failed: ${JSON.stringify(data)}`);
        return { ok: false, error: data.message ?? `HTTP ${res.status}` };
      }
      return { ok: true };
    } catch (e: any) {
      this.logger.error(`Email send failed: ${e.message}`);
      return { ok: false, error: e.message };
    }
  }
}
