/**
 * Global UAT Boundary Guard - STOP-SHIP Hardening Patch
 *
 * Implements earliest HTTP boundary enforcement for UAT/dry_run safety.
 * Runs before all routes to prevent UAT bypass via non-/uat endpoints.
 * Ensures production safety and UAT tenant isolation.
 */

import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { AuditService } from '../audit/audit.service';
import { getUatConfig } from '@neuronx/uat-harness';

/**
 * Global UAT boundary guard that runs for ALL HTTP requests
 *
 * Enforces UAT safety at the earliest possible point in the request lifecycle.
 * Blocks production corruption and ensures tenant isolation across all routes.
 */
@Injectable()
export class GlobalUatBoundaryGuard implements CanActivate {
  private readonly logger = new Logger(GlobalUatBoundaryGuard.name);

  constructor(private readonly auditService: AuditService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const config = getUatConfig();

    // Extract request context
    const tenantId = this.extractTenantId(request);
    const correlationId = this.extractCorrelationId(request);
    const uatSignalsPresent = this.detectUatSignals(request);

    // Determine final correlation ID (generate if needed, but don't mutate response)
    const finalCorrelationId =
      correlationId ||
      `uat_boundary_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // PRODUCTION ENVIRONMENT: Block any UAT signals
    if (config.neuronxEnv !== 'uat') {
      if (uatSignalsPresent) {
        await this.auditService.logEvent(
          'uat_boundary_blocked_prod',
          {
            reason: 'UAT signals detected in production environment',
            uatSignals: uatSignalsPresent,
            endpoint: `${request.method} ${request.url}`,
            userAgent: request.headers['user-agent'],
            ip: request.ip || request.connection?.remoteAddress,
            environment: config.neuronxEnv,
            correlationId: finalCorrelationId,
          },
          'uat-boundary-guard',
          tenantId || 'unknown'
        );

        this.logger.warn(
          `UAT BOUNDARY BLOCKED (PROD): ${finalCorrelationId} - UAT signals in production`
        );

        throw new ForbiddenException({
          message: 'UAT Safety Violation - Production Environment',
          reason: 'UAT signals cannot be processed in production environment',
          environment: config.neuronxEnv,
          correlationId: finalCorrelationId,
        });
      }

      // No UAT signals in production - allow request
      return true;
    }

    // UAT ENVIRONMENT: Enforce strict tenant and mode controls
    if (config.neuronxEnv === 'uat') {
      // 1. Check tenant allowlist
      if (!tenantId || !config.uatTenantIds.includes(tenantId)) {
        await this.auditService.logEvent(
          'uat_boundary_blocked_not_allowlisted',
          {
            reason: 'Tenant not in UAT allowlist',
            tenantId,
            allowedTenants: config.uatTenantIds,
            endpoint: `${request.method} ${request.url}`,
            userAgent: request.headers['user-agent'],
            ip: request.ip || request.connection?.remoteAddress,
            environment: config.neuronxEnv,
            correlationId: finalCorrelationId,
          },
          'uat-boundary-guard',
          tenantId || 'unknown'
        );

        this.logger.warn(
          `UAT BOUNDARY BLOCKED (TENANT): ${finalCorrelationId} - ${tenantId} not allowlisted`
        );

        throw new ForbiddenException({
          message: 'UAT Safety Violation - Tenant Not Allowlisted',
          reason: `Tenant ${tenantId} is not authorized for UAT operations`,
          environment: config.neuronxEnv,
          tenantId,
          correlationId: finalCorrelationId,
        });
      }

      // 2. Enforce UAT mode restrictions
      const requestedMode = this.extractUatMode(request);

      // Allow dry_run always
      if (config.uatMode === 'dry_run' || requestedMode === 'dry_run') {
        await this.auditService.logEvent(
          'uat_boundary_allowed',
          {
            mode: 'dry_run',
            tenantId,
            endpoint: `${request.method} ${request.url}`,
            environment: config.neuronxEnv,
            uatMode: config.uatMode,
            correlationId: finalCorrelationId,
          },
          'uat-boundary-guard',
          tenantId
        );

        this.logger.log(
          `UAT BOUNDARY ALLOWED: ${finalCorrelationId} - ${tenantId} in dry_run mode`
        );
        return true;
      }

      // Check live_uat requirements
      if (config.uatMode === 'live_uat' && requestedMode === 'live_uat') {
        // Additional LIVE_UAT checks would go here if needed
        // For now, allow if explicitly configured

        await this.auditService.logEvent(
          'uat_boundary_allowed',
          {
            mode: 'live_uat',
            tenantId,
            endpoint: `${request.method} ${request.url}`,
            environment: config.neuronxEnv,
            uatMode: config.uatMode,
            correlationId: finalCorrelationId,
          },
          'uat-boundary-guard',
          tenantId
        );

        this.logger.log(
          `UAT BOUNDARY ALLOWED: ${finalCorrelationId} - ${tenantId} in live_uat mode`
        );
        return true;
      }

      // Block live_uat if not properly configured
      if (requestedMode === 'live_uat' && config.uatMode !== 'live_uat') {
        await this.auditService.logEvent(
          'uat_boundary_blocked_live_not_enabled',
          {
            reason: 'LIVE_UAT mode requested but not enabled in configuration',
            requestedMode,
            configMode: config.uatMode,
            tenantId,
            endpoint: `${request.method} ${request.url}`,
            environment: config.neuronxEnv,
            correlationId: finalCorrelationId,
          },
          'uat-boundary-guard',
          tenantId
        );

        this.logger.warn(
          `UAT BOUNDARY BLOCKED (LIVE_UAT): ${finalCorrelationId} - ${tenantId} requested live_uat`
        );

        throw new ForbiddenException({
          message: 'UAT Safety Violation - LIVE_UAT Not Enabled',
          reason: 'LIVE_UAT mode is not enabled in current configuration',
          environment: config.neuronxEnv,
          tenantId,
          correlationId: finalCorrelationId,
        });
      }

      // Default block for any other mode violations
      await this.auditService.logEvent(
        'uat_boundary_blocked_mode_violation',
        {
          reason: 'UAT mode violation',
          requestedMode,
          configMode: config.uatMode,
          tenantId,
          endpoint: `${request.method} ${request.url}`,
          environment: config.neuronxEnv,
          correlationId: finalCorrelationId,
        },
        'uat-boundary-guard',
        tenantId
      );

      this.logger.warn(
        `UAT BOUNDARY BLOCKED (MODE): ${finalCorrelationId} - ${tenantId} mode violation`
      );

      throw new ForbiddenException({
        message: 'UAT Safety Violation - Mode Not Allowed',
        reason: `Requested mode ${requestedMode} not allowed in current configuration`,
        environment: config.neuronxEnv,
        tenantId,
        correlationId: finalCorrelationId,
      });
    }

    // Should not reach here, but allow by default for safety
    this.logger.warn(
      `UAT BOUNDARY: Unexpected environment ${config.neuronxEnv}, allowing request`
    );
    return true;
  }

  /**
   * Extract tenant ID from request headers, query, or path
   */
  private extractTenantId(request: any): string | null {
    // Check headers first
    const tenantHeader =
      request.headers['x-tenant-id'] || request.headers['tenant-id'];
    if (tenantHeader) return tenantHeader;

    // Check query params
    if (request.query?.tenantId) return request.query.tenantId;

    // Check path params
    if (request.params?.tenantId) return request.params.tenantId;

    // Check auth context (if available)
    if (request.user?.tenantId) return request.user.tenantId;

    return null;
  }

  /**
   * Extract correlation ID from request headers or query
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

  /**
   * Extract requested UAT mode from request
   */
  private extractUatMode(request: any): 'dry_run' | 'live_uat' | null {
    // Check headers
    const modeHeader =
      request.headers['x-uat-mode'] || request.headers['uat-mode'];
    if (modeHeader) {
      if (modeHeader === 'dry_run' || modeHeader === 'live_uat') {
        return modeHeader;
      }
    }

    // Check query params
    const modeQuery = request.query?.uatMode || request.query?.dry_run;
    if (modeQuery) {
      if (modeQuery === 'dry_run' || modeQuery === 'live_uat') {
        return modeQuery;
      }
      // Handle boolean dry_run query param
      if (modeQuery === 'true' || modeQuery === true) {
        return 'dry_run';
      }
    }

    // Default to config mode if no explicit request
    return null;
  }

  /**
   * Detect if any UAT signals are present in the request
   * Returns array of detected signals or empty array if none
   */
  private detectUatSignals(request: any): string[] {
    const signals: string[] = [];

    // Check path
    if (request.url && request.url.startsWith('/uat')) {
      signals.push('path_starts_with_uat');
    }

    // Check headers for UAT prefixes
    const uatHeaders = Object.keys(request.headers || {}).filter(
      header =>
        header.toLowerCase().startsWith('x-uat') ||
        header.toLowerCase() === 'uat-mode'
    );
    if (uatHeaders.length > 0) {
      signals.push(`headers: ${uatHeaders.join(', ')}`);
    }

    // Check query params for UAT signals
    const uatQueryParams = Object.keys(request.query || {}).filter(
      param =>
        param.toLowerCase().includes('uat') ||
        param.toLowerCase() === 'dry_run' ||
        param.toLowerCase() === 'live_uat'
    );
    if (uatQueryParams.length > 0) {
      signals.push(`query: ${uatQueryParams.join(', ')}`);
    }

    return signals;
  }
}
