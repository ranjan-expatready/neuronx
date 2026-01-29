/**
 * Permissions Decorator - WI-022: Access Control & API Key Governance
 *
 * Decorator for declaring required permissions on controllers and methods.
 */

import { SetMetadata } from '@nestjs/common';
import { Permission, REQUIRE_PERMISSIONS_METADATA } from './authz.types';

/**
 * Decorator to require specific permissions for accessing a route
 *
 * @param permissions - Array of permissions required (ALL must be present)
 * @example
 * @RequirePermissions(['artifacts:read', 'artifacts:write'])
 * @Get('artifacts')
 * async listArtifacts() { ... }
 */
export const RequirePermissions = (...permissions: Permission[]) =>
  SetMetadata(REQUIRE_PERMISSIONS_METADATA, permissions);

/**
 * Decorator to require admin permissions (admin:all)
 * @example
 * @RequireAdmin()
 * @Post('admin/action')
 * async adminAction() { ... }
 */
export const RequireAdmin = () =>
  SetMetadata(REQUIRE_PERMISSIONS_METADATA, ['admin:all']);

/**
 * Decorator to allow public access (no permissions required)
 * @example
 * @AllowPublic()
 * @Get('health')
 * async healthCheck() { ... }
 */
export const AllowPublic = () => SetMetadata(REQUIRE_PERMISSIONS_METADATA, []);
