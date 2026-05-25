export interface JwtPayload {
  sub: string;
  email: string;
  orgId: string;
  jti: string;
  iat?: number;
  exp?: number;
}

export interface AuthenticatedUser {
  id: string;
  email: string;
  orgId: string;
  roles: string[];
  managedTeamIds: string[];
  sessionId: string;
  jti: string;
  permissions: Set<string>;
}

export const TOKEN_CONFIG = {
  ACCESS_EXPIRES:  '15m',
  REFRESH_EXPIRES: '7d',
} as const;

export const REDIS_KEYS = {
  jtiValidated: (jti: string) => `jwt:ok:${jti}`,
  rbacPerms:    (uid: string) => `rbac:perms:${uid}`,
} as const;
