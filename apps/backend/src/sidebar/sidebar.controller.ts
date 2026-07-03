import { Controller, Get, Put, Body, UseGuards } from '@nestjs/common';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { RbacGuard } from '../auth/guards/index';
import { PrismaService } from '../prisma/prisma.service';

// Разделы доступные для добавления в сайдбар
const ALL_SECTIONS = [
  { id: 'dashboard',    label: 'Дашборд',          icon: 'ti-layout-dashboard', adminOnly: false },
  { id: 'home',         label: 'Мои задачи',        icon: 'ti-home',             adminOnly: false },
  { id: 'employees',    label: 'Сотрудники',        icon: 'ti-users',            adminOnly: false },
  { id: 'tasks',        label: 'Задачи',            icon: 'ti-checkbox',         adminOnly: false },
  { id: 'projects',     label: 'Проекты',           icon: 'ti-layout-kanban',    adminOnly: false },
  { id: 'analytics',    label: 'Аналитика',         icon: 'ti-chart-bar',        adminOnly: false },
  { id: 'teams',        label: 'Команды',           icon: 'ti-tag',              adminOnly: true  },
  { id: 'productivity', label: 'Продуктивность',    icon: 'ti-star',             adminOnly: true  },
  { id: 'timesheet',    label: 'Табель',            icon: 'ti-calendar',         adminOnly: false },
  { id: 'reports',      label: 'Отчёты и экспорт',  icon: 'ti-file-report',      adminOnly: true  },
  { id: 'knowledge',    label: 'База знаний',       icon: 'ti-book',             adminOnly: false },
  { id: 'routines',     label: 'Рутины',            icon: 'ti-repeat',           adminOnly: false },
  { id: 'kpi',          label: 'KPI',               icon: 'ti-target',           adminOnly: true  },
  { id: 'products',     label: 'Карточки товаров',  icon: 'ti-package',          adminOnly: false },
  { id: 'sales',        label: 'Продажи WB',        icon: 'ti-chart-arrows',     adminOnly: true  },
  { id: 'reviews',      label: 'Отзывы WB',         icon: 'ti-star',             adminOnly: true  },
  { id: 'calls',        label: 'Видеозвонки',       icon: 'ti-video',            adminOnly: false },
  { id: 'notebook',     label: 'Мой блокнот',       icon: 'ti-notebook',         adminOnly: false },
  { id: 'dictionaries', label: 'Справочники',       icon: 'ti-list-details',     adminOnly: true  },
  { id: 'settings',     label: 'Настройки',         icon: 'ti-settings',         adminOnly: true  },
  { id: 'audit',        label: 'Журнал действий',   icon: 'ti-shield-lock',      adminOnly: true  },
];

const DEFAULT_CONFIG = {
  groups: [
    {
      id: 'main',
      label: 'Главное',
      emoji: '🏢',
      collapsed: false,
      items: ['dashboard', 'home', 'tasks', 'projects', 'employees', 'calls'],
    },
    {
      id: 'marketplace',
      label: 'Маркетплейсы',
      emoji: '🛍️',
      collapsed: false,
      items: ['products', 'sales', 'reviews'],
    },
    {
      id: 'analytics',
      label: 'Аналитика',
      emoji: '📊',
      collapsed: true,
      items: ['analytics', 'reports', 'kpi', 'productivity'],
    },
    {
      id: 'tools',
      label: 'Инструменты',
      emoji: '🧩',
      collapsed: true,
      items: ['knowledge', 'routines', 'notebook', 'timesheet', 'teams'],
    },
    {
      id: 'admin',
      label: 'Управление',
      emoji: '⚙️',
      collapsed: true,
      items: ['dictionaries', 'settings', 'audit'],
    },
  ],
};

@Controller('api/v1/users/sidebar')
@UseGuards(RbacGuard)
export class SidebarController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  @RequirePermissions('task:read:self', 'task:read:all', 'task:read:team')
  async getConfig(@CurrentUser() user: any) {
    const userId = user.id ?? user.sub;
    const record = await this.prisma.userSidebarConfig.findUnique({ where: { userId } }).catch(() => null);
    const config = record ? JSON.parse(record.config) : DEFAULT_CONFIG;
    return { config, allSections: ALL_SECTIONS };
  }

  @Put()
  @RequirePermissions('task:read:self', 'task:read:all', 'task:read:team')
  async saveConfig(@CurrentUser() user: any, @Body() body: { config: any }) {
    const userId = user.id ?? user.sub;
    await this.prisma.userSidebarConfig.upsert({
      where: { userId },
      update: { config: JSON.stringify(body.config), updatedAt: new Date() },
      create: { userId, orgId: user.orgId, config: JSON.stringify(body.config) },
    });
    return { success: true };
  }

  @Get('reset')
  @RequirePermissions('task:read:self', 'task:read:all', 'task:read:team')
  async resetConfig(@CurrentUser() user: any) {
    const userId = user.id ?? user.sub;
    await this.prisma.userSidebarConfig.deleteMany({ where: { userId } }).catch(() => {});
    return { config: DEFAULT_CONFIG, allSections: ALL_SECTIONS };
  }
}
