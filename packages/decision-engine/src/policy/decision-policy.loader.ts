/**
 * Decision Policy Loader - WI-042: Decision Policy Configuration
 *
 * Loads and validates decision policy from YAML configuration file.
 * Provides fail-fast validation at startup.
 */

import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import * as yaml from 'js-yaml';
import {
  DecisionPolicySchema,
  DecisionPolicy,
  PolicyLoadResult,
  PolicyValidationError,
  DecisionEnforcementMode,
} from './decision-policy.types';

@Injectable()
export class DecisionPolicyLoader implements OnModuleInit {
  private readonly logger = new Logger(DecisionPolicyLoader.name);
  private policy: DecisionPolicy | null = null;

  /**
   * Load and validate policy on module initialization
   * Fails fast if policy is invalid
   */
  async onModuleInit(): Promise<void> {
    try {
      const result = await this.loadAndValidatePolicy();

      if (!result.valid) {
        const errorMessages = result.errors
          .map(err => `${err.path}: ${err.message}`)
          .join('\n');

        this.logger.error(
          `Decision policy validation failed:\n${errorMessages}`
        );
        throw new Error(
          `Invalid decision policy configuration: ${errorMessages}`
        );
      }

      // Log warnings but don't fail
      if (result.warnings.length > 0) {
        this.logger.warn(
          `Decision policy warnings:\n${result.warnings.join('\n')}`
        );
      }

      this.policy = result.policy;
      this.logger.log(
        `Decision policy v${result.policy.version} loaded successfully`
      );
    } catch (error) {
      this.logger.error(`Failed to load decision policy: ${error.message}`);
      throw error; // Fail fast on startup
    }
  }

  /**
   * Get the loaded policy (guaranteed to be valid after onModuleInit)
   */
  getPolicy(): DecisionPolicy {
    if (!this.policy) {
      throw new Error(
        'Decision policy not loaded. Ensure onModuleInit has completed.'
      );
    }
    return this.policy;
  }

  /**
   * Get policy value with type safety
   */
  get<TKey extends keyof DecisionPolicy>(key: TKey): DecisionPolicy[TKey] {
    const policy = this.getPolicy();
    return policy[key];
  }

  /**
   * Get enforcement mode from policy
   */
  getEnforcementMode(): DecisionEnforcementMode {
    return this.get('enforcementMode');
  }

  /**
   * Get risk thresholds from policy
   */
  getRiskThresholds() {
    return this.get('riskThresholds');
  }

  /**
   * Get deal value thresholds from policy
   */
  getDealValueThresholds() {
    return this.get('dealValueThresholds');
  }

  /**
   * Get SLA urgency mapping from policy
   */
  getSlaUrgencyMapping() {
    return this.get('slaUrgencyMapping');
  }

  /**
   * Get voice mode rules from policy
   */
  getVoiceModeRules() {
    return this.get('voiceModeRules');
  }

  /**
   * Get voice constraints from policy
   */
  getVoiceConstraints() {
    return this.get('voiceConstraints');
  }

  /**
   * Get actor selection rules from policy
   */
  getActorSelectionRules() {
    return this.get('actorSelectionRules');
  }

  /**
   * Get execution mode rules from policy
   */
  getExecutionModeRules() {
    return this.get('executionModeRules');
  }

  /**
   * Get escalation rules from policy
   */
  getEscalationRules() {
    return this.get('escalationRules');
  }

  /**
   * Get retry limits from policy
   */
  getRetryLimits() {
    return this.get('retryLimits');
  }

  /**
   * Get feature flags from policy
   */
  getFeatures() {
    return this.get('features');
  }

  /**
   * Load and validate policy from file system
   */
  private async loadAndValidatePolicy(): Promise<PolicyLoadResult> {
    const policyPath = this.getPolicyFilePath();

    if (!existsSync(policyPath)) {
      throw new Error(`Decision policy file not found: ${policyPath}`);
    }

    let rawContent: string;
    try {
      rawContent = readFileSync(policyPath, 'utf-8');
    } catch (error) {
      throw new Error(`Failed to read decision policy file: ${error.message}`);
    }

    let parsedContent: any;
    try {
      parsedContent = yaml.load(rawContent);
    } catch (error) {
      throw new Error(`Failed to parse decision policy YAML: ${error.message}`);
    }

    // Validate against schema
    const validationResult = DecisionPolicySchema.safeParse(parsedContent);

    const result: PolicyLoadResult = {
      policy: parsedContent,
      errors: [],
      warnings: [],
      valid: validationResult.success,
    };

    if (!validationResult.success) {
      result.errors = validationResult.error.errors.map(err => ({
        path: err.path.join('.'),
        message: err.message,
        value: err.code === 'invalid_type' ? parsedContent : undefined,
      }));
    } else {
      result.policy = validationResult.data;

      // Check for potential issues and add warnings
      result.warnings = this.validatePolicyConsistency(validationResult.data);
    }

    return result;
  }

  /**
   * Get the policy file path
   */
  private getPolicyFilePath(): string {
    // Check for environment variable override
    const overridePath = process.env.DECISION_POLICY_PATH;
    if (overridePath) {
      return overridePath;
    }

    // Default to config/decision-policy.yaml relative to project root
    return join(process.cwd(), 'config', 'decision-policy.yaml');
  }

  /**
   * Validate policy consistency and add warnings for potential issues
   */
  private validatePolicyConsistency(policy: DecisionPolicy): string[] {
    const warnings: string[] = [];

    // Check for potentially dangerous combinations
    if (
      policy.enforcementMode === 'monitor_only' &&
      policy.features.escalationWorkflow
    ) {
      warnings.push(
        'Monitor mode with escalation workflow enabled may cause confusion'
      );
    }

    // Check for overly permissive AI thresholds
    if (policy.riskThresholds.aiAllowed === 'CRITICAL') {
      warnings.push(
        'AI allowed for CRITICAL risk may be unsafe for production'
      );
    }

    // Check for conflicting voice rules
    if (
      policy.voiceModeRules.conversationalAllowed === 'CRITICAL' &&
      policy.voiceConstraints.conversationalRiskLimit === 'LOW'
    ) {
      warnings.push(
        'Voice mode rules conflict: conversational allowed for all risks but limited to LOW risk'
      );
    }

    // Check for very low AI confidence thresholds
    if (policy.actorSelectionRules.aiConfidenceThreshold < 0.5) {
      warnings.push(
        'Very low AI confidence threshold may result in poor execution quality'
      );
    }

    // Check for feature flag consistency
    if (
      !policy.features.aiActors &&
      policy.actorSelectionRules.aiConfidenceThreshold > 0
    ) {
      warnings.push('AI actors disabled but AI confidence threshold is set');
    }

    // Check for deal value threshold ordering
    const { low, medium, high } = policy.dealValueThresholds;
    if (low >= medium || medium > high) {
      warnings.push(
        'Deal value thresholds are not properly ordered (low < medium <= high)'
      );
    }

    return warnings;
  }
}
