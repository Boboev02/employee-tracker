const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

// ─── Backend: Teams service ───────────────────────────────────
write('src/teams/teams.service.ts', `import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
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
`);

// ─── Backend: Teams controller ────────────────────────────────
write('src/teams/teams.controller.ts', `import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CurrentUser } from '../auth/decorators/index';

@Controller('api/v1/teams')
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  getAll(@CurrentUser() user: any) {
    return this.teams.getAll(user.orgId);
  }

  @Get(':id')
  getById(@CurrentUser() user: any, @Param('id') id: string) {
    return this.teams.getById(id, user.orgId);
  }

  @Post()
  create(@CurrentUser() user: any, @Body() body: { name: string }) {
    return this.teams.create(user.orgId, body.name);
  }

  @Patch(':id')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { name: string }) {
    return this.teams.update(id, user.orgId, body.name);
  }

  @Delete(':id')
  @HttpCode(204)
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.teams.delete(id, user.orgId);
  }

  @Post(':id/members')
  addMember(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { userId: string }) {
    return this.teams.addMember(id, user.orgId, body.userId);
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  removeMember(@CurrentUser() user: any, @Param('id') id: string, @Param('userId') userId: string) {
    return this.teams.removeMember(id, user.orgId, userId);
  }
}
`);

// ─── Backend: Teams module ────────────────────────────────────
write('src/teams/teams.module.ts', `import { Module } from '@nestjs/common';
import { TeamsController } from './teams.controller';
import { TeamsService } from './teams.service';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports:     [PrismaModule],
  controllers: [TeamsController],
  providers:   [TeamsService],
  exports:     [TeamsService],
})
export class TeamsModule {}
`);

// ─── Update app.module.ts ─────────────────────────────────────
write('src/app.module.ts', `import 'dotenv/config';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule }    from './prisma/prisma.module';
import { AuthModule }      from './auth/auth.module';
import { HealthModule }    from './health/health.module';
import { TasksModule }     from './tasks/tasks.module';
import { EmployeesModule } from './employees/employees.module';
import { RealtimeModule }  from './realtime/realtime.module';
import { AnalyticsModule } from './analytics/analytics.module';
import { TrackingModule }  from './tracking/tracking.module';
import { TeamsModule }     from './teams/teams.module';
import { JwtAuthGuard }    from './auth/guards/index';

@Module({
  imports: [
    PrismaModule, AuthModule, HealthModule,
    TasksModule, EmployeesModule, RealtimeModule,
    AnalyticsModule, TrackingModule, TeamsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: JwtAuthGuard }],
})
export class AppModule {}
`);

console.log('\n✅ Teams backend created');
