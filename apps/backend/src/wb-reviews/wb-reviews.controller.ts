import { Controller, Get, Query } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/index';
import { SettingsService } from '../settings/settings.service';

@Controller('api/v1/wb-reviews')
export class WbReviewsController {
  constructor(private readonly settings: SettingsService) {}

  @Get()
  async getReviews(
    @CurrentUser() user: any,
    @Query('dateFrom') dateFrom: string,
    @Query('dateTo') dateTo: string,
    @Query('isAnswered') isAnswered: string,
  ) {
    const token = await this.settings.getWbToken(user.orgId);
    if (!token) return { error: 'WB токен не настроен. Добавьте токен в Настройках.' };

    try {
      const params = new URLSearchParams({
        isAnswered: isAnswered ?? 'false',
        take: '5000',
        skip: '0',
        order: 'dateDesc',
      });
      if (dateFrom) params.set('dateFrom', dateFrom);
      if (dateTo) params.set('dateTo', dateTo);

      const res = await fetch(`https://feedbacks-api.wildberries.ru/api/v1/feedbacks?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        const text = await res.text().catch(() => '');
        return { error: `WB API вернул ${res.status}: ${text}` };
      }

      const data = await res.json();
      const feedbacks = data?.data?.feedbacks ?? [];

      // Группируем по артикулу
      const byProduct: Record<string, any> = {};
      for (const fb of feedbacks) {
        const sku = fb.productDetails?.supplierArticle ?? fb.nmId ?? 'unknown';
        const name = fb.productDetails?.productName ?? sku;
        const rating = fb.productValuation ?? 0;
        const date = fb.createdDate?.slice(0, 10) ?? '';

        if (!byProduct[sku]) {
          byProduct[sku] = {
            sku, name,
            total: 0, positive: 0, negative: 0, neutral: 0,
            avgRating: 0, totalRating: 0,
            byDay: {} as Record<string, { positive: number; negative: number; neutral: number }>,
            recent: [],
          };
        }

        const p = byProduct[sku];
        p.total++;
        p.totalRating += rating;
        if (rating >= 4) p.positive++;
        else if (rating <= 2) p.negative++;
        else p.neutral++;

        if (date) {
          if (!p.byDay[date]) p.byDay[date] = { positive: 0, negative: 0, neutral: 0 };
          if (rating >= 4) p.byDay[date].positive++;
          else if (rating <= 2) p.byDay[date].negative++;
          else p.byDay[date].neutral++;
        }

        if (p.recent.length < 5) {
          p.recent.push({
            id: fb.id,
            rating,
            text: fb.text ?? '',
            date: fb.createdDate,
            answered: !!fb.answer?.text,
          });
        }
      }

      // Считаем средний рейтинг
      for (const p of Object.values(byProduct)) {
        p.avgRating = p.total > 0 ? Math.round((p.totalRating / p.total) * 10) / 10 : 0;
        delete p.totalRating;
      }

      return {
        total: feedbacks.length,
        products: Object.values(byProduct).sort((a: any, b: any) => b.total - a.total),
      };
    } catch (e: any) {
      return { error: `Ошибка запроса к WB API: ${e.message}` };
    }
  }

  @Get('summary')
  async getSummary(@CurrentUser() user: any) {
    const token = await this.settings.getWbToken(user.orgId);
    if (!token) return { error: 'WB токен не настроен' };

    try {
      const res = await fetch('https://feedbacks-api.wildberries.ru/api/v1/feedbacks/count-unanswered', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return { error: `WB API: ${res.status}` };
      return res.json();
    } catch (e: any) {
      return { error: e.message };
    }
  }
}
