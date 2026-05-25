import {
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
      // Reload permissions from roles in token
      const roles = payload.roles ?? [];
      payload.permissions = resolvePermissions(roles);
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

    // OR logic: user needs at least ONE of the required permissions
    const hasAll = required.some(p => user.permissions?.has(p));
    if (!hasAll) throw new ForbiddenException('Insufficient permissions');
    return true;
  }
}
