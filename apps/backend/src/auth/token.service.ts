import { Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { randomUUID } from 'crypto';
import type { JwtPayload } from './auth.types';

@Injectable()
export class TokenService {
  constructor(private readonly jwt: JwtService) {}

  generateAccessToken(payload: Omit<JwtPayload, 'jti'> & { roles?: string[] }): string {
    return this.jwt.sign(
      { ...payload, jti: randomUUID() },
      { secret: process.env.JWT_ACCESS_SECRET, expiresIn: '7d' },
    );
  }

  generateRefreshToken(payload: Omit<JwtPayload, 'jti'> & { roles?: string[] }): string {
    return this.jwt.sign(
      { ...payload, jti: randomUUID() },
      { secret: process.env.JWT_REFRESH_SECRET, expiresIn: '7d' },
    );
  }

  verifyAccessToken(token: string): JwtPayload {
    return this.jwt.verify(token, { secret: process.env.JWT_ACCESS_SECRET });
  }

  verifyRefreshToken(token: string): JwtPayload {
    return this.jwt.verify(token, { secret: process.env.JWT_REFRESH_SECRET });
  }

  verifyAccessTokenIgnoreExpiry(token: string): JwtPayload {
    return this.jwt.verify(token, {
      secret: process.env.JWT_ACCESS_SECRET,
      ignoreExpiration: true,
    });
  }
}
