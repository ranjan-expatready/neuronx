/**
 * Authorization Types - WI-022: Access Control & API Key Governance
 *
 * Types and constants for access control, authentication, and authorization.
 */

import { Request } from 'express';

// ============================================================================
// PERMISSION CONSTANTS
// ============================================================================

export const PERMISSIONS = {
  // Webhooks
  WEBHOOKS_READ: 'webhooks:read',
  WEBHOOKS_WRITE: 'webhooks:write',
  WEBHOOKS_MANAGE: 'webhooks:manage',

  // Artifacts
  ARTIFACTS_READ: 'artifacts:read',
  ARTIFACTS_WRITE: 'artifacts:write',
  ARTIFACTS_MANAGE: 'artifacts:manage',

  // Usage
  USAGE_READ: 'usage:read',

  // Events
  EVENTS_READ: 'events:read',

  // Payments
  PAYMENTS_READ: 'payments:read',

  // Secrets (admin-only)
  SECRETS_ROTATE: 'secrets:rotate',

  // Admin (super permission)
  ADMIN_ALL: 'admin:all',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

// ============================================================================
// ACTOR TYPES
// ============================================================================

export interface RequestActor {
  type: 'admin' | 'apikey';
  id: string;
  tenantId: string;
  roleIds: string[];
  permissions: Permission[];
  correlationId: string;
}

export interface AdminActor extends RequestActor {
  type: 'admin';
  userId: string; // Reference to admin user
}

export interface ApiKeyActor extends RequestActor {
  type: 'apikey';
  apiKeyId: string;
  apiKeyName: string;
  fingerprint: string;
}

// ============================================================================
// ROLE DEFINITIONS
// ============================================================================

export const CANONICAL_ROLES = {
  TENANT_ADMIN: {
    name: 'TenantAdmin',
    permissions: [PERMISSIONS.ADMIN_ALL],
  },
  OPERATOR: {
    name: 'Operator',
    permissions: [
      PERMISSIONS.WEBHOOKS_MANAGE,
      PERMISSIONS.ARTIFACTS_MANAGE,
      PERMISSIONS.USAGE_READ,
      PERMISSIONS.EVENTS_READ,
      PERMISSIONS.PAYMENTS_READ,
    ],
  },
  READ_ONLY: {
    name: 'ReadOnly',
    permissions: [
      PERMISSIONS.WEBHOOKS_READ,
      PERMISSIONS.ARTIFACTS_READ,
      PERMISSIONS.USAGE_READ,
      PERMISSIONS.EVENTS_READ,
      PERMISSIONS.PAYMENTS_READ,
    ],
  },
  INTEGRATION_BOT: {
    name: 'IntegrationBot',
    permissions: [
      PERMISSIONS.WEBHOOKS_READ,
      PERMISSIONS.EVENTS_READ,
      PERMISSIONS.USAGE_READ,
      PERMISSIONS.ARTIFACTS_WRITE, // For uploading exports/artifacts
    ],
  },
} as const;

// ============================================================================
// API KEY TYPES
// ============================================================================

export interface ApiKeyCreateRequest {
  name: string;
  roleIds?: string[]; // Preferred approach
  permissions?: Permission[]; // Optional override
}

export interface ApiKeyCreateResponse {
  id: string;
  name: string;
  key: string; // RAW KEY - returned ONLY ONCE
  fingerprint: string;
  roleIds: string[];
  permissions: Permission[];
  createdAt: Date;
}

export interface ApiKeyRotateResponse {
  id: string;
  name: string;
  newKey: string; // NEW RAW KEY - returned ONLY ONCE
  fingerprint: string;
  roleIds: string[];
  permissions: Permission[];
  rotatedAt: Date;
}

export interface ApiKeyRecord {
  id: string;
  tenantId: string;
  name: string;
  digest: string;
  previousDigest?: string;
  previousDigestExpiresAt?: Date;
  status: 'ACTIVE' | 'REVOKED';
  fingerprint: string;
  roleIds: string[];
  permissions: Permission[];
  secretRef: string;
  lastUsedAt?: Date;
  createdAt: Date;
  updatedAt: Date;
  revokedAt?: Date;
}

export interface ApiKeyListResponse {
  apiKeys: Omit<ApiKeyRecord, 'digest' | 'previousDigest' | 'secretRef'>[];
  total: number;
}

// ============================================================================
// ROLE TYPES
// ============================================================================

export interface RoleCreateRequest {
  name: string;
  permissions: Permission[];
}

export interface RoleRecord {
  id: string;
  tenantId: string;
  name: string;
  permissions: Permission[];
  createdAt: Date;
  updatedAt: Date;
}

// ============================================================================
// AUDIT TYPES
// ============================================================================

export interface AuditEvent {
  tenantId: string;
  actor: RequestActor;
  action: string;
  resourceType?: string;
  resourceId?: string;
  correlationId?: string;
  ip?: string;
  userAgent?: string;
}

export interface AuditLogRecord {
  id: string;
  tenantId: string;
  actorType: 'admin' | 'apikey';
  actorId: string;
  action: string;
  resourceType?: string;
  resourceId?: string;
  correlationId?: string;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

// ============================================================================
// REQUEST CONTEXT EXTENSION
// ============================================================================

declare module 'express' {
  interface Request {
    tenantId?: string;
    actor?: RequestActor;
    correlationId?: string;
  }
}

// ============================================================================
// GUARD METADATA
// ============================================================================

export const REQUIRE_PERMISSIONS_METADATA = Symbol('REQUIRE_PERMISSIONS');

// ============================================================================
// API KEY CONSTANTS
// ============================================================================

export const API_KEY_PREFIXES = {
  LIVE: 'nxk_live_',
  TEST: 'nxk_test_',
} as const;

export const API_KEY_MIN_LENGTH = 40;

// ============================================================================
// ERROR TYPES
// ============================================================================

export class AuthzError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number = 403
  ) {
    super(message);
    this.name = 'AuthzError';
  }
}

export class InvalidApiKeyError extends AuthzError {
  constructor() {
    super('Invalid API key', 'INVALID_API_KEY', 401);
  }
}

export class InsufficientPermissionsError extends AuthzError {
  constructor(required: Permission[], actual: Permission[]) {
    super(
      `Insufficient permissions. Required: ${required.join(', ')}, Actual: ${actual.join(', ')}`,
      'INSUFFICIENT_PERMISSIONS',
      403
    );
  }
}

export class RevokedApiKeyError extends AuthzError {
  constructor() {
    super('API key has been revoked', 'REVOKED_API_KEY', 401);
  }
}

export class TenantIsolationError extends AuthzError {
  constructor() {
    super('Tenant isolation violation', 'TENANT_ISOLATION', 403);
  }
}
