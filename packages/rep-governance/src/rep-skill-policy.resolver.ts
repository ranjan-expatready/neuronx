import type {
  RepSkillPolicy,
  SkillTier,
  SkillTierPermissions,
  RiskRestrictions,
  OverridePolicy,
  OverrideType,
} from './rep-skill-policy.schema';

/**
 * Resolves rep skill policy decisions and provides convenient access to skill tier rules
 */
export class RepSkillPolicyResolver {
  constructor(private readonly policy: RepSkillPolicy) {}

  /**
   * Get permissions for a specific skill tier
   */
  getSkillTierPermissions(tier: SkillTier): SkillTierPermissions | null {
    return this.policy.skillTiers[tier] || null;
  }

  /**
   * Check if a skill tier is allowed for a specific risk level
   */
  isTierAllowedForRisk(tier: SkillTier, riskLevel: string): boolean {
    const restrictions = this.policy.riskRestrictions[riskLevel];
    return restrictions ? restrictions.allowedTiers.includes(tier) : true; // Default allow if no restrictions
  }

  /**
   * Check if an FSM transition is allowed for a skill tier
   */
  isFSMTransitionAllowed(
    tier: SkillTier,
    fromState: string,
    toState: string
  ): boolean {
    const permissions = this.getSkillTierPermissions(tier);
    if (!permissions) return false;

    const transition = `${fromState}->${toState}`;

    // Check if explicitly blocked
    if (
      permissions.blockedFSMTransitions.some(pattern =>
        this.matchesTransitionPattern(pattern, transition)
      )
    ) {
      return false;
    }

    // Check if explicitly allowed
    return permissions.allowedFSMTransitions.some(pattern =>
      this.matchesTransitionPattern(pattern, transition)
    );
  }

  /**
   * Check if a voice mode is allowed for a skill tier
   */
  isVoiceModeAllowed(tier: SkillTier, voiceMode: string): boolean {
    const permissions = this.getSkillTierPermissions(tier);
    if (!permissions) return false;

    // Check if explicitly blocked
    if (permissions.blockedVoiceModes.includes(voiceMode)) {
      return false;
    }

    // Check if explicitly allowed (or if no restrictions)
    return (
      permissions.allowedVoiceModes.includes(voiceMode) ||
      permissions.allowedVoiceModes.length === 0
    );
  }

  /**
   * Check if a deal value is within allowed limits for a skill tier
   */
  isDealValueAllowed(tier: SkillTier, dealValue: number): boolean {
    const permissions = this.getSkillTierPermissions(tier);
    return permissions ? dealValue <= permissions.maxDealValue : false;
  }

  /**
   * Check if a skill tier can override decisions
   */
  canOverrideDecisions(tier: SkillTier): boolean {
    const permissions = this.getSkillTierPermissions(tier);
    return permissions ? permissions.canOverrideDecisions : false;
  }

  /**
   * Check if a skill tier requires supervisor approval
   */
  requiresSupervisorApproval(tier: SkillTier): boolean {
    const permissions = this.getSkillTierPermissions(tier);
    return permissions ? permissions.requiresSupervisorApproval : true; // Default to requiring approval
  }

  /**
   * Check if escalation is required for a skill tier
   */
  requiresEscalation(tier: SkillTier): boolean {
    const permissions = this.getSkillTierPermissions(tier);
    return permissions ? permissions.escalationRequired : true; // Default to requiring escalation
  }

  /**
   * Get override policy for a specific override type
   */
  getOverridePolicy(overrideType: OverrideType): OverridePolicy | null {
    return this.policy.overridePolicies[overrideType] || null;
  }

  /**
   * Check if a skill tier can perform a specific override type
   */
  canPerformOverride(tier: SkillTier, overrideType: OverrideType): boolean {
    const overridePolicy = this.getOverridePolicy(overrideType);
    return overridePolicy ? overridePolicy.allowedTiers.includes(tier) : false;
  }

  /**
   * Get risk restrictions for a specific risk level
   */
  getRiskRestrictions(riskLevel: string): RiskRestrictions | null {
    return this.policy.riskRestrictions[riskLevel] || null;
  }

  /**
   * Check if dual approval is required for a risk level
   */
  requiresDualApproval(riskLevel: string): boolean {
    const restrictions = this.getRiskRestrictions(riskLevel);
    return restrictions ? restrictions.requiresDualApproval || false : false;
  }

  /**
   * Check if compliance review is required for a risk level
   */
  requiresComplianceReview(riskLevel: string): boolean {
    const restrictions = this.getRiskRestrictions(riskLevel);
    return restrictions
      ? restrictions.requiresComplianceReview || false
      : false;
  }

  /**
   * Get training requirements for a skill tier
   */
  getTrainingRequirements(tier: SkillTier) {
    return this.policy.trainingRequirements[tier];
  }

  /**
   * Get advancement criteria for tier progression
   */
  getAdvancementCriteria(fromTier: SkillTier, toTier: SkillTier) {
    const key = `${fromTier}_to_${toTier}`;
    return this.policy.advancementCriteria[key];
  }

  /**
   * Check if all actions are audited
   */
  areAllActionsAudited(): boolean {
    return this.policy.auditPolicies.allActionsAudited;
  }

  /**
   * Check if skill tier is included in audit logs
   */
  isSkillTierIncludedInAudit(): boolean {
    return this.policy.auditPolicies.skillTierIncludedInAudit;
  }

  /**
   * Check if override justifications are required
   */
  areOverrideJustificationsRequired(): boolean {
    return this.policy.auditPolicies.overrideJustificationsRequired;
  }

  /**
   * Check if violation escalation is enabled
   */
  isViolationEscalationEnabled(): boolean {
    return this.policy.auditPolicies.violationEscalationEnabled;
  }

  /**
   * Check if compliance reporting is enabled
   */
  isComplianceReportingEnabled(): boolean {
    return this.policy.auditPolicies.complianceReportingEnabled;
  }

  /**
   * Get emergency procedures for a specific scenario
   */
  getEmergencyProcedures(scenario: string) {
    return this.policy.emergencyProcedures[scenario];
  }

  /**
   * Check if emergency procedures allow bypassing restrictions
   */
  canBypassRestrictionsInEmergency(scenario: string, tier: SkillTier): boolean {
    const procedures = this.getEmergencyProcedures(scenario);
    if (!procedures) return false;

    return (
      procedures.allowedTiers.includes(tier) &&
      procedures.bypassNormalRestrictions
    );
  }

  /**
   * Get enforcement mode
   */
  getEnforcementMode(): 'monitor_only' | 'block' {
    return this.policy.enforcementMode;
  }

  /**
   * Check if enforcement should block operations
   */
  shouldBlockOperations(): boolean {
    return this.policy.enforcementMode === 'block';
  }

  /**
   * Get all allowed skill tiers
   */
  getAllowedSkillTiers(): SkillTier[] {
    return Object.keys(this.policy.skillTiers) as SkillTier[];
  }

  /**
   * Get integration points configuration
   */
  getIntegrationPoints() {
    return { ...this.policy.integrationPoints };
  }

  private matchesTransitionPattern(
    pattern: string,
    transition: string
  ): boolean {
    if (pattern === '*') return true;

    // Support wildcard patterns like "state1->*" or "*->state2"
    const regex = new RegExp(`^${pattern.replace(/\*/g, '.*')}$`);
    return regex.test(transition);
  }
}
