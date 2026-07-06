import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CrmAutomationService } from './crm-automation.service';

@Injectable()
export class CrmWebFormService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly automation: CrmAutomationService,
  ) {}

  async getForms(orgId: string) {
    return this.prisma.crmWebForm.findMany({ where: { orgId }, orderBy: { createdAt: 'desc' } });
  }

  async createForm(orgId: string, dto: any) {
    return this.prisma.crmWebForm.create({
      data: {
        orgId, name: dto.name,
        fields: dto.fields ?? [
          { key: 'name', label: 'Имя', type: 'text', required: true },
          { key: 'phone', label: 'Телефон', type: 'tel', required: true },
          { key: 'email', label: 'Email', type: 'email', required: false },
        ],
        defaultSource: dto.defaultSource ?? 'website',
        defaultOwnerId: dto.defaultOwnerId,
      },
    });
  }

  async deleteForm(orgId: string, id: string) {
    await this.prisma.crmWebForm.delete({ where: { id } });
    return { ok: true };
  }

  /** Публичный (без авторизации) приём заявки с формы — создаёт Лид */
  async submitForm(formId: string, payload: Record<string, any>) {
    const form = await this.prisma.crmWebForm.findUnique({ where: { id: formId } });
    if (!form || !form.isActive) throw new NotFoundException('Форма не найдена или отключена');

    const requiredFields = (form.fields as any[]).filter(f => f.required);
    for (const f of requiredFields) {
      if (!payload[f.key]) throw new BadRequestException(`Поле "${f.label}" обязательно`);
    }

    const lead = await this.prisma.crmLead.create({
      data: {
        orgId: form.orgId,
        name: payload.name ?? payload.email ?? 'Заявка с сайта',
        email: payload.email, phone: payload.phone,
        source: form.defaultSource,
        ownerId: form.defaultOwnerId,
        notes: Object.entries(payload).map(([k, v]) => `${k}: ${v}`).join('\n'),
      },
    });

    await this.prisma.crmWebForm.update({ where: { id: formId }, data: { submitCount: { increment: 1 } } });
    await this.automation.onEntityCreated(form.orgId, 'LEAD', lead).catch(() => {});

    return { ok: true, leadId: lead.id };
  }
}
