/**
 * GHL Capability Policy Resolver - WI-048: GHL Capability Allow/Deny Matrix
 *
 * Provides access to loaded GHL capability policy configuration with resolution logic.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  GhlCapabilityPolicy,
  CapabilityResolutionResult,
  CapabilityCheckContext,
  GhlCapability,
  PlanTier,
  CapabilityEnforcementMode,
  CapabilityConfig,
} from './ghl-capability-policy.types';

@Injectable()
export class GhlCapabilityPolicyResolver {
  private readonly logger = new Logger(GhlCapabilityPolicyResolver.name);
  private policy: GhlCapabilityPolicy;

  constructor(initialPolicy: GhlCapabilityPolicy) {
    this.policy = initialPolicy;
  }

  /**
   * Get the current GHL capability policy
   */
  getPolicy(): GhlCapabilityPolicy {
    return this.policy;
  }

  /**
   * Update policy at runtime (for testing or dynamic updates)
   */
  setPolicy(newPolicy: GhlCapabilityPolicy): void {
    this.policy = newPolicy;
  }

  /**
   * Check if a capability is allowed for a given context
   */
  checkCapability(context: CapabilityCheckContext): CapabilityResolutionResult {
    const { tenantId, planTier, capability, environment } = context;

    // First, try environment-specific overrides
    const envOverride = this.findEnvironmentOverride(environment, planTier);
    if (envOverride) {
      const config = this.findCapabilityConfig(
        envOverride.capabilities,
        capability
      );
      if (config && config.enabled) {
        return this.createResolutionResult(
          true,
          config,
          'Environment override'
        );
      }
    }

    // Then, try default plan configuration
    const planMatrix = this.findPlanMatrix(planTier);
    if (planMatrix) {
      const config = this.findCapabilityConfig(
        planMatrix.capabilities,
        capability
      );
      if (config && config.enabled) {
        return this.createResolutionResult(true, config, 'Plan configuration');
      }
    }

    // Capability not explicitly configured - use fallback behavior
    return this.handleFallback(capability, planTier, tenantId);
  }

  /**
   * Get capability configuration for a specific plan and capability
   */
  getCapabilityConfig(
    planTier: PlanTier,
    capability: GhlCapability,
    environment?: string
  ): CapabilityConfig | null {
    // Try environment override first
    if (environment) {
      const envOverride = this.findEnvironmentOverride(environment, planTier);
      if (envOverride) {
        const config = this.findCapabilityConfig(
          envOverride.capabilities,
          capability
        );
        if (config && config.enabled) {
          return config;
        }
      }
    }

    // Try default plan configuration
    const planMatrix = this.findPlanMatrix(planTier);
    if (planMatrix) {
      const config = this.findCapabilityConfig(
        planMatrix.capabilities,
        capability
      );
      if (config && config.enabled) {
        return config;
      }
    }

    return null;
  }

  /**
   * Get all capabilities for a plan tier
   */
  getPlanCapabilities(
    planTier: PlanTier,
    environment?: string
  ): CapabilityConfig[] {
    // Try environment override first
    if (environment) {
      const envOverride = this.findEnvironmentOverride(environment, planTier);
      if (envOverride) {
        return envOverride.capabilities.filter(c => c.enabled);
      }
    }

    // Use default plan configuration
    const planMatrix = this.findPlanMatrix(planTier);
    return planMatrix ? planMatrix.capabilities.filter(c => c.enabled) : [];
  }

  /**
   * Check if auditing is enabled for a specific audit type
   */
  isAuditEnabled(auditType: keyof GhlCapabilityPolicy['audit']): boolean {
    return this.policy.audit[auditType] || false;
  }

  /**
   * Find plan capability matrix for a specific tier
   */
  private findPlanMatrix(planTier: PlanTier): any | null {
    return (
      this.policy.planCapabilityMatrices.find(
        matrix => matrix.planTier === planTier
      ) || null
    );
  }

  /**
   * Find environment-specific override
   */
  private findEnvironmentOverride(
    environment: string,
    planTier: PlanTier
  ): any | null {
    if (
      !this.policy.environmentOverrides ||
      !this.policy.environmentOverrides[environment]
    ) {
      return null;
    }

    return (
      this.policy.environmentOverrides[environment].find(
        matrix => matrix.planTier === planTier
      ) || null
    );
  }

  /**
   * Find capability configuration in a list
   */
  private findCapabilityConfig(
    capabilities: CapabilityConfig[],
    capability: GhlCapability
  ): CapabilityConfig | null {
    return (
      capabilities.find(config => config.capability === capability) || null
    );
  }

  /**
   * Create a resolution result from capability config
   */
  private createResolutionResult(
    allowed: boolean,
    config: CapabilityConfig,
    source: string
  ): CapabilityResolutionResult {
    return {
      allowed,
      enforcementMode: config.enforcementMode,
      limits: config.limits,
      reason: `${source}: ${config.description || config.capability}`,
      capabilityConfig: config,
    };
  }

  /**
   * Handle fallback behavior for unknown/unconfigured capabilities
   */
  private handleFallback(
    capability: GhlCapability,
    planTier: PlanTier,
    tenantId: string
  ): CapabilityResolutionResult {
    const fallback = this.policy.unknownCapabilityFallback;

    // Log the fallback usage
    this.logger.warn(`Capability fallback triggered`, {
      capability,
      planTier,
      tenantId,
      fallbackMode: fallback.defaultMode,
    });

    // Alert if enabled
    if (fallback.alertOnUnknown && fallback.alertChannels) {
      this.sendFallbackAlert(capability, planTier, tenantId);
    }

    // Create audit event if auditing is enabled
    if (this.isAuditEnabled('auditCapabilityDenials')) {
      this.auditFallbackUsage(capability, planTier, tenantId);
    }

    return {
      allowed: fallback.defaultMode !== 'block', // Allow unless explicitly blocked
      enforcementMode: fallback.defaultMode,
      reason: `Unknown capability fallback: ${fallback.defaultMode}`,
      capabilityConfig: undefined,
    };
  }

  /**
   * Send alert for unknown capability fallback
   */
  private sendFallbackAlert(
    capability: GhlCapability,
    planTier: PlanTier,
    tenantId: string
  ): void {
    const alertMessage = {
      alertType: 'GHL_CAPABILITY_FALLBACK',
      timestamp: new Date().toISOString(),
      capability,
      planTier,
      tenantId,
      policyVersion: this.policy.version,
    };

    this.logger.warn('GHL capability fallback alert', alertMessage);

    // In a real implementation, this would send to configured alert channels
    // For now, we just log it
  }

  /**
   * Audit fallback usage
   */
  private async auditFallbackUsage(
    capability: GhlCapability,
    planTier: PlanTier,
    tenantId: string
  ): Promise<void> {
    // In a real implementation, this would create an audit event in the database
    // For now, we just log it
    this.logger.debug('Auditing capability fallback', {
      capability,
      planTier,
      tenantId,
      timestamp: new Date().toISOString(),
    });
  }

  /**
   * Validate that a capability configuration exists
   */
  validateCapabilityExists(
    planTier: PlanTier,
    capability: GhlCapability,
    environment?: string
  ): boolean {
    return this.getCapabilityConfig(planTier, capability, environment) !== null;
  }
}
