import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/index';
import { CurrentUser } from '../auth/decorators/index';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/v1/search')
@UseGuards(JwtAuthGuard)
export class SearchController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async search(@CurrentUser() user: any, @Query('q') q: string) {
    if (!q || q.trim().length < 2) return { tasks: [], employees: [], articles: [] };
    const query = q.trim();
    const orgId = user.orgId;
    const [tasks, employees, articles] = await Promise.all([
      this.prisma.task.findMany({
        where: { orgId, deletedAt: null, title: { contains: query, mode: 'insensitive' } },
        select: { id: true, title: true, status: true, priority: true, dueDate: true, assignee: { select: { id: true, name: true } } },
        take: 5, orderBy: { updatedAt: 'desc' },
      }),
      this.prisma.user.findMany({
        where: { orgId, deletedAt: null, OR: [{ name: { contains: query, mode: 'insensitive' } }, { email: { contains: query, mode: 'insensitive' } }] },
        select: { id: true, name: true, email: true, status: true },
        take: 5,
      }),
      this.prisma.knowledgeArticle.findMany({
        where: { orgId, deletedAt: null, OR: [{ title: { contains: query, mode: 'insensitive' } }, { content: { contains: query, mode: 'insensitive' } }] },
        select: { id: true, title: true, category: { select: { name: true, icon: true } } },
        take: 5, orderBy: { updatedAt: 'desc' },
      }),
    ]);
    return { tasks, employees, articles };
  }
}