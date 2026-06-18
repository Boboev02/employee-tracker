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
  ) {
    const token = await this.settings.getWbToken(user.orgId);
    if (!token) return { error: 'WB токен не настроен. Добавьте токен в Настройках.' };

    try {
      const fetchFeedbacks = async (answered: boolean) => {
        const params = new URLSearchParams({
          isAnswered: answered ? 'true' : 'false',
          take: '5000',
          skip: '0',
          order: 'dateDesc',
        });
        const res = await fetch(`https://feedbacks-api.wildberries.ru/api/v1/feedbacks?${params}`, {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error(`WB API вернул ${res.status}: ${text}`);
        }
        const data = await res.json();
        return data?.data?.feedbacks ?? [];
      };

      const [unanswered, answered] = await Promise.all([
        fetchFeedbacks(false),
        fetchFeedbacks(true),
      ]);
      let feedbacks = [...unanswered, ...answered];

      // Фильтруем по дате на нашей стороне
      if (dateFrom || dateTo) {
        const from = dateFrom ? new Date(dateFrom) : null;
        const to = dateTo ? new Date(dateTo) : null;
        feedbacks = feedbacks.filter((fb: any) => {
          const d = new Date(fb.createdDate);
          if (from && d < from) return false;
          if (to && d > to) return false;
          return true;
        });
      }

      // Сегодня по московскому времени (UTC+3)
      const nowMsk = new Date(Date.now() + 3 * 60 * 60 * 1000);
      const todayMskStr = nowMsk.toISOString().slice(0, 10); // "2026-06-18"

      const todayFeedbacks = feedbacks.filter((fb: any) => {
        return (fb.createdDate ?? '').slice(0, 10) === todayMskStr;
      });
      const answeredToday = answered.filter((fb: any) => {
        // createDate может быть в формате "2026-06-18T10:00:00Z" или "2026-06-18T10:00:00+03:00"
        const cd = fb.answer?.createDate ?? '';
        if (!cd) return false;
        // Конвертируем в МСК для сравнения
        const d = new Date(cd);
        const dMsk = new Date(d.getTime() + 3 * 60 * 60 * 1000);
        return dMsk.toISOString().slice(0, 10) === todayMskStr;
      });

      // Группируем по артикулу
      const byProduct: Record<string, any> = {};
      for (const fb of feedbacks) {
        const sku = fb.productDetails?.supplierArticle ?? String(fb.nmId) ?? 'unknown';
        const name = fb.productDetails?.productName ?? sku;
        const rating = fb.productValuation ?? 0;
        const date = fb.createdDate?.slice(0, 10) ?? '';
        const isAnswered = !!fb.answer?.text;

        if (!byProduct[sku]) {
          byProduct[sku] = {
            sku, name,
            total: 0, positive: 0, negative: 0, neutral: 0,
            avgRating: 0, totalRating: 0,
            answeredCount: 0, unansweredCount: 0,
            byDay: {} as Record<string, any>,
            recent: [],
            ratingTrend: [] as number[],
            allRatings: [] as { rating: number; date: string }[],
          };
        }

        const p = byProduct[sku];
        p.total++;
        p.totalRating += rating;
        if (rating >= 4) p.positive++;
        else if (rating <= 2) p.negative++;
        else p.neutral++;
        if (isAnswered) p.answeredCount++;
        else p.unansweredCount++;

        p.ratingTrend.push(rating);
        p.allRatings.push({ rating, date: fb.createdDate ?? '' });

        if (date) {
          if (!p.byDay[date]) p.byDay[date] = { positive: 0, negative: 0, neutral: 0, total: 0 };
          if (rating >= 4) p.byDay[date].positive++;
          else if (rating <= 2) p.byDay[date].negative++;
          else p.byDay[date].neutral++;
          p.byDay[date].total++;
        }

        if (p.recent.length < 3) {
          p.recent.push({
            id: fb.id,
            rating,
            text: fb.text ?? '',
            date: fb.createdDate,
            answered: isAnswered,
          });
        }
      }

      // Считаем метрики
      const products = Object.values(byProduct).map((p: any) => {
        p.avgRating = p.total > 0 ? Math.round((p.totalRating / p.total) * 10) / 10 : 0;
        delete p.totalRating;

        // Рейтинг по официальной формуле WB с коэффициентом затухания
        const now = Date.now();
        let sumWeighted = 0, sumK = 0;
        for (const r of p.allRatings) {
          const d = r.date ? Math.floor((now - new Date(r.date).getTime()) / (1000 * 60 * 60 * 24)) : 0;
          const k = d < 90 ? 1 : Math.pow(100, -(d - 182) / (730 * 1.5));
          sumWeighted += r.rating * k;
          sumK += k;
        }
        p.wbRating = sumK > 0 ? Math.round((sumWeighted / sumK) * 10) / 10 : p.avgRating;
        // Передаём allRatings на фронтенд для калькулятора
        // (оставляем массив)

        // Тренд: сравниваем первую и вторую половину отзывов
        const half = Math.floor(p.ratingTrend.length / 2);
        if (half > 0) {
          const firstHalf = p.ratingTrend.slice(0, half);
          const secondHalf = p.ratingTrend.slice(half);
          const avg1 = firstHalf.reduce((a: number, b: number) => a + b, 0) / firstHalf.length;
          const avg2 = secondHalf.reduce((a: number, b: number) => a + b, 0) / secondHalf.length;
          p.trend = avg2 > avg1 + 0.2 ? 'up' : avg2 < avg1 - 0.2 ? 'down' : 'stable';
          p.trendDiff = Math.round((avg2 - avg1) * 10) / 10;
        } else {
          p.trend = 'stable';
          p.trendDiff = 0;
        }
        delete p.ratingTrend;

        // Процент ответов
        p.answerRate = p.total > 0 ? Math.round(p.answeredCount / p.total * 100) : 0;

        return p;
      }).sort((a: any, b: any) => b.total - a.total);

      // Топ товары
      const topByNegative = [...products].sort((a: any, b: any) => b.negative - a.negative).slice(0, 5);
      const topByPositive = [...products].sort((a: any, b: any) => b.positive - a.positive).slice(0, 5);
      const falling = [...products].filter((p: any) => p.trend === 'down').sort((a: any, b: any) => a.trendDiff - b.trendDiff).slice(0, 5);
      const rising = [...products].filter((p: any) => p.trend === 'up').sort((a: any, b: any) => b.trendDiff - a.trendDiff).slice(0, 5);

      return {
        total: feedbacks.length,
        todayTotal: todayFeedbacks.length,
        answeredToday: answeredToday.length,
        unansweredTotal: unanswered.filter((fb: any) => {
          if (!dateFrom && !dateTo) return true;
          const d = new Date(fb.createdDate);
          const from = dateFrom ? new Date(dateFrom) : null;
          const to = dateTo ? new Date(dateTo) : null;
          if (from && d < from) return false;
          if (to && d > to) return false;
          return true;
        }).length,
        products,
        tops: { topByNegative, topByPositive, falling, rising },
      };
    } catch (e: any) {
      return { error: `Ошибка: ${e.message}` };
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
