/**
 * Authentication Guard - WI-022: Access Control & API Key Governance
 *
 * Composite guard that supports both Admin Bearer tokens and API keys.
 * Fail-closed: requires authentication via one of the supported methods.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
} from '@nestjs/common';
import { ApiKeyGuard } from './api-key.guard';
import { AdminGuard } from './admin.guard';
import { PrincipalExtractorService, PrincipalContext } from './principal';

@Injectable()
export class AuthGuard implements CanActivate {
  private readonly logger = new Logger(AuthGuard.name);

  constructor(
    private readonly apiKeyGuard: ApiKeyGuard,
    private readonly adminGuard: AdminGuard,
    private readonly principalExtractor: PrincipalExtractorService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Try API key authentication first (more specific)
    try {
      const apiKeyResult = await this.apiKeyGuard.canActivate(context);
      if (apiKeyResult) {
        // Extract and set principal on request
        try {
          const { principal } = await this.principalExtractor.extract(request);
          PrincipalContext.setPrincipal(request, principal);
        } catch (error) {
          this.logger.error('Failed to extract principal after API key auth', {
            error: error.message,
            tenantId: request.tenantId,
            path: request.path,
          });
          return false;
        }

        this.logger.debug('Authenticated via API key', {
          tenantId: request.tenantId,
          actorType: request.actor?.type,
          userId: request.principal?.userId,
          path: request.path,
        });
        return true;
      }
    } catch (error) {
      // API key auth failed, try admin auth
      this.logger.debug('API key authentication failed, trying admin auth', {
        error: error.message,
        path: request.path,
      });
    }

    // Try admin bearer token authentication
    try {
      const adminResult = await this.adminGuard.canActivate(context);
      if (adminResult) {
        // Extract and set principal on request
        try {
          const { principal } = await this.principalExtractor.extract(request);
          PrincipalContext.setPrincipal(request, principal);
        } catch (error) {
          this.logger.error('Failed to extract principal after admin auth', {
            error: error.message,
            tenantId: request.tenantId,
            path: request.path,
          });
          return false;
        }

        this.logger.debug('Authenticated via admin token', {
          tenantId: request.tenantId,
          actorType: request.actor?.type,
          userId: request.principal?.userId,
          path: request.path,
        });
        return true;
      }
    } catch (error) {
      this.logger.debug('Admin authentication failed', {
        error: error.message,
        path: request.path,
      });
    }

    // Both authentication methods failed - fail closed
    this.logger.warn('All authentication methods failed', {
      path: request.path,
      method: request.method,
      hasApiKey: !!this.extractApiKey(request),
      hasBearerToken: !!this.extractBearerToken(request),
      correlationId: request.correlationId,
    });

    return false;
  }

  private extractApiKey(request: any): boolean {
    return !!(
      request.headers['x-api-key'] ||
      (request.headers.authorization &&
        request.headers.authorization.match(/^ApiKey\s+/i))
    );
  }

  private extractBearerToken(request: any): boolean {
    return !!(
      request.headers.authorization &&
      request.headers.authorization.startsWith('Bearer ')
    );
  }
}
