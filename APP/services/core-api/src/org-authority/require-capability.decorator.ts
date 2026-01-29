/**
 * Require Capability Decorator - WI-035: Tenant & Organization Authority Model
 *
 * Decorator for requiring capabilities on endpoints.
 */

import { SetMetadata } from '@nestjs/common';
import { Capability } from '@neuronx/org-authority';

export const REQUIRE_CAPABILITY = Symbol('REQUIRE_CAPABILITY');

/**
 * Decorator to require specific capabilities
 */
export const RequireCapability = (...capabilities: Capability[]) =>
  SetMetadata(REQUIRE_CAPABILITY, capabilities);
