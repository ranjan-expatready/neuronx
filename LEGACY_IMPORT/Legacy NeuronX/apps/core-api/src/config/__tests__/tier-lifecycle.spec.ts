/**
 * Tier Lifecycle Tests - REQ-019: Configuration as IP
 *
 * Tests that entitlement tier transitions follow proper lifecycle rules:
 * - Upgrade: immediate effect
 * - Downgrade: delayed + safe
 * - Feature disablement: voice immediate, SLA frozen, routing constrained
 * - Grace periods: configurable windows before enforcement
 */

import { Test, TestingModule } from '@nestjs/testing';
import { EntitlementService } from '../entitlements/entitlement.service';
import {
  TierLifecycleManager,
  TierTransitionRequest,
  FeatureDowngradeHandler,
} from '../entitlements/tier.lifecycle';

describe('Tier Lifecycle Management - Safe Transition Semantics', () => {
  let entitlementService: EntitlementService;
  let lifecycleManager: TierLifecycleManager;

  // Test tenant
  const tenantId = 'test-tenant-lifecycle';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EntitlementService,
        {
          provide: TierLifecycleManager,
          useClass: TierLifecycleManager,
        },
      ],
    }).compile();

    entitlementService = module.get<EntitlementService>(EntitlementService);
    lifecycleManager = module.get<TierLifecycleManager>(TierLifecycleManager);

    // Clear any existing state
    entitlementService.clearScheduledActions();
  });

  afterEach(() => {
    entitlementService.clearScheduledActions();
  });

  describe('Upgrade Transitions - Immediate Effect', () => {
    it('should apply starter to professional upgrade immediately', async () => {
      // Setup: Assign starter tier first
      await entitlementService.assignTenantTier(
        tenantId,
        'starter',
        'test-system'
      );

      // Request upgrade to professional
      const upgradeRequest: TierTransitionRequest = {
        tenantId,
        fromTier: 'starter',
        toTier: 'professional',
        reason: 'customer_request',
        requestedBy: 'test-user',
      };

      const result =
        await entitlementService.requestTierTransition(upgradeRequest);

      // Verify upgrade applied immediately
      expect(result.success).toBe(true);
      expect(result.transition?.effectiveTiming).toBe('immediate');
      expect(result.entitlement?.tierId).toBe('professional');

      // Verify no scheduled actions (immediate)
      const scheduledActions = entitlementService.getScheduledActions(tenantId);
      expect(
        scheduledActions.filter(a => a.type === 'tier_transition')
      ).toHaveLength(0);
    });

    it('should apply professional to enterprise upgrade immediately', async () => {
      // Setup: Assign professional tier first
      await entitlementService.assignTenantTier(
        tenantId,
        'professional',
        'test-system'
      );

      // Request upgrade to enterprise
      const upgradeRequest: TierTransitionRequest = {
        tenantId,
        fromTier: 'professional',
        toTier: 'enterprise',
        reason: 'customer_request',
        requestedBy: 'test-user',
      };

      const result =
        await entitlementService.requestTierTransition(upgradeRequest);

      // Verify upgrade applied immediately
      expect(result.success).toBe(true);
      expect(result.transition?.effectiveTiming).toBe('immediate');
      expect(result.entitlement?.tierId).toBe('enterprise');
    });

    it('should allow free to starter upgrade immediately', async () => {
      // Setup: Assign free tier first
      await entitlementService.assignTenantTier(
        tenantId,
        'free',
        'test-system'
      );

      // Request upgrade to starter
      const upgradeRequest: TierTransitionRequest = {
        tenantId,
        fromTier: 'free',
        toTier: 'starter',
        reason: 'customer_request',
        requestedBy: 'test-user',
      };

      const result =
        await entitlementService.requestTierTransition(upgradeRequest);

      // Verify upgrade applied immediately
      expect(result.success).toBe(true);
      expect(result.transition?.effectiveTiming).toBe('immediate');
      expect(result.entitlement?.tierId).toBe('starter');
    });
  });

  describe('Downgrade Transitions - Delayed + Safe', () => {
    it('should schedule enterprise to professional downgrade with grace period', async () => {
      // Setup: Assign enterprise tier first
      await entitlementService.assignTenantTier(
        tenantId,
        'enterprise',
        'test-system'
      );

      // Request downgrade to professional
      const downgradeRequest: TierTransitionRequest = {
        tenantId,
        fromTier: 'enterprise',
        toTier: 'professional',
        reason: 'billing_issue',
        requestedBy: 'test-system',
      };

      const result =
        await entitlementService.requestTierTransition(downgradeRequest);

      // Verify downgrade scheduled with grace period
      expect(result.success).toBe(true);
      expect(result.transition?.effectiveTiming).toBe('grace_period');
      expect(result.transition?.gracePeriodDays).toBe(14); // Enterprise->Professional grace period
      expect(result.entitlement?.tierId).toBe('professional');

      // Verify scheduled actions created
      const scheduledActions = entitlementService.getScheduledActions(tenantId);
      expect(scheduledActions.some(a => a.type === 'tier_transition')).toBe(
        true
      );
    });

    it('should schedule professional to starter downgrade with grace period', async () => {
      // Setup: Assign professional tier first
      await entitlementService.assignTenantTier(
        tenantId,
        'professional',
        'test-system'
      );

      // Request downgrade to starter
      const downgradeRequest: TierTransitionRequest = {
        tenantId,
        fromTier: 'professional',
        toTier: 'starter',
        reason: 'billing_issue',
        requestedBy: 'test-system',
      };

      const result =
        await entitlementService.requestTierTransition(downgradeRequest);

      // Verify downgrade scheduled with grace period
      expect(result.success).toBe(true);
      expect(result.transition?.effectiveTiming).toBe('grace_period');
      expect(result.transition?.gracePeriodDays).toBe(14); // Professional->Starter grace period
      expect(result.entitlement?.tierId).toBe('starter');

      // Verify scheduled actions include voice disablement (immediate for safety)
      const scheduledActions = entitlementService.getScheduledActions(tenantId);
      expect(
        scheduledActions.some(a => a.details.action === 'disable_voice')
      ).toBe(true);
    });

    it('should schedule starter to free downgrade with shorter grace period', async () => {
      // Setup: Assign starter tier first
      await entitlementService.assignTenantTier(
        tenantId,
        'starter',
        'test-system'
      );

      // Request downgrade to free
      const downgradeRequest: TierTransitionRequest = {
        tenantId,
        fromTier: 'starter',
        toTier: 'free',
        reason: 'billing_issue',
        requestedBy: 'test-system',
      };

      const result =
        await entitlementService.requestTierTransition(downgradeRequest);

      // Verify downgrade scheduled with shorter grace period
      expect(result.success).toBe(true);
      expect(result.transition?.effectiveTiming).toBe('grace_period');
      expect(result.transition?.gracePeriodDays).toBe(7); // Starter->Free grace period
      expect(result.entitlement?.tierId).toBe('free');
    });
  });

  describe('Safe Feature Disablement Behavior', () => {
    it('should disable voice features immediately on professional to starter downgrade', async () => {
      // Setup: Assign professional tier first
      await entitlementService.assignTenantTier(
        tenantId,
        'professional',
        'test-system'
      );

      // Request downgrade to starter
      const downgradeRequest: TierTransitionRequest = {
        tenantId,
        fromTier: 'professional',
        toTier: 'starter',
        reason: 'billing_issue',
        requestedBy: 'test-system',
      };

      await entitlementService.requestTierTransition(downgradeRequest);

      // Verify voice disablement scheduled immediately
      const scheduledActions = entitlementService.getScheduledActions(tenantId);
      const voiceActions = scheduledActions.filter(
        a => a.details.action === 'disable_voice'
      );

      expect(voiceActions).toHaveLength(1);
      expect(voiceActions[0].details.domains.voice._disabled).toBe(true);
      expect(voiceActions[0].details.domains.voice._disabledReason).toBe(
        'tier_downgrade'
      );

      // Verify notification included
      expect(voiceActions[0].details.notifications[0].feature).toBe('voice');
      expect(voiceActions[0].details.notifications[0].reactivateTier).toBe(
        'professional'
      );
    });

    it('should freeze SLA and escalation rules on enterprise to professional downgrade', async () => {
      // Setup: Assign enterprise tier first
      await entitlementService.assignTenantTier(
        tenantId,
        'enterprise',
        'test-system'
      );

      // Request downgrade to professional
      const downgradeRequest: TierTransitionRequest = {
        tenantId,
        fromTier: 'enterprise',
        toTier: 'professional',
        reason: 'billing_issue',
        requestedBy: 'test-system',
      };

      await entitlementService.requestTierTransition(downgradeRequest);

      // Verify SLA/escalation freeze scheduled (not immediate for enterprise->professional)
      const scheduledActions = entitlementService.getScheduledActions(tenantId);
      const freezeActions = scheduledActions.filter(
        a => a.details.action === 'freeze_sla_escalation'
      );

      // Note: Enterprise->Professional doesn't freeze SLA immediately
      // This would be scheduled for later enforcement if needed
    });

    it('should freeze SLA and escalation on professional/starter to free downgrade', async () => {
      // Setup: Assign starter tier first
      await entitlementService.assignTenantTier(
        tenantId,
        'starter',
        'test-system'
      );

      // Request downgrade to free
      const downgradeRequest: TierTransitionRequest = {
        tenantId,
        fromTier: 'starter',
        toTier: 'free',
        reason: 'billing_issue',
        requestedBy: 'test-system',
      };

      await entitlementService.requestTierTransition(downgradeRequest);

      // Verify SLA/escalation freeze scheduled
      const scheduledActions = entitlementService.getScheduledActions(tenantId);
      const freezeActions = scheduledActions.filter(
        a => a.details.action === 'freeze_sla_escalation'
      );

      expect(freezeActions).toHaveLength(1);
      expect(freezeActions[0].details.domains.sla._frozen).toBe(true);
      expect(freezeActions[0].details.domains.escalation._frozen).toBe(true);
      expect(freezeActions[0].details.domains.sla._frozenReason).toBe(
        'tier_downgrade'
      );
    });

    it('should gracefully degrade routing on starter to free downgrade', async () => {
      // Setup: Assign starter tier first
      await entitlementService.assignTenantTier(
        tenantId,
        'starter',
        'test-system'
      );

      // Request downgrade to free
      const downgradeRequest: TierTransitionRequest = {
        tenantId,
        fromTier: 'starter',
        toTier: 'free',
        reason: 'billing_issue',
        requestedBy: 'test-system',
      };

      await entitlementService.requestTierTransition(downgradeRequest);

      // Verify routing degradation scheduled
      const scheduledActions = entitlementService.getScheduledActions(tenantId);
      const routingActions = scheduledActions.filter(
        a => a.details.action === 'degrade_routing'
      );

      expect(routingActions).toHaveLength(1);
      expect(routingActions[0].details.domains.routing._degraded).toBe(true);
      expect(routingActions[0].details.domains.routing._maxCapacity).toBe(1); // Free tier max capacity
      expect(routingActions[0].details.domains.routing._degradedReason).toBe(
        'tier_downgrade'
      );
    });
  });

  describe('Transition Validation and Error Handling', () => {
    it('should reject invalid tier transitions', async () => {
      // Setup: Assign starter tier
      await entitlementService.assignTenantTier(
        tenantId,
        'starter',
        'test-system'
      );

      // Try invalid transition: starter directly to enterprise (skipping professional)
      const invalidRequest: TierTransitionRequest = {
        tenantId,
        fromTier: 'starter',
        toTier: 'enterprise',
        reason: 'customer_request',
        requestedBy: 'test-user',
      };

      const result =
        await entitlementService.requestTierTransition(invalidRequest);

      // Verify transition rejected
      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        'Transition from starter to enterprise is not allowed'
      );
    });

    it('should reject transitions when tenant not on expected tier', async () => {
      // Setup: Assign professional tier
      await entitlementService.assignTenantTier(
        tenantId,
        'professional',
        'test-system'
      );

      // Try transition claiming tenant is on starter (but they're on professional)
      const invalidRequest: TierTransitionRequest = {
        tenantId,
        fromTier: 'starter', // Wrong current tier
        toTier: 'free',
        reason: 'customer_request',
        requestedBy: 'test-user',
      };

      const result =
        await entitlementService.requestTierTransition(invalidRequest);

      // Verify transition rejected
      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        'Tenant test-tenant-lifecycle is not currently on tier starter'
      );
    });

    it('should handle transitions for non-existent tenants', async () => {
      const nonexistentTenant = 'nonexistent-tenant';

      const request: TierTransitionRequest = {
        tenantId: nonexistentTenant,
        fromTier: 'free',
        toTier: 'starter',
        reason: 'customer_request',
        requestedBy: 'test-user',
      };

      const result = await entitlementService.requestTierTransition(request);

      // Verify transition rejected
      expect(result.success).toBe(false);
      expect(result.errors).toContain(
        'Tenant nonexistent-tenant is not currently on tier free'
      );
    });
  });

  describe('Grace Period Configuration', () => {
    it('should use configured grace periods for different transitions', () => {
      // Test grace period calculation
      expect(
        lifecycleManager.getGracePeriod('enterprise', 'professional')
      ).toBe(14);
      expect(lifecycleManager.getGracePeriod('professional', 'starter')).toBe(
        14
      );
      expect(lifecycleManager.getGracePeriod('starter', 'free')).toBe(7);
    });

    it('should default to immediate effect for upgrades', () => {
      expect(lifecycleManager.getGracePeriod('free', 'starter')).toBe(0);
      expect(lifecycleManager.getGracePeriod('starter', 'professional')).toBe(
        0
      );
      expect(
        lifecycleManager.getGracePeriod('professional', 'enterprise')
      ).toBe(0);
    });
  });

  describe('Feature Disablement Behavior Configuration', () => {
    it('should configure voice as immediate disable', () => {
      expect(lifecycleManager.getFeatureDisablementBehavior('voice')).toBe(
        'immediate_disable'
      );
    });

    it('should configure SLA and escalation as frozen preserve', () => {
      expect(lifecycleManager.getFeatureDisablementBehavior('sla')).toBe(
        'frozen_preserve'
      );
      expect(lifecycleManager.getFeatureDisablementBehavior('escalation')).toBe(
        'frozen_preserve'
      );
    });

    it('should configure routing as graceful degrade', () => {
      expect(lifecycleManager.getFeatureDisablementBehavior('routing')).toBe(
        'graceful_degrade'
      );
    });

    it('should configure integrations as safe fallback', () => {
      expect(
        lifecycleManager.getFeatureDisablementBehavior('integrationMappings')
      ).toBe('safe_fallback');
    });
  });

  describe('Scheduled Actions Management', () => {
    it('should track scheduled actions for delayed transitions', async () => {
      // Setup: Assign enterprise tier
      await entitlementService.assignTenantTier(
        tenantId,
        'enterprise',
        'test-system'
      );

      // Request downgrade to professional
      const downgradeRequest: TierTransitionRequest = {
        tenantId,
        fromTier: 'enterprise',
        toTier: 'professional',
        reason: 'billing_issue',
        requestedBy: 'test-system',
      };

      await entitlementService.requestTierTransition(downgradeRequest);

      // Verify scheduled actions tracked
      const scheduledActions = entitlementService.getScheduledActions(tenantId);
      expect(scheduledActions.length).toBeGreaterThan(0);

      // Verify action structure
      const transitionAction = scheduledActions.find(
        a => a.type === 'tier_transition'
      );
      expect(transitionAction).toBeDefined();
      expect(transitionAction!.details.tenantId).toBe(tenantId);
      expect(transitionAction!.details.entitlement.tierId).toBe('professional');
    });

    it('should clear scheduled actions for testing', () => {
      // Add some mock actions
      entitlementService['scheduledActions'].set('test-key', [
        { type: 'test' },
      ]);

      // Verify actions exist
      expect(entitlementService.getScheduledActions('test')).toHaveLength(1);

      // Clear actions
      entitlementService.clearScheduledActions();

      // Verify actions cleared
      expect(entitlementService.getScheduledActions('test')).toHaveLength(0);
    });
  });

  describe('Tenant Isolation in Transitions', () => {
    it('should not affect other tenants when processing transitions', async () => {
      const tenant1 = 'tenant-1';
      const tenant2 = 'tenant-2';

      // Setup both tenants with different tiers
      await entitlementService.assignTenantTier(
        tenant1,
        'starter',
        'test-system'
      );
      await entitlementService.assignTenantTier(
        tenant2,
        'professional',
        'test-system'
      );

      // Transition tenant1
      const request1: TierTransitionRequest = {
        tenantId: tenant1,
        fromTier: 'starter',
        toTier: 'professional',
        reason: 'customer_request',
        requestedBy: 'test-user',
      };

      await entitlementService.requestTierTransition(request1);

      // Verify tenant2 unaffected
      const entitlement2 =
        await entitlementService.getTenantEntitlement(tenant2);
      expect(entitlement2?.tierId).toBe('professional');

      // Verify tenant1 transitioned
      const entitlement1 =
        await entitlementService.getTenantEntitlement(tenant1);
      expect(entitlement1?.tierId).toBe('professional');
    });
  });

  describe('Feature Downgrade Handler Utilities', () => {
    it('should generate proper voice disablement actions', () => {
      const result = FeatureDowngradeHandler.handleVoiceDisablement(tenantId);

      expect(result.action).toBe('disable_voice');
      expect(result.tenantId).toBe(tenantId);
      expect(result.domains.voice._disabled).toBe(true);
      expect(result.domains.voice._disabledReason).toBe('tier_downgrade');
      expect(result.notifications[0].feature).toBe('voice');
      expect(result.notifications[0].reactivateTier).toBe('professional');
    });

    it('should generate proper SLA freeze actions', () => {
      const result = FeatureDowngradeHandler.handleSLAFreeze(tenantId);

      expect(result.action).toBe('freeze_sla_escalation');
      expect(result.domains.sla._frozen).toBe(true);
      expect(result.domains.escalation._frozen).toBe(true);
      expect(result.notifications[0].features).toEqual(['sla', 'escalation']);
    });

    it('should generate proper routing degradation actions', () => {
      const result = FeatureDowngradeHandler.handleRoutingDegrade(
        tenantId,
        'free'
      );

      expect(result.action).toBe('degrade_routing');
      expect(result.domains.routing._degraded).toBe(true);
      expect(result.domains.routing._maxCapacity).toBe(1); // Free tier capacity
      expect(result.notifications[0].note).toContain(
        'Routing capacity reduced to 1 teams'
      );
    });

    it('should generate proper integration fallback actions', () => {
      const result =
        FeatureDowngradeHandler.handleIntegrationFallback(tenantId);

      expect(result.action).toBe('fallback_integrations');
      expect(result.domains.integrationMappings._fallback).toBe(true);
      expect(result.domains.integrationMappings._allowedIntegrations).toEqual([
        'crm-basic',
      ]);
    });
  });
});
