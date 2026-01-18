/**
 * Admin Guard - WI-022: Access Control & API Key Governance
 *
 * Authenticates admin users via Bearer tokens and sets up actor context.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { PERMISSIONS, AdminActor } from './authz.types';

@Injectable()
export class AdminGuard implements CanActivate {
  private readonly logger = new Logger(AdminGuard.name);

  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();

    // Check for Bearer token
    const authHeader = request.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ForbiddenException('Admin authentication required');
    }

    // Extract token (in production, validate JWT)
    const token = authHeader.substring(7); // Remove 'Bearer ' prefix

    // TODO: In production, validate JWT token and extract user information
    // For now, accept any Bearer token as valid admin (stub implementation)
    if (!token || token.length < 10) {
      throw new ForbiddenException('Invalid admin token');
    }

    // Extract tenant from headers (stub - in production from JWT)
    const tenantId = request.headers['x-tenant-id'] || 'default-tenant';
    const userId = 'admin-user'; // Stub - in production from JWT

    // Create admin actor with full permissions
    const actor: AdminActor = {
      type: 'admin',
      id: userId,
      tenantId,
      roleIds: ['TenantAdmin'], // Admin role
      permissions: [PERMISSIONS.ADMIN_ALL], // All permissions
      correlationId:
        request.correlationId ||
        `admin-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      userId,
    };

    // Set request context
    request.tenantId = tenantId;
    request.actor = actor;

    this.logger.debug('Admin authentication successful', {
      tenantId,
      userId,
      path: request.path,
      correlationId: actor.correlationId,
    });

    return true;
  }
}
