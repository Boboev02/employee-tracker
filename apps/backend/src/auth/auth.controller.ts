import { Controller, Post, Get, Body, Req, Res, HttpCode, UnauthorizedException, Logger } from '@nestjs/common';
import { Request, Response } from 'express';
import { AuthService }   from './auth.service';
import { TokenService }  from './token.service';
import { Public, CurrentUser } from './decorators/index';
import { AuditService } from '../audit/audit.service';

@Controller('api/v1/auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);
  constructor(
    private readonly auth:   AuthService,
    private readonly tokens: TokenService,
    private readonly audit:  AuditService,
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
    try {
      const result = await this.auth.login(body.email, body.password, req.ip, req.headers['user-agent']);
      this.audit.log({
        orgId: result.user?.orgId,
        userId: result.user?.id,
        userName: result.user?.name ?? body.email,
        action: 'login',
        category: 'auth',
        details: { email: body.email },
        ipAddress: req.ip,
        userAgent: req.headers['user-agent'] as string,
      });
      return res.json(result);
    } catch (e: any) {
      const status = e?.status ?? 500;
      const message = e?.message ?? 'Internal server error';
      this.logger?.error?.('[login]', e);
      return res.status(status).json({ error: true, message });
    }
  }

  // Extension refresh — accepts expired access token
  @Public()
  @Post('refresh-extension')
  async refreshExtension(@Req() req: any) {
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) throw new UnauthorizedException('No token');
    const result = await this.auth.refreshExpiredToken(token);
    if (!result) throw new UnauthorizedException('Invalid token');
    return result;
  }

  // Old refresh (requires valid access token)
  @Post('refresh')
  @HttpCode(200)
  async refresh(@CurrentUser() user: any) {
    const accessToken = this.tokens.generateAccessToken({
      sub: user.id ?? user.sub, email: user.email, orgId: user.orgId, roles: user.roles,
    });
    return { accessToken, expiresIn: 900 };
  }

  @Post('logout')
  @HttpCode(204)
  async logout(@Req() req: Request, @Res() res: Response) {
    const user = (req as any).user;
    const token = req.headers.authorization?.slice(7) ?? '';
    if (user) {
      await this.auth.logout(user.id ?? user.sub, token);
      this.audit.log({
        orgId: user.orgId,
        userId: user.id ?? user.sub,
        userName: user.name ?? user.email,
        action: 'logout',
        category: 'auth',
        ipAddress: req.ip,
      });
    }
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
