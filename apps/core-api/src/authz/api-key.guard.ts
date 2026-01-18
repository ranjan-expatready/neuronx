/**
 * API Key Guard - WI-022: Access Control & API Key Governance
 *
 * Authenticates requests using API keys from X-API-Key header.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  Logger,
  Inject,
} from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import {
  ApiKeyActor,
  InvalidApiKeyError,
  RevokedApiKeyError,
} from './authz.types';
import { authzMetrics } from '../observability/metrics';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  private readonly logger = new Logger(ApiKeyGuard.name);

  constructor(
    @Inject(ApiKeyService)
    private readonly apiKeyService: ApiKeyService
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();

    // Extract API key from headers
    const apiKey = this.extractApiKey(request);
    if (!apiKey) {
      this.logger.debug('No API key found in request', {
        path: request.path,
        method: request.method,
        headers: Object.keys(request.headers).filter(
          h =>
            h.toLowerCase().includes('api') || h.toLowerCase().includes('auth')
        ),
      });
      return false; // Let composite guard handle other auth methods
    }

    try {
      // Validate API key and get actor context
      const actor = await this.apiKeyService.validateApiKey(apiKey);

      // Set request context
      request.tenantId = actor.tenantId;
      request.actor = actor;
      request.correlationId = actor.correlationId;

      // Update last used timestamp (fire-and-forget)
      this.apiKeyService.updateLastUsed(actor.id).catch(error => {
        this.logger.warn('Failed to update API key last used timestamp', {
          apiKeyId: actor.id,
          error: error.message,
        });
      });

      // Record success metrics
      authzMetrics.successTotal.inc();

      this.logger.debug('API key authentication successful', {
        tenantId: actor.tenantId,
        apiKeyId: actor.id,
        fingerprint: actor.fingerprint,
        path: request.path,
        correlationId: actor.correlationId,
      });

      return true;
    } catch (error) {
      // Record failure metrics
      if (error instanceof InvalidApiKeyError) {
        authzMetrics.invalidApiKeyTotal.inc();
      }

      this.logger.warn('API key authentication failed', {
        error: error.message,
        path: request.path,
        method: request.method,
        correlationId: request.correlationId,
      });

      // Re-throw specific auth errors
      if (
        error instanceof InvalidApiKeyError ||
        error instanceof RevokedApiKeyError
      ) {
        throw error;
      }

      // For other errors, treat as invalid key
      throw new InvalidApiKeyError();
    }
  }

  private extractApiKey(request: any): string | null {
    // Check X-API-Key header (preferred)
    const apiKeyHeader = request.headers['x-api-key'];
    if (apiKeyHeader && typeof apiKeyHeader === 'string') {
      return apiKeyHeader.trim();
    }

    // Check Authorization header for ApiKey scheme
    const authHeader = request.headers.authorization;
    if (authHeader && typeof authHeader === 'string') {
      const match = authHeader.match(/^ApiKey\s+(.+)$/i);
      if (match) {
        return match[1].trim();
      }
    }

    return null;
  }
}
