import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { RbacGuard } from '../auth/guards/index';

@Controller('api/v1/products')
@UseGuards(RbacGuard)
export class ProductsController {
  constructor(private readonly products: ProductsService) {}

  // Синхронизация карточек с маркетплейсов
  @Post('sync/wb')
  @RequirePermissions('org:update')
  syncWB(@CurrentUser() user: any) {
    return this.products.syncWB(user.orgId);
  }

  @Post('sync/ozon')
  @RequirePermissions('org:update')
  syncOzon(@CurrentUser() user: any) {
    return this.products.syncOzon(user.orgId);
  }

  // Токен Ozon
  @Post('settings/ozon-token')
  @RequirePermissions('org:update')
  setOzonToken(@CurrentUser() user: any, @Body() body: { token: string; clientId: string }) {
    return this.products.setOzonToken(user.orgId, body.token, body.clientId);
  }

  // Список карточек
  @Get()
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getProducts(
    @CurrentUser() user: any,
    @Query('marketplace') marketplace?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.products.getProducts(user.orgId, {
      marketplace, search,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  // Детальная страница карточки с задачами
  @Get(':id')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getProduct(@CurrentUser() user: any, @Param('id') id: string) {
    return this.products.getProduct(user.orgId, id);
  }

  // Создание задачи внутри карточки
  @Post(':id/tasks')
  @RequirePermissions('task:create')
  createTask(@CurrentUser() user: any, @Param('id') id: string, @Body() body: any) {
    return this.products.createTask(user.orgId, user.id ?? user.sub, id, body);
  }
}
