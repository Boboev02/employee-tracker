import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

const PAID_PLANS = ['PRO', 'BUSINESS'];

@Injectable()
export class SubscriberDashboardService {
  constructor(private readonly prisma: PrismaService) {}

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
}
