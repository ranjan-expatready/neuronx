/**
 * GHL Capability Policy Loader - WI-048: GHL Capability Allow/Deny Matrix
 *
 * Loads and validates GHL capability policy from YAML file at startup.
 */

import { readFileSync } from 'fs';
import { safeLoad } from 'js-yaml';
import {
  GhlCapabilityPolicy,
  GhlCapabilityPolicySchema,
  GhlCapability,
} from './ghl-capability-policy.types';
import { Logger } from '@nestjs/common';

export class GhlCapabilityPolicyLoader {
  private readonly logger = new Logger(GhlCapabilityPolicyLoader.name);

  /**
   * Load and validate GHL capability policy from YAML file
   */
  loadPolicy(filePath: string): GhlCapabilityPolicy {
    try {
      this.logger.log(
        `Attempting to load GHL capability policy from: ${filePath}`
      );
      const fileContents = readFileSync(filePath, 'utf8');
      const parsedConfig = safeLoad(fileContents);

      const validatedPolicy = GhlCapabilityPolicySchema.parse(parsedConfig);
      this.logger.log(
        'GHL capability policy loaded and validated successfully.'
      );

      // Additional validation for business rules
      this.validatePolicyBusinessRules(validatedPolicy);

      return validatedPolicy;
    } catch (error) {
      this.logger.error(
        `Failed to load or validate GHL capability policy from ${filePath}: ${error.message}`
      );
      if (error.errors) {
        error.errors.forEach((err: any) =>
          this.logger.error(
            `Validation error: ${err.path.join('.')} - ${err.message}`
          )
        );
      }
      throw new Error(
        `Invalid GHL Capability Policy Configuration: ${error.message}`
      );
    }
  }

  /**
   * Validate business rules beyond schema validation
   */
  private validatePolicyBusinessRules(policy: GhlCapabilityPolicy): void {
    const errors: string[] = [];

    // Check for duplicate capabilities within the same plan
    for (const matrix of policy.planCapabilityMatrices) {
      const capabilities = new Set<GhlCapability>();
      for (const config of matrix.capabilities) {
        if (capabilities.has(config.capability)) {
          errors.push(
            `Duplicate capability ${config.capability} in plan ${matrix.planTier}`
          );
        }
        capabilities.add(config.capability);
      }
    }

    // Check that all plans have at least basic CRM capabilities
    const requiredCapabilities: GhlCapability[] = [
      'crm_create_lead',
      'crm_list_leads',
    ];

    for (const matrix of policy.planCapabilityMatrices) {
      const planCapabilities = new Set(
        matrix.capabilities.map(c => c.capability)
      );
      for (const required of requiredCapabilities) {
        if (!planCapabilities.has(required)) {
          errors.push(
            `Plan ${matrix.planTier} missing required capability: ${required}`
          );
        }
      }
    }

    // Check environment override consistency
    if (policy.environmentOverrides) {
      for (const [env, matrices] of Object.entries(
        policy.environmentOverrides
      )) {
        const planTiers = new Set(matrices.map(m => m.planTier));
        if (planTiers.size !== matrices.length) {
          errors.push(
            `Environment ${env} has duplicate plan tiers in overrides`
          );
        }
      }
    }

    // Validate limit configurations
    for (const matrix of policy.planCapabilityMatrices) {
      for (const config of matrix.capabilities) {
        if (config.enforcementMode === 'allow_with_limits' && !config.limits) {
          errors.push(
            `Capability ${config.capability} in plan ${matrix.planTier} has allow_with_limits but no limits defined`
          );
        }
      }
    }

    if (errors.length > 0) {
      throw new Error(`Policy validation failed: ${errors.join(', ')}`);
    }
  }
}
