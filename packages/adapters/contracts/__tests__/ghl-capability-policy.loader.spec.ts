import { GhlCapabilityPolicyLoader } from '../ghl-capability-policy.loader';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

describe('GhlCapabilityPolicyLoader', () => {
  let loader: GhlCapabilityPolicyLoader;
  const testConfigPath = join(__dirname, 'test-ghl-capability-policy.yaml');

  beforeEach(() => {
    loader = new GhlCapabilityPolicyLoader();
    vi.spyOn(loader['logger'], 'log').mockImplementation(() => {});
    vi.spyOn(loader['logger'], 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
    vi.restoreAllMocks();
  });

  it('should load and validate a valid GHL capability policy file', () => {
    const validConfig = `
      version: "1.0.0"
      description: "Test GHL capability policy"
      planCapabilityMatrices:
        - planTier: "FREE"
          description: "Free plan capabilities"
          capabilities:
            - capability: "crm_create_lead"
              enforcementMode: "allow_with_audit"
              limits:
                maxRequestsPerHour: 10
              description: "Basic lead creation"
              enabled: true
      fallback:
        behavior: "grace_with_alert"
        alertChannels: ["test@example.com"]
        gracePeriodDays: 7
      audit:
        auditCapabilityUsage: true
        auditCapabilityDenials: true
        auditCapabilityLimitsExceeded: true
        auditRetentionDays: 90
    `;
    writeFileSync(testConfigPath, validConfig);

    const policy = loader.loadPolicy(testConfigPath);
    expect(policy).toBeDefined();
    expect(policy.version).toBe('1.0.0');
    expect(policy.planCapabilityMatrices).toHaveLength(1);
    expect(policy.fallback.behavior).toBe('grace_with_alert');
  });

  it('should validate business rules (duplicate capabilities)', () => {
    const invalidConfig = `
      version: "1.0.0"
      planCapabilityMatrices:
        - planTier: "FREE"
          capabilities:
            - capability: "crm_create_lead"
              enforcementMode: "allow_with_audit"
              enabled: true
            - capability: "crm_create_lead"
              enforcementMode: "block"
              enabled: true
      fallback:
        behavior: "grace_with_alert"
      audit:
        auditCapabilityUsage: true
    `;
    writeFileSync(testConfigPath, invalidConfig);

    expect(() => loader.loadPolicy(testConfigPath)).toThrow(
      'Duplicate capability crm_create_lead in plan FREE'
    );
  });

  it('should validate required capabilities per plan', () => {
    const invalidConfig = `
      version: "1.0.0"
      planCapabilityMatrices:
        - planTier: "FREE"
          capabilities:
            # Missing crm_create_lead and crm_list_leads
            - capability: "conversation_send_message"
              enforcementMode: "allow_with_audit"
              enabled: true
      fallback:
        behavior: "grace_with_alert"
      audit:
        auditCapabilityUsage: true
    `;
    writeFileSync(testConfigPath, invalidConfig);

    expect(() => loader.loadPolicy(testConfigPath)).toThrow(
      'Plan FREE missing required capability: crm_create_lead'
    );
  });

  it('should throw an error for a non-existent file', () => {
    expect(() => loader.loadPolicy('/non/existent/path.yaml')).toThrow(
      'Invalid GHL Capability Policy Configuration'
    );
    expect(loader['logger'].error).toHaveBeenCalledWith(
      expect.stringContaining(
        'Failed to load or validate GHL capability policy'
      )
    );
  });
});
