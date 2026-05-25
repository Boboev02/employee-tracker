import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, UseGuards } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { RbacGuard } from '../auth/guards/index';

@Controller('api/v1/employees')
@UseGuards(RbacGuard)
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  @RequirePermissions('user:read:all', 'user:read:team')
  getAll(@CurrentUser() user: any, @Query() q: any) {
    // Managers can only see their team
    return this.employees.getAll(user.orgId, q);
  }

  @Get(':id')
  @RequirePermissions('user:read:all', 'user:read:team', 'user:read:self')
  getById(@CurrentUser() user: any, @Param('id') id: string) {
    return this.employees.getById(id, user.orgId);
  }

  @Post('invite')
  @RequirePermissions('user:invite')
  invite(@CurrentUser() user: any, @Body() body: any) {
    return this.employees.invite(user.orgId, body);
  }

  @Patch(':id/role')
  @RequirePermissions('role:assign')
  updateRole(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { role: string }) {
    return this.employees.updateRole(id, user.orgId, body.role);
  }

  @Patch(':id/suspend')
  @RequirePermissions('user:suspend')
  suspend(@CurrentUser() user: any, @Param('id') id: string) {
    return this.employees.suspend(id, user.orgId);
  }

  @Patch(':id/activate')
  @RequirePermissions('user:suspend')
  activate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.employees.activate(id, user.orgId);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('user:delete')
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.employees.delete(id, user.orgId, user.id);
  }
}
