import { Controller, Get, Post, Patch, Delete, Body, Param, Query, UseGuards, HttpCode } from '@nestjs/common';
import { ProductsService } from './products.service';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { RbacGuard } from '../auth/guards/index';
import {
  CreateProductDto, UpdateProductDto, SetProductFieldDto, CreateProductTaskDto,
  AddTrademarkDto, AddKitDto, SetOzonTokenDto,
} from './dto/product.dto';

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
  setOzonToken(@CurrentUser() user: any, @Body() body: SetOzonTokenDto) {
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
  createTask(@CurrentUser() user: any, @Param('id') id: string, @Body() body: CreateProductTaskDto) {
    return this.products.createTask(user.orgId, user.id ?? user.sub, id, body);
  }

  // Создание карточки вручную
  @Post()
  @RequirePermissions('org:update', 'task:create')
  createProduct(@CurrentUser() user: any, @Body() body: CreateProductDto) {
    return this.products.createProduct(user.orgId, user.id ?? user.sub, body);
  }

  // Пользовательские поля товара
  @Get(':id/fields')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getProductFields(@CurrentUser() user: any, @Param('id') id: string) {
    return this.products.getProductFields(user.orgId, id);
  }

  @Patch(':id/fields')
  @RequirePermissions('org:update', 'task:update:any')
  setProductField(@CurrentUser() user: any, @Param('id') id: string, @Body() body: SetProductFieldDto) {
    return this.products.setProductField(user.orgId, id, user.id ?? user.sub, body);
  }

  // Удаление карточки
  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('org:update', 'task:delete')
  deleteProduct(@CurrentUser() user: any, @Param('id') id: string) {
    return this.products.deleteProduct(user.orgId, id);
  }

  // Обновление карточки товара
  @Patch(':id')
  @RequirePermissions('org:update', 'task:update:any')
  updateProduct(@CurrentUser() user: any, @Param('id') id: string, @Body() body: UpdateProductDto) {
    return this.products.updateProduct(user.orgId, id, user.id ?? user.sub, body);
  }

  // Товарные знаки
  @Post(':id/trademarks')
  @RequirePermissions('org:update', 'task:update:any')
  addTrademark(@CurrentUser() user: any, @Param('id') id: string, @Body() body: AddTrademarkDto) {
    return this.products.addTrademark(user.orgId, id, body);
  }

  @Delete(':id/trademarks/:tmId')
  @HttpCode(204)
  @RequirePermissions('org:update', 'task:update:any')
  deleteTrademark(@CurrentUser() user: any, @Param('id') id: string, @Param('tmId') tmId: string) {
    return this.products.deleteTrademark(user.orgId, id, tmId);
  }

  // Наборы
  @Post(':id/kits')
  @RequirePermissions('org:update', 'task:update:any')
  addKit(@CurrentUser() user: any, @Param('id') id: string, @Body() body: AddKitDto) {
    return this.products.addKit(user.orgId, id, body.kitName);
  }

  @Delete(':id/kits/:kitId')
  @HttpCode(204)
  @RequirePermissions('org:update', 'task:update:any')
  deleteKit(@CurrentUser() user: any, @Param('id') id: string, @Param('kitId') kitId: string) {
    return this.products.deleteKit(user.orgId, id, kitId);
  }

  // История версий
  @Get(':id/versions')
  @RequirePermissions('task:read:all', 'task:read:team', 'task:read:self')
  getVersions(@CurrentUser() user: any, @Param('id') id: string) {
    return this.products.getVersions(user.orgId, id);
  }
}
