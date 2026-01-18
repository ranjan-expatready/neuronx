/**
 * Configuration Module - WI-026: Release & Environment Hardening
 *
 * Provides validated configuration to the application.
 * Runs boot-time validation to ensure safe deployments.
 */

import { Global, Module } from '@nestjs/common';
import { ConfigValidator } from './config.validator';
import { FeatureFlagsService } from './feature-flags.service';
import { ReadinessGuardService } from './readiness-guard.service';
import { EnvironmentConfig } from './config.schema';

@Global()
@Module({
  providers: [
    {
      provide: 'VALIDATED_CONFIG',
      useFactory: (): EnvironmentConfig => {
        // This runs at module initialization (boot time)
        // Will throw and exit if validation fails
        return ConfigValidator.validateBootConfig();
      },
    },
    FeatureFlagsService,
    ReadinessGuardService,
  ],
  exports: ['VALIDATED_CONFIG', FeatureFlagsService, ReadinessGuardService],
})
export class ConfigModule {}

/**
 * Get validated configuration (for use in other modules)
 * This is safe to call after app bootstrap since validation already passed
 */
export function getValidatedConfig(): EnvironmentConfig {
  // In a real implementation, this would inject from the module
  // For now, we'll validate on demand (but it should already be validated at boot)
  return ConfigValidator.validateBootConfig();
}
