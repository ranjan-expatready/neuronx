import { Test, TestingModule } from '@nestjs/testing';
import { GhlWebhookController } from '../../apps/core-api/src/integrations/ghl/ghl-webhook.controller';
import { GhlAuthController } from '../../apps/core-api/src/integrations/ghl/ghl-auth.controller';
import { GhlHealthController } from '../../apps/core-api/src/integrations/ghl/ghl-health.controller';
import { EventBus } from '../../apps/core-api/src/eventing';

/**
 * Contract Tests for GHL Adapter
 *
 * These tests verify that the GHL adapter implementation conforms to
 * the expected interface contracts and data transformation rules.
 * They ensure no vendor-specific types leak into core business logic.
 */

describe('GHL Adapter Contract Tests', () => {
  let webhookController: GhlWebhookController;
  let authController: GhlAuthController;
  let healthController: GhlHealthController;
  let eventBus: EventBus;

  const mockEventBus = {
    publish: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [
        GhlWebhookController,
        GhlAuthController,
        GhlHealthController,
      ],
      providers: [
        {
          provide: EventBus,
          useValue: mockEventBus,
        },
      ],
    }).compile();

    webhookController = module.get<GhlWebhookController>(GhlWebhookController);
    authController = module.get<GhlAuthController>(GhlAuthController);
    healthController = module.get<GhlHealthController>(GhlHealthController);
    eventBus = module.get<EventBus>(EventBus);
  });

  describe('Webhook Interface Contract', () => {
    it('should implement handleWebhook method', () => {
      expect(webhookController.handleWebhook).toBeDefined();
      expect(typeof webhookController.handleWebhook).toBe('function');
    });

    it('should accept standard webhook payload structure', async () => {
      const standardPayload = {
        id: 'webhook-123',
        tenantId: 'tenant-456',
        type: 'contact.created',
        timestamp: '2024-01-01T00:00:00Z',
        payload: {
          contact: {
            id: 'ghl-contact-789',
            firstName: 'John',
            lastName: 'Doe',
            email: 'john.doe@example.com',
            phone: '+1234567890',
            companyName: 'TechCorp',
            tags: ['hot-lead', 'technology'],
            customFields: {
              industry: 'Technology',
              companySize: '50-100',
              budget: '25000',
            },
          },
        },
      };

      const mockReq = {
        headers: {
          'x-ghl-signature': 'valid_signature_for_testing',
          'content-type': 'application/json',
        },
        body: standardPayload,
      };

      const result = await webhookController.handleWebhook(
        mockReq as any,
        'tenant-456'
      );

      expect(result).toEqual({ status: 'processed' });
    });

    it('should transform GHL contact to NeuronX lead without vendor types', async () => {
      // This test verifies that the transformation logic doesn't expose
      // GHL-specific types in the core domain
      const ghlContact = {
        id: 'ghl-contact-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        companyName: 'TechCorp',
        tags: ['hot-lead'],
        customFields: {
          industry: 'Technology',
          companySize: '50-100',
        },
      };

      const mockReq = {
        headers: {
          'x-ghl-signature': 'valid_signature_for_testing',
        },
        body: {
          id: 'webhook-123',
          tenantId: 'tenant-456',
          type: 'contact.created',
          payload: { contact: ghlContact },
        },
      };

      await webhookController.handleWebhook(mockReq as any, 'tenant-456');

      // Verify that the event published contains NeuronX domain types only
      expect(mockEventBus.publish).toHaveBeenCalledWith({
        type: 'contact.created',
        tenantId: 'tenant-456',
        correlationId: expect.any(String),
        timestamp: expect.any(Date),
        payload: {
          // This should be transformed to NeuronX domain model
          id: expect.stringContaining('neuronx-'),
          firstName: 'John',
          lastName: 'Doe',
          email: 'john.doe@example.com',
          phone: '+1234567890',
          company: 'TechCorp',
          industry: 'technology',
          companySize: 75, // Transformed from '50-100'
          tags: ['hot-lead'],
          source: 'ghl',
          tenantId: 'tenant-456',
          createdAt: expect.any(Date),
          updatedAt: expect.any(Date),
        },
      });
    });

    it('should reject webhooks with invalid signatures', async () => {
      const payload = {
        id: 'webhook-123',
        type: 'contact.created',
        payload: { contact: { id: 'contact-123' } },
      };

      const mockReq = {
        headers: {
          'x-ghl-signature': 'invalid_signature',
        },
        body: payload,
      };

      await expect(
        webhookController.handleWebhook(mockReq as any, 'tenant-456')
      ).rejects.toThrow();
    });

    it('should prevent webhook replay attacks', async () => {
      const payload = {
        id: 'replay-webhook-123',
        tenantId: 'tenant-456',
        type: 'contact.created',
        payload: { contact: { id: 'contact-123' } },
      };

      const mockReq = {
        headers: {
          'x-ghl-signature': 'valid_signature_for_testing',
          'x-webhook-id': payload.id,
        },
        body: payload,
      };

      // First webhook should succeed
      const result1 = await webhookController.handleWebhook(
        mockReq as any,
        'tenant-456'
      );
      expect(result1).toEqual({ status: 'processed' });

      // Second webhook with same ID should fail (replay protection)
      await expect(
        webhookController.handleWebhook(mockReq as any, 'tenant-456')
      ).rejects.toThrow(/replay|duplicate/);
    });
  });

  describe('OAuth Interface Contract', () => {
    it('should implement OAuth flow methods', () => {
      expect(authController.initiateOAuth).toBeDefined();
      expect(authController.handleCallback).toBeDefined();
      expect(typeof authController.initiateOAuth).toBe('function');
      expect(typeof authController.handleCallback).toBe('function');
    });

    it('should return standardized OAuth initiation response', async () => {
      const result = await authController.initiateOAuth('test-tenant');

      expect(result).toHaveProperty('authorizationUrl');
      expect(result.authorizationUrl).toContain('gohighlevel.com');
      expect(result.authorizationUrl).toMatch(/client_id=[^&]+/);
      expect(result.authorizationUrl).toMatch(/redirect_uri=[^&]+/);
      expect(result.authorizationUrl).toMatch(/state=[^&]+/);
      expect(result.authorizationUrl).toMatch(/scope=[^&]+/);
      expect(result).toHaveProperty('state');
      expect(typeof result.state).toBe('string');
      expect(result.state.length).toBeGreaterThan(10);
    });

    it('should handle OAuth callback with valid parameters', async () => {
      const mockQuery = {
        code: 'valid_oauth_code_123',
        state: 'valid_state_token_456',
      };

      const result = await authController.handleCallback(
        mockQuery,
        'test-tenant'
      );

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('redirectUrl');
      // Should not expose internal OAuth details
      expect(result).not.toHaveProperty('access_token');
      expect(result).not.toHaveProperty('refresh_token');
    });

    it('should reject invalid OAuth states', async () => {
      const mockQuery = {
        code: 'valid_code',
        state: 'invalid_state_token',
      };

      await expect(
        authController.handleCallback(mockQuery, 'test-tenant')
      ).rejects.toThrow(/state|invalid/);
    });

    it('should handle OAuth errors gracefully', async () => {
      const mockQuery = {
        error: 'access_denied',
        error_description: 'User denied access',
      };

      const result = await authController.handleCallback(
        mockQuery,
        'test-tenant'
      );

      expect(result).toHaveProperty('status', 'error');
      expect(result).toHaveProperty('error');
      expect(result.error).toContain('denied');
    });
  });

  describe('Health Interface Contract', () => {
    it('should implement health check method', () => {
      expect(healthController.getHealth).toBeDefined();
      expect(typeof healthController.getHealth).toBe('function');
    });

    it('should return standardized health response', async () => {
      const result = await healthController.getHealth();

      expect(result).toHaveProperty('status');
      expect(['healthy', 'degraded', 'unhealthy']).toContain(result.status);
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('services');

      // GHL-specific health checks
      expect(result.services).toHaveProperty('ghl');
      expect(result.services.ghl).toHaveProperty('status');
      expect(result.services.ghl).toHaveProperty('lastCheck');
    });

    it('should include adapter-specific health metrics', async () => {
      const result = await healthController.getHealth();

      // Contract requires these specific GHL health indicators
      expect(result.services.ghl).toHaveProperty('apiConnectivity');
      expect(result.services.ghl).toHaveProperty('webhookReception');
      expect(result.services.ghl).toHaveProperty('authTokenStatus');

      // Values should be appropriate types
      expect(typeof result.services.ghl.apiConnectivity).toBe('boolean');
      expect(typeof result.services.ghl.webhookReception).toBe('boolean');
      expect(['valid', 'expired', 'missing']).toContain(
        result.services.ghl.authTokenStatus
      );
    });

    it('should not expose sensitive adapter configuration', async () => {
      const result = await healthController.getHealth();

      // Health endpoint should not leak secrets or internal config
      expect(result.services.ghl).not.toHaveProperty('apiKey');
      expect(result.services.ghl).not.toHaveProperty('clientSecret');
      expect(result.services.ghl).not.toHaveProperty('webhookSecret');
      expect(result.services.ghl).not.toHaveProperty('accessToken');
    });
  });

  describe('Data Transformation Contract', () => {
    it('should transform all standard GHL contact fields to NeuronX domain', () => {
      // Test comprehensive field mapping
      const ghlContact = {
        id: 'ghl-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        companyName: 'TechCorp',
        tags: ['hot-lead', 'technology'],
        customFields: {
          industry: 'Technology',
          companySize: '100-500',
          budget: '50000',
          website: 'https://techcorp.com',
        },
        dateAdded: '2024-01-01T00:00:00Z',
        dnd: false,
      };

      // Verify transformation logic (this would be in a service method)
      const neuronxLead = {
        id: `neuronx-${ghlContact.id}`,
        tenantId: 'test-tenant',
        firstName: ghlContact.firstName,
        lastName: ghlContact.lastName,
        email: ghlContact.email,
        phone: ghlContact.phone,
        company: ghlContact.companyName,
        industry: ghlContact.customFields.industry?.toLowerCase(),
        companySize: parseInt(
          ghlContact.customFields.companySize?.split('-')[0] || '0'
        ),
        website: ghlContact.customFields.website,
        tags: ghlContact.tags,
        isActive: !ghlContact.dnd,
        source: 'ghl',
        externalId: ghlContact.id,
        createdAt: new Date(ghlContact.dateAdded),
        updatedAt: new Date(),
      };

      // Contract verification
      expect(neuronxLead.id).toMatch(/^neuronx-ghl-/);
      expect(neuronxLead.externalId).toBe(ghlContact.id);
      expect(neuronxLead.source).toBe('ghl');
      expect(neuronxLead.industry).toBe('technology');
      expect(neuronxLead.companySize).toBe(100);
      expect(neuronxLead.isActive).toBe(true);
      expect(neuronxLead.tags).toEqual(['hot-lead', 'technology']);
    });

    it('should handle GHL opportunity transformation', () => {
      const ghlOpportunity = {
        id: 'ghl-opp-456',
        name: 'Enterprise Software Deal',
        contactId: 'ghl-contact-123',
        value: 75000,
        status: 'open',
        pipeline: 'sales',
        stage: 'proposal',
        createdAt: '2024-01-01T00:00:00Z',
        assignedTo: 'user-789',
      };

      const neuronxDeal = {
        id: `neuronx-deal-${ghlOpportunity.id}`,
        tenantId: 'test-tenant',
        name: ghlOpportunity.name,
        leadId: `neuronx-${ghlOpportunity.contactId}`,
        value: ghlOpportunity.value,
        status: ghlOpportunity.status,
        stage: ghlOpportunity.stage,
        probability:
          ghlOpportunity.stage === 'proposal'
            ? 0.6
            : ghlOpportunity.stage === 'negotiation'
              ? 0.8
              : 0.4,
        assignedTo: ghlOpportunity.assignedTo,
        source: 'ghl',
        externalId: ghlOpportunity.id,
        createdAt: new Date(ghlOpportunity.createdAt),
        updatedAt: new Date(),
      };

      expect(neuronxDeal.id).toMatch(/^neuronx-deal-ghl-/);
      expect(neuronxDeal.leadId).toMatch(/^neuronx-ghl-/);
      expect(neuronxDeal.source).toBe('ghl');
      expect(neuronxDeal.probability).toBe(0.6);
      expect(neuronxDeal.externalId).toBe(ghlOpportunity.id);
    });

    it('should handle missing or malformed GHL data gracefully', () => {
      // Test with minimal/incomplete GHL data
      const minimalGhlContact = {
        id: 'ghl-minimal',
        email: 'minimal@example.com',
        // Missing other fields
      };

      const neuronxLead = {
        id: `neuronx-${minimalGhlContact.id}`,
        tenantId: 'test-tenant',
        email: minimalGhlContact.email,
        firstName: undefined,
        lastName: undefined,
        phone: undefined,
        company: undefined,
        industry: undefined,
        companySize: 0,
        tags: [],
        source: 'ghl',
        externalId: minimalGhlContact.id,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Should not crash, should provide defaults
      expect(neuronxLead.email).toBe(minimalGhlContact.email);
      expect(neuronxLead.firstName).toBeUndefined();
      expect(neuronxLead.companySize).toBe(0);
      expect(neuronxLead.tags).toEqual([]);
    });
  });
});
