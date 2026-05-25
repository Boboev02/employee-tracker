import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { resolvePermissions } from '../rbac/permissions.matrix';

@Injectable()
export class JwtAccessStrategy extends PassportStrategy(Strategy, 'jwt-access') {
  constructor(private readonly prisma: PrismaService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: process.env.JWT_ACCESS_SECRET ?? 'dev-secret',
      ignoreExpiration: false,
    });
  }

  async validate(payload: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      include: { userRoles: { include: { role: true } } },
    });

    if (!user || user.deletedAt) throw new UnauthorizedException();

    const roles = user.userRoles.map((ur: any) => ur.role.name);
    const permissions = resolvePermissions(roles);

    return {
      id: user.id,
      email: user.email,
      orgId: user.orgId,
      roles,
      permissions,
      sessionId: payload.jti,
      jti: payload.jti,
      managedTeamIds: [],
    };
  }
}
