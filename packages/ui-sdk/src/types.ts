// UI SDK Types
// Governance Layer & Action Dispatch Infrastructure

// Note: ReadinessReport types are imported from the production-readiness package at runtime

/**
 * UI Surface Types
 */
export enum UiSurface {
  OPERATOR = 'OPERATOR',
  MANAGER = 'MANAGER',
  EXECUTIVE = 'EXECUTIVE',
}

/**
 * Readiness Domain Types (mirrored from production-readiness package)
 */
export enum ReadinessDomain {
  SYSTEM_HEALTH = 'systemHealth',
  GOVERNANCE = 'governance',
  GHL_TRUST = 'ghlTrust',
  VOICE_RISK = 'voiceRisk',
  BILLING_REVENUE = 'billingRevenue',
}

/**
 * Principal Context (derived from backend)
 */
export interface PrincipalContext {
  tenantId: string;
  userId: string;
  memberId?: string;
  authType: 'api_key' | 'admin_token' | 'service_account';
  displayName?: string;
  email?: string;
  skillTier?: SkillTier;
  availableSurfaces: UiSurface[];
  capabilities: string[];
  correlationId: string;
}

/**
 * Skill Tier (from rep-governance)
 */
export enum SkillTier {
  L1 = 'L1',
  L2 = 'L2',
  L3 = 'L3',
  L4 = 'L4',
}

/**
 * Runtime Configuration
 */
export interface RuntimeConfig {
  // Surface controls
  enableOperatorConsole: boolean;
  enableManagerConsole: boolean;
  enableExecDashboard: boolean;

  // Feature toggles
  enableVoiceWidgets: boolean;
  enableDriftWidgets: boolean;
  enableOverrideRequests: boolean;

  // Enforcement modes
  enforcementBannerMode: 'monitor_only' | 'block';

  // UI behavior
  maxRetryAttempts: number;
  correlationIdPrefix: string;
}

/**
 * API Response Wrapper
 */
export interface ApiResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  correlationId?: string;
}

/**
 * Action Dispatch Types
 */
export interface ExecutionCommand {
  commandType: string;
  parameters: Record<string, any>;
}

export interface DecisionResult {
  decisionId: string;
  outcome: string;
  confidence: number;
  evidence: string[];
}

export interface ExecutionPlan {
  planId: string;
  opportunityId: string;
  command: ExecutionCommand;
  decision: DecisionResult;
  requiresApproval: boolean;
  approvalReason?: string;
}

export interface ExecutionToken {
  tokenId: string;
  planId: string;
  expiresAt: Date;
  capabilities: string[];
}

/**
 * Action Dispatch Results
 */
export interface ActionResult {
  success: boolean;
  result?: any;
  error?: ActionError;
  correlationId: string;
  auditId?: string;
}

export interface ActionError {
  code: ActionErrorCode;
  message: string;
  details?: any;
}

export enum ActionErrorCode {
  UNAUTHORIZED = 'UNAUTHORIZED',
  FORBIDDEN = 'FORBIDDEN',
  BLOCKED_BY_POLICY = 'BLOCKED_BY_POLICY',
  BILLING_BLOCKED = 'BILLING_BLOCKED',
  SCOPE_BLOCKED = 'SCOPE_BLOCKED',
  DRIFT_BLOCKED = 'DRIFT_BLOCKED',
  UNKNOWN = 'UNKNOWN',
}

/**
 * Evidence Linking Types
 */
export interface EvidenceLink {
  type: EvidenceLinkType;
  id: string;
  url?: string;
  description: string;
}

export enum EvidenceLinkType {
  DECISION_EXPLANATION = 'DECISION_EXPLANATION',
  READINESS_REPORT = 'READINESS_REPORT',
  DRIFT_VIOLATION = 'DRIFT_VIOLATION',
  AUDIT_LOG = 'AUDIT_LOG',
  POLICY_REFERENCE = 'POLICY_REFERENCE',
}

/**
 * GHL Deep Link Types
 */
export interface GhlDeepLink {
  url: string;
  type: GhlLinkType;
  entityId: string;
  tenantId: string;
}

export enum GhlLinkType {
  OPPORTUNITY = 'OPPORTUNITY',
  CONTACT = 'CONTACT',
  PIPELINE = 'PIPELINE',
  CALENDAR = 'CALENDAR',
  DASHBOARD = 'DASHBOARD',
}

/**
 * HTTP Client Types
 */
export interface HttpClientConfig {
  baseUrl: string;
  timeout: number;
  maxRetries: number;
  retryDelay: number;
}

export interface RequestOptions extends RequestInit {
  correlationId?: string;
  tenantId?: string;
  skipRetry?: boolean;
}

/**
 * Error Types
 */
export class UiSdkError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly correlationId?: string
  ) {
    super(message);
    this.name = 'UiSdkError';
  }
}

// Readiness types are available at runtime from the production-readiness package
