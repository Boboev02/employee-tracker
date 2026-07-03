import {
  Injectable, NotFoundException, BadRequestException, ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { FIELD_TYPES, FIELD_COL, FieldFilter } from './custom-fields.types';

@Injectable()
export class CustomFieldsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Field Definitions ─────────────────────────────────────────────────

  async getFields(orgId: string, projectId?: string) {
    const fields = await this.prisma.customField.findMany({
      where: { orgId, deletedAt: null },
      include: {
        group: true,
        projectBindings: true,
        taskTypeBindings: { include: { taskType: true } },
      },
      orderBy: [{ groupId: 'asc' }, { sortOrder: 'asc' }],
    });

    // Filter by project if provided (show fields with no bindings OR bound to this project)
    if (projectId) {
      return fields.filter(f =>
        f.projectBindings.length === 0 ||
        f.projectBindings.some(b => b.projectId === projectId)
      );
    }
    return fields;
  }

  async createField(orgId: string, dto: any) {
    if (!FIELD_TYPES.includes(dto.type)) {
      throw new BadRequestException(`Unknown field type: ${dto.type}`);
    }

    // Find next sortOrder
    const max = await this.prisma.customField.aggregate({
      where: { orgId, deletedAt: null },
      _max: { sortOrder: true },
    });

    return this.prisma.customField.create({
      data: {
        orgId,
        type: dto.type,
        name: dto.name,
        description: dto.description,
        groupId: dto.groupId,
        isRequired: dto.isRequired ?? false,
        showInTable: dto.showInTable ?? true,
        showInCard: dto.showInCard ?? true,
        showInFilter: dto.showInFilter ?? true,
        showOnCreate: dto.showOnCreate ?? true,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
        defaultValue: dto.defaultValue,
        config: dto.config,
      },
    });
  }

  async updateField(id: string, orgId: string, dto: any) {
    const field = await this.prisma.customField.findFirst({
      where: { id, orgId, deletedAt: null },
    });
    if (!field) throw new NotFoundException('Field not found');

    // Cannot change type of a field that has values
    if (dto.type && dto.type !== field.type) {
      const count = await this.prisma.customFieldValue.count({ where: { fieldId: id } });
      if (count > 0) {
        throw new BadRequestException('Cannot change type of a field that already has values');
      }
    }

    return this.prisma.customField.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        type: dto.type,
        groupId: dto.groupId,
        isRequired: dto.isRequired,
        showInTable: dto.showInTable,
        showInCard: dto.showInCard,
        showInFilter: dto.showInFilter,
        showOnCreate: dto.showOnCreate,
        sortOrder: dto.sortOrder,
        defaultValue: dto.defaultValue,
        config: dto.config,
      },
    });
  }

  async deleteField(id: string, orgId: string) {
    const field = await this.prisma.customField.findFirst({
      where: { id, orgId, deletedAt: null },
    });
    if (!field) throw new NotFoundException('Field not found');
    if (field.isSystem) throw new ForbiddenException('Cannot delete system fields');

    return this.prisma.customField.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  async reorderFields(orgId: string, orders: { id: string; sortOrder: number }[]) {
    await this.prisma.$transaction(
      orders.map(o =>
        this.prisma.customField.updateMany({
          where: { id: o.id, orgId },
          data: { sortOrder: o.sortOrder },
        })
      )
    );
    return { ok: true };
  }

  // ─── Field Groups ──────────────────────────────────────────────────────

  async getGroups(orgId: string) {
    return this.prisma.fieldGroup.findMany({
      where: { orgId },
      include: {
        fields: {
          where: { deletedAt: null },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  async createGroup(orgId: string, dto: any) {
    const max = await this.prisma.fieldGroup.aggregate({
      where: { orgId },
      _max: { sortOrder: true },
    });
    return this.prisma.fieldGroup.create({
      data: {
        orgId,
        name: dto.name,
        description: dto.description,
        color: dto.color,
        icon: dto.icon,
        sortOrder: (max._max.sortOrder ?? 0) + 1,
      },
    });
  }

  async updateGroup(id: string, orgId: string, dto: any) {
    const group = await this.prisma.fieldGroup.findFirst({ where: { id, orgId } });
    if (!group) throw new NotFoundException('Group not found');
    return this.prisma.fieldGroup.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        color: dto.color,
        icon: dto.icon,
        sortOrder: dto.sortOrder,
        isCollapsed: dto.isCollapsed,
      },
    });
  }

  async deleteGroup(id: string, orgId: string) {
    const group = await this.prisma.fieldGroup.findFirst({ where: { id, orgId } });
    if (!group) throw new NotFoundException('Group not found');
    // Un-link fields from group, don't delete them
    await this.prisma.customField.updateMany({
      where: { groupId: id, orgId },
      data: { groupId: null },
    });
    return this.prisma.fieldGroup.delete({ where: { id } });
  }

  // ─── Task Types ────────────────────────────────────────────────────────

  async getTaskTypes(orgId: string) {
    return this.prisma.taskType.findMany({
      where: { orgId, deletedAt: null },
      include: {
        fieldBindings: {
          include: { field: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    });
  }

  async createTaskType(orgId: string, dto: any) {
    return this.prisma.taskType.create({
      data: {
        orgId,
        name: dto.name,
        icon: dto.icon,
        color: dto.color,
        isDefault: dto.isDefault ?? false,
      },
    });
  }

  async updateTaskType(id: string, orgId: string, dto: any) {
    const tt = await this.prisma.taskType.findFirst({ where: { id, orgId, deletedAt: null } });
    if (!tt) throw new NotFoundException('Task type not found');
    return this.prisma.taskType.update({
      where: { id },
      data: { name: dto.name, icon: dto.icon, color: dto.color, isDefault: dto.isDefault },
    });
  }

  async deleteTaskType(id: string, orgId: string) {
    const tt = await this.prisma.taskType.findFirst({ where: { id, orgId, deletedAt: null } });
    if (!tt) throw new NotFoundException('Task type not found');
    return this.prisma.taskType.update({ where: { id }, data: { deletedAt: new Date() } });
  }

  async setTaskTypeFields(taskTypeId: string, orgId: string, fieldIds: string[]) {
    // Verify task type belongs to org
    const tt = await this.prisma.taskType.findFirst({ where: { id: taskTypeId, orgId, deletedAt: null } });
    if (!tt) throw new NotFoundException('Task type not found');

    // Delete existing bindings
    await this.prisma.fieldTaskTypeBinding.deleteMany({ where: { taskTypeId } });

    // Create new bindings
    if (fieldIds.length > 0) {
      await this.prisma.fieldTaskTypeBinding.createMany({
        data: fieldIds.map((fieldId, i) => ({ fieldId, taskTypeId, sortOrder: i })),
        skipDuplicates: true,
      });
    }
    return this.getTaskTypes(orgId);
  }

  // ─── Project Bindings ──────────────────────────────────────────────────

  async setFieldProjects(fieldId: string, orgId: string, projectIds: string[]) {
    const field = await this.prisma.customField.findFirst({ where: { id: fieldId, orgId, deletedAt: null } });
    if (!field) throw new NotFoundException('Field not found');

    await this.prisma.fieldProjectBinding.deleteMany({ where: { fieldId } });

    if (projectIds.length > 0) {
      await this.prisma.fieldProjectBinding.createMany({
        data: projectIds.map(projectId => ({ fieldId, projectId })),
        skipDuplicates: true,
      });
    }
    return { ok: true };
  }

  // ─── Conditions ────────────────────────────────────────────────────────

  async getConditions(orgId: string) {
    return this.prisma.fieldCondition.findMany({
      where: { orgId },
      include: {
        sourceField: true,
        targetField: true,
      },
      orderBy: [{ logicGroup: 'asc' }, { sortOrder: 'asc' }],
    });
  }

  async createCondition(orgId: string, dto: any) {
    return this.prisma.fieldCondition.create({
      data: {
        orgId,
        sourceFieldId: dto.sourceFieldId,
        operator: dto.operator,
        value: dto.value,
        logicGroup: dto.logicGroup ?? 0,
        action: dto.action,
        targetFieldId: dto.targetFieldId,
        actionValue: dto.actionValue,
        sortOrder: dto.sortOrder ?? 0,
      },
    });
  }

  async deleteCondition(id: string, orgId: string) {
    const cond = await this.prisma.fieldCondition.findFirst({ where: { id, orgId } });
    if (!cond) throw new NotFoundException('Condition not found');
    return this.prisma.fieldCondition.delete({ where: { id } });
  }

  // ─── Field Values ──────────────────────────────────────────────────────

  async getTaskFieldValues(taskId: string, orgId: string) {
    const values = await this.prisma.customFieldValue.findMany({
      where: { taskId, orgId },
      include: { field: { select: { id: true, name: true, type: true } } },
    });

    // Return as flat map { fieldId: value }
    const result: Record<string, any> = {};
    for (const v of values) {
      result[v.fieldId] = this.extractValue(v);
    }
    return result;
  }

  async setTaskFieldValues(taskId: string, orgId: string, dto: Record<string, any>) {
    // Verify task belongs to org
    const task = await this.prisma.task.findFirst({ where: { id: taskId, orgId, deletedAt: null } });
    if (!task) throw new NotFoundException('Task not found');

    // Get field definitions for validation
    const fieldIds = Object.keys(dto);
    const fields = await this.prisma.customField.findMany({
      where: { id: { in: fieldIds }, orgId, deletedAt: null },
    });
    const fieldMap = new Map(fields.map(f => [f.id, f]));

    const upserts: any[] = [];
    const jsonSnapshot: Record<string, any> = { ...((task.customFields as any) ?? {}) };

    for (const [fieldId, rawValue] of Object.entries(dto)) {
      const field = fieldMap.get(fieldId);
      if (!field) continue; // skip unknown fields silently

      const typed = this.castValue(field.type, rawValue);
      upserts.push(
        this.prisma.customFieldValue.upsert({
          where: { taskId_fieldId: { taskId, fieldId } },
          create: { taskId, fieldId, orgId, ...typed },
          update: typed,
        })
      );

      // Update snapshot
      jsonSnapshot[fieldId] = rawValue;
    }

    await this.prisma.$transaction([
      ...upserts,
      // Update JSONB snapshot on task
      this.prisma.task.update({
        where: { id: taskId },
        data: { customFields: jsonSnapshot, updatedAt: new Date() },
      }),
    ]);

    return { ok: true, updated: upserts.length };
  }

  // ─── Filter Builder ────────────────────────────────────────────────────

  buildCustomFieldWhere(orgId: string, filters: FieldFilter[]) {
    if (!filters?.length) return {};

    const subqueries = filters.map(f => ({
      fieldValues: {
        some: {
          fieldId: f.fieldId,
          orgId,
          ...this.buildValueCondition(f),
        },
      },
    }));

    return { AND: subqueries };
  }

  private buildValueCondition(f: FieldFilter): any {
    const col = FIELD_COL[f.type] ?? 'strVal';

    switch (f.op) {
      case 'EQ':           return { [col]: f.val };
      case 'NEQ':          return { NOT: { [col]: f.val } };
      case 'GT':           return { [col]: { gt: f.val } };
      case 'LT':           return { [col]: { lt: f.val } };
      case 'GTE':          return { [col]: { gte: f.val } };
      case 'LTE':          return { [col]: { lte: f.val } };
      case 'CONTAINS':     return { strVal: { contains: f.val, mode: 'insensitive' } };
      case 'NOT_CONTAINS': return { NOT: { strVal: { contains: f.val, mode: 'insensitive' } } };
      case 'STARTS_WITH':  return { strVal: { startsWith: f.val, mode: 'insensitive' } };
      case 'IS_EMPTY':     return { [col]: null };
      case 'NOT_EMPTY':    return { NOT: { [col]: null } };
      case 'IN':           return { [col]: { in: Array.isArray(f.val) ? f.val : [f.val] } };
      case 'NOT_IN':       return { NOT: { [col]: { in: Array.isArray(f.val) ? f.val : [f.val] } } };
      case 'BETWEEN':
        return Array.isArray(f.val) && f.val.length === 2
          ? { [col]: { gte: f.val[0], lte: f.val[1] } }
          : {};
      default: return {};
    }
  }

  // ─── Saved Filters ─────────────────────────────────────────────────────

  async getSavedFilters(orgId: string, userId: string) {
    return this.prisma.savedFilter.findMany({
      where: { orgId, OR: [{ userId }, { isShared: true }] },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createSavedFilter(orgId: string, userId: string, dto: any) {
    return this.prisma.savedFilter.create({
      data: { orgId, userId, name: dto.name, filters: dto.filters, isShared: dto.isShared ?? false },
    });
  }

  async deleteSavedFilter(id: string, orgId: string, userId: string) {
    const sf = await this.prisma.savedFilter.findFirst({ where: { id, orgId } });
    if (!sf) throw new NotFoundException('Saved filter not found');
    if (sf.userId !== userId) throw new ForbiddenException('Not your filter');
    return this.prisma.savedFilter.delete({ where: { id } });
  }

  // ─── Helpers ───────────────────────────────────────────────────────────

  private castValue(type: string, raw: any): Record<string, any> {
    if (raw === null || raw === undefined) {
      return { strVal: null, numVal: null, boolVal: null, dateVal: null, jsonVal: null };
    }

    const col = FIELD_COL[type] ?? 'strVal';

    if (col === 'strVal') return { strVal: String(raw), numVal: null, boolVal: null, dateVal: null, jsonVal: null };
    if (col === 'numVal') return { numVal: Number(raw), strVal: null, boolVal: null, dateVal: null, jsonVal: null };
    if (col === 'boolVal') return { boolVal: Boolean(raw), strVal: null, numVal: null, dateVal: null, jsonVal: null };
    if (col === 'dateVal') return { dateVal: new Date(raw), strVal: null, numVal: null, boolVal: null, jsonVal: null };
    if (col === 'jsonVal') return { jsonVal: raw, strVal: null, numVal: null, boolVal: null, dateVal: null };

    return { strVal: String(raw), numVal: null, boolVal: null, dateVal: null, jsonVal: null };
  }

  private extractValue(v: any): any {
    if (v.strVal !== null && v.strVal !== undefined) return v.strVal;
    if (v.numVal !== null && v.numVal !== undefined) return v.numVal;
    if (v.boolVal !== null && v.boolVal !== undefined) return v.boolVal;
    if (v.dateVal !== null && v.dateVal !== undefined) return v.dateVal;
    if (v.jsonVal !== null && v.jsonVal !== undefined) return v.jsonVal;
    return null;
  }

  // ─── Auto-number ───────────────────────────────────────────────────────

  async generateAutoNumber(fieldId: string, orgId: string, prefix: string = 'TASK-') {
    // Count existing values for this field
    const count = await this.prisma.customFieldValue.count({ where: { fieldId, orgId } });
    return `${prefix}${String(count + 1).padStart(6, '0')}`;
  }

  // ─── Bulk update for task list ──────────────────────────────────────────

  async bulkSetFieldValue(taskIds: string[], orgId: string, fieldId: string, value: any) {
    const field = await this.prisma.customField.findFirst({ where: { id: fieldId, orgId, deletedAt: null } });
    if (!field) throw new NotFoundException('Field not found');

    const typed = this.castValue(field.type, value);

    await this.prisma.$transaction(
      taskIds.map(taskId =>
        this.prisma.customFieldValue.upsert({
          where: { taskId_fieldId: { taskId, fieldId } },
          create: { taskId, fieldId, orgId, ...typed },
          update: typed,
        })
      )
    );

    // Update JSONB snapshots
    await this.prisma.task.updateMany({
      where: { id: { in: taskIds }, orgId },
      data: { updatedAt: new Date() },
    });

    return { ok: true, updated: taskIds.length };
  }
}
