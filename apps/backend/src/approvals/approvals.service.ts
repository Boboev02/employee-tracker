import { Injectable, NotFoundException, BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { NotificationService } from '../notifications/notification.service';

@Injectable()
export class ApprovalsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly notifications: NotificationService,
  ) {}

  // ─── Flows (маршруты) ──────────────────────────────────────────────────────

  async getFlows(orgId: string) {
    return this.prisma.approvalFlow.findMany({
      where: { orgId, isActive: true },
      include: {
        steps: { orderBy: { order: 'asc' } },
        _count: { select: { requests: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createFlow(orgId: string, userId: string, dto: any) {
    return this.prisma.approvalFlow.create({
      data: {
        orgId,
        name: dto.name,
        description: dto.description,
        trigger: dto.trigger ?? 'MANUAL',
        triggerConfig: dto.triggerConfig,
        isActive: dto.isActive ?? true,
        createdById: userId,
      },
      include: { steps: true },
    });
  }

  async updateFlow(id: string, orgId: string, dto: any) {
    const flow = await this.prisma.approvalFlow.findFirst({ where: { id, orgId } });
    if (!flow) throw new NotFoundException('Flow not found');
    return this.prisma.approvalFlow.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        trigger: dto.trigger,
        triggerConfig: dto.triggerConfig,
        isActive: dto.isActive,
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  }

  async deleteFlow(id: string, orgId: string) {
    const flow = await this.prisma.approvalFlow.findFirst({ where: { id, orgId } });
    if (!flow) throw new NotFoundException('Flow not found');
    return this.prisma.approvalFlow.update({ where: { id }, data: { isActive: false } });
  }

  // ─── Steps (шаги) ─────────────────────────────────────────────────────────

  async setSteps(flowId: string, orgId: string, steps: any[]) {
    const flow = await this.prisma.approvalFlow.findFirst({ where: { id: flowId, orgId } });
    if (!flow) throw new NotFoundException('Flow not found');

    // Delete existing and recreate
    await this.prisma.approvalStep.deleteMany({ where: { flowId } });

    if (steps.length > 0) {
      await this.prisma.approvalStep.createMany({
        data: steps.map((s, i) => ({
          flowId,
          order: i,
          name: s.name,
          type: s.type ?? 'SEQUENTIAL',
          approverType: s.approverType ?? 'USER',
          approverIds: s.approverIds ?? [],
          deadlineHours: s.deadlineHours ?? 0,
          onTimeout: s.onTimeout ?? 'SKIP',
          skipCondition: s.skipCondition,
        })),
      });
    }

    return this.prisma.approvalFlow.findFirst({
      where: { id: flowId },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
  }

  // ─── Requests (запросы) ────────────────────────────────────────────────────

  async getRequests(orgId: string, filters: any = {}) {
    const where: any = { orgId };
    if (filters.status) where.status = filters.status;
    if (filters.entityType) where.entityType = filters.entityType;
    if (filters.entityId) where.entityId = filters.entityId;
    if (filters.requestedById) where.requestedById = filters.requestedById;

    const take = Math.min(parseInt(filters.limit ?? '50'), 200);
    const skip = parseInt(filters.offset ?? '0');

    const [data, total] = await Promise.all([
      this.prisma.approvalRequest.findMany({
        where,
        include: {
          flow: { select: { id: true, name: true } },
          decisions: {
            include: { step: { select: { id: true, name: true, order: true } } },
            orderBy: { createdAt: 'asc' },
          },
        },
        orderBy: { createdAt: 'desc' },
        take, skip,
      }),
      this.prisma.approvalRequest.count({ where }),
    ]);

    return { data, total, take, skip };
  }

  async getMyPendingDecisions(orgId: string, userId: string) {
    return this.prisma.approvalDecision.findMany({
      where: { approverId: userId, status: 'PENDING', request: { orgId, status: 'PENDING' } },
      include: {
        request: {
          include: { flow: { select: { id: true, name: true } } },
        },
        step: { select: { id: true, name: true, order: true } },
      },
      orderBy: { createdAt: 'asc' },
    });
  }

  async createRequest(orgId: string, userId: string, dto: any) {
    const flow = await this.prisma.approvalFlow.findFirst({
      where: { id: dto.flowId, orgId, isActive: true },
      include: { steps: { orderBy: { order: 'asc' } } },
    });
    if (!flow) throw new NotFoundException('Flow not found');
    if (!flow.steps.length) throw new BadRequestException('Flow has no steps');

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

    const request = await this.prisma.approvalRequest.create({
      data: {
        orgId,
        flowId: flow.id,
        entityType: dto.entityType,
        entityId: dto.entityId,
        entityTitle: dto.entityTitle ?? '',
        requestedById: userId,
        requestedByName: user?.name ?? 'Пользователь',
        currentStep: 0,
        status: 'PENDING',
      },
    });

    // Create decisions for step 0
    await this.createDecisionsForStep(request.id, flow.steps[0], orgId);

    return this.prisma.approvalRequest.findUnique({
      where: { id: request.id },
      include: { flow: true, decisions: { include: { step: true } } },
    });
  }

  async decide(requestId: string, orgId: string, userId: string, dto: { status: 'APPROVED' | 'REJECTED'; comment?: string }) {
    const request = await this.prisma.approvalRequest.findFirst({
      where: { id: requestId, orgId, status: 'PENDING' },
      include: {
        flow: { include: { steps: { orderBy: { order: 'asc' } } } },
        decisions: true,
      },
    });
    if (!request) throw new NotFoundException('Request not found or already completed');

    // Find user's decision for current step
    const currentStep = request.flow.steps[request.currentStep];
    if (!currentStep) throw new BadRequestException('No current step');

    const myDecision = request.decisions.find(
      d => d.approverId === userId && d.stepId === currentStep.id && d.status === 'PENDING'
    );
    if (!myDecision) throw new ForbiddenException('You are not a approver for this step');

    const user = await this.prisma.user.findUnique({ where: { id: userId }, select: { name: true } });

    // Record decision
    await this.prisma.approvalDecision.update({
      where: { id: myDecision.id },
      data: { status: dto.status, comment: dto.comment, decidedAt: new Date(), approverName: user?.name ?? userId },
    });

    // Check if step is complete
    const stepDecisions = await this.prisma.approvalDecision.findMany({ where: { requestId, stepId: currentStep.id } });
    const approved = stepDecisions.filter(d => d.status === 'APPROVED').length;
    const rejected = stepDecisions.filter(d => d.status === 'REJECTED').length;
    const total    = stepDecisions.length;

    let stepComplete = false;
    let stepApproved = false;

    if (dto.status === 'REJECTED') {
      // Any rejection → step fails (for SEQUENTIAL and PARALLEL)
      stepComplete = true; stepApproved = false;
    } else if (currentStep.type === 'SEQUENTIAL' || currentStep.type === 'PARALLEL') {
      // All must approve
      stepComplete = approved === total;
      stepApproved = stepComplete;
    } else if (currentStep.type === 'ANY_ONE') {
      // Any one approval is enough
      stepComplete = true; stepApproved = true;
    }

    if (stepComplete) {
      if (!stepApproved) {
        // Reject entire request
        await this.prisma.approvalRequest.update({
          where: { id: requestId },
          data: { status: 'REJECTED', completedAt: new Date(), comment: dto.comment },
        });
        await this.notifyRequestor(request, 'REJECTED', dto.comment);
      } else {
        const nextStepIdx = request.currentStep + 1;
        if (nextStepIdx >= request.flow.steps.length) {
          // All steps done → APPROVED
          await this.prisma.approvalRequest.update({
            where: { id: requestId },
            data: { status: 'APPROVED', completedAt: new Date() },
          });
          await this.notifyRequestor(request, 'APPROVED');
          // Auto-action on entity
          await this.applyApprovalResult(request, 'APPROVED', orgId);
        } else {
          // Move to next step
          const nextStep = request.flow.steps[nextStepIdx];
          await this.prisma.approvalRequest.update({
            where: { id: requestId },
            data: { currentStep: nextStepIdx },
          });
          await this.createDecisionsForStep(requestId, nextStep, orgId);
        }
      }
    }

    return this.prisma.approvalRequest.findUnique({
      where: { id: requestId },
      include: { flow: true, decisions: { include: { step: true } } },
    });
  }

  async cancelRequest(requestId: string, orgId: string, userId: string) {
    const request = await this.prisma.approvalRequest.findFirst({
      where: { id: requestId, orgId, status: 'PENDING' },
    });
    if (!request) throw new NotFoundException('Request not found');
    if (request.requestedById !== userId) throw new ForbiddenException('Only requestor can cancel');

    return this.prisma.approvalRequest.update({
      where: { id: requestId },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
  }

  // ─── Auto-trigger ──────────────────────────────────────────────────────────

  async checkAutoTrigger(orgId: string, userId: string, entityType: string, entityId: string, newStatus: string, entityTitle: string) {
    // Find flows triggered by this status change
    const flows = await this.prisma.approvalFlow.findMany({
      where: {
        orgId, isActive: true,
        trigger: 'TASK_STATUS',
      },
      include: { steps: { orderBy: { order: 'asc' } } },
    });

    for (const flow of flows) {
      const config = flow.triggerConfig as any;
      if (config?.status === newStatus && (!config.entityType || config.entityType === entityType)) {
        // Check if request already exists
        const existing = await this.prisma.approvalRequest.findFirst({
          where: { orgId, flowId: flow.id, entityId, status: 'PENDING' },
        });
        if (!existing) {
          await this.createRequest(orgId, userId, {
            flowId: flow.id, entityType, entityId, entityTitle,
          });
        }
      }
    }
  }

  // ─── Helpers ───────────────────────────────────────────────────────────────

  private async createDecisionsForStep(requestId: string, step: any, orgId: string) {
    const approverIds: string[] = step.approverIds ?? [];

    // Resolve role-based approvers
    let resolvedIds: string[] = [];
    if (step.approverType === 'USER') {
      resolvedIds = approverIds;
    } else if (step.approverType === 'ROLE') {
      // Get users with specified roles
      const roleUsers = await this.prisma.user.findMany({
        where: {
          orgId, deletedAt: null,
          userRoles: { some: { role: { name: { in: approverIds } } } },
        },
        select: { id: true, name: true },
      });
      resolvedIds = roleUsers.map(u => u.id);
    } else if (step.approverType === 'DEPARTMENT_HEAD') {
      // Get department heads (first admin in dept)
      const heads = await this.prisma.user.findMany({
        where: { orgId, deletedAt: null, userRoles: { some: { role: { name: 'ADMIN' } } } },
        select: { id: true, name: true },
        take: 1,
      });
      resolvedIds = heads.map(u => u.id);
    }

    if (!resolvedIds.length) return;

    // Get user names
    const users = await this.prisma.user.findMany({
      where: { id: { in: resolvedIds } },
      select: { id: true, name: true },
    });
    const userMap = new Map(users.map(u => [u.id, u.name]));

    // Create pending decisions
    await this.prisma.approvalDecision.createMany({
      data: resolvedIds.map(uid => ({
        requestId,
        stepId: step.id,
        approverId: uid,
        approverName: userMap.get(uid) ?? uid,
        status: 'PENDING',
      })),
      skipDuplicates: true,
    });

    // Notify approvers
    for (const uid of resolvedIds) {
      const request = await this.prisma.approvalRequest.findUnique({ where: { id: requestId } });
      if (!request) continue;
      await this.notifications.create(
        uid, orgId, 'approval_request',
        '📋 Нужно ваше согласование',
        `"${request.entityTitle}" ожидает вашего решения (шаг: ${step.name})`,
      ).catch(() => {});
    }
  }

  private async notifyRequestor(request: any, result: string, comment?: string) {
    const emoji = result === 'APPROVED' ? '✅' : '❌';
    const label = result === 'APPROVED' ? 'Согласовано' : 'Отклонено';
    await this.notifications.create(
      request.requestedById, request.orgId, 'approval_result',
      `${emoji} ${label}: ${request.entityTitle}`,
      comment ? `Комментарий: ${comment}` : `Запрос "${request.entityTitle}" ${label.toLowerCase()}`,
    ).catch(() => {});
  }

  private async applyApprovalResult(request: any, result: string, orgId: string) {
    if (result === 'APPROVED' && request.entityType === 'TASK') {
      // Auto-move task to next status after approval
      await this.prisma.task.updateMany({
        where: { id: request.entityId, orgId, status: 'REVIEW' },
        data: { status: 'DONE' },
      }).catch(() => {});
    }
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  async getStats(orgId: string) {
    const [pending, approved, rejected, total] = await Promise.all([
      this.prisma.approvalRequest.count({ where: { orgId, status: 'PENDING' } }),
      this.prisma.approvalRequest.count({ where: { orgId, status: 'APPROVED' } }),
      this.prisma.approvalRequest.count({ where: { orgId, status: 'REJECTED' } }),
      this.prisma.approvalRequest.count({ where: { orgId } }),
    ]);

    const myPending = await this.prisma.approvalDecision.count({
      where: { status: 'PENDING', request: { orgId, status: 'PENDING' } },
    });

    return { pending, approved, rejected, total, myPending };
  }
}
