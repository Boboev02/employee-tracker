import { Injectable } from '@nestjs/common';
import { resolvePermissions, type Permission } from './permissions.matrix';
import type { AuthenticatedUser } from '../auth.types';

@Injectable()
export class RbacService {
  checkPermissions(user: AuthenticatedUser, required: Permission[]): boolean {
    return required.every(p => user.permissions.has(p));
  }

  checkAnyPermission(user: AuthenticatedUser, required: Permission[]): boolean {
    return required.some(p => user.permissions.has(p));
  }

  buildPermissions(roles: string[]): Set<Permission> {
    return resolvePermissions(roles);
  }
}
