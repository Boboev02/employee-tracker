import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class TelegramNotifyService {
  private readonly logger = new Logger('TelegramNotify');
  private readonly botToken = process.env.TELEGRAM_BOT_TOKEN;

  async sendMessage(chatId: string, text: string): Promise<{ ok: boolean; error?: string }> {
    if (!this.botToken) {
      this.logger.warn('TELEGRAM_BOT_TOKEN не задан в .env — сообщение не отправлено');
      return { ok: false, error: 'TELEGRAM_BOT_TOKEN не настроен' };
    }
    try {
      // Прямой доступ к Telegram API заблокирован на уровне сети сервера — идём через Cloudflare Worker-релей.
      // Relay просто перенаправляет запрос на api.telegram.org, сохраняя путь/метод/тело без изменений.
      const relayBase = process.env.TELEGRAM_RELAY_URL ?? 'https://api.telegram.org';
      const res = await fetch(`${relayBase}/bot${this.botToken}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) return { ok: false, error: data.description ?? `HTTP ${res.status}` };
      return { ok: true };
    } catch (e: any) {
      this.logger.error(`Telegram send failed: ${e.message}`);
      return { ok: false, error: e.message };
    }
  }
}
