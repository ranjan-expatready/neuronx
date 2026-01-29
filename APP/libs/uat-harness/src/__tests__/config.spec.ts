/**
 * UAT Configuration Tests - WI-066: UAT Harness + Seed + Safety
 */

import { loadUatConfig, getUatConfig, clearUatConfigCache } from '../config';

describe('UAT Configuration', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    clearUatConfigCache();
  });

  afterEach(() => {
    process.env = originalEnv;
    clearUatConfigCache();
  });

  describe('loadUatConfig', () => {
    it('should load default configuration when no env vars set', () => {
      const config = loadUatConfig();

      expect(config.neuronxEnv).toBe('dev');
      expect(config.uatTenantIds).toEqual([]);
      expect(config.uatMode).toBe('dry_run');
      expect(config.uatKillSwitch).toBe(true);
      expect(config.uatLabelPrefix).toBe('[UAT]');
    });

    it('should parse NEURONX_ENV correctly', () => {
      process.env.NEURONX_ENV = 'uat';
      const config = loadUatConfig();
      expect(config.neuronxEnv).toBe('uat');

      process.env.NEURONX_ENV = 'prod';
      clearUatConfigCache();
      const prodConfig = loadUatConfig();
      expect(prodConfig.neuronxEnv).toBe('prod');
    });

    it('should parse UAT_TENANT_IDS as comma-separated list', () => {
      process.env.UAT_TENANT_IDS = 'tenant1,tenant2,tenant3';
      const config = loadUatConfig();
      expect(config.uatTenantIds).toEqual(['tenant1', 'tenant2', 'tenant3']);
    });

    it('should parse UAT_MODE correctly', () => {
      process.env.UAT_MODE = 'live_uat';
      const config = loadUatConfig();
      expect(config.uatMode).toBe('live_uat');
    });

    it('should parse UAT_KILL_SWITCH as boolean', () => {
      process.env.UAT_KILL_SWITCH = 'false';
      const config = loadUatConfig();
      expect(config.uatKillSwitch).toBe(false);
    });

    it('should parse provider allowlists', () => {
      process.env.UAT_TEST_PHONE_ALLOWLIST = '+1234567890,+0987654321';
      process.env.UAT_EMAIL_DOMAIN_ALLOWLIST = 'test.com,example.com';
      process.env.UAT_CALENDAR_ALLOWLIST = 'cal1,cal2';
      process.env.UAT_GHL_LOCATION_IDS = 'loc1,loc2';

      const config = loadUatConfig();
      expect(config.uatTestPhoneAllowlist).toEqual([
        '+1234567890',
        '+0987654321',
      ]);
      expect(config.uatEmailDomainAllowlist).toEqual([
        'test.com',
        'example.com',
      ]);
      expect(config.uatCalendarAllowlist).toEqual(['cal1', 'cal2']);
      expect(config.uatGhlLocationIds).toEqual(['loc1', 'loc2']);
    });

    it('should enforce production safety - reject UAT flags in prod', () => {
      process.env.NEURONX_ENV = 'prod';
      process.env.UAT_TENANT_IDS = 'tenant1';

      expect(() => loadUatConfig()).toThrow(
        'PRODUCTION SAFETY VIOLATION: Production environment cannot have UAT flags enabled'
      );
    });

    it('should reject invalid NEURONX_ENV values', () => {
      process.env.NEURONX_ENV = 'invalid';

      expect(() => loadUatConfig()).toThrow(
        'Invalid NEURONX_ENV: invalid. Must be one of: dev, uat, prod'
      );
    });

    it('should reject invalid UAT_MODE values', () => {
      process.env.UAT_MODE = 'invalid';

      expect(() => loadUatConfig()).toThrow(
        'Invalid UAT_MODE: invalid. Must be one of: dry_run, live_uat'
      );
    });

    it('should handle empty allowlists gracefully', () => {
      process.env.UAT_TENANT_IDS = '';
      process.env.UAT_TEST_PHONE_ALLOWLIST = '   ';

      const config = loadUatConfig();
      expect(config.uatTenantIds).toEqual([]);
      expect(config.uatTestPhoneAllowlist).toEqual([]);
    });
  });

  describe('getUatConfig caching', () => {
    it('should cache configuration between calls', () => {
      process.env.NEURONX_ENV = 'uat';
      const config1 = getUatConfig();
      expect(config1.neuronxEnv).toBe('uat');

      // Change env but should still get cached value
      process.env.NEURONX_ENV = 'prod';
      const config2 = getUatConfig();
      expect(config2.neuronxEnv).toBe('uat'); // Cached value

      // Clear cache and get new value
      clearUatConfigCache();
      const config3 = getUatConfig();
      expect(config3.neuronxEnv).toBe('prod');
    });
  });
});
