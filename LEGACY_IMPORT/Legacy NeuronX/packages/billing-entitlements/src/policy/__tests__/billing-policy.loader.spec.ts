import { BillingPolicyLoader } from '../billing-policy.loader';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

describe('BillingPolicyLoader', () => {
  let loader: BillingPolicyLoader;
  const testConfigPath = join(__dirname, 'test-billing-policy.yaml');

  beforeEach(() => {
    loader = new BillingPolicyLoader();
    vi.spyOn(loader['logger'], 'log').mockImplementation(() => {});
    vi.spyOn(loader['logger'], 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
    vi.restoreAllMocks();
  });

  it('should load and validate a valid billing policy file', () => {
    const validConfig = `
      plans:
        FREE:
          name: "Free Plan"
          limits:
            executionsPerMonth: 100
            voiceMinutesPerMonth: 10
            experimentsPerMonth: 1
            teams: 1
            operators: 1
          enforcementMode: "block"
          gracePeriodDays: 0
          warningThresholds: [80, 95]

      usageExtraction:
        voiceEstimates:
          - voiceMode: "SCRIPTED"
            estimatedMinutes: 2
        usageTypeMappings:
          - channels: ["voice"]
            usageType: "VOICE_MINUTE"
            quantity: 0

      enforcement:
        defaultEnforcementMode: "monitor_only"
        defaultGracePeriodDays: 7
        failClosedOnErrors: true

      warningThresholds:
        softWarning: 80
        hardWarning: 90
        criticalWarning: 95
    `;
    writeFileSync(testConfigPath, validConfig);

    const policy = loader.loadPolicy(testConfigPath);
    expect(policy).toBeDefined();
    expect(policy.plans.FREE.name).toBe('Free Plan');
    expect(policy.plans.FREE.limits.executionsPerMonth).toBe(100);
    expect(policy.enforcement.defaultEnforcementMode).toBe('monitor_only');
  });

  it('should throw an error for an invalid policy file (missing required field)', () => {
    const invalidConfig = `
      plans:
        FREE:
          name: "Free Plan"
          limits:
            executionsPerMonth: 100
            voiceMinutesPerMonth: 10
            experimentsPerMonth: 1
            teams: 1
            operators: 1
          enforcementMode: "block"
          gracePeriodDays: 0

      # usageExtraction is missing
      enforcement:
        defaultEnforcementMode: "monitor_only"
        defaultGracePeriodDays: 7
        failClosedOnErrors: true

      warningThresholds:
        softWarning: 80
        hardWarning: 90
        criticalWarning: 95
    `;
    writeFileSync(testConfigPath, invalidConfig);

    expect(() => loader.loadPolicy(testConfigPath)).toThrow(
      'Invalid Billing Policy Configuration'
    );
    expect(loader['logger'].error).toHaveBeenCalledWith(
      expect.stringContaining('Validation error: usageExtraction - Required')
    );
  });

  it('should throw an error for a non-existent file', () => {
    expect(() => loader.loadPolicy('/non/existent/path.yaml')).toThrow(
      'Invalid Billing Policy Configuration'
    );
    expect(loader['logger'].error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to load or validate billing policy')
    );
  });
});
