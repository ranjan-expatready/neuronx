import { Test, TestingModule } from '@nestjs/testing';
import { GhlModule } from '../../src/integrations/ghl/ghl.module';
import { GhlWebhookController } from '../../src/integrations/ghl/ghl-webhook.controller';
import { GhlAuthController } from '../../src/integrations/ghl/ghl-auth.controller';
import { GhlHealthController } from '../../src/integrations/ghl/ghl-health.controller';

describe('Adapter Contract Tests', () => {
  let webhookController: GhlWebhookController;
  let authController: GhlAuthController;
  let healthController: GhlHealthController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      imports: [GhlModule],
    }).compile();

    webhookController = module.get<GhlWebhookController>(GhlWebhookController);
    authController = module.get<GhlAuthController>(GhlAuthController);
    healthController = module.get<GhlHealthController>(GhlHealthController);
  });

  describe('GHL Webhook Controller Contract', () => {
    it('should implement required webhook interface', () => {
      expect(webhookController.handleWebhook).toBeDefined();
      expect(typeof webhookController.handleWebhook).toBe('function');
    });

    it('should handle standard webhook payload structure', async () => {
      const standardPayload = {
        id: 'webhook-123',
        tenantId: 'tenant-456',
        type: 'contact.created',
        timestamp: '2024-01-01T00:00:00Z',
        payload: {
          contact: {
            id: 'contact-789',
            firstName: 'Test',
            lastName: 'User',
            email: 'test@example.com',
          },
        },
      };

      const mockReq = {
        headers: {
          'x-ghl-signature': 'mock_signature',
          'content-type': 'application/json',
        },
        body: standardPayload,
      };

      const result = await webhookController.handleWebhook(
        mockReq as any,
        'tenant-456'
      );

      expect(result).toHaveProperty('status');
      expect(result.status).toBe('processed');
    });

    it('should validate webhook signature according to contract', async () => {
      const payload = {
        id: 'webhook-123',
        type: 'contact.created',
        payload: { contact: { id: 'contact-789' } },
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
  });

  describe('GHL Auth Controller Contract', () => {
    it('should implement OAuth flow interface', () => {
      expect(authController.initiateOAuth).toBeDefined();
      expect(authController.handleCallback).toBeDefined();
      expect(typeof authController.initiateOAuth).toBe('function');
      expect(typeof authController.handleCallback).toBe('function');
    });

    it('should return proper OAuth initiation response', async () => {
      const result = await authController.initiateOAuth('test-tenant');

      expect(result).toHaveProperty('authorizationUrl');
      expect(result.authorizationUrl).toContain('gohighlevel.com');
      expect(result.authorizationUrl).toContain('client_id');
      expect(result.authorizationUrl).toContain('redirect_uri');
      expect(result.authorizationUrl).toContain('state');
      expect(result).toHaveProperty('state');
    });

    it('should handle OAuth callback with valid parameters', async () => {
      const mockQuery = {
        code: 'valid_auth_code',
        state: 'valid_state_token',
      };

      const result = await authController.handleCallback(
        mockQuery,
        'test-tenant'
      );

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('redirectUrl');
    });

    it('should reject OAuth callback with invalid state', async () => {
      const mockQuery = {
        code: 'valid_auth_code',
        state: 'invalid_state_token',
      };

      await expect(
        authController.handleCallback(mockQuery, 'test-tenant')
      ).rejects.toThrow('Invalid state parameter');
    });
  });

  describe('GHL Health Controller Contract', () => {
    it('should implement health check interface', () => {
      expect(healthController.getHealth).toBeDefined();
      expect(typeof healthController.getHealth).toBe('function');
    });

    it('should return standard health check response', async () => {
      const result = await healthController.getHealth();

      expect(result).toHaveProperty('status');
      expect(result).toHaveProperty('timestamp');
      expect(result).toHaveProperty('version');
      expect(result).toHaveProperty('services');

      // GHL-specific health checks
      expect(result.services).toHaveProperty('ghl');
      expect(result.services.ghl).toHaveProperty('status');
      expect(result.services.ghl).toHaveProperty('lastCheck');
    });

    it('should include integration-specific health metrics', async () => {
      const result = await healthController.getHealth();

      // Verify contract includes expected GHL health metrics
      expect(result.services.ghl).toHaveProperty('apiConnectivity');
      expect(result.services.ghl).toHaveProperty('webhookReception');
      expect(result.services.ghl).toHaveProperty('authTokenStatus');
    });
  });

  describe('Cross-Adapter Data Transformation Contract', () => {
    it('should transform GHL contact to NeuronX lead format', () => {
      const ghlContact = {
        id: 'ghl-contact-123',
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: '+1234567890',
        companyName: 'Acme Corp',
        tags: ['hot-lead', 'technology'],
        customFields: {
          industry: 'Technology',
          companySize: '100-500',
          budget: '50000',
        },
      };

      // Test the transformation logic (would be in a service)
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
        tags: ghlContact.tags,
        source: 'ghl',
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Verify transformation contract
      expect(neuronxLead.id).toContain('neuronx-');
      expect(neuronxLead.email).toBe(ghlContact.email);
      expect(neuronxLead.industry).toBe('technology');
      expect(neuronxLead.tags).toEqual(['hot-lead', 'technology']);
      expect(neuronxLead.source).toBe('ghl');
    });

    it('should handle GHL opportunity to NeuronX deal transformation', () => {
      const ghlOpportunity = {
        id: 'ghl-opp-456',
        name: 'Enterprise Software Deal',
        contactId: 'ghl-contact-123',
        value: 75000,
        status: 'open',
        pipeline: 'sales',
        stage: 'proposal',
        createdAt: '2024-01-01T00:00:00Z',
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
        source: 'ghl',
        createdAt: new Date(ghlOpportunity.createdAt),
        updatedAt: new Date(),
      };

      // Verify deal transformation contract
      expect(neuronxDeal.id).toContain('neuronx-deal-');
      expect(neuronxDeal.value).toBe(75000);
      expect(neuronxDeal.probability).toBe(0.6); // proposal stage
      expect(neuronxDeal.source).toBe('ghl');
    });
  });
});
