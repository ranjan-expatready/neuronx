/**
 * Read-Only GHL Live Data Integration Types - WI-070
 *
 * Type definitions for read-only GHL operations and snapshot functionality.
 */

// Re-export domain models for convenience
export type {
  Lead,
  Opportunity,
  Pipeline,
  User,
  AdapterContext,
} from '@neuronx/domain';

// ===== CONFIGURATION TYPES =====

export interface GhlReadAdapterConfig {
  tenantId: string;
  ghlApiKey: string;
  baseUrl: string;
  timeout: number;
  rateLimit: {
    requestsPerMinute: number;
    burstLimit: number;
  };
  auditEnabled: boolean;
}

// ===== READ-ONLY INTERFACES =====

/**
 * Read-Only CRM Adapter - Only supports read operations
 */
export interface IReadOnlyCRMAdapter {
  /**
   * Get a lead by ID (READ-ONLY)
   */
  getLead(id: string, context: AdapterContext): Promise<Lead>;

  /**
   * List leads with optional filtering (READ-ONLY)
   */
  listLeads(
    filters?: {
      email?: string;
      phone?: string;
      tags?: string[];
      status?: string;
      limit?: number;
      offset?: number;
    },
    context?: AdapterContext
  ): Promise<{ leads: Lead[]; total: number }>;

  /**
   * Get an opportunity by ID (READ-ONLY)
   */
  getOpportunity(id: string, context: AdapterContext): Promise<Opportunity>;

  /**
   * List opportunities with optional filtering (READ-ONLY)
   */
  listOpportunities(
    context: AdapterContext,
    filters?: {
      leadId?: string;
      pipelineId?: string;
      stage?: string;
      assignedTo?: string;
      limit?: number;
      offset?: number;
    }
  ): Promise<{ opportunities: Opportunity[]; total: number }>;

  /**
   * Get available pipelines (READ-ONLY)
   */
  getPipelines(context: AdapterContext): Promise<Pipeline[]>;

  /**
   * Get a specific pipeline (READ-ONLY)
   */
  getPipeline(id: string, context: AdapterContext): Promise<Pipeline>;
}

/**
 * Read-Only Identity Adapter - Only supports read operations
 */
export interface IReadOnlyIdentityAdapter {
  /**
   * List users with optional filtering (READ-ONLY)
   */
  listUsers(
    filters?: {
      email?: string;
      role?: string;
      isActive?: boolean;
      limit?: number;
      offset?: number;
    },
    context: AdapterContext
  ): Promise<{ users: User[]; total: number }>;

  /**
   * Get a user by ID (READ-ONLY)
   */
  getUser(id: string, context: AdapterContext): Promise<User>;

  /**
   * Get a user by email (READ-ONLY)
   */
  getUserByEmail(email: string, context: AdapterContext): Promise<User>;
}

// ===== SNAPSHOT TYPES =====

/**
 * Snapshot metadata
 */
export interface SnapshotMetadata {
  snapshotId: string;
  source: 'GHL';
  pulledAt: Date;
  tenantId: string;
  correlationId: string;
  recordCount: number;
  dataTypes: string[]; // ['contacts', 'opportunities', 'pipelines']
  status: 'success' | 'partial' | 'failed';
  errorMessage?: string;
}

/**
 * Contact snapshot data
 */
export interface ContactSnapshot {
  id: string;
  email: string;
  firstName?: string;
  lastName?: string;
  phone?: string;
  tags: string[];
  source: string;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt?: Date;
}

/**
 * Opportunity snapshot data
 */
export interface OpportunitySnapshot {
  id: string;
  title: string;
  value?: number;
  currency?: string;
  stage: string;
  pipelineId: string;
  contactId: string;
  assignedTo?: string;
  createdAt: Date;
  updatedAt: Date;
  lastActivityAt?: Date;
}

/**
 * Pipeline snapshot data
 */
export interface PipelineSnapshot {
  id: string;
  name: string;
  stages: Array<{
    id: string;
    name: string;
    order: number;
  }>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Complete snapshot data structure
 */
export interface GhlSnapshotData {
  metadata: SnapshotMetadata;
  contacts: ContactSnapshot[];
  opportunities: OpportunitySnapshot[];
  pipelines: PipelineSnapshot[];
  users: User[];
}

// ===== GOVERNANCE TYPES =====

/**
 * Governance violation types
 */
export enum GovernanceViolationType {
  MUTATION_ATTEMPT = 'mutation_attempt',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  CONFIGURATION_ERROR = 'configuration_error',
}

/**
 * Governance violation record
 */
export interface GovernanceViolation {
  id: string;
  type: GovernanceViolationType;
  tenantId: string;
  userId?: string;
  operation: string;
  details: Record<string, any>;
  timestamp: Date;
  correlationId: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

// ===== CONFIGURATION TYPES =====

// Extend the main GhlReadAdapterConfig with additional optional properties
export interface ExtendedGhlReadAdapterConfig extends GhlReadAdapterConfig {
  environment?: 'dev' | 'stage' | 'prod';
  snapshot?: {
    enabled: boolean;
    schedule?: string; // cron expression
    retentionDays: number;
    maxRecordsPerSnapshot: number;
  };
  governance?: {
    auditMutations: boolean;
    rateLimitRequestsPerMinute: number;
    allowedDataTypes: string[]; // ['contacts', 'opportunities', 'pipelines']
  };
}

// ===== UTILITY TYPES =====

/**
 * Data freshness information
 */
export interface DataFreshness {
  source: string;
  lastUpdated: Date;
  ageInMinutes: number;
  isStale: boolean;
  snapshotId?: string;
}

/**
 * Alignment comparison between NeuronX and GHL
 */
export interface DataAlignment {
  totalRecords: number;
  alignedRecords: number | null; // null when alignment cannot be computed
  misalignedRecords: number | null; // null when alignment cannot be computed
  alignmentPercentage: number | null; // null when alignment cannot be computed (UNKNOWN)
  driftReasons: Array<{
    recordId: string;
    field: string;
    neuronxValue: any;
    ghlValue: any;
    severity: 'low' | 'medium' | 'high';
  }>;
}
