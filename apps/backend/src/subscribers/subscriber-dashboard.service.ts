import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as ExcelJS from 'exceljs';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';

const PAID_PLANS = ['PRO', 'BUSINESS'];
const CACHE_TTL_SECONDS = 60; // виджеты/графики кэшируются на минуту — снижает нагрузку на БД при частых открытиях Dashboard

@Injectable()
export class SubscriberDashboardService {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  private async cached<T>(key: string, compute: () => Promise<T>): Promise<T> {
    try {
      const hit = await this.redis.get(key);
      if (hit) return JSON.parse(hit);
    } catch {}
    const value = await compute();
    try { await this.redis.set(key, JSON.stringify(value), 'EX', CACHE_TTL_SECONDS); } catch {}
    return value;
  }

  // ─── Настройка цен на тарифы (нужна для расчёта выручки) ────────────────────

  async getPricing(orgId: string) {
    const rows = await this.prisma.subscriberPlanPricing.findMany({ where: { orgId } });
    const map: Record<string, number> = { TRIAL: 0, NONE: 0, PRO: 0, BUSINESS: 0 };
    for (const r of rows) map[r.plan] = r.monthlyPrice;
    return map;
  }

  async savePricing(orgId: string, plan: string, monthlyPrice: number) {
    return this.prisma.subscriberPlanPricing.upsert({
      where: { orgId_plan: { orgId, plan } },
      update: { monthlyPrice },
      create: { orgId, plan, monthlyPrice },
    });
  }

  // ─── Раскладка виджетов (drag&drop порядок, персонально для пользователя) ──

  async getLayout(orgId: string, userId: string) {
    const layout = await this.prisma.subscriberDashboardLayout.findUnique({ where: { orgId_userId: { orgId, userId } } });
    return layout?.widgetOrder ?? null;
  }

  async saveLayout(orgId: string, userId: string, widgetOrder: string[]) {
    return this.prisma.subscriberDashboardLayout.upsert({
      where: { orgId_userId: { orgId, userId } },
      update: { widgetOrder },
      create: { orgId, userId, widgetOrder },
    });
  }

  // ─── Виджеты ─────────────────────────────────────────────────────────────────

  async getWidgets(orgId: string) {
    return this.cached(`subdash:widgets:${orgId}`, () => this.computeWidgets(orgId));
  }

  private async computeWidgets(orgId: string) {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const todayEnd = new Date(todayStart.getTime() + 86400000);
    const weekEnd = new Date(todayStart.getTime() + 8 * 86400000);
    const monthAgo = new Date(now.getTime() - 30 * 86400000);
    const twoMonthsAgo = new Date(now.getTime() - 60 * 86400000);

    const baseWhere = { orgId, deletedAt: null };
    const pricing = await this.getPricing(orgId);

    const [
      total, active, noSubscription, overdue, endingToday, endingWeek,
      newRegistrations, renewalsCount, churnCount,
      payingSubscribers,
    ] = await Promise.all([
      this.prisma.subscriber.count({ where: baseWhere }),
      this.prisma.subscriber.count({ where: { ...baseWhere, plan: { in: PAID_PLANS }, planStatus: 'active' } }),
      this.prisma.subscriber.count({ where: { ...baseWhere, OR: [{ plan: 'NONE' }, { plan: null }] } }),
      this.prisma.subscriber.count({ where: { ...baseWhere, crmStatus: { notIn: ['LOST', 'ARCHIVED'] }, OR: [{ trialEndsAt: { lt: todayStart } }, { subscriptionEndsAt: { lt: todayStart } }] } }),
      this.prisma.subscriber.count({ where: { ...baseWhere, OR: [{ trialEndsAt: { gte: todayStart, lt: todayEnd } }, { subscriptionEndsAt: { gte: todayStart, lt: todayEnd } }] } }),
      this.prisma.subscriber.count({ where: { ...baseWhere, OR: [{ trialEndsAt: { gte: todayStart, lt: weekEnd } }, { subscriptionEndsAt: { gte: todayStart, lt: weekEnd } }] } }),
      this.prisma.subscriber.count({ where: { ...baseWhere, createdAt: { gte: monthAgo } } }),
      this.prisma.subscriberHistory.count({ where: { orgId, field: 'crmStatus', newValue: JSON.stringify('RENEWED'), createdAt: { gte: monthAgo } } }),
      this.prisma.subscriberHistory.count({ where: { orgId, field: 'plan', newValue: JSON.stringify('NONE'), createdAt: { gte: monthAgo } } }),
      this.prisma.subscriber.findMany({ where: { ...baseWhere, plan: { in: PAID_PLANS }, planStatus: 'active' }, select: { plan: true } }),
    ]);

    const mrr = payingSubscribers.reduce((sum, s) => sum + (pricing[s.plan ?? ''] ?? 0), 0);
    const arr = mrr * 12;
    const avgCheck = payingSubscribers.length > 0 ? mrr / payingSubscribers.length : 0;

    // Churn rate: доля плативших 30-60 дней назад, кто отказался за последние 30 дней
    const payingTwoMonthsAgoApprox = await this.prisma.subscriber.count({ where: { ...baseWhere, plan: { in: PAID_PLANS }, createdAt: { lt: monthAgo } } });
    const churnRate = payingTwoMonthsAgoApprox > 0 ? (churnCount / payingTwoMonthsAgoApprox) * 100 : 0;

    // Упрощённый LTV: средний чек / месячный churn rate (если отток есть), иначе средний чек × 12 (эвристика на 1 год)
    const ltv = churnRate > 0 ? avgCheck / (churnRate / 100) : avgCheck * 12;

    return {
      total, active, noSubscription, overdue, endingToday, endingWeek,
      revenue: Math.round(mrr), avgCheck: Math.round(avgCheck),
      renewals: renewalsCount, churns: churnCount, newRegistrations,
      ltv: Math.round(ltv), churnRate: Math.round(churnRate * 10) / 10,
      mrr: Math.round(mrr), arr: Math.round(arr),
    };
  }

  // ─── Графики ─────────────────────────────────────────────────────────────────

  async getCharts(orgId: string) {
    return this.cached(`subdash:charts:${orgId}`, () => this.computeCharts(orgId));
  }

  private async computeCharts(orgId: string) {
    const [registrations, sales, renewals, churn, plans, managerActivity] = await Promise.all([
      this.chartByDay(orgId, 'createdAt', 'subscriber'),
      this.salesChart(orgId),
      this.historyChartByField(orgId, 'crmStatus', 'RENEWED'),
      this.historyChartByField(orgId, 'plan', 'NONE'),
      this.planDistribution(orgId),
      this.managerActivityChart(orgId),
    ]);
    return { registrations, sales, renewals, churn, plans, managerActivity };
  }

  private last30Days(): { date: string; label: string }[] {
    const days = [];
    for (let i = 29; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000);
      days.push({ date: d.toISOString().slice(0, 10), label: d.toLocaleDateString('ru', { day: 'numeric', month: 'short' }) });
    }
    return days;
  }

  private async chartByDay(orgId: string, dateField: string, model: 'subscriber') {
    const rows = await (this.prisma.subscriber as any).findMany({
      where: { orgId, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
      select: { [dateField]: true },
    });
    const days = this.last30Days();
    return days.map(d => ({
      label: d.label,
      count: rows.filter((r: any) => new Date(r[dateField]).toISOString().slice(0, 10) === d.date).length,
    }));
  }

  private async salesChart(orgId: string) {
    const pricing = await this.getPricing(orgId);
    const rows = await this.prisma.subscriberHistory.findMany({
      where: { orgId, field: 'plan', createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
    });
    const days = this.last30Days();
    return days.map(d => {
      const dayRows = rows.filter(r => r.createdAt.toISOString().slice(0, 10) === d.date);
      const revenue = dayRows.reduce((sum, r) => {
        try {
          const newPlan = JSON.parse(r.newValue ?? 'null');
          return sum + (PAID_PLANS.includes(newPlan) ? (pricing[newPlan] ?? 0) : 0);
        } catch { return sum; }
      }, 0);
      return { label: d.label, revenue };
    });
  }

  private async historyChartByField(orgId: string, field: string, matchValue: string) {
    const rows = await this.prisma.subscriberHistory.findMany({
      where: { orgId, field, newValue: JSON.stringify(matchValue), createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
    });
    const days = this.last30Days();
    return days.map(d => ({ label: d.label, count: rows.filter(r => r.createdAt.toISOString().slice(0, 10) === d.date).length }));
  }

  private async planDistribution(orgId: string) {
    const groups = await this.prisma.subscriber.groupBy({ by: ['plan'], where: { orgId, deletedAt: null }, _count: true });
    return groups.map(g => ({ plan: g.plan ?? 'NONE', count: g._count }));
  }

  private async managerActivityChart(orgId: string) {
    const rows = await this.prisma.subscriberHistory.findMany({
      where: { orgId, changedById: { not: null }, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } },
    });
    const managerIds = Array.from(new Set(rows.map(r => r.changedById).filter(Boolean))) as string[];
    const managers = await this.prisma.user.findMany({ where: { id: { in: managerIds } }, select: { id: true, name: true } });
    const nameMap = new Map(managers.map(m => [m.id, m.name]));
    const counts = new Map<string, number>();
    for (const r of rows) {
      if (!r.changedById) continue;
      counts.set(r.changedById, (counts.get(r.changedById) ?? 0) + 1);
    }
    return Array.from(counts.entries()).map(([id, count]) => ({ manager: nameMap.get(id) ?? 'Неизвестно', count })).sort((a, b) => b.count - a.count);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // ЭТАП 9: ОТЧЁТЫ
  // ═══════════════════════════════════════════════════════════════════════════

  async getReports(orgId: string) {
    return this.cached(`subdash:reports:${orgId}`, () => this.computeReports(orgId));
  }

  private async computeReports(orgId: string) {
    const baseWhere = { orgId, deletedAt: null };

    const [byPlan, byManagerRaw, byCountryRaw, byLanguageRaw, byCancelReasonRaw] = await Promise.all([
      this.prisma.subscriber.groupBy({ by: ['plan'], where: baseWhere, _count: true }),
      this.prisma.subscriber.groupBy({ by: ['managerId'], where: baseWhere, _count: true }),
      this.prisma.subscriber.groupBy({ by: ['country'], where: baseWhere, _count: true }),
      this.prisma.subscriber.groupBy({ by: ['language'], where: baseWhere, _count: true }),
      this.prisma.subscriber.groupBy({ by: ['cancelReason'], where: { ...baseWhere, cancelReason: { not: null } }, _count: true }),
    ]);

    const managerIds = byManagerRaw.map(m => m.managerId).filter(Boolean) as string[];
    const managers = await this.prisma.user.findMany({ where: { id: { in: managerIds } }, select: { id: true, name: true } });
    const managerNameMap = new Map(managers.map(m => [m.id, m.name]));

    const pricing = await this.getPricing(orgId);
    const byManager = byManagerRaw.map(m => ({ manager: m.managerId ? (managerNameMap.get(m.managerId) ?? '—') : 'Без менеджера', count: m._count }));

    // По продажам (за 30 дней, по дням выручки — переиспользуем salesChart)
    const bySales = await this.salesChart(orgId);

    // По продлениям / по отказам — за последние 30 дней, детализация по дням (переиспользуем historyChartByField)
    const byRenewals = await this.historyChartByField(orgId, 'crmStatus', 'RENEWED');
    const byChurns = await this.historyChartByField(orgId, 'plan', 'NONE');

    // По новым пользователям (регистрации по дням)
    const byNewUsers = await this.chartByDay(orgId, 'createdAt', 'subscriber');

    // По активности пользователей (по количеству записей в истории — прокси активности)
    const activityRows = await this.prisma.subscriberHistory.groupBy({ by: ['subscriberId'], where: { orgId, createdAt: { gte: new Date(Date.now() - 30 * 86400000) } }, _count: true, orderBy: { _count: { subscriberId: 'desc' } }, take: 20 });
    const activitySubIds = activityRows.map(r => r.subscriberId);
    const activitySubs = await this.prisma.subscriber.findMany({ where: { id: { in: activitySubIds } }, select: { id: true, firstName: true, lastName: true } });
    const activitySubMap = new Map(activitySubs.map(s => [s.id, `${s.firstName ?? ''} ${s.lastName ?? ''}`.trim()]));
    const byActivity = activityRows.map(r => ({ subscriber: activitySubMap.get(r.subscriberId) ?? '—', events: r._count }));

    return {
      byPlan: byPlan.map(p => ({ plan: p.plan ?? 'NONE', count: p._count })),
      byManager,
      bySales,
      byRenewals,
      byChurns,
      byCountry: byCountryRaw.map(c => ({ country: c.country ?? 'Не указано', count: c._count })),
      byLanguage: byLanguageRaw.map(l => ({ language: l.language ?? 'Не указано', count: l._count })),
      byNewUsers,
      byCancelReason: byCancelReasonRaw.map(c => ({ reason: c.cancelReason ?? 'Не указано', count: c._count })),
      byActivity,
    };
  }

  // ─── Экспорт отчётов ────────────────────────────────────────────────────────

  async exportSubscribersExcel(orgId: string, ids?: string[]) {
    const where: any = { orgId, deletedAt: null };
    if (ids && ids.length > 0) where.id = { in: ids };
    const subs = await this.prisma.subscriber.findMany({ where, include: { manager: { select: { name: true } } } });

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Подписчики');
    sheet.columns = [
      { header: 'Имя', key: 'firstName', width: 18 }, { header: 'Фамилия', key: 'lastName', width: 18 },
      { header: 'Email', key: 'email', width: 26 }, { header: 'Телефон', key: 'phone', width: 16 },
      { header: 'Тариф', key: 'plan', width: 12 }, { header: 'CRM статус', key: 'crmStatus', width: 14 },
      { header: 'Менеджер', key: 'manager', width: 18 }, { header: 'Триал до', key: 'trialEndsAt', width: 14 },
      { header: 'Подписка до', key: 'subscriptionEndsAt', width: 14 }, { header: 'Теги', key: 'tags', width: 20 },
    ];
    sheet.getRow(1).font = { bold: true };
    for (const s of subs) {
      sheet.addRow({
        firstName: s.firstName ?? '', lastName: s.lastName ?? '', email: s.email ?? '', phone: s.phone ?? '',
        plan: s.plan ?? '', crmStatus: s.crmStatus, manager: s.manager?.name ?? '',
        trialEndsAt: s.trialEndsAt?.toISOString().slice(0, 10) ?? '', subscriptionEndsAt: s.subscriptionEndsAt?.toISOString().slice(0, 10) ?? '',
        tags: (s.tags ?? []).join(', '),
      });
    }
    return workbook.xlsx.writeBuffer();
  }
}
