import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/index';
import { CurrentUser } from '../auth/decorators/index';
import { KnowledgeService } from './knowledge.service';

@Controller('api/v1/knowledge')
@UseGuards(JwtAuthGuard)
export class KnowledgeController {
  constructor(private readonly knowledge: KnowledgeService) {}

  @Get('categories')
  getCategories(@CurrentUser() user: any) {
    return this.knowledge.getCategories(user.orgId);
  }

  @Post('categories')
  createCategory(@CurrentUser() user: any, @Body() dto: any) {
    return this.knowledge.createCategory(user.orgId, dto);
  }

  @Put('categories/:id')
  updateCategory(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: any) {
    return this.knowledge.updateCategory(id, user.orgId, dto);
  }

  @Delete('categories/:id')
  deleteCategory(@Param('id') id: string) {
    return this.knowledge.deleteCategory(id);
  }

  @Get('articles')
  getArticles(@CurrentUser() user: any, @Query('categoryId') categoryId?: string, @Query('search') search?: string) {
    return this.knowledge.getArticles(user.orgId, categoryId, search);
  }

  @Get('articles/:id')
  getArticle(@Param('id') id: string, @CurrentUser() user: any) {
    return this.knowledge.getArticle(id, user.orgId);
  }

  @Post('articles')
  createArticle(@CurrentUser() user: any, @Body() dto: any) {
    return this.knowledge.createArticle(user.orgId, user.id, dto);
  }

  @Put('articles/:id')
  updateArticle(@Param('id') id: string, @CurrentUser() user: any, @Body() dto: any) {
    return this.knowledge.updateArticle(id, user.orgId, dto);
  }

  @Delete('articles/:id')
  deleteArticle(@Param('id') id: string) {
    return this.knowledge.deleteArticle(id);
  }
}
