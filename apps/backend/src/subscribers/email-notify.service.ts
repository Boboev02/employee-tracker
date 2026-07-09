import { Injectable, Logger } from '@nestjs/common';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailNotifyService {
  private readonly logger = new Logger('EmailNotify');
  private transporter: nodemailer.Transporter | null = null;

  private getTransporter() {
    if (this.transporter) return this.transporter;
    const user = process.env.EMAIL_SMTP_USER;
    const pass = process.env.EMAIL_SMTP_PASSWORD;
    if (!user || !pass) return null;
    this.transporter = nodemailer.createTransport({
      host: 'smtp.yandex.ru',
      port: 465,
      secure: true,
      auth: { user, pass },
    });
    return this.transporter;
  }

  async sendMail(to: string, subject: string, text: string): Promise<{ ok: boolean; error?: string }> {
    const transporter = this.getTransporter();
    if (!transporter) {
      this.logger.warn('EMAIL_SMTP_USER/PASSWORD не заданы в .env — письмо не отправлено');
      return { ok: false, error: 'SMTP не настроен' };
    }
    try {
      await transporter.sendMail({
        from: `KingStats CRM <${process.env.EMAIL_SMTP_USER}>`,
        to, subject, text,
      });
      return { ok: true };
    } catch (e: any) {
      this.logger.error(`Email send failed: ${e.message}`);
      return { ok: false, error: e.message };
    }
  }
}
