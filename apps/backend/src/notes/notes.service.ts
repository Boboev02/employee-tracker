
import { Injectable, ForbiddenException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class NotesService {
  constructor(private readonly prisma: PrismaService) {}

  async list(userId: string, orgId: string, status?: string, search?: string, limit = 100, offset = 0) {
    const where: any = { userId, orgId };
    if (status) where.status = status;
    else where.status = { not: 'ARCHIVED' };
    if (search) where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
    ];
    return this.prisma.note.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
      take: Math.min(limit, 200),
      skip: offset,
    });
  }

  async create(userId: string, orgId: string, dto: any) {
    return this.prisma.note.create({
      data: {
        userId, orgId,
        title:    dto.title    || 'Новая заметка',
        content:  dto.content  || '',
        status:   dto.status   || 'ACTIVE',
        priority: dto.priority || 'MEDIUM',
        isPinned: dto.isPinned || false,
        remindAt: dto.remindAt ? new Date(dto.remindAt) : null,
      },
    });
  }

  async update(id: string, userId: string, dto: any) {
    const note = await this.prisma.note.findUnique({ where: { id } });
    if (!note) throw new NotFoundException();
    if (note.userId !== userId) throw new ForbiddenException();
    return this.prisma.note.update({
      where: { id },
      data: {
        ...(dto.title    !== undefined && { title: dto.title }),
        ...(dto.content  !== undefined && { content: dto.content }),
        ...(dto.status   !== undefined && { status: dto.status }),
        ...(dto.priority !== undefined && { priority: dto.priority }),
        ...(dto.isPinned !== undefined && { isPinned: dto.isPinned }),
        ...(dto.remindAt !== undefined && { remindAt: dto.remindAt ? new Date(dto.remindAt) : null }),
      },
    });
  }

  async remove(id: string, userId: string) {
    const note = await this.prisma.note.findUnique({ where: { id } });
    if (!note) throw new NotFoundException();
    if (note.userId !== userId) throw new ForbiddenException();
    return this.prisma.note.delete({ where: { id } });
  }
}
