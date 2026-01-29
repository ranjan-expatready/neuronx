/**
 * Plan Mapping Policy Loader - WI-045: GHL Product → Plan Mapping Hardening
 *
 * Loads and validates plan mapping policy from YAML file at startup.
 */

import { readFileSync } from 'fs';
import { safeLoad } from 'js-yaml';
import {
  PlanMappingPolicy,
  PlanMappingPolicySchema,
} from './plan-mapping-policy.types';
import { Logger } from '@nestjs/common';

export class PlanMappingPolicyLoader {
  private readonly logger = new Logger(PlanMappingPolicyLoader.name);

  /**
   * Load and validate plan mapping policy from YAML file
   */
  loadPolicy(filePath: string): PlanMappingPolicy {
    try {
      this.logger.log(
        `Attempting to load plan mapping policy from: ${filePath}`
      );
      const fileContents = readFileSync(filePath, 'utf8');
      const parsedConfig = safeLoad(fileContents);

      const validatedPolicy = PlanMappingPolicySchema.parse(parsedConfig);
      this.logger.log('Plan mapping policy loaded and validated successfully.');

      // Additional validation for business rules
      this.validatePolicyBusinessRules(validatedPolicy);

      return validatedPolicy;
    } catch (error) {
      this.logger.error(
        `Failed to load or validate plan mapping policy from ${filePath}: ${error.message}`
      );
      if (error.errors) {
        error.errors.forEach((err: any) =>
          this.logger.error(
            `Validation error: ${err.path.join('.')} - ${err.message}`
          )
        );
      }
      throw new Error(
        `Invalid Plan Mapping Policy Configuration: ${error.message}`
      );
    }
  }

  /**
   * Validate business rules beyond schema validation
   */
  private validatePolicyBusinessRules(policy: PlanMappingPolicy): void {
    const errors: string[] = [];

    // Check for duplicate GHL product IDs
    const productIds = new Set<string>();
    for (const mapping of policy.productMappings) {
      if (productIds.has(mapping.ghlProductId)) {
        errors.push(`Duplicate GHL product ID: ${mapping.ghlProductId}`);
      }
      productIds.add(mapping.ghlProductId);
    }

    // Check fallback configuration
    if (
      policy.fallback.behavior === 'default_tier' &&
      !policy.fallback.defaultTier
    ) {
      errors.push(
        'Fallback behavior is "default_tier" but no defaultTier specified'
      );
    }

    // Check for environment override conflicts
    if (policy.environmentOverrides) {
      const envs = new Set<string>();
      for (const override of policy.environmentOverrides) {
        if (envs.has(override.environment) && override.environment !== 'all') {
          errors.push(
            `Duplicate environment override for: ${override.environment}`
          );
        }
        envs.add(override.environment);
      }
    }

    if (errors.length > 0) {
      throw new Error(`Policy validation failed: ${errors.join(', ')}`);
    }
  }
}
