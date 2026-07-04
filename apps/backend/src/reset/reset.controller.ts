import { Controller, Post, Delete, UseGuards, ForbiddenException, UnauthorizedException, Body, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/index';
import { CurrentUser } from '../auth/decorators/index';
import { PrismaService } from '../prisma/prisma.service';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import * as bcrypt from 'bcrypt';

@Controller('api/v1/reset')
@UseGuards(JwtAuthGuard)
export class ResetController {
  constructor(
    private readonly prisma: PrismaService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // Helper: check admin
  private checkAdmin(user: any) {
    if (!user?.roles?.includes('ADMIN') && !user?.roles?.includes('SUPER_ADMIN') && !user?.roles?.includes('OWNER')) {
      throw new ForbiddenException('Только администратор может удалять данные');
    }
  }

  // ─── Full reset (with password confirmation) ────────────────────────────────
  @Post()
  async resetAll(@CurrentUser() user: any, @Body() body: { password?: string; confirm?: string }) {
    this.checkAdmin(user);
    if (!body?.password) throw new UnauthorizedException('Для сброса данных необходимо подтвердить пароль');
    if (body?.confirm !== 'УДАЛИТЬ ВСЕ ДАННЫЕ') throw new UnauthorizedException('Введите текст подтверждения: УДАЛИТЬ ВСЕ ДАННЫЕ');

    const dbUser = await this.prisma.user.findUnique({ where: { id: user.sub } });
    if (!dbUser) throw new UnauthorizedException('Пользователь не найден');
    const valid = await bcrypt.compare(body.password, dbUser.password);
    if (!valid) throw new UnauthorizedException('Неверный пароль');

    const orgId = user.orgId;
    await this.clearAll(orgId);
    await this.clearRedis();

    return { success: true, message: 'Все данные очищены' };
  }

  // ─── Section-specific resets ─────────────────────────────────────────────────

  @Delete('tasks')
  async resetTasks(@CurrentUser() user: any) {
    this.checkAdmin(user);
    const orgId = user.orgId;
    await this.prisma.taskHistory.deleteMany({ where: { task: { orgId } } }).catch(()=>{});
    await this.prisma.taskComment.deleteMany({ where: { task: { orgId } } }).catch(()=>{});
    await this.prisma.taskChecklist.deleteMany({ where: { task: { orgId } } }).catch(()=>{});
    await this.prisma.taskParticipant.deleteMany({ where: { task: { orgId } } }).catch(()=>{});
    await this.prisma.taskAttachment.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.customFieldValue.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.task.deleteMany({ where: { orgId } });
    return { success: true, message: 'Все задачи удалены' };
  }

  @Delete('projects')
  async resetProjects(@CurrentUser() user: any) {
    this.checkAdmin(user);
    const orgId = user.orgId;
    await this.prisma.projectComment.deleteMany({ where: { project: { orgId } } }).catch(()=>{});
    await this.prisma.projectActivity.deleteMany({ where: { project: { orgId } } }).catch(()=>{});
    await this.prisma.projectMember.deleteMany({ where: { project: { orgId } } }).catch(()=>{});
    await this.prisma.project.deleteMany({ where: { orgId } });
    return { success: true, message: 'Все проекты удалены' };
  }

  @Delete('products')
  async resetProducts(@CurrentUser() user: any) {
    this.checkAdmin(user);
    await this.prisma.product.deleteMany({ where: { orgId: user.orgId } });
    return { success: true, message: 'Все товары удалены' };
  }

  @Delete('crm')
  async resetCrm(@CurrentUser() user: any) {
    this.checkAdmin(user);
    const orgId = user.orgId;
    await this.prisma.crmActivity.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.crmDeal.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.crmContact.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.crmCompany.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.crmLead.deleteMany({ where: { orgId } }).catch(()=>{});
    return { success: true, message: 'Все данные CRM удалены' };
  }

  @Delete('analytics')
  async resetAnalytics(@CurrentUser() user: any) {
    this.checkAdmin(user);
    const orgId = user.orgId;
    await this.prisma.activityEvent.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.analyticsHourly.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.realtimeStatus.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.clearRedis();
    return { success: true, message: 'Аналитика очищена' };
  }

  @Delete('knowledge')
  async resetKnowledge(@CurrentUser() user: any) {
    this.checkAdmin(user);
    const orgId = user.orgId;
    await this.prisma.knowledgeArticle.updateMany({ where: { orgId }, data: { deletedAt: new Date() } }).catch(()=>{});
    await this.prisma.knowledgeCategory.deleteMany({ where: { orgId } }).catch(()=>{});
    return { success: true, message: 'База знаний очищена' };
  }

  @Delete('kpi')
  async resetKpi(@CurrentUser() user: any) {
    this.checkAdmin(user);
    await this.prisma.employeeKpi.deleteMany({ where: { orgId: user.orgId } });
    return { success: true, message: 'KPI данные удалены' };
  }

  @Delete('relations')
  async resetRelations(@CurrentUser() user: any) {
    this.checkAdmin(user);
    const orgId = user.orgId;
    await this.prisma.entityRelation.deleteMany({ where: { orgId } });
    await this.prisma.activityLog.deleteMany({ where: { orgId } });
    return { success: true, message: 'Связи и история удалены' };
  }

  @Delete('departments')
  async resetDepartments(@CurrentUser() user: any) {
    this.checkAdmin(user);
    const orgId = user.orgId;
    // Проверка целостности: нельзя удалить, если есть проекты
    const projectCount = await this.prisma.project.count({ where: { orgId, deletedAt: null } });
    if (projectCount > 0) {
      throw new ForbiddenException(`Нельзя удалить отделы: есть ${projectCount} проектов, привязанных к отделам. Сначала удалите проекты.`);
    }
    await this.prisma.departmentMember.deleteMany({ where: { department: { orgId } } }).catch(()=>{});
    await this.prisma.task.updateMany({ where: { orgId }, data: { departmentId: null } }).catch(()=>{});
    await this.prisma.user.updateMany({ where: { orgId }, data: { primaryDepartmentId: null } }).catch(()=>{});
    await this.prisma.department.deleteMany({ where: { orgId } });
    return { success: true, message: 'Все отделы удалены' };
  }

  @Delete('employees')
  async resetEmployees(@CurrentUser() user: any) {
    this.checkAdmin(user);
    const orgId = user.orgId;
    const currentUserId = user.sub;
    // Не удаляем самого себя (текущего администратора)
    await this.prisma.departmentMember.deleteMany({ where: { user: { orgId }, userId: { not: currentUserId } } }).catch(()=>{});
    await this.prisma.task.updateMany({ where: { orgId, assigneeId: { not: currentUserId } }, data: { assigneeId: null } }).catch(()=>{});
    await this.prisma.user.updateMany({
      where: { orgId, id: { not: currentUserId } },
      data: { deletedAt: new Date(), status: 'DELETED' },
    });
    return { success: true, message: 'Все сотрудники удалены (кроме вашего аккаунта)' };
  }

  @Delete('task-types')
  async resetTaskTypes(@CurrentUser() user: any) {
    this.checkAdmin(user);
    const orgId = user.orgId;
    await this.prisma.fieldTaskTypeBinding.deleteMany({ where: { taskType: { orgId } } }).catch(()=>{});
    await this.prisma.task.updateMany({ where: { orgId }, data: { taskTypeId: null } }).catch(()=>{});
    await this.prisma.taskType.deleteMany({ where: { orgId } });
    return { success: true, message: 'Все типы задач удалены' };
  }

  @Delete('custom-fields')
  async resetCustomFields(@CurrentUser() user: any) {
    this.checkAdmin(user);
    const orgId = user.orgId;
    await this.prisma.customFieldValue.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.fieldCondition.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.fieldProjectBinding.deleteMany({ where: { field: { orgId } } }).catch(()=>{});
    await this.prisma.fieldTaskTypeBinding.deleteMany({ where: { field: { orgId } } }).catch(()=>{});
    await this.prisma.customField.deleteMany({ where: { orgId } });
    await this.prisma.fieldGroup.deleteMany({ where: { orgId } }).catch(()=>{});
    return { success: true, message: 'Все пользовательские поля удалены' };
  }

  // ─── Helpers ────────────────────────────────────────────────────────────────

  private async clearAll(orgId: string) {
    await this.prisma.activityEvent.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.analyticsHourly.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.realtimeStatus.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.taskHistory.deleteMany({ where: { task: { orgId } } }).catch(()=>{});
    await this.prisma.taskComment.deleteMany({ where: { task: { orgId } } }).catch(()=>{});
    await this.prisma.taskChecklist.deleteMany({ where: { task: { orgId } } }).catch(()=>{});
    await this.prisma.taskParticipant.deleteMany({ where: { task: { orgId } } }).catch(()=>{});
    await this.prisma.taskAttachment.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.customFieldValue.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.task.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.projectComment.deleteMany({ where: { project: { orgId } } }).catch(()=>{});
    await this.prisma.projectActivity.deleteMany({ where: { project: { orgId } } }).catch(()=>{});
    await this.prisma.projectMember.deleteMany({ where: { project: { orgId } } }).catch(()=>{});
    await this.prisma.project.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.crmActivity.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.crmDeal.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.crmContact.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.crmCompany.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.crmLead.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.employeeKpi.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.product.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.entityRelation.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.activityLog.deleteMany({ where: { orgId } }).catch(()=>{});
    await this.prisma.notification.deleteMany({ where: { orgId } }).catch(()=>{});
  }

  private async clearRedis() {
    const scan = async (pattern: string) => {
      const keys: string[] = [];
      let cursor = '0';
      do {
        const [next, batch] = await this.redis.scan(cursor, 'MATCH', pattern, 'COUNT', '100');
        cursor = next; keys.push(...batch);
      } while (cursor !== '0');
      return keys;
    };
    const keys = [...await scan('work:session:*'), ...await scan('presence:*'), ...await scan('cf:defs:*'), ...await scan('wb:reviews:*')];
    if (keys.length > 0) await this.redis.del(...keys);
  }
}
