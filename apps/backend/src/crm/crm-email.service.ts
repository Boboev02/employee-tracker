import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as nodemailer from 'nodemailer';

@Injectable()
export class CrmEmailService {
  constructor(private readonly prisma: PrismaService) {}

  async getSettings(orgId: string) {
    const settings = await this.prisma.crmEmailSettings.findUnique({ where: { orgId } });
    if (!settings) return null;
    // Не отдаём пароль на фронт
    return { ...settings, smtpPass: settings.smtpPass ? '••••••••' : null };
  }

  async saveSettings(orgId: string, dto: any) {
    return this.prisma.crmEmailSettings.upsert({
      where: { orgId },
      update: {
        smtpHost: dto.smtpHost, smtpPort: dto.smtpPort, smtpUser: dto.smtpUser,
        ...(dto.smtpPass && dto.smtpPass !== '••••••••' ? { smtpPass: dto.smtpPass } : {}),
        fromName: dto.fromName, fromEmail: dto.fromEmail, isActive: dto.isActive ?? true,
      },
      create: {
        orgId, smtpHost: dto.smtpHost, smtpPort: dto.smtpPort ?? 587, smtpUser: dto.smtpUser,
        smtpPass: dto.smtpPass, fromName: dto.fromName, fromEmail: dto.fromEmail, isActive: dto.isActive ?? true,
      },
    });
  }

  /** Отправляет письмо через SMTP org'а; если SMTP не настроен — просто возвращает ok:false без падения (письмо логируется как активность отдельно) */
  async sendEmail(orgId: string, to: string, subject: string, body: string): Promise<{ ok: boolean; error?: string }> {
    const settings = await this.prisma.crmEmailSettings.findUnique({ where: { orgId } });
    if (!settings || !settings.isActive || !settings.smtpHost) {
      return { ok: false, error: 'SMTP не настроен. Перейдите в Настройки CRM → Email.' };
    }

    try {
      const transporter = nodemailer.createTransport({
        host: settings.smtpHost, port: settings.smtpPort ?? 587,
        secure: (settings.smtpPort ?? 587) === 465,
        auth: settings.smtpUser ? { user: settings.smtpUser, pass: settings.smtpPass ?? '' } : undefined,
      });
      await transporter.sendMail({
        from: `"${settings.fromName ?? 'CRM'}" <${settings.fromEmail ?? settings.smtpUser}>`,
        to, subject, html: body.replace(/\n/g, '<br/>'),
      });
      return { ok: true };
    } catch (e: any) {
      return { ok: false, error: e.message };
    }
  }
}
