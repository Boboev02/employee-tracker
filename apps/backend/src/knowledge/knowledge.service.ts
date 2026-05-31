import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class KnowledgeService {
  constructor(private readonly prisma: PrismaService) {}

  async getCategories(orgId: string) {
    return this.prisma.knowledgeCategory.findMany({
      where: { orgId },
      orderBy: { sortOrder: 'asc' },
      include: { _count: { select: { articles: { where: { deletedAt: null } } } } },
    });
  }

  async createCategory(orgId: string, dto: any) {
    return this.prisma.knowledgeCategory.create({
      data: { orgId, name: dto.name, description: dto.description, icon: dto.icon ?? '📁', color: dto.color ?? '#8b7cf6' },
    });
  }

  async updateCategory(id: string, orgId: string, dto: any) {
    return this.prisma.knowledgeCategory.update({ where: { id }, data: dto });
  }

  async deleteCategory(id: string) {
    return this.prisma.knowledgeCategory.delete({ where: { id } });
  }

  async getArticles(orgId: string, categoryId?: string, search?: string) {
    const where: any = { orgId, deletedAt: null };
    if (categoryId) where.categoryId = categoryId;
    if (search) where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { content: { contains: search, mode: 'insensitive' } },
    ];
    return this.prisma.knowledgeArticle.findMany({
      where,
      orderBy: [{ isPinned: 'desc' }, { updatedAt: 'desc' }],
      include: { category: { select: { id: true, name: true, icon: true, color: true } } },
    });
  }

  async getArticle(id: string, orgId: string) {
    await this.prisma.knowledgeArticle.update({ where: { id }, data: { views: { increment: 1 } } });
    return this.prisma.knowledgeArticle.findFirst({
      where: { id, orgId, deletedAt: null },
      include: { category: true },
    });
  }

  async createArticle(orgId: string, authorId: string, dto: any) {
    return this.prisma.knowledgeArticle.create({
      data: { orgId, authorId, categoryId: dto.categoryId, title: dto.title, content: dto.content ?? '', fileUrl: dto.fileUrl, fileName: dto.fileName, fileType: dto.fileType },
    });
  }

  async updateArticle(id: string, orgId: string, dto: any) {
    return this.prisma.knowledgeArticle.update({ where: { id }, data: dto });
  }

  async deleteArticle(id: string) {
    return this.prisma.knowledgeArticle.update({ where: { id }, data: { deletedAt: new Date() } });
  }
}
