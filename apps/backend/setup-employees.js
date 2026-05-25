const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

// ─── Backend: Employees controller ───────────────────────────
write('src/employees/employees.controller.ts', `import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode } from '@nestjs/common';
import { EmployeesService } from './employees.service';
import { CurrentUser } from '../auth/decorators/index';

@Controller('api/v1/employees')
export class EmployeesController {
  constructor(private readonly employees: EmployeesService) {}

  @Get()
  getAll(@CurrentUser() user: any, @Query() q: any) {
    return this.employees.getAll(user.orgId, q);
  }

  @Get(':id')
  getById(@CurrentUser() user: any, @Param('id') id: string) {
    return this.employees.getById(id, user.orgId);
  }

  @Post('invite')
  invite(@CurrentUser() user: any, @Body() body: any) {
    return this.employees.invite(user.orgId, body);
  }

  @Patch(':id/role')
  updateRole(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { role: string }) {
    return this.employees.updateRole(id, user.orgId, body.role);
  }

  @Patch(':id/suspend')
  suspend(@CurrentUser() user: any, @Param('id') id: string) {
    return this.employees.suspend(id, user.orgId);
  }

  @Patch(':id/activate')
  activate(@CurrentUser() user: any, @Param('id') id: string) {
    return this.employees.activate(id, user.orgId);
  }
}
`);

// ─── Backend: Employees service ───────────────────────────────
write('src/employees/employees.service.ts', `import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcrypt';

@Injectable()
export class EmployeesService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(orgId: string, filters: any = {}) {
    const where: any = { orgId, deletedAt: null };
    if (filters.search) {
      where.OR = [
        { name:  { contains: filters.search, mode: 'insensitive' } },
        { email: { contains: filters.search, mode: 'insensitive' } },
      ];
    }
    if (filters.status) where.status = filters.status;

    const users = await this.prisma.user.findMany({
      where,
      include: { userRoles: { include: { role: true } } },
      orderBy: { createdAt: 'desc' },
    });

    return users.map(u => ({
      id:        u.id,
      name:      u.name,
      email:     u.email,
      status:    u.status,
      avatarUrl: u.avatarUrl,
      roles:     u.userRoles.map(ur => ur.role.name),
      createdAt: u.createdAt,
    }));
  }

  async getById(id: string, orgId: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, orgId, deletedAt: null },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) throw new NotFoundException('Employee not found');
    return {
      id:        user.id,
      name:      user.name,
      email:     user.email,
      status:    user.status,
      avatarUrl: user.avatarUrl,
      roles:     user.userRoles.map(ur => ur.role.name),
      createdAt: user.createdAt,
    };
  }

  async invite(orgId: string, dto: { email: string; name: string; role?: string; password?: string }) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already registered');

    const password = dto.password ?? 'Welcome123!';
    const hash = await bcrypt.hash(password, 12);

    const roleName = dto.role ?? 'EMPLOYEE';
    let role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) role = await this.prisma.role.create({ data: { name: roleName, permissions: [] } });

    const user = await this.prisma.user.create({
      data: { email: dto.email, name: dto.name, password: hash, orgId },
    });
    await this.prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

    return { id: user.id, email: user.email, name: user.name, role: roleName, temporaryPassword: password };
  }

  async updateRole(userId: string, orgId: string, roleName: string) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, orgId } });
    if (!user) throw new NotFoundException('Employee not found');

    let role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) role = await this.prisma.role.create({ data: { name: roleName, permissions: [] } });

    await this.prisma.userRole.deleteMany({ where: { userId } });
    await this.prisma.userRole.create({ data: { userId, roleId: role.id } });

    return { message: 'Role updated' };
  }

  async suspend(userId: string, orgId: string) {
    await this.prisma.user.updateMany({ where: { id: userId, orgId }, data: { status: 'SUSPENDED' } });
    return { message: 'Suspended' };
  }

  async activate(userId: string, orgId: string) {
    await this.prisma.user.updateMany({ where: { id: userId, orgId }, data: { status: 'ACTIVE' } });
    return { message: 'Activated' };
  }
}
`);

// ─── Backend: Employees module ────────────────────────────────
write('src/employees/employees.module.ts', `import { Module } from '@nestjs/common';
import { EmployeesController } from './employees.controller';
import { EmployeesService } from './employees.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [EmployeesController],
  providers: [EmployeesService],
  exports: [EmployeesService],
})
export class EmployeesModule {}
`);

// ─── Update app.module.ts ─────────────────────────────────────
write('src/app.module.ts', `import 'dotenv/config';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { TasksModule } from './tasks/tasks.module';
import { EmployeesModule } from './employees/employees.module';
import { JwtAuthGuard } from './auth/guards/index';

@Module({
  imports: [PrismaModule, AuthModule, HealthModule, TasksModule, EmployeesModule],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
`);

console.log('\n✅ Employees backend created');
