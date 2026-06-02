import { Controller, Post, Get, Body, Req, Res, HttpCode, UnauthorizedException } from '@nestjs/common';
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

  // Extension refresh — accepts expired access token
  @Public()
  @Post('refresh-extension')
  async refreshExtension(@Req() req: any) {
    const authHeader = req.headers['authorization'] ?? '';
    const token = authHeader.replace('Bearer ', '').trim();
    if (!token) throw new UnauthorizedException('No token');
    try {
      const payload = this.auth['tokens'].verifyAccessTokenIgnoreExpiry(token);
      if (!payload?.sub) throw new UnauthorizedException();
      const user = await this.auth['prisma'].user.findUnique({
        where: { id: payload.sub },
        include: { userRoles: { include: { role: true } } },
      });
      if (!user || user.deletedAt) throw new UnauthorizedException();
      const roles = user.userRoles.map((ur: any) => ur.role.name);
      const accessToken = this.auth['tokens'].generateAccessToken({
        sub: user.id, email: user.email, orgId: user.orgId, roles,
      });
      return { accessToken, expiresIn: 86400 };
    } catch(e) {
      throw new UnauthorizedException('Invalid token');
    }
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
