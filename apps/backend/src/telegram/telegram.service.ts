import { Injectable } from '@nestjs/common';

@Injectable()
export class TelegramService {
  private readonly token = process.env.TELEGRAM_BOT_TOKEN;
  private readonly apiUrl = `https://api.telegram.org/bot${this.token}`;

  async sendMessage(chatId: string, text: string): Promise<void> {
    if (!this.token || !chatId) return;
    try {
      await fetch(`${this.apiUrl}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
      });
    } catch (e) {
      console.error('[Telegram] Failed to send message:', e);
    }
  }

  async notifyTaskAssigned(chatId: string, taskTitle: string, assignedBy: string): Promise<void> {
    const text = `📋 <b>Новая задача</b>\n\nВам назначена задача: <b>${taskTitle}</b>\nОт: ${assignedBy}`;
    await this.sendMessage(chatId, text);
  }

  async notifyTaskComment(chatId: string, taskTitle: string, commentAuthor: string, comment: string): Promise<void> {
    const text = `💬 <b>Новый комментарий</b>\n\nЗадача: <b>${taskTitle}</b>\nОт: ${commentAuthor}\n\n${comment.slice(0, 200)}`;
    await this.sendMessage(chatId, text);
  }

  async notifyTaskStatusChanged(chatId: string, taskTitle: string, newStatus: string, changedBy: string): Promise<void> {
    const statusLabels: Record<string, string> = { NEW: '🔵 Новая', IN_PROGRESS: '🟡 В работе', REVIEW: '🟠 Проверка', BLOCKED: '🔴 Заблокировано', DONE: '🟢 Готово' };
    const text = `🔄 <b>Статус задачи изменён</b>\n\nЗадача: <b>${taskTitle}</b>\nСтатус: ${statusLabels[newStatus] ?? newStatus}\nИзменил: ${changedBy}`;
    await this.sendMessage(chatId, text);
  }
}
