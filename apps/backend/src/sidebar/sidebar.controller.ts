import { Controller, Get, Put, Delete, Body, UseGuards, HttpCode } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { RbacGuard } from '../auth/guards/index';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Персональная раскладка сайдбара.
 * Бэкенд — просто хранилище JSON на пользователя: реестр разделов и
 * значения по умолчанию живут на фронтенде (lib/sidebarConfig.ts),
 * чтобы не расходились две версии правды.
 */
@Controller('api/v1/users/sidebar')
@UseGuards(RbacGuard)
export class SidebarController {
  constructor(private readonly prisma: PrismaService) {}

  private uid(user: any) { return user.id ?? user.sub; }

  @Get()
  @RequirePermissions('task:read:self', 'task:read:all', 'task:read:team')
  async getConfig(@CurrentUser() user: any) {
    const userId = this.uid(user);
    const record = await this.prisma.userSidebarConfig
      .findUnique({ where: { userId } })
      .catch(() => null);
    if (!record) return { config: null };
    try {
      return { config: JSON.parse(record.config) };
    } catch {
      return { config: null };
    }
  }

  @Put()
  @RequirePermissions('task:read:self', 'task:read:all', 'task:read:team')
  async saveConfig(@CurrentUser() user: any, @Body() body: { config: any }) {
    const userId = this.uid(user);
    const json = JSON.stringify(body?.config ?? null);
    await this.prisma.userSidebarConfig.upsert({
      where: { userId },
      update: { config: json, updatedAt: new Date() },
      create: { userId, orgId: user.orgId, config: json },
    });
    return { success: true };
  }

  @Delete()
  @HttpCode(204)
  @RequirePermissions('task:read:self', 'task:read:all', 'task:read:team')
  async resetConfig(@CurrentUser() user: any) {
    await this.prisma.userSidebarConfig
      .deleteMany({ where: { userId: this.uid(user) } })
      .catch(() => {});
  }
}
