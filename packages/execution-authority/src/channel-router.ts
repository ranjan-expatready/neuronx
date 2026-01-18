/**
 * Channel Router - WI-034: Multi-Channel Execution Authority
 * WI-043: Channel Routing Policy Configuration
 *
 * Deterministic channel routing with NeuronX authority (REQ-002).
 * External systems cannot influence channel selection.
 * All routing logic now driven by policy configuration.
 */

import {
  ChannelRouter,
  ExecutionContext,
  ExecutionChannel,
  ChannelRoutingRule,
  RoutingCondition,
} from './types';
import { ActorType } from '@neuronx/decision-engine';
import { ExecutionCommand } from '@neuronx/playbook-engine';
import { DecisionResult } from '@neuronx/decision-engine';
import { ChannelRoutingPolicyResolver } from './policy/channel-routing-policy.resolver';

/**
 * Deterministic channel router
 */
export class DeterministicChannelRouter implements ChannelRouter {
  constructor(private readonly policyResolver: ChannelRoutingPolicyResolver) {}

  /**
   * Route execution to appropriate channel based on context using policy-driven logic
   */
  async routeChannel(context: ExecutionContext): Promise<{
    channel: ExecutionChannel;
    reason: string;
    confidence: number;
  }> {
    const {
      executionCommand,
      decisionResult,
      riskScore,
      slaUrgency,
      retryCount,
      dealValue,
    } = context;
    const policy = this.policyResolver.getPolicy();

    // 1. Check SLA urgency overrides (highest priority)
    for (const override of policy.slaUrgencyOverrides) {
      if (
        override.urgency === slaUrgency &&
        (!override.commandTypes ||
          override.commandTypes.includes(executionCommand.commandType))
      ) {
        return {
          channel: override.preferredChannel,
          reason: override.reason,
          confidence: 0.95,
        };
      }
    }

    // 2. Check risk-based channel constraints
    const riskLevel = this.policyResolver.getRiskLevel(riskScore);
    const riskConstraintChannel = policy.riskChannelConstraints[riskLevel];
    if (riskConstraintChannel) {
      return {
        channel: riskConstraintChannel,
        reason: `${riskLevel} risk level requires ${riskConstraintChannel} channel`,
        confidence: 0.9,
      };
    }

    // 3. Check deal value routing
    for (const dealRule of policy.dealValueRouting) {
      if (
        dealValue >= dealRule.minValue &&
        (!dealRule.maxValue || dealValue <= dealRule.maxValue)
      ) {
        return {
          channel: dealRule.preferredChannel,
          reason: dealRule.reason,
          confidence: 0.85,
        };
      }
    }

    // 4. Check retry fallbacks
    for (const retryRule of policy.retryFallbacks) {
      if (retryCount > retryRule.maxRetries) {
        return {
          channel: retryRule.fallbackChannel,
          reason: retryRule.reason,
          confidence: 0.8,
        };
      }
    }

    // 5. Check human-only channel requirements
    for (const humanRule of policy.humanOnlyChannels) {
      if (
        decisionResult.actor === 'HUMAN' &&
        (!humanRule.commandTypes ||
          humanRule.commandTypes.includes(executionCommand.commandType))
      ) {
        return {
          channel: humanRule.requiredChannel,
          reason: humanRule.reason,
          confidence: 0.95,
        };
      }
    }

    // 6. Fallback routing based on command type
    return this.fallbackRouting(executionCommand, decisionResult);
  }

  /**
   * Fallback routing when no rules match - uses policy command fallbacks
   */
  private fallbackRouting(
    command: ExecutionCommand,
    decision: DecisionResult
  ): { channel: ExecutionChannel; reason: string; confidence: number } {
    const fallbacks = this.policyResolver.getCommandFallbacks();

    // Find matching command fallback
    for (const fallback of fallbacks) {
      if (fallback.commandType === command.commandType) {
        return {
          channel: fallback.fallbackChannel,
          reason: fallback.reason,
          confidence: 0.7,
        };
      }
    }

    // Ultimate fallback - use first channel in priority order
    const priorityOrder = this.policyResolver.getChannelPriorityOrder();
    return {
      channel: priorityOrder[0] as ExecutionChannel,
      reason: 'Ultimate fallback to highest priority channel',
      confidence: 0.5,
    };
  }
}
