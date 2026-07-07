import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Каркас интеграции с внешними сервисами подписок (KingStats и подобные).
 * Пока API не подключен — syncNow() возвращает понятную ошибку.
 * Как только появится реальный эндпоинт — реализация fetchExternalSubscribers()
 * заменяется на настоящий HTTP-вызов (пример уже подготовлен в комментарии).
 */
@Injectable()
export class CrmIntegrationService {
  constructor(private readonly prisma: PrismaService) {}

  async getIntegrations(orgId: string) {
    const integrations = await this.prisma.crmIntegration.findMany({ where: { orgId } });
    return integrations.map(i => ({ ...i, apiKey: i.apiKey ? '••••••••' : null }));
  }

  async saveIntegration(orgId: string, name: string, dto: any) {
    return this.prisma.crmIntegration.upsert({
      where: { orgId_name: { orgId, name } },
      update: {
        apiUrl: dto.apiUrl,
        ...(dto.apiKey && dto.apiKey !== '••••••••' ? { apiKey: dto.apiKey } : {}),
        displayName: dto.displayName, isActive: dto.isActive ?? true,
      },
      create: {
        orgId, name, displayName: dto.displayName ?? name,
        apiUrl: dto.apiUrl, apiKey: dto.apiKey, isActive: dto.isActive ?? false,
      },
    });
  }

  /**
   * Запускает синхронизацию подписчиков из внешнего сервиса в CrmContact.
   * Пока не настроен apiUrl — возвращает понятную ошибку вместо падения.
   */
  async syncNow(orgId: string, name: string) {
    const integration = await this.prisma.crmIntegration.findUnique({ where: { orgId_name: { orgId, name } } });
    if (!integration || !integration.apiUrl || !integration.apiKey) {
      throw new BadRequestException(`Интеграция "${name}" не настроена — укажите URL и API-ключ в настройках`);
    }

    try {
      const subscribers = await this.fetchExternalSubscribers(integration.apiUrl, integration.apiKey);
      let synced = 0;

      for (const sub of subscribers) {
        await this.prisma.crmContact.upsert({
          where: { externalSource_externalId: { externalSource: name, externalId: String(sub.id) } as any },
          update: {
            firstName: sub.name ?? sub.username ?? 'Без имени',
            email: sub.email, phone: sub.phone,
            subscriptionPlan: sub.plan, subscriptionStatus: sub.planStatus,
            trialEndsAt: sub.trialEndsAt ? new Date(sub.trialEndsAt) : null,
            subscriptionEndsAt: sub.subscriptionEndsAt ? new Date(sub.subscriptionEndsAt) : null,
            lastLoginAt: sub.lastLoginAt ? new Date(sub.lastLoginAt) : null,
          },
          create: {
            orgId, firstName: sub.name ?? sub.username ?? 'Без имени',
            email: sub.email, phone: sub.phone,
            source: name, externalSource: name, externalId: String(sub.id),
            subscriptionPlan: sub.plan, subscriptionStatus: sub.planStatus,
            trialEndsAt: sub.trialEndsAt ? new Date(sub.trialEndsAt) : null,
            subscriptionEndsAt: sub.subscriptionEndsAt ? new Date(sub.subscriptionEndsAt) : null,
            lastLoginAt: sub.lastLoginAt ? new Date(sub.lastLoginAt) : null,
          },
        }).catch(() => {});
        synced++;
      }

      await this.prisma.crmIntegration.update({
        where: { orgId_name: { orgId, name } },
        data: { lastSyncAt: new Date(), lastSyncStatus: 'SUCCESS', lastSyncMessage: `Синхронизировано ${synced} подписчиков`, syncedCount: synced },
      });
      return { ok: true, synced };
    } catch (e: any) {
      await this.prisma.crmIntegration.update({
        where: { orgId_name: { orgId, name } },
        data: { lastSyncAt: new Date(), lastSyncStatus: 'ERROR', lastSyncMessage: e.message },
      });
      throw e;
    }
  }

  /**
   * ⚠️ ЗАГЛУШКА — заменить на реальный вызов, когда будет готов API KingStats.
   * Ожидаемый формат ответа (см. спецификацию):
   * { users: [{ id, username, email, name, phone, plan, planStatus, trialEndsAt, subscriptionEndsAt, lastLoginAt }] }
   */
  private async fetchExternalSubscribers(apiUrl: string, apiKey: string): Promise<any[]> {
    const res = await fetch(apiUrl, { headers: { Authorization: `Bearer ${apiKey}` } });
    if (!res.ok) throw new Error(`KingStats API вернул ${res.status}`);
    const data = await res.json();
    return data.users ?? data.subscribers ?? [];
  }
}
