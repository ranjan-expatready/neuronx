import { describe, it, expect, beforeEach } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import {
  BoundaryPolicyLoader,
  BoundaryPolicyLoadError,
  BoundaryPolicyValidationError,
} from '../boundary-policy.loader';

describe('BoundaryPolicyLoader', () => {
  const testPolicyPath = path.join(__dirname, 'test-policy.yaml');
  const validPolicy = {
    enforcementMode: 'monitor_only' as const,
    businessLogicRules: [
      {
        name: 'scoring_logic',
        description: 'Lead scoring algorithms',
        patterns: ['calculate.*score', 'update.*score'],
      },
    ],
    allowedWorkflowActions: ['send_email', 'send_sms', 'update_contact'],
    deniedWorkflowActions: ['qualify_lead', 'disqualify_lead'],
    allowedPipelineMutations: ['move_to_stage', 'update_status'],
    deniedPipelineMutations: ['create_custom_stage'],
    allowedAiWorkerCapabilities: ['generate_email_content'],
    deniedAiWorkerCapabilities: ['make_decisions'],
    thresholds: {
      maxActionsPerWorkflow: 20,
      maxConditionDepth: 2,
      maxBranchCount: 5,
      maxTriggerCount: 10,
    },
    requireNeuronxTokenHeaderOnWebhookCalls: true,
    riskClassificationRules: {
      unknownActionType: {
        severity: 'LOW' as const,
        requiresReview: false,
      },
    },
    severityLevels: {
      LOW: { description: 'Minor violations', blocksTenant: false },
      MEDIUM: { description: 'Moderate violations', blocksTenant: false },
      HIGH: { description: 'Severe violations', blocksTenant: true },
      CRITICAL: { description: 'Critical violations', blocksTenant: true },
    },
    violationCategories: {
      LOGIC_IN_WORKFLOW: 'Business logic in workflow conditions',
      UNAPPROVED_AUTOMATION_ACTION: 'Actions that perform business decisions',
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

      const policy = BoundaryPolicyLoader.load(testPolicyPath);

      expect(policy.enforcementMode).toBe('monitor_only');
      expect(policy.allowedWorkflowActions).toContain('send_email');
      expect(policy.deniedWorkflowActions).toContain('qualify_lead');
    });

    it('should throw BoundaryPolicyLoadError for missing file', () => {
      const nonExistentPath = '/path/that/does/not/exist.yaml';

      expect(() => BoundaryPolicyLoader.load(nonExistentPath)).toThrow(
        BoundaryPolicyLoadError
      );
    });

    it('should throw BoundaryPolicyValidationError for invalid policy', () => {
      const invalidPolicy = {
        ...validPolicy,
        enforcementMode: 'invalid_mode', // Invalid enum value
      };

      fs.writeFileSync(testPolicyPath, JSON.stringify(invalidPolicy, null, 2));

      expect(() => BoundaryPolicyLoader.load(testPolicyPath)).toThrow(
        BoundaryPolicyValidationError
      );
    });
  });

  describe('validate', () => {
    it('should validate correct policy', () => {
      const result = BoundaryPolicyLoader.validate(validPolicy);
      expect(result.enforcementMode).toBe('monitor_only');
    });

    it('should throw for invalid enforcement mode', () => {
      const invalidPolicy = {
        ...validPolicy,
        enforcementMode: 'invalid' as any,
      };

      expect(() => BoundaryPolicyLoader.validate(invalidPolicy)).toThrow(
        BoundaryPolicyValidationError
      );
    });

    it('should throw for missing required fields', () => {
      const invalidPolicy = {
        ...validPolicy,
        thresholds: undefined, // Required field missing
      };

      expect(() => BoundaryPolicyLoader.validate(invalidPolicy)).toThrow(
        BoundaryPolicyValidationError
      );
    });

    it('should throw for invalid threshold values', () => {
      const invalidPolicy = {
        ...validPolicy,
        thresholds: {
          ...validPolicy.thresholds,
          maxActionsPerWorkflow: -1, // Must be positive
        },
      };

      expect(() => BoundaryPolicyLoader.validate(invalidPolicy)).toThrow(
        BoundaryPolicyValidationError
      );
    });
  });
});
