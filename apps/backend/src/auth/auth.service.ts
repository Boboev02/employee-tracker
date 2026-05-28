import { Injectable, UnauthorizedException, BadRequestException, Logger, ConflictException } from '@nestjs/common';
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
    } else if ((dto as any).orgId) {
      orgId = (dto as any).orgId;
    } else {
      const org = await this.prisma.organisation.findFirst({ orderBy: { createdAt: 'asc' } });
      if (!org) {
        const newOrg = await this.prisma.organisation.create({ data: { name: 'Default' } });
        orgId = newOrg.id;
      } else {
        orgId = org.id;
      }
    }

    const hash = await bcrypt.hash(dto.password, 12);
    // First user in org gets ADMIN, rest get EMPLOYEE
    const userCount = await this.prisma.user.count({ where: { orgId } });
    const roleName = (dto.orgName || userCount === 0) ? 'ADMIN' : 'EMPLOYEE';
    let role = await this.prisma.role.findUnique({ where: { name: roleName } });
    if (!role) role = await this.prisma.role.create({ data: { name: roleName, permissions: [] } });

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
      sub: user.id, email: user.email, orgId: user.orgId, roles,
    });
    const refreshToken = this.tokens.generateRefreshToken({
      sub: user.id, email: user.email, orgId: user.orgId, roles,
    });

    // Очищаем истёкшие сессии перед созданием новой
    await this.prisma.session.deleteMany({
      where: { userId: user.id, expiresAt: { lt: new Date() } }
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
      expiresIn: 86400,
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
