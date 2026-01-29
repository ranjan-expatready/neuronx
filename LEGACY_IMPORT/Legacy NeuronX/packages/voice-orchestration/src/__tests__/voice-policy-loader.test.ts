import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  VoicePolicyLoader,
  VoicePolicyLoadError,
  VoicePolicyValidationError,
} from '../voice-policy.loader';

describe('VoicePolicyLoader', () => {
  const testPolicyPath = path.join(__dirname, 'test-voice-policy.yaml');
  const validPolicy = {
    enforcementMode: 'monitor_only' as const,
    voiceModeRules: {
      prospect_identified: {
        allowedModes: ['HUMAN_ONLY', 'ASSISTED'],
        defaultMode: 'ASSISTED',
        requiresChecklist: true,
        maxDurationMinutes: 5,
        requiredScripts: ['QUALIFICATION'],
      },
    },
    riskOverrides: {},
    scriptRequirements: {
      AUTONOMOUS: {
        requiredScripts: ['ACKNOWLEDGMENT'],
        allowAdlib: false,
        enforceOrder: true,
        maxDeviations: 0,
      },
      ASSISTED: {
        requiredScripts: ['QUALIFICATION_CHECKLIST'],
        allowAdlib: true,
        enforceOrder: false,
        maxDeviations: 3,
      },
      HUMAN_ONLY: {
        requiredScripts: ['OUTCOME_LOGGING'],
        allowAdlib: true,
        enforceOrder: false,
        maxDeviations: 10,
      },
    },
    qualityThresholds: {
      minConfidenceScore: 0.7,
      maxBackgroundNoise: 0.3,
      minSpeechClarity: 0.6,
      maxLatencyMs: 500,
    },
    retryRules: {
      maxRetries: 3,
      backoffMultiplier: 2,
      maxBackoffMinutes: 60,
      escalationTriggers: [],
    },
    outcomeRequirements: {
      requiredFields: ['outcome', 'duration_seconds'],
      allowedOutcomes: ['CONTACTED_SUCCESSFUL', 'NO_ANSWER'],
      blockedOutcomes: ['DIRECT_STATE_CHANGE'],
    },
    billingRules: {
      billableEvents: ['ANSWERED_CALL'],
      nonBillableEvents: ['NO_ANSWER'],
      rateMultipliers: {
        AUTONOMOUS: 0.8,
        ASSISTED: 1.0,
        HUMAN_ONLY: 1.2,
      },
    },
    complianceRules: {
      recordingRequired: true,
      piiMaskingEnabled: true,
      auditRetentionDays: 2555,
      maxDailyCallsPerLead: 3,
      cooldownPeriodMinutes: 60,
    },
    emergencyOverrides: {
      enabled: false,
      allowedModes: ['HUMAN_ONLY'],
      requiresApproval: true,
      approvalTimeoutHours: 24,
    },
  };

  beforeEach(() => {
    // Clean up any existing test files
    if (fs.existsSync(testPolicyPath)) {
      fs.unlinkSync(testPolicyPath);
    }
  });

  afterEach(() => {
    // Clean up test files
    if (fs.existsSync(testPolicyPath)) {
      fs.unlinkSync(testPolicyPath);
    }
  });

  describe('load', () => {
    it('should load valid policy file', () => {
      // Write valid policy to test file
      fs.writeFileSync(testPolicyPath, JSON.stringify(validPolicy, null, 2));

      const policy = VoicePolicyLoader.load(testPolicyPath);

      expect(policy.enforcementMode).toBe('monitor_only');
      expect(policy.voiceModeRules.prospect_identified.defaultMode).toBe(
        'ASSISTED'
      );
      expect(policy.complianceRules.recordingRequired).toBe(true);
    });

    it('should throw VoicePolicyLoadError for missing file', () => {
      const nonExistentPath = '/path/that/does/not/exist.yaml';

      expect(() => VoicePolicyLoader.load(nonExistentPath)).toThrow(
        VoicePolicyLoadError
      );
    });

    it('should throw VoicePolicyValidationError for invalid policy', () => {
      const invalidPolicy = {
        ...validPolicy,
        enforcementMode: 'invalid_mode', // Invalid enum value
      };

      fs.writeFileSync(testPolicyPath, JSON.stringify(invalidPolicy, null, 2));

      expect(() => VoicePolicyLoader.load(testPolicyPath)).toThrow(
        VoicePolicyValidationError
      );
    });
  });

  describe('validate', () => {
    it('should validate correct policy', () => {
      const result = VoicePolicyLoader.validate(validPolicy);
      expect(result.enforcementMode).toBe('monitor_only');
      expect(result.voiceModeRules.prospect_identified).toBeDefined();
    });

    it('should throw for invalid enforcement mode', () => {
      const invalidPolicy = {
        ...validPolicy,
        enforcementMode: 'invalid' as any,
      };

      expect(() => VoicePolicyLoader.validate(invalidPolicy)).toThrow(
        VoicePolicyValidationError
      );
    });

    it('should throw for missing required fields', () => {
      const invalidPolicy = {
        ...validPolicy,
        qualityThresholds: undefined, // Required field missing
      };

      expect(() => VoicePolicyLoader.validate(invalidPolicy)).toThrow(
        VoicePolicyValidationError
      );
    });

    it('should throw for invalid threshold values', () => {
      const invalidPolicy = {
        ...validPolicy,
        qualityThresholds: {
          ...validPolicy.qualityThresholds,
          minConfidenceScore: 1.5, // Must be <= 1.0
        },
      };

      expect(() => VoicePolicyLoader.validate(invalidPolicy)).toThrow(
        VoicePolicyValidationError
      );
    });

    it('should throw for invalid script requirements', () => {
      const invalidPolicy = {
        ...validPolicy,
        scriptRequirements: {
          ...validPolicy.scriptRequirements,
          INVALID_MODE: {
            // Invalid voice mode
            requiredScripts: [],
            allowAdlib: false,
            enforceOrder: false,
            maxDeviations: 0,
          },
        },
      };

      expect(() => VoicePolicyLoader.validate(invalidPolicy)).toThrow(
        VoicePolicyValidationError
      );
    });
  });
});
