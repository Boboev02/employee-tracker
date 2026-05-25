const fs = require('fs');
const path = require('path');

function write(filePath, content) {
  const dir = path.dirname(filePath);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath, content);
  console.log('✓', filePath);
}

// ─── auth.service.ts ─────────────────────────────────────────
write('src/auth/auth.service.ts', `import { Injectable, UnauthorizedException, BadRequestException, Logger, ConflictException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { TokenService } from './token.service';
import { RbacService } from './rbac/rbac.service';
import { resolvePermissions } from './rbac/permissions.matrix';
import { randomUUID } from 'crypto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
    private readonly rbac: RbacService,
  ) {}

  async register(dto: { email: string; password: string; name: string; orgName?: string }) {
    const exists = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (exists) throw new ConflictException('Email already registered');

    let orgId: string;
    if (dto.orgName) {
      const org = await this.prisma.organisation.create({ data: { name: dto.orgName } });
      orgId = org.id;
    } else {
      const org = await this.prisma.organisation.findFirst();
      if (!org) {
        const newOrg = await this.prisma.organisation.create({ data: { name: 'Default' } });
        orgId = newOrg.id;
      } else {
        orgId = org.id;
      }
    }

    const hash = await bcrypt.hash(dto.password, 12);
    let role = await this.prisma.role.findUnique({ where: { name: 'ADMIN' } });
    if (!role) {
      role = await this.prisma.role.create({ data: { name: 'ADMIN', permissions: [] } });
    }

    const user = await this.prisma.user.create({
      data: { email: dto.email, password: hash, name: dto.name, orgId },
    });
    await this.prisma.userRole.create({ data: { userId: user.id, roleId: role.id } });

    return { message: 'Registered successfully' };
  }

  async login(email: string, password: string, ip?: string, ua?: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user || user.deletedAt) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    const roles = user.userRoles.map(ur => ur.role.name);
    const jti = randomUUID();

    const accessToken = this.tokens.generateAccessToken({
      sub: user.id, email: user.email, orgId: user.orgId,
    });
    const refreshToken = this.tokens.generateRefreshToken({
      sub: user.id, email: user.email, orgId: user.orgId,
    });

    await this.prisma.session.create({
      data: {
        userId: user.id,
        refreshToken: await bcrypt.hash(refreshToken, 10),
        deviceName: ua?.slice(0, 100),
        ipAddress: ip,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000),
      },
    });

    const permissions = resolvePermissions(roles);

    return {
      accessToken,
      refreshToken,
      expiresIn: 900,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        orgId: user.orgId,
        roles,
        permissions: Array.from(permissions),
        avatarUrl: user.avatarUrl,
        managedTeamIds: [],
      },
    };
  }

  async logout(userId: string, refreshToken: string) {
    const sessions = await this.prisma.session.findMany({ where: { userId } });
    for (const session of sessions) {
      const match = await bcrypt.compare(refreshToken, session.refreshToken);
      if (match) {
        await this.prisma.session.delete({ where: { id: session.id } });
        break;
      }
    }
    return { message: 'Logged out' };
  }

  async getMe(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { userRoles: { include: { role: true } } },
    });
    if (!user) throw new UnauthorizedException();
    const roles = user.userRoles.map(ur => ur.role.name);
    return { id: user.id, email: user.email, name: user.name, orgId: user.orgId, roles, avatarUrl: user.avatarUrl, managedTeamIds: [] };
  }
}
`);

// ─── auth.controller.ts ──────────────────────────────────────
write('src/auth/auth.controller.ts', `import { Controller, Post, Get, Body, Req, Res, UnauthorizedException, HttpCode } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { Public } from './decorators/index';
import { CurrentUser } from './decorators/index';

@Controller('api/v1/auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Public()
  @Post('register')
  register(@Body() body: { email: string; password: string; name: string; orgName?: string }) {
    return this.auth.register(body);
  }

  @Public()
  @Post('login')
  @HttpCode(200)
  async login(@Body() body: { email: string; password: string }, @Req() req: Request, @Res() res: Response) {
    const ip = req.ip;
    const ua = req.headers['user-agent'];
    const result = await this.auth.login(body.email, body.password, ip, ua);
    res.cookie('auth_ok', '1', { httpOnly: false, maxAge: 7 * 24 * 3600 * 1000, sameSite: 'lax' });
    return res.json(result);
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res() res: Response) {
    const user = (req as any).user;
    const token = req.headers.authorization?.slice(7) ?? '';
    if (user) await this.auth.logout(user.id, token);
    res.clearCookie('auth_ok');
    return res.status(204).send();
  }

  @Get('me')
  getMe(@CurrentUser() user: any) {
    return this.auth.getMe(user.id);
  }
}
`);

// ─── auth.module.ts ───────────────────────────────────────────
write('src/auth/auth.module.ts', `import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { TokenService } from './token.service';
import { RbacService } from './rbac/rbac.service';
import { JwtAccessStrategy } from './strategies/jwt.strategies';
import { JwtAuthGuard } from './guards/index';
import { RbacGuard } from './guards/index';
import { PrismaModule } from '../prisma/prisma.module';

@Global()
@Module({
  imports: [
    PrismaModule,
    PassportModule,
    JwtModule.register({}),
  ],
  controllers: [AuthController],
  providers: [
    AuthService, TokenService, RbacService,
    JwtAccessStrategy, JwtAuthGuard, RbacGuard,
  ],
  exports: [AuthService, TokenService, RbacService, JwtAuthGuard, RbacGuard, JwtModule],
})
export class AuthModule {}
`);

// ─── session.service.ts ───────────────────────────────────────
write('src/auth/session.service.ts', `import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SessionService {
  constructor(private readonly prisma: PrismaService) {}

  async getUserSessions(userId: string) {
    return this.prisma.session.findMany({
      where: { userId, expiresAt: { gt: new Date() } },
      select: { id: true, deviceName: true, ipAddress: true, createdAt: true, expiresAt: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async revokeSession(sessionId: string, userId: string) {
    await this.prisma.session.deleteMany({ where: { id: sessionId, userId } });
  }

  async revokeAllSessions(userId: string) {
    await this.prisma.session.deleteMany({ where: { userId } });
  }
}
`);

// ─── app.module.ts (updated with AuthModule) ─────────────────
write('src/app.module.ts', `import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { JwtAuthGuard } from './auth/guards/index';

@Module({
  imports: [PrismaModule, AuthModule],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
`);

// ─── health controller ────────────────────────────────────────
write('src/health/health.controller.ts', `import { Controller, Get } from '@nestjs/common';
import { Public } from '../auth/decorators/index';

@Controller()
export class HealthController {
  @Public()
  @Get('health')
  health() { return { status: 'ok', timestamp: new Date().toISOString() }; }

  @Public()
  @Get()
  root() { return { error: 'Route not found' }; }
}
`);

write('src/health/health.module.ts', `import { Module } from '@nestjs/common';
import { HealthController } from './health.controller';

@Module({ controllers: [HealthController] })
export class HealthModule {}
`);

// ─── Update app.module.ts with HealthModule ───────────────────
write('src/app.module.ts', `import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { HealthModule } from './health/health.module';
import { JwtAuthGuard } from './auth/guards/index';

@Module({
  imports: [PrismaModule, AuthModule, HealthModule],
  providers: [
    { provide: APP_GUARD, useClass: JwtAuthGuard },
  ],
})
export class AppModule {}
`);

console.log('\\n✅ All auth files created successfully');
