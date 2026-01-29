/**
 * UAT Guard Middleware - WI-066: UAT Harness + Seed + Safety
 *
 * NestJS guard that enforces UAT safety boundaries throughout the API.
 * Blocks production corruption and ensures tenant isolation.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuditService } from '../audit/audit.service';
import { UatGuardService, getUatConfig } from '@neuronx/uat-harness';
import { UatContext, UatAuditEvent } from '@neuronx/uat-harness';

/**
 * UAT guard for protecting API endpoints
 *
 * Applied to controllers/routes that perform external execution or data modification.
 * Ensures UAT safety boundaries are respected.
 */
@Injectable()
export class UatGuard implements CanActivate {
  private readonly logger = new Logger(UatGuard.name);
  private readonly guardService: UatGuardService;

  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService
  ) {
    this.guardService = new UatGuardService();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const config = getUatConfig();

    // Extract tenant and correlation context
    const tenantId = this.extractTenantId(request);
    const correlationId = this.extractCorrelationId(request);

    if (!tenantId) {
      throw new ForbiddenException('Tenant ID required for UAT safety checks');
    }

    const uatContext: UatContext = {
      config,
      tenantId,
      correlationId:
        correlationId ||
        `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
    };

    // Perform UAT safety check
    const guardResult = this.guardService.checkOperationAllowed(uatContext);

    // Create durable audit event
    await this.auditService.logEvent(
      guardResult.allowed
        ? 'uat_guard_check_allowed'
        : 'uat_guard_check_blocked',
      {
        endpoint: `${request.method} ${request.url}`,
        guardResult,
        userAgent: request.headers['user-agent'],
        ip: request.ip || request.connection?.remoteAddress,
        environment: config.neuronxEnv,
        uatMode: config.uatMode,
        killSwitchActive: config.uatKillSwitch,
        tenantAllowed: guardResult.allowed,
        blockReason: guardResult.reason,
        isDryRun: guardResult.mode === 'dry_run',
      },
      'uat-guard',
      tenantId
    );

    // Log to console for debugging
    this.logger.log(
      `UAT Guard Check: ${guardResult.allowed ? 'ALLOWED' : 'BLOCKED'} - ${tenantId} - ${uatContext.correlationId}`
    );

    // Block if not allowed
    if (!guardResult.allowed) {
      throw new ForbiddenException({
        message: 'UAT Safety Violation',
        reason: guardResult.reason,
        environment: config.neuronxEnv,
        tenantId,
        correlationId: uatContext.correlationId,
      });
    }

    // Attach UAT context to request for downstream use
    request.uatContext = uatContext;
    request.uatGuardResult = guardResult;

    return true;
  }

  /**
   * Extract tenant ID from request
   * Looks in headers, query params, or auth context
   */
  private extractTenantId(request: any): string | null {
    // Check headers first
    const tenantHeader =
      request.headers['x-tenant-id'] || request.headers['tenant-id'];
    if (tenantHeader) return tenantHeader;

    // Check query params
    if (request.query?.tenantId) return request.query.tenantId;

    // Check auth context (if available)
    if (request.user?.tenantId) return request.user.tenantId;

    // Check path params
    if (request.params?.tenantId) return request.params.tenantId;

    return null;
  }

  /**
   * Extract correlation ID from request
   * Generates one if not present
   */
  private extractCorrelationId(request: any): string | null {
    // Check headers
    const correlationHeader =
      request.headers['x-correlation-id'] ||
      request.headers['correlation-id'] ||
      request.headers['x-request-id'];

    if (correlationHeader) return correlationHeader;

    // Check query params
    if (request.query?.correlationId) return request.query.correlationId;

    return null;
  }
}

/**
 * Decorator to mark endpoints that require UAT protection
 * Use on controllers or specific routes
 */
export const RequireUatSafety = Reflect.createDecorator<string>({
  key: 'uat-safety-required',
  transformer: (value: string = 'default') => value,
});

/**
 * Decorator to specify UAT execution mode requirement
 * Use on controllers or specific routes
 */
export const RequireUatMode = (mode: 'dry_run' | 'live_uat') =>
  Reflect.createDecorator<string>({
    key: 'uat-mode-required',
    transformer: () => mode,
  });
