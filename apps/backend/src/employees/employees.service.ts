import { Injectable, NotFoundException, ConflictException, ForbiddenException } from '@nestjs/common';
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
      birthDate: (u as any).birthDate,
      gender:    (u as any).gender,
      hiredAt:   (u as any).hiredAt,
      position:  (u as any).position,
      phone:     (u as any).phone,
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
      birthDate: (user as any).birthDate,
      gender:    (user as any).gender,
      hiredAt:   (user as any).hiredAt,
      position:  (user as any).position,
      phone:     (user as any).phone,
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

  async delete(userId: string, orgId: string, requesterId: string) {
    if (userId === requesterId) {
      throw new Error('Cannot delete yourself');
    }
    const user = await this.prisma.user.findFirst({ where: { id: userId, orgId } });
    if (!user) throw new Error('Employee not found');

    // Soft delete
    await this.prisma.user.update({
      where: { id: userId },
      data:  { deletedAt: new Date(), status: 'SUSPENDED' },
    });
    // Remove sessions
    await this.prisma.session.deleteMany({ where: { userId } });
    // Remove from teams
    await this.prisma.teamMember.updateMany({
      where: { userId, leftAt: null },
      data:  { leftAt: new Date() },
    });
    return { message: 'Deleted' };
  }

  async updateProfile(userId: string, orgId: string, dto: {
    name?: string;
    phone?: string;
    position?: string;
    gender?: string;
    birthDate?: string;
    hiredAt?: string;
    avatarUrl?: string;
  }) {
    const user = await this.prisma.user.findFirst({ where: { id: userId, orgId, deletedAt: null } });
    if (!user) throw new NotFoundException('Employee not found');

    const data: any = {};
    if (dto.name)      data.name = dto.name;
    if (dto.phone !== undefined)    data.phone = dto.phone;
    if (dto.position !== undefined) data.position = dto.position;
    if (dto.gender !== undefined)   data.gender = dto.gender;
    if (dto.avatarUrl !== undefined) data.avatarUrl = dto.avatarUrl;
    if (dto.birthDate !== undefined) data.birthDate = dto.birthDate ? new Date(dto.birthDate) : null;
    if (dto.hiredAt !== undefined)   data.hiredAt = dto.hiredAt ? new Date(dto.hiredAt) : null;

    return this.prisma.user.update({
      where: { id: userId },
      data: { ...data, updatedAt: new Date() },
      select: { id: true, name: true, email: true, avatarUrl: true },
    });
  }

  async resetPassword(id: string, orgId: string, newPassword: string) {
    if (!newPassword || newPassword.length < 6) throw new Error('Min 6 chars');
    const hash = await bcrypt.hash(newPassword, 12);
    return this.prisma.user.update({
      where: { id },
      data: { password: hash, updatedAt: new Date() },
      select: { id: true, name: true, email: true },
    });
  }

}
