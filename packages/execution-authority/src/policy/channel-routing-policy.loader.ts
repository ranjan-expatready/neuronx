/**
 * Channel Routing Policy Loader - WI-043: Channel Routing Policy Configuration
 *
 * Loads and validates channel routing policy from YAML file at startup.
 */

import { readFileSync } from 'fs';
import { safeLoad } from 'js-yaml';
import {
  ChannelRoutingPolicy,
  ChannelRoutingPolicySchema,
} from './channel-routing-policy.types';
import { Logger } from '@nestjs/common';

export class ChannelRoutingPolicyLoader {
  private readonly logger = new Logger(ChannelRoutingPolicyLoader.name);

  /**
   * Load and validate channel routing policy from YAML file
   */
  loadPolicy(filePath: string): ChannelRoutingPolicy {
    try {
      this.logger.log(
        `Attempting to load channel routing policy from: ${filePath}`
      );
      const fileContents = readFileSync(filePath, 'utf8');
      const parsedConfig = safeLoad(fileContents);

      const validatedPolicy = ChannelRoutingPolicySchema.parse(parsedConfig);
      this.logger.log(
        'Channel routing policy loaded and validated successfully.'
      );
      return validatedPolicy;
    } catch (error) {
      this.logger.error(
        `Failed to load or validate channel routing policy from ${filePath}: ${error.message}`
      );
      if (error.errors) {
        error.errors.forEach((err: any) =>
          this.logger.error(
            `Validation error: ${err.path.join('.')} - ${err.message}`
          )
        );
      }
      throw new Error(
        `Invalid Channel Routing Policy Configuration: ${error.message}`
      );
    }
  }
}
