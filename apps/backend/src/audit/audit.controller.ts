import { Controller, Get, Query, ForbiddenException } from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/index';
import { PrismaService } from '../prisma/prisma.service';

@Controller('api/v1/audit')
export class AuditController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async getLogs(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('category') category?: string,
    @Query('userId') userId?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    if (!user.roles?.includes('ADMIN') && !user.roles?.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('Доступ к логам только для администраторов');
    }

    const take = Math.min(parseInt(limit ?? '50'), 200);
    const skip = (Math.max(parseInt(page ?? '1'), 1) - 1) * take;

    const where: any = { orgId: user.orgId };
    if (category) where.category = category;
    if (userId) where.userId = userId;
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }
    if (search) {
      where.OR = [
        { action: { contains: search, mode: 'insensitive' } },
        { userName: { contains: search, mode: 'insensitive' } },
        { details: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [logs, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        take,
        skip,
      }),
      this.prisma.auditLog.count({ where }),
    ]);

    return {
      logs: logs.map(l => ({ ...l, details: l.details ? JSON.parse(l.details) : null })),
      total,
      page: Math.max(parseInt(page ?? '1'), 1),
      pages: Math.ceil(total / take),
    };
  }

  @Get('categories')
  async getCategories(@CurrentUser() user: any) {
    if (!user.roles?.includes('ADMIN') && !user.roles?.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('Доступ только для администраторов');
    }
    const categories = await this.prisma.auditLog.groupBy({
      by: ['category'],
      where: { orgId: user.orgId },
      _count: true,
    });
    return categories.map(c => ({ category: c.category, count: c._count }));
  }

  @Get('errors')
  async getErrors(
    @CurrentUser() user: any,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('dateFrom') dateFrom?: string,
    @Query('dateTo') dateTo?: string,
  ) {
    if (!user.roles?.includes('ADMIN') && !user.roles?.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('Доступ к логам только для администраторов');
    }

    const take = Math.min(parseInt(limit ?? '50'), 200);
    const skip = (Math.max(parseInt(page ?? '1'), 1) - 1) * take;

    const where: any = { orgId: user.orgId };
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) where.createdAt.gte = new Date(dateFrom);
      if (dateTo) where.createdAt.lte = new Date(dateTo);
    }
    if (search) {
      where.OR = [
        { message: { contains: search, mode: 'insensitive' } },
        { endpoint: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [errors, total] = await Promise.all([
      this.prisma.errorLog.findMany({ where, orderBy: { createdAt: 'desc' }, take, skip }),
      this.prisma.errorLog.count({ where }),
    ]);

    return { errors, total, page: Math.max(parseInt(page ?? '1'), 1), pages: Math.ceil(total / take) };
  }

  @Get('errors/summary')
  async getErrorsSummary(@CurrentUser() user: any) {
    if (!user.roles?.includes('ADMIN') && !user.roles?.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('Доступ только для администраторов');
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const last24h = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const [todayCount, totalCount, last24hCount, topEndpoints] = await Promise.all([
      this.prisma.errorLog.count({ where: { orgId: user.orgId, createdAt: { gte: today } } }),
      this.prisma.errorLog.count({ where: { orgId: user.orgId } }),
      this.prisma.errorLog.count({ where: { orgId: user.orgId, createdAt: { gte: last24h } } }),
      this.prisma.errorLog.groupBy({
        by: ['endpoint'],
        where: { orgId: user.orgId, createdAt: { gte: last24h } },
        _count: true,
        orderBy: { _count: { endpoint: 'desc' } },
        take: 5,
      }),
    ]);

    return {
      todayCount, totalCount, last24hCount,
      topEndpoints: topEndpoints.map(e => ({ endpoint: e.endpoint, count: e._count })),
    };
  }

  @Get('summary')
  async getSummary(@CurrentUser() user: any) {
    if (!user.roles?.includes('ADMIN') && !user.roles?.includes('SUPER_ADMIN')) {
      throw new ForbiddenException('Доступ только для администраторов');
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const [totalToday, totalAll, byUser] = await Promise.all([
      this.prisma.auditLog.count({ where: { orgId: user.orgId, createdAt: { gte: today } } }),
      this.prisma.auditLog.count({ where: { orgId: user.orgId } }),
      this.prisma.auditLog.groupBy({
        by: ['userId', 'userName'],
        where: { orgId: user.orgId, createdAt: { gte: today } },
        _count: true,
        orderBy: { _count: { userId: 'desc' } },
        take: 5,
      }),
    ]);

    return {
      totalToday,
      totalAll,
      topUsersToday: byUser.map(u => ({ userId: u.userId, userName: u.userName, count: u._count })),
    };
  }
}
