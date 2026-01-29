import { PlanMappingPolicyLoader } from '../plan-mapping-policy.loader';
import { readFileSync, writeFileSync, unlinkSync, existsSync } from 'fs';
import { join } from 'path';
import { beforeEach, afterEach, describe, it, expect, vi } from 'vitest';

describe('PlanMappingPolicyLoader', () => {
  let loader: PlanMappingPolicyLoader;
  const testConfigPath = join(__dirname, 'test-plan-mapping-policy.yaml');

  beforeEach(() => {
    loader = new PlanMappingPolicyLoader();
    vi.spyOn(loader['logger'], 'log').mockImplementation(() => {});
    vi.spyOn(loader['logger'], 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    if (existsSync(testConfigPath)) {
      unlinkSync(testConfigPath);
    }
    vi.restoreAllMocks();
  });

  it('should load and validate a valid plan mapping policy file', () => {
    const validConfig = `
      version: "1.0.0"
      description: "Test plan mapping policy"
      productMappings:
        - ghlProductId: "prod_free"
          neuronxPlanTier: "FREE"
          description: "Free plan"
          enabled: true
        - ghlProductId: "prod_pro"
          neuronxPlanTier: "PRO"
          description: "Pro plan"
          sku: "pro_monthly"
          enabled: true
      fallback:
        behavior: "grace_with_alert"
        defaultTier: "FREE"
        alertChannels: ["test@example.com"]
        gracePeriodDays: 7
      auditEnabled: true
      alertOnFallback: true
    `;
    writeFileSync(testConfigPath, validConfig);

    const policy = loader.loadPolicy(testConfigPath);
    expect(policy).toBeDefined();
    expect(policy.version).toBe('1.0.0');
    expect(policy.productMappings).toHaveLength(2);
    expect(policy.fallback.behavior).toBe('grace_with_alert');
  });

  it('should throw an error for an invalid policy file (missing required field)', () => {
    const invalidConfig = `
      version: "1.0.0"
      productMappings: []
      # fallback is missing
      auditEnabled: true
    `;
    writeFileSync(testConfigPath, invalidConfig);

    expect(() => loader.loadPolicy(testConfigPath)).toThrow(
      'Invalid Plan Mapping Policy Configuration'
    );
    expect(loader['logger'].error).toHaveBeenCalledWith(
      expect.stringContaining('Validation error: fallback - Required')
    );
  });

  it('should validate business rules (duplicate product IDs)', () => {
    const invalidConfig = `
      version: "1.0.0"
      productMappings:
        - ghlProductId: "prod_duplicate"
          neuronxPlanTier: "FREE"
          enabled: true
        - ghlProductId: "prod_duplicate"
          neuronxPlanTier: "PRO"
          enabled: true
      fallback:
        behavior: "default_tier"
        defaultTier: "FREE"
      auditEnabled: true
    `;
    writeFileSync(testConfigPath, invalidConfig);

    expect(() => loader.loadPolicy(testConfigPath)).toThrow(
      'Policy validation failed: Duplicate GHL product ID: prod_duplicate'
    );
  });

  it('should validate fallback configuration', () => {
    const invalidConfig = `
      version: "1.0.0"
      productMappings: []
      fallback:
        behavior: "default_tier"
        # defaultTier is missing
      auditEnabled: true
    `;
    writeFileSync(testConfigPath, invalidConfig);

    expect(() => loader.loadPolicy(testConfigPath)).toThrow(
      'Policy validation failed: Fallback behavior is "default_tier" but no defaultTier specified'
    );
  });

  it('should throw an error for a non-existent file', () => {
    expect(() => loader.loadPolicy('/non/existent/path.yaml')).toThrow(
      'Invalid Plan Mapping Policy Configuration'
    );
    expect(loader['logger'].error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to load or validate plan mapping policy')
    );
  });
});
