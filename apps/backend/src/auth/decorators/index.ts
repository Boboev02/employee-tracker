import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';

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
