/**
 * Capability Guard - WI-035: Tenant & Organization Authority Model
 *
 * Guard that enforces capability requirements on endpoints.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { OrgAuthorityService } from './org-authority.service';
import { Capability, REQUIRE_CAPABILITY } from './require-capability.decorator';

@Injectable()
export class CapabilityGuard implements CanActivate {
  private readonly logger = new Logger(CapabilityGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly orgAuthorityService: OrgAuthorityService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredCapabilities = this.reflector.getAllAndOverride<Capability[]>(
      REQUIRE_CAPABILITY,
      [context.getHandler(), context.getClass()]
    );

    if (!requiredCapabilities || requiredCapabilities.length === 0) {
      return true; // No capability requirements
    }

    const request = context.switchToHttp().getRequest();
    const userId = this.extractUserId(request); // TODO: Implement proper user extraction

    if (!userId) {
      this.logger.warn('No user ID found in request for capability check');
      return false;
    }

    try {
      // Check each required capability
      for (const capability of requiredCapabilities) {
        await this.orgAuthorityService.requireCapability(userId, capability);
      }

      this.logger.log(
        `Capability check passed for user ${userId}: ${requiredCapabilities.join(', ')}`
      );
      return true;
    } catch (error) {
      this.logger.warn(
        `Capability check failed for user ${userId}: ${error.message}`,
        {
          requiredCapabilities,
          userId,
        }
      );
      return false;
    }
  }

  /**
   * Extract user ID from request
   * TODO: Implement proper user identity extraction from auth context
   */
  private extractUserId(request: any): string | null {
    // For now, try to extract from various possible locations
    // This needs to be updated based on actual auth implementation

    // Try header
    if (request.headers?.['x-user-id']) {
      return request.headers['x-user-id'];
    }

    // Try from actor if available
    if (request.actor?.userId) {
      return request.actor.userId;
    }

    // Try from user object
    if (request.user?.id) {
      return request.user.id;
    }

    // Fallback for development/testing
    if (
      process.env.NODE_ENV !== 'production' &&
      request.headers?.['x-test-user-id']
    ) {
      return request.headers['x-test-user-id'];
    }

    return null;
  }
}
