import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TeamsService {
  constructor(private readonly prisma: PrismaService) {}

  async getAll(orgId: string) {
    const teams = await this.prisma.team.findMany({
      where: { orgId },
      include: {
        members: {
          where: { leftAt: null },
          include: { team: false },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return Promise.all(teams.map(async team => {
      const memberUsers = await this.prisma.user.findMany({
        where: { id: { in: team.members.map(m => m.userId) }, deletedAt: null },
        include: { userRoles: { include: { role: true } } },
      });
      return {
        id:          team.id,
        name:        team.name,
        orgId:       team.orgId,
        createdAt:   team.createdAt,
        memberCount: memberUsers.length,
        members:     memberUsers.map(u => ({
          id:        u.id,
          name:      u.name,
          email:     u.email,
          avatarUrl: u.avatarUrl,
          roles:     u.userRoles.map(ur => ur.role.name),
        })),
      };
    }));
  }

  async getById(id: string, orgId: string) {
    const team = await this.prisma.team.findFirst({
      where: { id, orgId },
      include: { members: { where: { leftAt: null } } },
    });
    if (!team) throw new NotFoundException('Team not found');

    const memberUsers = await this.prisma.user.findMany({
      where: { id: { in: team.members.map(m => m.userId) }, deletedAt: null },
      include: { userRoles: { include: { role: true } } },
    });

    return {
      id:        team.id,
      name:      team.name,
      orgId:     team.orgId,
      createdAt: team.createdAt,
      members:   memberUsers.map(u => ({
        id:        u.id,
        name:      u.name,
        email:     u.email,
        avatarUrl: u.avatarUrl,
        roles:     u.userRoles.map(ur => ur.role.name),
      })),
    };
  }

  async create(orgId: string, name: string) {
    const exists = await this.prisma.team.findFirst({ where: { orgId, name } });
    if (exists) throw new ConflictException('Team with this name already exists');
    return this.prisma.team.create({ data: { orgId, name } });
  }

  async update(id: string, orgId: string, name: string) {
    const team = await this.prisma.team.findFirst({ where: { id, orgId } });
    if (!team) throw new NotFoundException('Team not found');
    return this.prisma.team.update({ where: { id }, data: { name } });
  }

  async delete(id: string, orgId: string) {
    const team = await this.prisma.team.findFirst({ where: { id, orgId } });
    if (!team) throw new NotFoundException('Team not found');
    await this.prisma.teamMember.deleteMany({ where: { teamId: id } });
    return this.prisma.team.delete({ where: { id } });
  }

  async addMember(teamId: string, orgId: string, userId: string) {
    const team = await this.prisma.team.findFirst({ where: { id: teamId, orgId } });
    if (!team) throw new NotFoundException('Team not found');

    const user = await this.prisma.user.findFirst({ where: { id: userId, orgId, deletedAt: null } });
    if (!user) throw new NotFoundException('User not found');

    const existing = await this.prisma.teamMember.findFirst({
      where: { teamId, userId, leftAt: null },
    });
    if (existing) throw new ConflictException('User already in team');

    return this.prisma.teamMember.create({ data: { teamId, userId } });
  }

  async removeMember(teamId: string, orgId: string, userId: string) {
    const team = await this.prisma.team.findFirst({ where: { id: teamId, orgId } });
    if (!team) throw new NotFoundException('Team not found');

    await this.prisma.teamMember.updateMany({
      where:  { teamId, userId, leftAt: null },
      data:   { leftAt: new Date() },
    });
    return { message: 'Member removed' };
  }
}
