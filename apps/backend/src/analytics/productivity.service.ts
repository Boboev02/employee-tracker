import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

export interface ProductivityScore {
  userId:       string;
  name:         string;
  score:        number;   // 0-100
  grade:        string;   // A/B/C/D/F
  factors: {
    activity:   number;   // 0-25: events per day vs org average
    consistency: number;  // 0-25: how many days active
    tasks:       number;  // 0-25: tasks completed
    focus:       number;  // 0-25: time on productive sections
  };
  details: {
    totalEvents:    number;
    activeDays:     number;
    totalDays:      number;
    tasksCompleted: number;
    tasksTotal:     number;
    avgEventsPerDay: number;
    topPlatform:    string;
    topSection:     string;
  };
}

@Injectable()
export class ProductivityService {
  constructor(private readonly prisma: PrismaService) {}

  async getOrgProductivity(orgId: string, days = 7): Promise<ProductivityScore[]> {
    const from = new Date();
    from.setDate(from.getDate() - days);
    from.setHours(0, 0, 0, 0);

    const users = await this.prisma.user.findMany({
      where: { orgId, deletedAt: null, status: 'ACTIVE' },
      include: { userRoles: { include: { role: true } } },
    });

    const scores = await Promise.all(users.map(u => this.getUserScore(u, orgId, from, days)));

    // Normalize activity factor vs org average
    const avgEvents = scores.reduce((s, sc) => s + sc.details.totalEvents, 0) / (scores.length || 1);
    scores.forEach(sc => {
      if (avgEvents > 0) {
        sc.factors.activity = Math.min(25, Math.round((sc.details.totalEvents / avgEvents) * 18));
      }
      sc.score = sc.factors.activity + sc.factors.consistency + sc.factors.tasks + sc.factors.focus;
      sc.grade = this.getGrade(sc.score);
    });

    return scores.sort((a, b) => b.score - a.score);
  }

  private async getUserScore(user: any, orgId: string, from: Date, days: number): Promise<ProductivityScore> {
    const [events, tasks] = await Promise.all([
      this.prisma.activityEvent.findMany({
        where: { userId: user.id, orgId, createdAt: { gte: from } },
        select: { createdAt: true, platformData: true, platform: true },
      }),
      this.prisma.task.findMany({
        where: { assigneeId: user.id, orgId, deletedAt: null },
        select: { status: true, completedAt: true, priority: true },
      }),
    ]);

    // Factor 1: Activity (events per day vs average — normalized later)
    const totalEvents = events.length;

    // Factor 2: Consistency (active days / total days)
    const activeDays = new Set(events.map(e => e.createdAt.toISOString().slice(0, 10))).size;
    const consistencyFactor = Math.round((activeDays / days) * 25);

    // Factor 3: Tasks completed (weighted by priority)
    const tasksCompleted = tasks.filter(t => t.status === 'DONE').length;
    const tasksTotal = tasks.length;
    const criticalDone = tasks.filter(t => t.status === 'DONE' && t.priority === 'CRITICAL').length;
    const highDone     = tasks.filter(t => t.status === 'DONE' && t.priority === 'HIGH').length;
    const taskScore = tasksTotal > 0
      ? Math.min(25, Math.round(((tasksCompleted / tasksTotal) * 15) + (criticalDone * 3) + (highDone * 1.5)))
      : 0;

    // Factor 4: Focus (time on productive sections)
    const productiveSections = new Set(['orders', 'products', 'analytics', 'finance', 'supplies', 'prices', 'feedbacks', 'questions', 'advertising', 'promotion', 'stocks', 'logistics']);
    const productiveEvents = events.filter(e => {
      const section = (e.platformData as any)?.section;
      return productiveSections.has(section);
    }).length;
    const focusFactor = totalEvents > 0
      ? Math.round((productiveEvents / totalEvents) * 25)
      : 0;

    // Top platform
    const platformCounts: Record<string, number> = {};
    events.forEach(e => { platformCounts[e.platform] = (platformCounts[e.platform] ?? 0) + 1; });
    const topPlatform = Object.entries(platformCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

    // Top section
    const sectionCounts: Record<string, number> = {};
    events.forEach(e => {
      const s = (e.platformData as any)?.section;
      if (s) sectionCounts[s] = (sectionCounts[s] ?? 0) + 1;
    });
    const topSection = Object.entries(sectionCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? '—';

    return {
      userId: user.id,
      name:   user.name,
      score:  0, // normalized later
      grade:  'N/A',
      factors: {
        activity:    0, // normalized later
        consistency: consistencyFactor,
        tasks:       taskScore,
        focus:       focusFactor,
      },
      details: {
        totalEvents,
        activeDays,
        totalDays:       days,
        tasksCompleted,
        tasksTotal,
        avgEventsPerDay: activeDays > 0 ? Math.round(totalEvents / activeDays) : 0,
        topPlatform,
        topSection,
      },
    };
  }

  private getGrade(score: number): string {
    if (score >= 85) return 'A';
    if (score >= 70) return 'B';
    if (score >= 55) return 'C';
    if (score >= 40) return 'D';
    return 'F';
  }
}
