/**
 * Billing Policy Loader - WI-044: Billing Plan & Limit Configuration
 *
 * Loads and validates billing policy from YAML file at startup.
 */

import { readFileSync } from 'fs';
import { safeLoad } from 'js-yaml';
import { BillingPolicy, BillingPolicySchema } from './billing-policy.types';
import { Logger } from '@nestjs/common';

export class BillingPolicyLoader {
  private readonly logger = new Logger(BillingPolicyLoader.name);

  /**
   * Load and validate billing policy from YAML file
   */
  loadPolicy(filePath: string): BillingPolicy {
    try {
      this.logger.log(`Attempting to load billing policy from: ${filePath}`);
      const fileContents = readFileSync(filePath, 'utf8');
      const parsedConfig = safeLoad(fileContents);

      const validatedPolicy = BillingPolicySchema.parse(parsedConfig);
      this.logger.log('Billing policy loaded and validated successfully.');
      return validatedPolicy;
    } catch (error) {
      this.logger.error(
        `Failed to load or validate billing policy from ${filePath}: ${error.message}`
      );
      if (error.errors) {
        error.errors.forEach((err: any) =>
          this.logger.error(
            `Validation error: ${err.path.join('.')} - ${err.message}`
          )
        );
      }
      throw new Error(`Invalid Billing Policy Configuration: ${error.message}`);
    }
  }
}
