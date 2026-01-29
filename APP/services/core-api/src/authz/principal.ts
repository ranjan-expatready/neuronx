/**
 * Principal Model - WI-036: Production Identity & Principal Model
 *
 * Defines the authenticated principal shape for NeuronX operations.
 * Provides clean abstraction over different auth methods (API keys, admin tokens).
 */

import { RequestActor, AdminActor, ApiKeyActor } from './authz.types';

/**
 * Principal represents an authenticated entity in NeuronX
 * This is the stable identity model used throughout the application
 */
export interface Principal {
  /** Tenant this principal belongs to */
  tenantId: string;

  /** Stable user identifier (from auth system) */
  userId: string;

  /** Link to org member if exists (for org authority) */
  memberId?: string;

  /** Authentication method used */
  authType: 'api_key' | 'admin_token' | 'service_account';

  /** Display name for logging/auditing */
  displayName?: string;

  /** Email for notifications/auditing */
  email?: string;

  /** Correlation ID for request tracing */
  correlationId: string;

  /** Additional metadata from auth system */
  metadata?: Record<string, any>;
}

/**
 * Principal extraction result
 */
export interface PrincipalExtractionResult {
  principal: Principal;
  actor: RequestActor;
}

/**
 * Principal extraction error
 */
export class PrincipalExtractionError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 401
  ) {
    super(message);
    this.name = 'PrincipalExtractionError';
  }
}

/**
 * Principal extractor interface
 */
export interface PrincipalExtractor {
  /**
   * Extract principal from request
   * @throws PrincipalExtractionError if extraction fails
   */
  extract(request: any): Promise<PrincipalExtractionResult>;
}

/**
 * Default principal extractor implementation
 */
export class DefaultPrincipalExtractor implements PrincipalExtractor {
  async extract(request: any): Promise<PrincipalExtractionResult> {
    // Get actor from request (set by guards)
    const actor = request.actor as RequestActor;
    if (!actor) {
      throw new PrincipalExtractionError(
        'No actor found in request - authentication required',
        'MISSING_ACTOR'
      );
    }

    // Extract principal based on actor type
    let principal: Principal;

    switch (actor.type) {
      case 'admin':
        principal = this.extractFromAdminActor(actor as AdminActor);
        break;

      case 'apikey':
        principal = this.extractFromApiKeyActor(actor as ApiKeyActor);
        break;

      default:
        throw new PrincipalExtractionError(
          `Unsupported actor type: ${actor.type}`,
          'UNSUPPORTED_ACTOR_TYPE'
        );
    }

    return { principal, actor };
  }

  private extractFromAdminActor(actor: AdminActor): Principal {
    return {
      tenantId: actor.tenantId,
      userId: actor.userId,
      authType: 'admin_token',
      displayName: `Admin ${actor.userId}`,
      correlationId: actor.correlationId,
      metadata: {
        actorType: 'admin',
        roleIds: actor.roleIds,
        permissions: actor.permissions,
      },
    };
  }

  private extractFromApiKeyActor(actor: ApiKeyActor): Principal {
    return {
      tenantId: actor.tenantId,
      userId: actor.id, // API key ID as user identifier
      authType: 'api_key',
      displayName: `API Key ${actor.apiKeyName}`,
      correlationId: actor.correlationId,
      metadata: {
        actorType: 'apikey',
        apiKeyName: actor.apiKeyName,
        fingerprint: actor.fingerprint,
        roleIds: actor.roleIds,
        permissions: actor.permissions,
      },
    };
  }
}

/**
 * Principal context utilities
 */
export class PrincipalContext {
  /**
   * Get principal from request (convenience method)
   */
  static async getPrincipal(request: any): Promise<Principal> {
    const extractor = new DefaultPrincipalExtractor();
    const result = await extractor.extract(request);
    return result.principal;
  }

  /**
   * Set principal on request for downstream use
   */
  static setPrincipal(request: any, principal: Principal): void {
    request.principal = principal;
  }

  /**
   * Get principal from request (after it's been set)
   */
  static getPrincipalFromRequest(request: any): Principal | null {
    return request.principal || null;
  }

  /**
   * Assert principal exists on request
   */
  static requirePrincipal(request: any): Principal {
    const principal = this.getPrincipalFromRequest(request);
    if (!principal) {
      throw new PrincipalExtractionError(
        'Principal not found in request context',
        'MISSING_PRINCIPAL'
      );
    }
    return principal;
  }
}
