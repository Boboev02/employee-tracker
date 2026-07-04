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
      include: {
        _count: {
          select: {
            tasks: { where: { deletedAt: null } },
            projects: { where: { deletedAt: null } },
            members: true,
          },
        },
      },
    });
  }

  async getDepartmentDetail(orgId: string, id: string) {
    const dept = await this.prisma.department.findFirst({
      where: { id, orgId },
      include: {
        members: { include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, position: true } } } },
        projects: { where: { deletedAt: null }, select: { id: true, name: true, status: true, _count: { select: { tasks: true } } } },
        _count: { select: { tasks: { where: { deletedAt: null } } } },
      },
    });
    if (!dept) return null;
    const completedTasks = await this.prisma.task.count({ where: { departmentId: id, orgId, status: 'DONE', deletedAt: null } });
    return { ...dept, completedTasks };
  }

  async createDepartment(orgId: string, dto: { name: string; color?: string; employeeIds?: string[] }) {
    const maxSort = await this.prisma.department.aggregate({ where: { orgId }, _max: { sortOrder: true } });
    const dept = await this.prisma.department.create({
      data: { orgId, name: dto.name, color: dto.color ?? '#7F77DD', sortOrder: (maxSort._max.sortOrder ?? 0) + 1 },
    });

    // Автосвязь: привязываем выбранных сотрудников к отделу
    if (dto.employeeIds?.length) {
      await this.prisma.departmentMember.createMany({
        data: dto.employeeIds.map(userId => ({ departmentId: dept.id, userId, isPrimary: true })),
        skipDuplicates: true,
      });
      // Устанавливаем как основной отдел, если ещё не задан
      await this.prisma.user.updateMany({
        where: { id: { in: dto.employeeIds }, orgId, primaryDepartmentId: null },
        data: { primaryDepartmentId: dept.id },
      });
    }

    return dept;
  }

  async updateDepartment(orgId: string, id: string, dto: { name?: string; color?: string; sortOrder?: number; isActive?: boolean; employeeIds?: string[] }) {
    const dept = await this.prisma.department.update({
      where: { id, orgId },
      data: { name: dto.name, color: dto.color, sortOrder: dto.sortOrder, isActive: dto.isActive },
    });

    if (dto.employeeIds) {
      // Синхронизация состава: удаляем отсутствующих, добавляем новых
      await this.prisma.departmentMember.deleteMany({ where: { departmentId: id, userId: { notIn: dto.employeeIds } } });
      if (dto.employeeIds.length) {
        await this.prisma.departmentMember.createMany({
          data: dto.employeeIds.map(userId => ({ departmentId: id, userId })),
          skipDuplicates: true,
        });
      }
    }
    return dept;
  }

  async deleteDepartment(orgId: string, id: string, force = false) {
    const [projectCount, memberCount] = await Promise.all([
      this.prisma.project.count({ where: { departmentId: id, orgId, deletedAt: null } }),
      this.prisma.departmentMember.count({ where: { departmentId: id } }),
    ]);

    if (!force && (projectCount > 0 || memberCount > 0)) {
      return {
        error: 'HAS_DEPENDENCIES',
        message: `В отделе есть ${projectCount} проектов и ${memberCount} сотрудников. Подтвердите удаление.`,
        projectCount, memberCount,
      };
    }

    // Мягкое удаление — деактивируем, не удаляем (задачи сохраняются)
    return this.prisma.department.update({ where: { id, orgId }, data: { isActive: false } });
  }

  // Список сотрудников отдела (для каскадных dropdown)
  async getDepartmentEmployees(orgId: string, departmentId: string) {
    const members = await this.prisma.departmentMember.findMany({
      where: { departmentId },
      include: { user: { select: { id: true, name: true, email: true, avatarUrl: true, position: true } } },
    });
    return members.map(m => m.user);
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
