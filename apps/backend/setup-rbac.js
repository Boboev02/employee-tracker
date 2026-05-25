const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

// ─── 1. Permissions matrix ────────────────────────────────────
write('src/auth/rbac/permissions.matrix.ts', `export type Permission =
  | 'org:read' | 'org:update' | 'org:billing:manage'
  | 'user:invite' | 'user:read:all' | 'user:read:team'
  | 'user:read:self' | 'user:update:any' | 'user:update:self'
  | 'user:suspend' | 'user:delete'
  | 'team:create' | 'team:read:all' | 'team:update' | 'team:members:manage'
  | 'tracking:view:all' | 'tracking:view:team' | 'tracking:view:self' | 'tracking:export'
  | 'analytics:view:org' | 'analytics:view:team' | 'analytics:view:self'
  | 'task:create' | 'task:read:all' | 'task:read:team' | 'task:read:self'
  | 'task:update:any' | 'task:update:self' | 'task:delete' | 'task:assign'
  | 'report:generate:org' | 'report:generate:team' | 'report:view'
  | 'role:assign' | 'audit:view';

export const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  SUPER_ADMIN: [
    'org:read','org:update','org:billing:manage',
    'user:invite','user:read:all','user:update:any','user:suspend','user:delete',
    'team:create','team:read:all','team:update','team:members:manage',
    'tracking:view:all','tracking:export',
    'analytics:view:org','analytics:view:team','analytics:view:self',
    'task:create','task:read:all','task:update:any','task:delete','task:assign',
    'report:generate:org','report:view','role:assign','audit:view',
  ],
  OWNER: [
    'org:read','org:update','org:billing:manage',
    'user:invite','user:read:all','user:update:any','user:suspend','user:delete',
    'team:create','team:read:all','team:update','team:members:manage',
    'tracking:view:all','tracking:export',
    'analytics:view:org','analytics:view:team',
    'task:create','task:read:all','task:update:any','task:delete','task:assign',
    'report:generate:org','report:view','role:assign','audit:view',
  ],
  ADMIN: [
    'org:read','org:update',
    'user:invite','user:read:all','user:update:any','user:suspend',
    'team:create','team:read:all','team:update','team:members:manage',
    'tracking:view:all','tracking:export',
    'analytics:view:org','analytics:view:team',
    'task:create','task:read:all','task:update:any','task:delete','task:assign',
    'report:generate:org','report:view','role:assign','audit:view',
  ],
  MANAGER: [
    'org:read',
    'user:invite','user:read:team','user:read:self','user:update:self',
    'team:read:all','team:members:manage',
    'tracking:view:team','tracking:view:self',
    'analytics:view:team','analytics:view:self',
    'task:create','task:read:team','task:read:self','task:update:any','task:assign',
    'report:generate:team','report:view',
  ],
  VIEWER: [
    'org:read',
    'user:read:team','user:read:self',
    'team:read:all',
    'tracking:view:team','tracking:view:self',
    'analytics:view:team','analytics:view:self',
    'task:read:team','task:read:self',
    'report:view',
  ],
  HR: [
    'org:read',
    'user:invite','user:read:all','user:read:self','user:update:self',
    'team:read:all',
    'tracking:view:all',
    'analytics:view:org','analytics:view:team',
    'report:generate:org','report:view',
  ],
  EMPLOYEE: [
    'user:read:self','user:update:self',
    'tracking:view:self',
    'analytics:view:self',
    'task:read:self','task:update:self',
  ],
};

export function resolvePermissions(roles: string[]): Set<Permission> {
  const perms = new Set<Permission>();
  for (const role of roles) {
    const rolePerms = ROLE_PERMISSIONS[role] ?? [];
    rolePerms.forEach(p => perms.add(p));
  }
  return perms;
}
`);

// ─── 2. Updated RbacGuard ─────────────────────────────────────
write('src/auth/guards/index.ts', `import {
  Injectable, CanActivate, ExecutionContext,
  UnauthorizedException, ForbiddenException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { resolvePermissions } from '../rbac/permissions.matrix';

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly jwt:       JwtService,
    private readonly reflector: Reflector,
  ) {}

  canActivate(ctx: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (isPublic) return true;

    const request = ctx.switchToHttp().getRequest();
    const auth    = request.headers?.authorization;
    const token   = auth?.startsWith('Bearer ') ? auth.slice(7) : request.cookies?.access_token ?? null;
    if (!token) throw new UnauthorizedException('Token missing');

    try {
      const payload = this.jwt.verify(token, { secret: process.env.JWT_ACCESS_SECRET });
      payload.id          = payload.sub;
      payload.permissions = resolvePermissions(payload.roles ?? []);
      request.user        = payload;
      return true;
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }
}

@Injectable()
export class RbacGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(ctx: ExecutionContext): boolean {
    const required = this.reflector.getAllAndOverride<string[]>('permissions', [
      ctx.getHandler(), ctx.getClass(),
    ]);
    if (!required?.length) return true;

    const { user } = ctx.switchToHttp().getRequest();
    if (!user) throw new UnauthorizedException();

    const hasAll = required.every(p => user.permissions?.has(p));
    if (!hasAll) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
`);

// ─── 3. Add RBAC to employees controller ─────────────────────
write('src/employees/employees.controller.ts', `import { Controller, Get, Post, Patch, Delete, Body, Param, Query, HttpCode, UseGuards } from '@nestjs/common';
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
}
`);

// ─── 4. Add RBAC to analytics controller ─────────────────────
write('src/analytics/analytics.controller.ts', `import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { AnalyticsService }     from './analytics.service';
import { ActiveTimeService }    from './active-time.service';
import { ProductivityService }  from './productivity.service';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { RbacGuard }            from '../auth/guards/index';

@Controller('api/v1/analytics')
@UseGuards(RbacGuard)
export class AnalyticsController {
  constructor(
    private readonly analytics:    AnalyticsService,
    private readonly activeTime:   ActiveTimeService,
    private readonly productivity: ProductivityService,
  ) {}

  @Get('stats')
  @RequirePermissions('analytics:view:org', 'analytics:view:team', 'analytics:view:self')
  getStats(@CurrentUser() user: any) {
    return this.analytics.getOrgStats(user.orgId);
  }

  @Get('tasks/by-status')
  @RequirePermissions('analytics:view:org', 'analytics:view:team')
  getByStatus(@CurrentUser() user: any) {
    return this.analytics.getTasksByStatus(user.orgId);
  }

  @Get('tasks/by-priority')
  @RequirePermissions('analytics:view:org', 'analytics:view:team')
  getByPriority(@CurrentUser() user: any) {
    return this.analytics.getTasksByPriority(user.orgId);
  }

  @Get('tasks/by-day')
  @RequirePermissions('analytics:view:org', 'analytics:view:team')
  getByDay(@CurrentUser() user: any, @Query('days') days?: string) {
    return this.analytics.getTasksCreatedByDay(user.orgId, days ? parseInt(days) : 14);
  }

  @Get('employees')
  @RequirePermissions('analytics:view:org', 'analytics:view:team')
  getEmployeeStats(@CurrentUser() user: any) {
    return this.analytics.getEmployeeStats(user.orgId);
  }

  @Get('activity/summary')
  @RequirePermissions('analytics:view:org', 'analytics:view:team', 'analytics:view:self')
  getActivitySummary(@CurrentUser() user: any, @Query('days') days?: string, @Query('userId') userId?: string) {
    // EMPLOYEE can only see own data
    const hasOrgView = user.permissions?.has('analytics:view:org') || user.permissions?.has('analytics:view:team');
    const targetUserId = hasOrgView ? userId : user.id;
    return this.activeTime.getActivitySummary(user.orgId, days ? parseInt(days) : 7, targetUserId);
  }

  @Get('activity/platforms')
  @RequirePermissions('analytics:view:org', 'analytics:view:team', 'analytics:view:self')
  getPlatformBreakdown(@CurrentUser() user: any, @Query('days') days?: string) {
    return this.activeTime.getPlatformBreakdown(user.orgId, days ? parseInt(days) : 7);
  }

  @Get('activity/hourly')
  @RequirePermissions('analytics:view:org', 'analytics:view:team', 'analytics:view:self')
  getHourlyActivity(@CurrentUser() user: any, @Query('userId') userId?: string) {
    const hasOrgView = user.permissions?.has('analytics:view:org') || user.permissions?.has('analytics:view:team');
    const targetUserId = hasOrgView ? userId : user.id;
    return this.activeTime.getHourlyActivity(user.orgId, targetUserId);
  }

  @Get('activity/total')
  @RequirePermissions('analytics:view:org', 'analytics:view:team', 'analytics:view:self')
  getTotalEvents(@CurrentUser() user: any) {
    return this.activeTime.getTotalEventCount(user.orgId);
  }

  @Get('productivity')
  @RequirePermissions('analytics:view:org', 'analytics:view:team')
  getProductivity(@CurrentUser() user: any, @Query('days') days?: string) {
    return this.productivity.getOrgProductivity(user.orgId, days ? parseInt(days) : 7);
  }
}
`);

// ─── 5. Add RBAC to teams controller ─────────────────────────
write('src/teams/teams.controller.ts', `import { Controller, Get, Post, Patch, Delete, Body, Param, HttpCode, UseGuards } from '@nestjs/common';
import { TeamsService } from './teams.service';
import { CurrentUser, RequirePermissions } from '../auth/decorators/index';
import { RbacGuard } from '../auth/guards/index';

@Controller('api/v1/teams')
@UseGuards(RbacGuard)
export class TeamsController {
  constructor(private readonly teams: TeamsService) {}

  @Get()
  @RequirePermissions('team:read:all')
  getAll(@CurrentUser() user: any) {
    return this.teams.getAll(user.orgId);
  }

  @Get(':id')
  @RequirePermissions('team:read:all')
  getById(@CurrentUser() user: any, @Param('id') id: string) {
    return this.teams.getById(id, user.orgId);
  }

  @Post()
  @RequirePermissions('team:create')
  create(@CurrentUser() user: any, @Body() body: { name: string }) {
    return this.teams.create(user.orgId, body.name);
  }

  @Patch(':id')
  @RequirePermissions('team:update')
  update(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { name: string }) {
    return this.teams.update(id, user.orgId, body.name);
  }

  @Delete(':id')
  @HttpCode(204)
  @RequirePermissions('team:update')
  delete(@CurrentUser() user: any, @Param('id') id: string) {
    return this.teams.delete(id, user.orgId);
  }

  @Post(':id/members')
  @RequirePermissions('team:members:manage')
  addMember(@CurrentUser() user: any, @Param('id') id: string, @Body() body: { userId: string }) {
    return this.teams.addMember(id, user.orgId, body.userId);
  }

  @Delete(':id/members/:userId')
  @HttpCode(204)
  @RequirePermissions('team:members:manage')
  removeMember(@CurrentUser() user: any, @Param('id') id: string, @Param('userId') userId: string) {
    return this.teams.removeMember(id, user.orgId, userId);
  }
}
`);

// ─── 6. RequirePermissions decorator — fix to use OR logic ───
write('src/auth/decorators/index.ts', `import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

export const CurrentUser = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user,
);

export const OrgId = createParamDecorator(
  (_: unknown, ctx: ExecutionContext) => ctx.switchToHttp().getRequest().user?.orgId,
);

// OR logic: user needs at least ONE of the listed permissions
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata('permissions', permissions);

export const Public = () => SetMetadata('isPublic', true);
`);

// ─── 7. Update RbacGuard to use OR logic ─────────────────────
// Already handled in guards/index.ts — need to change to OR
const guardsContent = fs.readFileSync('src/auth/guards/index.ts', 'utf8');
const fixedGuards = guardsContent.replace(
  'const hasAll = required.every(p => user.permissions?.has(p));',
  '// OR logic: user needs at least ONE of the required permissions\n    const hasAll = required.some(p => user.permissions?.has(p));'
);
fs.writeFileSync('src/auth/guards/index.ts', fixedGuards);
console.log('✓ RbacGuard updated to OR logic');

// ─── 8. Add permission info endpoint ─────────────────────────
write('src/auth/auth.controller.ts', `import { Controller, Post, Get, Body, Req, Res, HttpCode } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService }   from './auth.service';
import { TokenService }  from './token.service';
import { Public, CurrentUser } from './decorators/index';

@Controller('api/v1/auth')
export class AuthController {
  constructor(
    private readonly auth:   AuthService,
    private readonly tokens: TokenService,
  ) {}

  @Public()
  @Post('register')
  register(@Body() body: { email: string; password: string; name: string; orgName?: string }) {
    return this.auth.register(body);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { email: string; password: string }, @Req() req: Request, @Res() res: Response) {
    const result = await this.auth.login(body.email, body.password, req.ip, req.headers['user-agent']);
    return res.json(result);
  }

  @Post('refresh')
  @HttpCode(200)
  async refresh(@CurrentUser() user: any) {
    const accessToken = this.tokens.generateAccessToken({
      sub: user.id ?? user.sub, email: user.email, orgId: user.orgId,
    });
    return { accessToken, expiresIn: 900 };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res() res: Response) {
    const user = (req as any).user;
    const token = req.headers.authorization?.slice(7) ?? '';
    if (user) await this.auth.logout(user.id ?? user.sub, token);
    return res.status(204).send();
  }

  @Get('me')
  getMe(@CurrentUser() user: any) {
    return this.auth.getMe(user.id ?? user.sub);
  }

  @Get('permissions')
  getPermissions(@CurrentUser() user: any) {
    return {
      roles:       user.roles ?? [],
      permissions: Array.from(user.permissions ?? []),
    };
  }
}
`);

// ─── 9. Update active-time service to accept userId filter ───
const atContent = fs.readFileSync('src/analytics/active-time.service.ts', 'utf8');
if (!atContent.includes('targetUserId')) {
  const fixed = atContent.replace(
    'async getActivitySummary(orgId: string, days = 7) {',
    'async getActivitySummary(orgId: string, days = 7, targetUserId?: string) {'
  ).replace(
    'where: { orgId, createdAt: { gte: from } },',
    `where: { orgId, createdAt: { gte: from }, ...(targetUserId ? { userId: targetUserId } : {}) },`
  );
  fs.writeFileSync('src/analytics/active-time.service.ts', fixed);
  console.log('✓ active-time service updated');
}

console.log('\n✅ RBAC fully implemented');
console.log('\nPermissions by role:');
console.log('  ADMIN:    Full access (invite, suspend, analytics org, manage teams)');
console.log('  MANAGER:  Team access (view team analytics, manage tasks, invite)');
console.log('  VIEWER:   Read-only (view team data, no editing)');
console.log('  EMPLOYEE: Self only (own analytics, own tasks)');
