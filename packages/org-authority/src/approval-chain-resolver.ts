/**
 * Approval Chain Resolver - WI-035: Tenant & Organization Authority Model
 *
 * Deterministic approval requirements for actions based on risk and context.
 */

import {
  ApprovalRequirement,
  ActionContext,
  RiskLevel,
  Capability,
  ActionType,
  VoiceMode,
  ExecutionChannel,
} from './types';

/**
 * Approval chain resolver
 */
export class ApprovalChainResolver {
  /**
   * Get approval requirement for an action context
   */
  getApprovalRequirement(context: ActionContext): ApprovalRequirement {
    const { actionType, riskLevel, dealValue, channel, voiceMode } = context;

    // Base requirements by action type
    const baseRequirement = this.getBaseRequirement(actionType, riskLevel);

    // Adjust for deal value
    const dealAdjusted = this.adjustForDealValue(baseRequirement, dealValue);

    // Adjust for channel and voice mode
    const channelAdjusted = this.adjustForChannel(
      dealAdjusted,
      channel,
      voiceMode
    );

    return channelAdjusted;
  }

  /**
   * Get base approval requirement by action type and risk
   */
  private getBaseRequirement(
    actionType: ActionType,
    riskLevel: RiskLevel
  ): ApprovalRequirement {
    switch (actionType) {
      case ActionType.APPROVE:
        return this.getApprovalRequirementForRisk(riskLevel);

      case ActionType.ASSIST:
        return this.getAssistRequirementForRisk(riskLevel);

      case ActionType.ESCALATE:
        return this.getEscalateRequirementForRisk(riskLevel);

      case ActionType.REVOKE_TOKEN:
        return this.getRevokeTokenRequirementForRisk(riskLevel);

      default:
        return {
          required: false,
          requiredCapabilities: [],
          reason: 'Unknown action type',
        };
    }
  }

  /**
   * Get approval requirement based on risk level
   */
  private getApprovalRequirementForRisk(
    riskLevel: RiskLevel
  ): ApprovalRequirement {
    switch (riskLevel) {
      case RiskLevel.CRITICAL:
        return {
          required: true,
          requiredCapabilities: [Capability.APPROVE_HIGH_RISK_EXECUTION],
          reason: 'Critical risk requires high-risk approval capability',
          escalationRole: 'ENTERPRISE_ADMIN',
        };

      case RiskLevel.HIGH:
        return {
          required: true,
          requiredCapabilities: [Capability.APPROVE_HIGH_RISK_EXECUTION],
          reason: 'High risk requires high-risk approval capability',
          escalationRole: 'AGENCY_ADMIN',
        };

      case RiskLevel.MEDIUM:
        return {
          required: true,
          requiredCapabilities: [Capability.APPROVE_MEDIUM_RISK_EXECUTION],
          reason: 'Medium risk requires medium-risk approval capability',
          escalationRole: 'TEAM_LEAD',
        };

      case RiskLevel.LOW:
        return {
          required: false,
          requiredCapabilities: [],
          reason: 'Low risk does not require approval',
        };

      default:
        return {
          required: true,
          requiredCapabilities: [Capability.APPROVE_HIGH_RISK_EXECUTION],
          reason: 'Unknown risk level requires high-risk approval',
          escalationRole: 'ENTERPRISE_ADMIN',
        };
    }
  }

  /**
   * Get assist requirement based on risk level
   */
  private getAssistRequirementForRisk(
    riskLevel: RiskLevel
  ): ApprovalRequirement {
    // Assist actions generally require lower authority
    switch (riskLevel) {
      case RiskLevel.CRITICAL:
      case RiskLevel.HIGH:
      case RiskLevel.MEDIUM:
        return {
          required: true,
          requiredCapabilities: [Capability.ASSIST_EXECUTION],
          reason: 'Assist actions require execution assistance capability',
          escalationRole: 'TEAM_LEAD',
        };

      case RiskLevel.LOW:
        return {
          required: true,
          requiredCapabilities: [Capability.ASSIST_EXECUTION],
          reason: 'Even low-risk assist actions require capability',
          escalationRole: 'OPERATOR',
        };

      default:
        return {
          required: true,
          requiredCapabilities: [Capability.ASSIST_EXECUTION],
          reason: 'Unknown risk level requires execution assistance capability',
          escalationRole: 'TEAM_LEAD',
        };
    }
  }

  /**
   * Get escalate requirement based on risk level
   */
  private getEscalateRequirementForRisk(
    riskLevel: RiskLevel
  ): ApprovalRequirement {
    return {
      required: true,
      requiredCapabilities: [Capability.ESCALATE_EXECUTION],
      reason: 'Escalation actions require escalation capability',
      escalationRole: 'TEAM_LEAD',
    };
  }

  /**
   * Get revoke token requirement based on risk level
   */
  private getRevokeTokenRequirementForRisk(
    riskLevel: RiskLevel
  ): ApprovalRequirement {
    switch (riskLevel) {
      case RiskLevel.CRITICAL:
      case RiskLevel.HIGH:
        return {
          required: true,
          requiredCapabilities: [Capability.REVOKE_EXECUTION_TOKENS],
          reason: 'High-risk token revocation requires revocation capability',
          escalationRole: 'AGENCY_ADMIN',
        };

      case RiskLevel.MEDIUM:
      case RiskLevel.LOW:
        return {
          required: true,
          requiredCapabilities: [Capability.REVOKE_EXECUTION_TOKENS],
          reason: 'Token revocation requires revocation capability',
          escalationRole: 'TEAM_LEAD',
        };

      default:
        return {
          required: true,
          requiredCapabilities: [Capability.REVOKE_EXECUTION_TOKENS],
          reason: 'Unknown risk level requires token revocation capability',
          escalationRole: 'AGENCY_ADMIN',
        };
    }
  }

  /**
   * Adjust approval requirement based on deal value
   */
  private adjustForDealValue(
    requirement: ApprovalRequirement,
    dealValue?: number
  ): ApprovalRequirement {
    if (!dealValue || !requirement.required) {
      return requirement;
    }

    // High-value deals (>= $100k) require higher approval
    if (dealValue >= 100000) {
      if (
        !requirement.requiredCapabilities.includes(
          Capability.APPROVE_HIGH_RISK_EXECUTION
        )
      ) {
        return {
          ...requirement,
          requiredCapabilities: [Capability.APPROVE_HIGH_RISK_EXECUTION],
          reason: `${requirement.reason} (escalated due to high deal value: $${dealValue.toLocaleString()})`,
          escalationRole: 'ENTERPRISE_ADMIN',
        };
      }
    }

    return requirement;
  }

  /**
   * Adjust approval requirement based on channel and voice mode
   */
  private adjustForChannel(
    requirement: ApprovalRequirement,
    channel?: ExecutionChannel,
    voiceMode?: VoiceMode
  ): ApprovalRequirement {
    if (!requirement.required) {
      return requirement;
    }

    let adjustedReason = requirement.reason;
    let escalationRole = requirement.escalationRole;

    // Voice channel specific adjustments
    if (channel === ExecutionChannel.VOICE) {
      if (voiceMode === VoiceMode.SCRIPTED) {
        // Scripted voice with medium/high risk requires approval
        adjustedReason += ' (scripted voice execution)';
      } else if (voiceMode === VoiceMode.CONVERSATIONAL) {
        // Conversational AI is higher risk
        if (
          !requirement.requiredCapabilities.includes(
            Capability.APPROVE_HIGH_RISK_EXECUTION
          )
        ) {
          return {
            ...requirement,
            requiredCapabilities: [Capability.APPROVE_HIGH_RISK_EXECUTION],
            reason: `${requirement.reason} (conversational voice requires high-risk approval)`,
            escalationRole: 'AGENCY_ADMIN',
          };
        }
      } else if (voiceMode === VoiceMode.HUMAN_ONLY) {
        // Human-only voice should not require approval for basic operations
        // but still requires capability for oversight
        adjustedReason += ' (human-only voice execution)';
      }
    }

    // SMS channel for urgent communications
    if (channel === ExecutionChannel.SMS) {
      adjustedReason += ' (SMS channel)';
    }

    // Email channel adjustments
    if (channel === ExecutionChannel.EMAIL) {
      adjustedReason += ' (email channel)';
    }

    return {
      ...requirement,
      reason: adjustedReason,
      escalationRole: escalationRole || requirement.escalationRole,
    };
  }

  /**
   * Check if an action requires approval
   */
  requiresApproval(context: ActionContext): boolean {
    const requirement = this.getApprovalRequirement(context);
    return requirement.required;
  }

  /**
   * Get required capabilities for an action
   */
  getRequiredCapabilities(context: ActionContext): Capability[] {
    const requirement = this.getApprovalRequirement(context);
    return requirement.requiredCapabilities;
  }

  /**
   * Get approval reason for an action
   */
  getApprovalReason(context: ActionContext): string {
    const requirement = this.getApprovalRequirement(context);
    return requirement.reason;
  }

  /**
   * Get escalation role for an action
   */
  getEscalationRole(context: ActionContext): string | undefined {
    const requirement = this.getApprovalRequirement(context);
    return requirement.escalationRole;
  }

  /**
   * Validate approval chain logic
   */
  validateApprovalChain(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // Test various scenarios to ensure deterministic behavior
    const testCases = [
      { actionType: ActionType.APPROVE, riskLevel: RiskLevel.LOW },
      { actionType: ActionType.APPROVE, riskLevel: RiskLevel.MEDIUM },
      { actionType: ActionType.APPROVE, riskLevel: RiskLevel.HIGH },
      { actionType: ActionType.APPROVE, riskLevel: RiskLevel.CRITICAL },
      { actionType: ActionType.ASSIST, riskLevel: RiskLevel.MEDIUM },
      { actionType: ActionType.ESCALATE, riskLevel: RiskLevel.HIGH },
      { actionType: ActionType.REVOKE_TOKEN, riskLevel: RiskLevel.CRITICAL },
    ];

    for (const testCase of testCases) {
      try {
        const result1 = this.getApprovalRequirement(testCase);
        const result2 = this.getApprovalRequirement(testCase);

        // Ensure deterministic results
        if (JSON.stringify(result1) !== JSON.stringify(result2)) {
          errors.push(
            `Non-deterministic result for ${JSON.stringify(testCase)}`
          );
        }

        // Ensure capabilities are valid
        for (const cap of result1.requiredCapabilities) {
          if (!Object.values(Capability).includes(cap)) {
            errors.push(
              `Invalid capability ${cap} in result for ${JSON.stringify(testCase)}`
            );
          }
        }
      } catch (error) {
        errors.push(
          `Error in test case ${JSON.stringify(testCase)}: ${error.message}`
        );
      }
    }

    return { valid: errors.length === 0, errors };
  }
}
