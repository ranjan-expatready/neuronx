/**
 * UAT Guard Tests - WI-066: UAT Harness + Seed + Safety
 */

import { UatGuardService } from '../guard';
import { UatConfig, UatContext } from '../types';

describe('UatGuardService', () => {
  const createContext = (overrides: Partial<UatContext> = {}): UatContext => ({
    config: {
      neuronxEnv: 'dev',
      uatTenantIds: [],
      uatMode: 'dry_run',
      uatKillSwitch: true,
      uatGhlLocationIds: [],
      uatLabelPrefix: '[UAT]',
      uatTestPhoneAllowlist: [],
      uatEmailDomainAllowlist: [],
      uatCalendarAllowlist: [],
      ...overrides.config,
    } as UatConfig,
    tenantId: 'test-tenant',
    correlationId: 'test-correlation',
    timestamp: new Date(),
    ...overrides,
  });

  describe('checkOperationAllowed', () => {
    it('should deny operations in production environment', () => {
      const context = createContext({
        config: { neuronxEnv: 'prod' } as UatConfig,
      });

      const guard = new UatGuardService();
      const result = guard.checkOperationAllowed(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('PRODUCTION SAFETY');
      expect(result.killSwitchActive).toBe(true);
    });

    it('should allow operations in dev environment with dry_run', () => {
      const context = createContext({
        config: { neuronxEnv: 'dev' } as UatConfig,
      });

      const guard = new UatGuardService();
      const result = guard.checkOperationAllowed(context);

      expect(result.allowed).toBe(true);
      expect(result.mode).toBe('dry_run');
      expect(result.killSwitchActive).toBe(false);
    });

    it('should deny non-allowlisted tenants in UAT environment', () => {
      const context = createContext({
        config: {
          neuronxEnv: 'uat',
          uatTenantIds: ['allowed-tenant'],
        } as UatConfig,
        tenantId: 'blocked-tenant',
      });

      const guard = new UatGuardService();
      const result = guard.checkOperationAllowed(context);

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('UAT ISOLATION');
      expect(result.killSwitchActive).toBe(true);
    });

    it('should allow allowlisted tenants in UAT with kill switch enabled', () => {
      const context = createContext({
        config: {
          neuronxEnv: 'uat',
          uatTenantIds: ['allowed-tenant'],
          uatKillSwitch: true,
        } as UatConfig,
        tenantId: 'allowed-tenant',
      });

      const guard = new UatGuardService();
      const result = guard.checkOperationAllowed(context);

      expect(result.allowed).toBe(true);
      expect(result.mode).toBe('dry_run');
      expect(result.killSwitchActive).toBe(true);
    });

    it('should allow live execution when kill switch disabled in UAT', () => {
      const context = createContext({
        config: {
          neuronxEnv: 'uat',
          uatTenantIds: ['allowed-tenant'],
          uatKillSwitch: false,
          uatMode: 'live_uat',
        } as UatConfig,
        tenantId: 'allowed-tenant',
      });

      const guard = new UatGuardService();
      const result = guard.checkOperationAllowed(context);

      expect(result.allowed).toBe(true);
      expect(result.mode).toBe('live_uat');
      expect(result.killSwitchActive).toBe(false);
    });
  });

  describe('checkProviderExecutionAllowed', () => {
    it('should block provider execution in dry_run mode', () => {
      const context = createContext({
        config: {
          neuronxEnv: 'uat',
          uatTenantIds: ['test-tenant'],
          uatKillSwitch: true,
        } as UatConfig,
      });

      const guard = new UatGuardService();
      const result = guard.checkProviderExecutionAllowed(
        context,
        'sms',
        '+1234567890'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('DRY_RUN MODE');
    });

    it('should block SMS without phone number', () => {
      const context = createContext({
        config: {
          neuronxEnv: 'uat',
          uatTenantIds: ['test-tenant'],
          uatKillSwitch: false,
          uatMode: 'live_uat',
        } as UatConfig,
      });

      const guard = new UatGuardService();
      const result = guard.checkProviderExecutionAllowed(context, 'sms');

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('SMS requires phone number validation');
    });

    it('should validate SMS phone allowlist', () => {
      const context = createContext({
        config: {
          neuronxEnv: 'uat',
          uatTenantIds: ['test-tenant'],
          uatKillSwitch: false,
          uatMode: 'live_uat',
          uatTestPhoneAllowlist: ['+1234567890'],
        } as UatConfig,
      });

      const guard = new UatGuardService();

      // Allowed phone
      const allowed = guard.checkProviderExecutionAllowed(
        context,
        'sms',
        '+1234567890'
      );
      expect(allowed.allowed).toBe(true);

      // Blocked phone
      const blocked = guard.checkProviderExecutionAllowed(
        context,
        'sms',
        '+0987654321'
      );
      expect(blocked.allowed).toBe(false);
      expect(blocked.reason).toContain('not in allowlist');
    });

    it('should validate email domain allowlist', () => {
      const context = createContext({
        config: {
          neuronxEnv: 'uat',
          uatTenantIds: ['test-tenant'],
          uatKillSwitch: false,
          uatMode: 'live_uat',
          uatEmailDomainAllowlist: ['test.com'],
        } as UatConfig,
      });

      const guard = new UatGuardService();

      // Allowed domain
      const allowed = guard.checkProviderExecutionAllowed(
        context,
        'email',
        'user@test.com'
      );
      expect(allowed.allowed).toBe(true);

      // Blocked domain
      const blocked = guard.checkProviderExecutionAllowed(
        context,
        'email',
        'user@blocked.com'
      );
      expect(blocked.allowed).toBe(false);
      expect(blocked.reason).toContain('not in allowlist');
    });

    it('should validate calendar allowlist', () => {
      const context = createContext({
        config: {
          neuronxEnv: 'uat',
          uatTenantIds: ['test-tenant'],
          uatKillSwitch: false,
          uatMode: 'live_uat',
          uatCalendarAllowlist: ['cal1'],
        } as UatConfig,
      });

      const guard = new UatGuardService();

      // Allowed calendar
      const allowed = guard.checkProviderExecutionAllowed(
        context,
        'calendar',
        'cal1'
      );
      expect(allowed.allowed).toBe(true);

      // Blocked calendar
      const blocked = guard.checkProviderExecutionAllowed(
        context,
        'calendar',
        'cal2'
      );
      expect(blocked.allowed).toBe(false);
    });

    it('should validate GHL location allowlist', () => {
      const context = createContext({
        config: {
          neuronxEnv: 'uat',
          uatTenantIds: ['test-tenant'],
          uatKillSwitch: false,
          uatMode: 'live_uat',
          uatGhlLocationIds: ['loc1'],
        } as UatConfig,
      });

      const guard = new UatGuardService();

      // Allowed location
      const allowed = guard.checkProviderExecutionAllowed(
        context,
        'ghl',
        'loc1'
      );
      expect(allowed.allowed).toBe(true);

      // Blocked location
      const blocked = guard.checkProviderExecutionAllowed(
        context,
        'ghl',
        'loc2'
      );
      expect(blocked.allowed).toBe(false);
    });

    it('should block execution when no allowlist configured for live mode', () => {
      const context = createContext({
        config: {
          neuronxEnv: 'uat',
          uatTenantIds: ['test-tenant'],
          uatKillSwitch: false,
          uatMode: 'live_uat',
          // Empty allowlists
          uatTestPhoneAllowlist: [],
          uatEmailDomainAllowlist: [],
        } as UatConfig,
      });

      const guard = new UatGuardService();

      const smsResult = guard.checkProviderExecutionAllowed(
        context,
        'sms',
        '+1234567890'
      );
      expect(smsResult.allowed).toBe(false);
      expect(smsResult.reason).toContain('No test phone numbers configured');

      const emailResult = guard.checkProviderExecutionAllowed(
        context,
        'email',
        'user@test.com'
      );
      expect(emailResult.allowed).toBe(false);
      expect(emailResult.reason).toContain('No test domains configured');
    });
  });

  describe('getStatus', () => {
    it('should return current UAT status summary', () => {
      const config: UatConfig = {
        neuronxEnv: 'uat',
        uatTenantIds: ['tenant1', 'tenant2'],
        uatMode: 'live_uat',
        uatKillSwitch: false,
        uatGhlLocationIds: ['loc1'],
        uatLabelPrefix: '[UAT]',
        uatTestPhoneAllowlist: ['+123'],
        uatEmailDomainAllowlist: ['test.com'],
        uatCalendarAllowlist: ['cal1'],
      };

      const guard = new UatGuardService(config);
      const status = guard.getStatus();

      expect(status.environment).toBe('uat');
      expect(status.mode).toBe('live_uat');
      expect(status.killSwitch).toBe(false);
      expect(status.allowedTenants).toEqual(['tenant1', 'tenant2']);
      expect(status.providerAllowlists.sms).toEqual(['+123']);
      expect(status.providerAllowlists.email).toEqual(['test.com']);
      expect(status.providerAllowlists.calendar).toEqual(['cal1']);
      expect(status.providerAllowlists.ghl).toEqual(['loc1']);
    });
  });

  describe('createAuditEvent', () => {
    it('should create audit event with correct structure', () => {
      const config: UatConfig = {
        neuronxEnv: 'uat',
        uatTenantIds: ['test-tenant'],
        uatMode: 'dry_run',
        uatKillSwitch: true,
        uatGhlLocationIds: [],
        uatLabelPrefix: '[UAT]',
        uatTestPhoneAllowlist: [],
        uatEmailDomainAllowlist: [],
        uatCalendarAllowlist: [],
      };

      const context = createContext({ config });

      const guard = new UatGuardService(config);
      const event = guard.createAuditEvent('uat_guard_check', context, {
        extra: 'data',
      });

      expect(event.eventType).toBe('uat_guard_check');
      expect(event.tenantId).toBe('test-tenant');
      expect(event.correlationId).toBe('test-correlation');
      expect(event.details.neuronxEnv).toBe('uat');
      expect(event.details.uatMode).toBe('dry_run');
      expect(event.details.killSwitchActive).toBe(true);
      expect(event.details.extra).toBe('data');
    });
  });
});
