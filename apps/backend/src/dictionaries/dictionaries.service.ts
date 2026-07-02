import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class DictionariesService {
  constructor(private readonly prisma: PrismaService) {}

  // ===== ОТДЕЛЫ =====
  async getDepartments(orgId: string) {
    return this.prisma.department.findMany({
      where: { orgId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { tasks: { where: { deletedAt: null } } } } },
    });
  }

  async createDepartment(orgId: string, dto: { name: string; color?: string }) {
    const maxSort = await this.prisma.department.aggregate({ where: { orgId }, _max: { sortOrder: true } });
    return this.prisma.department.create({
      data: { orgId, name: dto.name, color: dto.color ?? '#7F77DD', sortOrder: (maxSort._max.sortOrder ?? 0) + 1 },
    });
  }

  async updateDepartment(orgId: string, id: string, dto: { name?: string; color?: string; sortOrder?: number; isActive?: boolean }) {
    return this.prisma.department.update({ where: { id, orgId }, data: dto });
  }

  async deleteDepartment(orgId: string, id: string) {
    // Мягкое удаление — деактивируем, не удаляем (задачи сохраняются)
    return this.prisma.department.update({ where: { id, orgId }, data: { isActive: false } });
  }

  // ===== СТАДИИ КАРТОЧЕК =====
  async getCardStages(orgId: string) {
    return this.prisma.cardStage.findMany({
      where: { orgId, isActive: true },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { products: true } } },
    });
  }

  async createCardStage(orgId: string, dto: { name: string; description?: string; color?: string }) {
    const maxSort = await this.prisma.cardStage.aggregate({ where: { orgId }, _max: { sortOrder: true } });
    return this.prisma.cardStage.create({
      data: { orgId, name: dto.name, description: dto.description, color: dto.color ?? '#7F77DD', sortOrder: (maxSort._max.sortOrder ?? 0) + 1 },
    });
  }

  async updateCardStage(orgId: string, id: string, dto: { name?: string; description?: string; color?: string; sortOrder?: number; isActive?: boolean }) {
    return this.prisma.cardStage.update({ where: { id, orgId }, data: dto });
  }

  async deleteCardStage(orgId: string, id: string) {
    return this.prisma.cardStage.update({ where: { id, orgId }, data: { isActive: false } });
  }

  // Инициализация дефолтных данных для новой организации
  async initDefaults(orgId: string) {
    const depts = await this.prisma.department.count({ where: { orgId } });
    if (!depts) {
      await this.prisma.department.createMany({
        data: [
          { orgId, name: 'Дизайн', color: '#8B5CF6', sortOrder: 1 },
          { orgId, name: 'Логистика', color: '#3B82F6', sortOrder: 2 },
          { orgId, name: 'Бухгалтерия', color: '#10B981', sortOrder: 3 },
          { orgId, name: 'Продвижение', color: '#F59E0B', sortOrder: 4 },
          { orgId, name: 'Склад', color: '#EF4444', sortOrder: 5 },
        ],
        skipDuplicates: true,
      });
    }

    const stages = await this.prisma.cardStage.count({ where: { orgId } });
    if (!stages) {
      await this.prisma.cardStage.createMany({
        data: [
          { orgId, name: 'Запуск', color: '#8B5CF6', sortOrder: 1, description: 'Новая карточка, подготовка к продажам' },
          { orgId, name: 'Продвижение', color: '#3B82F6', sortOrder: 2, description: 'Активное продвижение в топ' },
          { orgId, name: 'Вывод в топ', color: '#F59E0B', sortOrder: 3, description: 'Работа над рейтингом и отзывами' },
          { orgId, name: 'Плато', color: '#10B981', sortOrder: 4, description: 'Стабильные продажи' },
          { orgId, name: 'Спад', color: '#EF4444', sortOrder: 5, description: 'Снижение продаж, требует внимания' },
        ],
        skipDuplicates: true,
      });
    }
  }
}
