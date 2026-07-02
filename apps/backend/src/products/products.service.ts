import { Injectable, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { SettingsService } from '../settings/settings.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

@Injectable()
export class ProductsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly settings: SettingsService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private ozTokenKey(orgId: string) { return `ozon:token:${orgId}`; }

  async setOzonToken(orgId: string, token: string, clientId: string) {
    await this.redis.set(this.ozTokenKey(orgId), JSON.stringify({ token, clientId }));
  }

  async getOzonToken(orgId: string): Promise<{ token: string; clientId: string } | null> {
    const raw = await this.redis.get(this.ozTokenKey(orgId));
    return raw ? JSON.parse(raw) : null;
  }

  // ===== WB SYNC =====
  async syncWB(orgId: string) {
    // Сначала пробуем токен контента, потом общий WB токен
    let token = await this.redis.get('wb:content:token:' + orgId);
    if (!token) token = await this.settings.getWbToken(orgId);
    if (!token) throw new BadRequestException('WB API токен не установлен. Добавьте токен с правами "Контент" в Настройках.');

    const upserted: any[] = [];
    let cursor = 0;
    let hasMore = true;

    while (hasMore) {
      const res = await fetch('https://content-api.wildberries.ru/content/v2/get/cards/list', {
        method: 'POST',
        headers: { 'Authorization': token, 'Content-Type': 'application/json' },
        body: JSON.stringify({ settings: { cursor: { limit: 100, updatedAt: cursor === 0 ? undefined : undefined, nmID: cursor === 0 ? undefined : cursor }, filter: { withPhoto: -1 } } }),
      });

      if (!res.ok) {
        const err = await res.text();
        throw new BadRequestException(`WB API ошибка: ${err}`);
      }

      const data = await res.json();
      const cards = data.cards ?? [];

      for (const card of cards) {
        const nmId = String(card.nmID ?? '');
        const articleId = card.vendorCode ?? nmId;
        const photoUrl = card.photos?.[0]?.big ?? card.photos?.[0]?.c516x688 ?? null;
        const price = card.sizes?.[0]?.price ?? null;
        const name = card.title ?? card.subjectName ?? 'Без названия';

        await this.prisma.product.upsert({
          where: { orgId_marketplace_articleId: { orgId, marketplace: 'WB', articleId } },
          update: { name, photoUrl, price, nmId, categoryName: card.subjectName, brand: card.brand, url: `https://www.wildberries.ru/catalog/${nmId}/detail.aspx`, syncedAt: new Date(), updatedAt: new Date() },
          create: { orgId, marketplace: 'WB', articleId, nmId, name, photoUrl, price, categoryName: card.subjectName, brand: card.brand, url: `https://www.wildberries.ru/catalog/${nmId}/detail.aspx` },
        });
        upserted.push({ articleId, name });
      }

      // Пагинация WB через cursor
      const nextCursor = data.cursor;
      if (!nextCursor || cards.length < 100) {
        hasMore = false;
      } else {
        cursor = nextCursor.nmID ?? 0;
        if (!cursor) hasMore = false;
      }
    }

    return { synced: upserted.length, marketplace: 'WB' };
  }

  // ===== OZON SYNC =====
  async syncOzon(orgId: string) {
    const creds = await this.getOzonToken(orgId);
    if (!creds) throw new BadRequestException('Ozon API токен не установлен. Добавьте его в Настройках.');

    const headers = {
      'Client-Id': creds.clientId,
      'Api-Key': creds.token,
      'Content-Type': 'application/json',
    };

    // Получаем список ID товаров
    let lastId = ''; let hasMore = true; const allIds: number[] = [];

    while (hasMore) {
      const listRes = await fetch('https://api-seller.ozon.ru/v2/product/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({ filter: { visibility: 'ALL' }, last_id: lastId, limit: 1000 }),
      });
      const listData = await listRes.json();
      const items = listData.result?.items ?? [];
      allIds.push(...items.map((i: any) => i.product_id));
      lastId = listData.result?.last_id ?? '';
      hasMore = !!lastId && items.length === 1000;
    }

    if (!allIds.length) return { synced: 0, marketplace: 'OZON' };

    // Получаем детали пачками по 1000
    let synced = 0;
    for (let i = 0; i < allIds.length; i += 1000) {
      const chunk = allIds.slice(i, i + 1000);
      const infoRes = await fetch('https://api-seller.ozon.ru/v2/product/info/list', {
        method: 'POST',
        headers,
        body: JSON.stringify({ product_id: chunk }),
      });
      const infoData = await infoRes.json();
      const items = infoData.result?.items ?? [];

      for (const item of items) {
        const articleId = String(item.offer_id ?? item.id);
        const photoUrl = item.primary_image ?? item.images?.[0] ?? null;
        const name = item.name ?? 'Без названия';
        const price = item.price ? parseFloat(item.price) : null;
        const url = `https://www.ozon.ru/product/${item.id}`;

        await this.prisma.product.upsert({
          where: { orgId_marketplace_articleId: { orgId, marketplace: 'OZON', articleId } },
          update: { name, photoUrl, price, categoryName: item.category_id ? String(item.category_id) : null, brand: item.vendor, url, syncedAt: new Date(), updatedAt: new Date() },
          create: { orgId, marketplace: 'OZON', articleId, name, photoUrl, price, categoryName: item.category_id ? String(item.category_id) : null, brand: item.vendor, url },
        });
        synced++;
      }
    }

    return { synced, marketplace: 'OZON' };
  }

  // ===== CRUD =====
  async getProducts(orgId: string, params: { marketplace?: string; search?: string; page?: number; limit?: number }) {
    const take = params.limit ?? 50;
    const skip = ((params.page ?? 1) - 1) * take;
    const where: any = { orgId };
    if (params.marketplace) where.marketplace = params.marketplace;
    if (params.search) where.OR = [
      { name: { contains: params.search, mode: 'insensitive' } },
      { articleId: { contains: params.search, mode: 'insensitive' } },
    ];

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where, take, skip, orderBy: { updatedAt: 'desc' },
        include: { _count: { select: { tasks: { where: { deletedAt: null } } } } },
      }),
      this.prisma.product.count({ where }),
    ]);

    return { products, total, page: params.page ?? 1, pages: Math.ceil(total / take) };
  }

  async getProduct(orgId: string, id: string) {
    return this.prisma.product.findFirst({
      where: { id, orgId },
      include: {
        tasks: {
          where: { deletedAt: null },
          include: { assignee: { select: { id: true, name: true, avatarUrl: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
  }

  async createTask(orgId: string, userId: string, productId: string, dto: any) {
    const product = await this.prisma.product.findFirst({ where: { id: productId, orgId } });
    if (!product) throw new BadRequestException('Карточка не найдена');
    return this.prisma.task.create({
      data: {
        orgId, createdById: userId, productId,
        title: dto.title, description: dto.description,
        priority: dto.priority ?? 'MEDIUM', assigneeId: dto.assigneeId,
        dueDate: dto.dueDate ? new Date(dto.dueDate) : undefined,
        status: 'NEW', tags: dto.tags ?? [],
      },
    });
  }
}
