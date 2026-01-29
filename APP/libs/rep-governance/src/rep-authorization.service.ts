import { v4 as uuidv4 } from 'uuid';
import { RepSkillPolicyResolver } from './rep-skill-policy.resolver';
import {
  SkillTier,
  AuthorizationAction,
  AuthorizationResult,
  OverrideType,
} from './rep-skill.enums';
import type { RepSkillPolicy } from './rep-skill-policy.schema';

// Authorization Request Interface
export interface AuthorizationRequest {
  tenantId: string;
  repId: string;
  repSkillTier: SkillTier;
  action: AuthorizationAction;
  resource?: {
    type: string;
    id?: string;
    attributes?: Record<string, any>;
  };
  context?: {
    dealValue?: number;
    riskLevel?: string;
    fromState?: string;
    toState?: string;
    voiceMode?: string;
    justification?: string;
    supervisorId?: string;
  };
  correlationId?: string;
}

// Authorization Response Interface
export interface AuthorizationResponse {
  requestId: string;
  result: AuthorizationResult;
  skillTier: SkillTier;
  reason: string;
  details: {
    allowed: boolean;
    violations: string[];
    requirements?: string[];
    recommendations?: string[];
  };
  audit: {
    timestamp: Date;
    policyVersion: string;
    correlationId: string;
  };
  override?: {
    required: boolean;
    type?: OverrideType;
    justificationRequired: boolean;
    approvalRequired: boolean;
  };
}

// Override Request Interface
export interface OverrideRequest {
  tenantId: string;
  repId: string;
  repSkillTier: SkillTier;
  overrideType: OverrideType;
  originalRequest: AuthorizationRequest;
  justification: string;
  supervisorId?: string;
  correlationId?: string;
}

// Override Response Interface
export interface OverrideResponse {
  requestId: string;
  approved: boolean;
  reason: string;
  approvedBy?: string;
  timestamp: Date;
  correlationId: string;
}

/**
 * Rep Authorization Service
 * Performs skill-based authorization checks and manages overrides
 */
export class RepAuthorizationService {
  private readonly policyResolver: RepSkillPolicyResolver;

  constructor(
    policy: RepSkillPolicy,
    private readonly policyVersion: string = '1.0.0'
  ) {
    this.policyResolver = new RepSkillPolicyResolver(policy);
  }

  /**
   * Authorize an action based on rep skill tier and policy
   */
  authorize(request: AuthorizationRequest): AuthorizationResponse {
    const requestId = uuidv4();
    const correlationId = request.correlationId || uuidv4();

    const violations: string[] = [];
    const requirements: string[] = [];
    const recommendations: string[] = [];

    let result = AuthorizationResult.ALLOWED;
    let reason = 'Action authorized';
    let overrideRequired = false;
    let overrideType: OverrideType | undefined;
    let justificationRequired = false;
    let approvalRequired = false;

    // Check based on action type
    switch (request.action) {
      case AuthorizationAction.FSM_TRANSITION:
        const transitionAllowed = this.checkFSMTransition(
          request.repSkillTier,
          request.context?.fromState,
          request.context?.toState
        );
        if (!transitionAllowed.allowed) {
          violations.push(...transitionAllowed.violations);
          result = AuthorizationResult.DENIED;
          reason = 'FSM transition not allowed for skill tier';
        }
        break;

      case AuthorizationAction.VOICE_MODE_SELECTION:
        const voiceAllowed = this.checkVoiceMode(
          request.repSkillTier,
          request.context?.voiceMode
        );
        if (!voiceAllowed.allowed) {
          violations.push(...voiceAllowed.violations);
          result = AuthorizationResult.DENIED;
          reason = 'Voice mode not allowed for skill tier';
        }
        break;

      case AuthorizationAction.DEAL_VALUE_ACCESS:
        const dealAllowed = this.checkDealValue(
          request.repSkillTier,
          request.context?.dealValue
        );
        if (!dealAllowed.allowed) {
          violations.push(...dealAllowed.violations);
          result = AuthorizationResult.DENIED;
          reason = 'Deal value exceeds skill tier limit';
        }
        break;

      case AuthorizationAction.DECISION_OVERRIDE:
        if (!this.policyResolver.canOverrideDecisions(request.repSkillTier)) {
          violations.push('Decision override not allowed for skill tier');
          result = AuthorizationResult.DENIED;
          reason = 'Decision override not authorized';
        }
        break;

      case AuthorizationAction.EXECUTION_AUTHORIZATION:
        // Check if execution is allowed based on skill tier and risk
        const riskLevel = request.context?.riskLevel;
        if (
          riskLevel &&
          !this.policyResolver.isTierAllowedForRisk(
            request.repSkillTier,
            riskLevel
          )
        ) {
          violations.push(
            `Skill tier not allowed for risk level: ${riskLevel}`
          );
          result = AuthorizationResult.DENIED;
          reason = 'Execution not authorized for risk level';
        }
        break;

      default:
        violations.push(`Unknown authorization action: ${request.action}`);
        result = AuthorizationResult.DENIED;
        reason = 'Unknown action type';
    }

    // Check risk-based restrictions
    if (request.context?.riskLevel) {
      const riskRestrictions = this.policyResolver.getRiskRestrictions(
        request.context.riskLevel
      );
      if (riskRestrictions) {
        if (riskRestrictions.requiresDualApproval) {
          approvalRequired = true;
          overrideRequired = true;
          overrideType = OverrideType.SUPERVISOR_APPROVAL;
          requirements.push('Dual approval required for high-risk operations');
        }
        if (riskRestrictions.requiresComplianceReview) {
          requirements.push('Compliance review required');
        }
      }
    }

    // Determine if escalation is required
    if (
      this.policyResolver.requiresEscalation(request.repSkillTier) &&
      violations.length > 0
    ) {
      result = AuthorizationResult.REQUIRES_ESCALATION;
      reason = 'Escalation required for skill tier';
    }

    // Determine if supervisor approval is required
    if (
      this.policyResolver.requiresSupervisorApproval(request.repSkillTier) &&
      (violations.length > 0 || approvalRequired)
    ) {
      result = AuthorizationResult.REQUIRES_APPROVAL;
      reason = 'Supervisor approval required';
      overrideRequired = true;
      overrideType = OverrideType.SUPERVISOR_APPROVAL;
      justificationRequired = true;
    }

    // Add recommendations for skill improvement
    if (violations.length > 0) {
      recommendations.push('Consider skill tier advancement training');
      recommendations.push('Request supervisor guidance for complex actions');
    }

    return {
      requestId,
      result,
      skillTier: request.repSkillTier,
      reason,
      details: {
        allowed: result === AuthorizationResult.ALLOWED,
        violations,
        requirements,
        recommendations,
      },
      audit: {
        timestamp: new Date(),
        policyVersion: this.policyVersion,
        correlationId,
      },
      override: overrideRequired
        ? {
            required: true,
            type: overrideType,
            justificationRequired,
            approvalRequired,
          }
        : undefined,
    };
  }

  /**
   * Process an override request
   */
  processOverrideRequest(request: OverrideRequest): OverrideResponse {
    const requestId = uuidv4();
    const correlationId = request.correlationId || uuidv4();

    // Check if override type is allowed for skill tier
    const canPerformOverride = this.policyResolver.canPerformOverride(
      request.repSkillTier,
      request.overrideType
    );

    if (!canPerformOverride) {
      return {
        requestId,
        approved: false,
        reason: `Override type ${request.overrideType} not allowed for skill tier ${request.repSkillTier}`,
        timestamp: new Date(),
        correlationId,
      };
    }

    // Get override policy
    const overridePolicy = this.policyResolver.getOverridePolicy(
      request.overrideType
    );
    if (!overridePolicy) {
      return {
        requestId,
        approved: false,
        reason: `No policy found for override type: ${request.overrideType}`,
        timestamp: new Date(),
        correlationId,
      };
    }

    // Validate justification length
    if (
      overridePolicy.requiresJustification &&
      overridePolicy.justificationMinLength &&
      request.justification.length < overridePolicy.justificationMinLength
    ) {
      return {
        requestId,
        approved: false,
        reason: `Justification too short. Minimum length: ${overridePolicy.justificationMinLength} characters`,
        timestamp: new Date(),
        correlationId,
      };
    }

    // Check supervisor requirements
    if (overridePolicy.requiresSupervisorId && !request.supervisorId) {
      return {
        requestId,
        approved: false,
        reason: 'Supervisor approval required but not provided',
        timestamp: new Date(),
        correlationId,
      };
    }

    // For now, approve all valid override requests
    // In production, this would integrate with approval workflows
    return {
      requestId,
      approved: true,
      reason: 'Override approved based on policy',
      approvedBy: request.supervisorId || 'system',
      timestamp: new Date(),
      correlationId,
    };
  }

  /**
   * Get skill tier for a rep (would integrate with user management system)
   */
  getRepSkillTier(_repId: string, _tenantId: string): SkillTier {
    // This would query the actual user/skill tier from database
    // For now, return a default
    return SkillTier.L2;
  }

  /**
   * Check FSM transition authorization
   */
  private checkFSMTransition(
    skillTier: SkillTier,
    fromState?: string,
    toState?: string
  ): { allowed: boolean; violations: string[] } {
    if (!fromState || !toState) {
      return {
        allowed: false,
        violations: ['Missing state transition information'],
      };
    }

    const allowed = this.policyResolver.isFSMTransitionAllowed(
      skillTier,
      fromState,
      toState
    );

    return {
      allowed,
      violations: allowed
        ? []
        : [
            `Transition ${fromState}->${toState} not allowed for skill tier ${skillTier}`,
          ],
    };
  }

  /**
   * Check voice mode authorization
   */
  private checkVoiceMode(
    skillTier: SkillTier,
    voiceMode?: string
  ): { allowed: boolean; violations: string[] } {
    if (!voiceMode) {
      return { allowed: false, violations: ['Missing voice mode information'] };
    }

    const allowed = this.policyResolver.isVoiceModeAllowed(
      skillTier,
      voiceMode
    );

    return {
      allowed,
      violations: allowed
        ? []
        : [`Voice mode ${voiceMode} not allowed for skill tier ${skillTier}`],
    };
  }

  /**
   * Check deal value authorization
   */
  private checkDealValue(
    skillTier: SkillTier,
    dealValue?: number
  ): { allowed: boolean; violations: string[] } {
    if (dealValue === undefined) {
      return { allowed: false, violations: ['Missing deal value information'] };
    }

    const allowed = this.policyResolver.isDealValueAllowed(
      skillTier,
      dealValue
    );

    return {
      allowed,
      violations: allowed
        ? []
        : [
            `Deal value $${dealValue} exceeds limit for skill tier ${skillTier}`,
          ],
    };
  }

  /**
   * Get policy resolver for direct access
   */
  getPolicyResolver(): RepSkillPolicyResolver {
    return this.policyResolver;
  }

  /**
   * Get current policy version
   */
  getPolicyVersion(): string {
    return this.policyVersion;
  }
}
