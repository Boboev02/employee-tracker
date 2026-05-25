import { Module, Global } from '@nestjs/common';
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
