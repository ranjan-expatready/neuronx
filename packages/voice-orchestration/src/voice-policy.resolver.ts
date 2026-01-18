import type {
  VoicePolicy,
  VoiceMode,
  VoiceModeRule,
  ScriptRequirements,
} from './voice-policy.schema';
import type { VoiceOutcome } from './voice-outcome.enums';

/**
 * Resolves voice policy decisions and provides convenient access to policy rules
 */
export class VoicePolicyResolver {
  constructor(private readonly policy: VoicePolicy) {}

  /**
   * Get voice mode rule for a specific lead state
   */
  getVoiceModeRule(state: string): VoiceModeRule | null {
    return this.policy.voiceModeRules[state] || null;
  }

  /**
   * Check if a voice mode is allowed for a given state
   */
  isVoiceModeAllowed(state: string, mode: VoiceMode): boolean {
    const rule = this.getVoiceModeRule(state);
    return rule ? rule.allowedModes.includes(mode) : false;
  }

  /**
   * Get default voice mode for a state
   */
  getDefaultVoiceMode(state: string): VoiceMode | null {
    const rule = this.getVoiceModeRule(state);
    return rule ? rule.defaultMode : null;
  }

  /**
   * Get allowed voice modes for a state
   */
  getAllowedVoiceModes(state: string): VoiceMode[] {
    const rule = this.getVoiceModeRule(state);
    return rule ? [...rule.allowedModes] : [];
  }

  /**
   * Check if checklist is required for a state
   */
  requiresChecklist(state: string): boolean {
    const rule = this.getVoiceModeRule(state);
    return rule ? rule.requiresChecklist : false;
  }

  /**
   * Get maximum call duration for a state
   */
  getMaxDurationMinutes(state: string): number {
    const rule = this.getVoiceModeRule(state);
    return rule ? rule.maxDurationMinutes : 5; // Default fallback
  }

  /**
   * Get required scripts for a state
   */
  getRequiredScripts(state: string): string[] {
    const rule = this.getVoiceModeRule(state);
    return rule ? rule.requiredScripts.map(s => s.toString()) : [];
  }

  /**
   * Apply risk overrides to mode selection
   */
  applyRiskOverrides(
    state: string,
    context: {
      dealValue?: number;
      timeOfDay?: string;
      riskLevel?: 'low' | 'medium' | 'high';
      slaPressure?: boolean;
    }
  ): {
    allowedModes: VoiceMode[];
    reason?: string;
    requiresOverride?: boolean;
  } {
    const baseRule = this.getVoiceModeRule(state);
    if (!baseRule) {
      return { allowedModes: [] };
    }

    let allowedModes = [...baseRule.allowedModes];
    let reason: string | undefined;
    let requiresOverride: boolean | undefined;

    // Apply deal value override
    if (context.dealValue && context.dealValue >= 50000) {
      const highValueOverride = this.policy.riskOverrides.high_risk;
      if (highValueOverride) {
        allowedModes = [...highValueOverride.allowedModes];
        reason = highValueOverride.reason;
      }
    }

    // Apply time-based SLA pressure override
    if (context.slaPressure && context.timeOfDay) {
      const slaOverride = this.policy.riskOverrides.sla_pressure;
      if (slaOverride && slaOverride.timeWindows) {
        const currentTime = context.timeOfDay;
        const applicableWindow = slaOverride.timeWindows.find(window => {
          return currentTime >= window.start && currentTime <= window.end;
        });

        if (applicableWindow) {
          allowedModes = [...applicableWindow.allowedModes];
          reason = slaOverride.reason;
        }
      }
    }

    // Apply low confidence rep override
    if (context.riskLevel === 'high') {
      const lowConfidenceOverride =
        this.policy.riskOverrides.low_confidence_rep;
      if (lowConfidenceOverride) {
        allowedModes = [...lowConfidenceOverride.allowedModes];
        reason = lowConfidenceOverride.reason;
        requiresOverride = lowConfidenceOverride.requiresSupervisorOverride;
      }
    }

    return { allowedModes, reason, requiresOverride };
  }

  /**
   * Get script requirements for a voice mode
   */
  getScriptRequirements(mode: VoiceMode): ScriptRequirements | null {
    return this.policy.scriptRequirements[mode] || null;
  }

  /**
   * Check if adlib is allowed for a mode
   */
  allowsAdlib(mode: VoiceMode): boolean {
    const requirements = this.getScriptRequirements(mode);
    return requirements ? requirements.allowAdlib : false;
  }

  /**
   * Check if script order must be enforced
   */
  enforcesScriptOrder(mode: VoiceMode): boolean {
    const requirements = this.getScriptRequirements(mode);
    return requirements ? requirements.enforceOrder : false;
  }

  /**
   * Get maximum deviations allowed for a mode
   */
  getMaxDeviations(mode: VoiceMode): number {
    const requirements = this.getScriptRequirements(mode);
    return requirements ? requirements.maxDeviations : 0;
  }

  /**
   * Check if outcome is allowed
   */
  isOutcomeAllowed(outcome: VoiceOutcome): boolean {
    return this.policy.outcomeRequirements.allowedOutcomes.includes(outcome);
  }

  /**
   * Check if outcome is blocked
   */
  isOutcomeBlocked(outcome: string): boolean {
    return this.policy.outcomeRequirements.blockedOutcomes.includes(outcome);
  }

  /**
   * Get required outcome fields
   */
  getRequiredOutcomeFields(): string[] {
    return [...this.policy.outcomeRequirements.requiredFields];
  }

  /**
   * Check if an event is billable
   */
  isEventBillable(eventType: string): boolean {
    return this.policy.billingRules.billableEvents.includes(eventType);
  }

  /**
   * Get billing rate multiplier for a mode
   */
  getBillingMultiplier(mode: VoiceMode): number {
    return this.policy.billingRules.rateMultipliers[mode] || 1.0;
  }

  /**
   * Check if recording is required
   */
  isRecordingRequired(): boolean {
    return this.policy.complianceRules.recordingRequired;
  }

  /**
   * Get maximum daily calls per lead
   */
  getMaxDailyCallsPerLead(): number {
    return this.policy.complianceRules.maxDailyCallsPerLead;
  }

  /**
   * Get cooldown period between calls
   */
  getCooldownPeriodMinutes(): number {
    return this.policy.complianceRules.cooldownPeriodMinutes;
  }

  /**
   * Get quality thresholds
   */
  getQualityThresholds() {
    return { ...this.policy.qualityThresholds };
  }

  /**
   * Get retry rules
   */
  getRetryRules() {
    return { ...this.policy.retryRules };
  }

  /**
   * Check if emergency overrides are enabled
   */
  areEmergencyOverridesEnabled(): boolean {
    return this.policy.emergencyOverrides.enabled;
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
}
