/**
 * Decision Policy Loader Tests - WI-042
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import * as fs from 'fs';
import { DecisionPolicyLoader } from '../decision-policy.loader';

// Mock fs module
vi.mock('fs', () => ({
  readFileSync: vi.fn(),
  existsSync: vi.fn(),
}));

// Mock path
vi.mock('path', () => ({
  join: vi.fn((...args) => args.join('/')),
}));

describe('DecisionPolicyLoader', () => {
  let loader: DecisionPolicyLoader;

  beforeEach(() => {
    loader = new DecisionPolicyLoader();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('onModuleInit', () => {
    it('should load and validate policy successfully', async () => {
      const mockPolicyYaml = `
version: "1.0.0"
description: "Test policy"
enforcementMode: "monitor_only"
riskThresholds:
  aiAllowed: "MEDIUM"
  humanRequired: "HIGH"
  approvalRequired: "CRITICAL"
dealValueThresholds:
  low: 10000
  medium: 100000
  high: 100000
metadata:
  createdAt: "2024-01-01T00:00:00Z"
  createdBy: "Test"
  lastModified: "2024-01-01T00:00:00Z"
  lastModifiedBy: "Test"
  changeReason: "Test policy"
`;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockPolicyYaml);

      await loader.onModuleInit();

      expect(loader.getPolicy().version).toBe('1.0.0');
      expect(loader.getEnforcementMode()).toBe('monitor_only');
    });

    it('should fail fast on invalid policy file', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);

      await expect(loader.onModuleInit()).rejects.toThrow(
        'Decision policy file not found'
      );
    });

    it('should fail fast on invalid YAML', async () => {
      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue('invalid: yaml: [content');

      await expect(loader.onModuleInit()).rejects.toThrow(
        'Failed to parse decision policy YAML'
      );
    });

    it('should fail fast on invalid policy schema', async () => {
      const invalidPolicyYaml = `
version: "1.0.0"
description: "Invalid policy - missing required fields"
`;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(invalidPolicyYaml);

      await expect(loader.onModuleInit()).rejects.toThrow(
        'Invalid decision policy configuration'
      );
    });
  });

  describe('getPolicy', () => {
    it('should throw error if policy not loaded', () => {
      expect(() => loader.getPolicy()).toThrow('Decision policy not loaded');
    });
  });

  describe('Policy value accessors', () => {
    beforeEach(async () => {
      const mockPolicyYaml = `
version: "1.0.0"
description: "Test policy"
enforcementMode: "block"
riskThresholds:
  aiAllowed: "MEDIUM"
  humanRequired: "HIGH"
  approvalRequired: "CRITICAL"
dealValueThresholds:
  low: 10000
  medium: 100000
  high: 100000
slaUrgencyMapping:
  low: "LOW"
  normal: "MEDIUM"
  high: "HIGH"
  critical: "CRITICAL"
voiceModeRules:
  scriptedRequired: "HIGH"
  conversationalAllowed: "LOW"
voiceConstraints:
  maxDurationMinutes: 15
  scriptedConfidenceThreshold: 0.8
  conversationalRiskLimit: "LOW"
actorSelectionRules:
  aiConfidenceThreshold: 0.7
  hybridActorThreshold: 0.5
  humanFallbackEnabled: true
executionModeRules:
  autonomousMaxRisk: "LOW"
  assistedMinRisk: "MEDIUM"
  approvalMinRisk: "HIGH"
  hybridAlwaysAssisted: true
escalationRules:
  criticalRiskAlwaysEscalate: true
  highValueDealThreshold: 100000
  retryCountEscalationThreshold: 3
  slaCriticalEscalation: true
retryLimits:
  beforeEscalation: 3
  beforeHumanOverride: 5
features:
  voiceExecution: true
  aiActors: true
  hybridActors: true
  riskAssessment: true
  escalationWorkflow: true
metadata:
  createdAt: "2024-01-01T00:00:00Z"
  createdBy: "Test"
  lastModified: "2024-01-01T00:00:00Z"
  lastModifiedBy: "Test"
  changeReason: "Test policy"
`;

      vi.mocked(fs.existsSync).mockReturnValue(true);
      vi.mocked(fs.readFileSync).mockReturnValue(mockPolicyYaml);

      await loader.onModuleInit();
    });

    it('should return enforcement mode', () => {
      expect(loader.getEnforcementMode()).toBe('block');
    });

    it('should return risk thresholds', () => {
      const thresholds = loader.getRiskThresholds();
      expect(thresholds.aiAllowed).toBe('MEDIUM');
      expect(thresholds.humanRequired).toBe('HIGH');
      expect(thresholds.approvalRequired).toBe('CRITICAL');
    });

    it('should return deal value thresholds', () => {
      const thresholds = loader.getDealValueThresholds();
      expect(thresholds.low).toBe(10000);
      expect(thresholds.medium).toBe(100000);
      expect(thresholds.high).toBe(100000);
    });

    it('should return SLA urgency mapping', () => {
      const mapping = loader.getSlaUrgencyMapping();
      expect(mapping.critical).toBe('CRITICAL');
      expect(mapping.low).toBe('LOW');
    });

    it('should return voice mode rules', () => {
      const rules = loader.getVoiceModeRules();
      expect(rules.scriptedRequired).toBe('HIGH');
      expect(rules.conversationalAllowed).toBe('LOW');
    });

    it('should return retry limits', () => {
      const limits = loader.getRetryLimits();
      expect(limits.beforeEscalation).toBe(3);
      expect(limits.beforeHumanOverride).toBe(5);
    });

    it('should return feature flags', () => {
      const features = loader.getFeatures();
      expect(features.voiceExecution).toBe(true);
      expect(features.aiActors).toBe(true);
      expect(features.escalationWorkflow).toBe(true);
    });
  });
});
