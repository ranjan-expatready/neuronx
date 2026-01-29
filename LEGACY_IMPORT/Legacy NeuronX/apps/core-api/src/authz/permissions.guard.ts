/**
 * Permissions Guard - WI-022: Access Control & API Key Governance
 *
 * Enforces permission requirements declared via @RequirePermissions decorator.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request } from 'express';
import {
  Permission,
  REQUIRE_PERMISSIONS_METADATA,
  InsufficientPermissionsError,
} from './authz.types';
import { authzMetrics } from '../observability/metrics';

@Injectable()
export class PermissionsGuard implements CanActivate {
  private readonly logger = new Logger(PermissionsGuard.name);

  constructor(private reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const request: Request = context.switchToHttp().getRequest();
    const requiredPermissions = this.getRequiredPermissions(context);

    // No permissions required
    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    // Check if user is authenticated and has actor context
    const actor = request.actor;
    if (!actor) {
      this.logger.warn('No actor context found in request', {
        path: request.path,
        method: request.method,
        correlationId: request.correlationId,
      });
      throw new InsufficientPermissionsError(requiredPermissions, []);
    }

    // Check if actor has all required permissions
    const hasAllPermissions = requiredPermissions.every(permission =>
      actor.permissions.includes(permission)
    );

    if (!hasAllPermissions) {
      // Record permission denial metrics
      authzMetrics.permissionDeniedTotal.inc();

      this.logger.warn('Insufficient permissions for request', {
        tenantId: actor.tenantId,
        actorId: actor.id,
        actorType: actor.type,
        required: requiredPermissions,
        actual: actor.permissions,
        path: request.path,
        method: request.method,
        correlationId: actor.correlationId,
      });

      // TODO: Log to audit service (fire-and-forget for denied permissions)
      // await this.auditService.logDeniedPermission(actor, requiredPermissions, request);

      throw new InsufficientPermissionsError(
        requiredPermissions,
        actor.permissions
      );
    }

    this.logger.debug('Permissions check passed', {
      tenantId: actor.tenantId,
      actorId: actor.id,
      required: requiredPermissions,
      path: request.path,
      correlationId: actor.correlationId,
    });

    return true;
  }

  private getRequiredPermissions(
    context: ExecutionContext
  ): Permission[] | undefined {
    // Check method-level decorator first
    const methodPermissions = this.reflector.get<Permission[]>(
      REQUIRE_PERMISSIONS_METADATA,
      context.getHandler()
    );

    if (methodPermissions !== undefined) {
      return methodPermissions;
    }

    // Check class-level decorator
    const classPermissions = this.reflector.get<Permission[]>(
      REQUIRE_PERMISSIONS_METADATA,
      context.getClass()
    );

    return classPermissions;
  }
}
