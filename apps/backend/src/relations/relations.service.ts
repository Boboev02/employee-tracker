import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { RELATION_LABELS, REVERSE_LABELS } from './relations.types';

@Injectable()
export class RelationsService {
  constructor(private readonly prisma: PrismaService) {}

  // ─── Create relation ────────────────────────────────────────────────────

  async createRelation(orgId: string, userId: string, dto: {
    sourceType: string; sourceId: string;
    targetType: string; targetId: string;
    relationType: string; customLabel?: string;
  }) {
    // Check for duplicate
    const existing = await this.prisma.entityRelation.findFirst({
      where: {
        orgId,
        sourceType: dto.sourceType, sourceId: dto.sourceId,
        targetType: dto.targetType, targetId: dto.targetId,
        relationType: dto.relationType,
      },
    });
    if (existing) throw new BadRequestException('Связь уже существует');

    const relation = await this.prisma.entityRelation.create({
      data: {
        orgId,
        sourceType: dto.sourceType, sourceId: dto.sourceId,
        targetType: dto.targetType, targetId: dto.targetId,
        relationType: dto.relationType,
        customLabel: dto.customLabel,
        createdById: userId,
      },
    });

    // Log activity for source
    await this.logActivity(orgId, {
      entityType: dto.sourceType, entityId: dto.sourceId,
      actorId: userId, action: 'LINKED',
      newValue: `${dto.relationType}:${dto.targetType}:${dto.targetId}`,
    });

    return relation;
  }

  // ─── Get relations for entity ───────────────────────────────────────────

  async getRelations(orgId: string, entityType: string, entityId: string, relationType?: string) {
    const where: any = {
      orgId,
      OR: [
        { sourceType: entityType, sourceId: entityId },
        { targetType: entityType, targetId: entityId },
      ],
    };
    if (relationType) {
      where.relationType = relationType;
    }

    const relations = await this.prisma.entityRelation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    // Enrich with entity data
    const enriched = await Promise.all(
      relations.map(async r => {
        const isSource = r.sourceType === entityType && r.sourceId === entityId;
        const otherType = isSource ? r.targetType : r.sourceType;
        const otherId   = isSource ? r.targetId   : r.sourceId;
        const label     = isSource ? RELATION_LABELS[r.relationType] : REVERSE_LABELS[r.relationType];

        const entity = await this.resolveEntity(orgId, otherType, otherId);

        return {
          id: r.id,
          relationType: r.relationType,
          customLabel: r.customLabel,
          label,
          direction: isSource ? 'outgoing' : 'incoming',
          entityType: otherType,
          entityId: otherId,
          entity,
          createdAt: r.createdAt,
        };
      })
    );

    // Group by relationType
    const grouped: Record<string, any[]> = {};
    for (const r of enriched) {
      const key = r.relationType;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(r);
    }

    return { relations: enriched, grouped, total: enriched.length };
  }

  // ─── Get relations by target type ───────────────────────────────────────

  async getRelatedByType(orgId: string, entityType: string, entityId: string, targetType: string) {
    const relations = await this.prisma.entityRelation.findMany({
      where: {
        orgId,
        OR: [
          { sourceType: entityType, sourceId: entityId, targetType },
          { targetType: entityType, targetId: entityId, sourceType: targetType },
        ],
      },
      orderBy: { createdAt: 'desc' },
    });

    const ids = relations.map(r =>
      r.sourceType === entityType && r.sourceId === entityId ? r.targetId : r.sourceId
    );

    const entities = await Promise.all(
      ids.map(id => this.resolveEntity(orgId, targetType, id))
    );

    return entities.filter(Boolean);
  }

  // ─── Delete relation ────────────────────────────────────────────────────

  async deleteRelation(id: string, orgId: string, userId: string) {
    const rel = await this.prisma.entityRelation.findFirst({ where: { id, orgId } });
    if (!rel) throw new NotFoundException('Связь не найдена');

    await this.prisma.entityRelation.delete({ where: { id } });

    await this.logActivity(orgId, {
      entityType: rel.sourceType, entityId: rel.sourceId,
      actorId: userId, action: 'UNLINKED',
      oldValue: `${rel.relationType}:${rel.targetType}:${rel.targetId}`,
    });

    return { ok: true };
  }

  // ─── Activity Log ────────────────────────────────────────────────────────

  async logActivity(orgId: string, dto: {
    entityType: string; entityId: string;
    actorId?: string; actorName?: string;
    action: string; field?: string;
    oldValue?: string; newValue?: string;
    meta?: any;
  }) {
    return this.prisma.activityLog.create({
      data: {
        orgId,
        entityType: dto.entityType,
        entityId:   dto.entityId,
        actorId:    dto.actorId,
        actorName:  dto.actorName,
        action:     dto.action,
        field:      dto.field,
        oldValue:   dto.oldValue,
        newValue:   dto.newValue,
        meta:       dto.meta,
      },
    });
  }

  async getActivityLog(orgId: string, entityType: string, entityId: string, limit = 50, offset = 0) {
    const [logs, total] = await Promise.all([
      this.prisma.activityLog.findMany({
        where: { orgId, entityType, entityId },
        orderBy: { createdAt: 'desc' },
        take: Math.min(limit, 200),
        skip: offset,
      }),
      this.prisma.activityLog.count({ where: { orgId, entityType, entityId } }),
    ]);
    return { logs, total };
  }

  // ─── Resolve entity data ─────────────────────────────────────────────────

  private async resolveEntity(orgId: string, type: string, id: string): Promise<any> {
    try {
      switch (type) {
        case 'TASK':
          return await this.prisma.task.findFirst({
            where: { id, orgId, deletedAt: null },
            select: { id: true, title: true, status: true, priority: true, dueDate: true,
              assignee: { select: { id: true, name: true, avatarUrl: true } } },
          });
        case 'PROJECT':
          return await this.prisma.project.findFirst({
            where: { id, orgId },
            select: { id: true, name: true, status: true, color: true },
          });
        case 'PRODUCT':
          return await this.prisma.product.findFirst({
            where: { id, orgId },
            select: { id: true, name: true, marketplace: true, articleId: true, photoUrl: true, price: true },
          });
        case 'DEAL':
          return await this.prisma.crmDeal.findFirst({
            where: { id, orgId },
            select: { id: true, title: true, stage: true, amount: true },
          });
        case 'EMPLOYEE':
          return await this.prisma.user.findFirst({
            where: { id, orgId, deletedAt: null },
            select: { id: true, name: true, email: true, avatarUrl: true },
          });
        case 'KNOWLEDGE_ARTICLE':
          return await this.prisma.knowledgeArticle.findFirst({
            where: { id, orgId, deletedAt: null },
            select: { id: true, title: true },
          });
        default:
          return { id, type };
      }
    } catch {
      return null;
    }
  }

  // ─── Search entities for relation picker ─────────────────────────────────

  async searchEntities(orgId: string, entityType: string, query: string, limit = 20) {
    const q = query.trim();
    switch (entityType) {
      case 'TASK':
        return this.prisma.task.findMany({
          where: { orgId, deletedAt: null, title: { contains: q, mode: 'insensitive' } },
          select: { id: true, title: true, status: true, priority: true },
          take: limit,
        });
      case 'PROJECT':
        return this.prisma.project.findMany({
          where: { orgId, name: { contains: q, mode: 'insensitive' } },
          select: { id: true, name: true, status: true, color: true },
          take: limit,
        });
      case 'PRODUCT':
        return this.prisma.product.findMany({
          where: { orgId, OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { articleId: { contains: q, mode: 'insensitive' } },
          ]},
          select: { id: true, name: true, marketplace: true, articleId: true, photoUrl: true },
          take: limit,
        });
      case 'DEAL':
        return this.prisma.crmDeal.findMany({
          where: { orgId, deletedAt: null, title: { contains: q, mode: 'insensitive' } },
          select: { id: true, title: true, stage: true, amount: true },
          take: limit,
        });
      case 'EMPLOYEE':
        return this.prisma.user.findMany({
          where: { orgId, deletedAt: null, OR: [
            { name: { contains: q, mode: 'insensitive' } },
            { email: { contains: q, mode: 'insensitive' } },
          ]},
          select: { id: true, name: true, email: true, avatarUrl: true },
          take: limit,
        });
      default:
        return [];
    }
  }
}
