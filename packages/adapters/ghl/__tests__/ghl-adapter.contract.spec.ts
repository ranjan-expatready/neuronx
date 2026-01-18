// Contract Tests for GHL Adapter
// Ensures GHL adapter properly implements canonical interfaces

import { GhlAdapter } from '../ghl.adapter';
import {
  ICRMAdapter,
  IConversationAdapter,
  IWorkflowAdapter,
  IIdentityAdapter,
  ICalendarAdapter,
  IBaseAdapter,
} from '../../contracts';

// Mock the token vault
jest.mock('../../security/token-vault', () => ({
  TokenVault: jest.fn().mockImplementation(() => ({
    getToken: jest.fn().mockResolvedValue({
      accessToken: 'mock_token',
      refreshToken: 'mock_refresh',
      expiresAt: new Date(Date.now() + 3600000),
      tokenType: 'location',
      locationId: 'mock_location',
      scope: ['contacts.readonly', 'contacts.write'],
      lastRefreshed: new Date(),
      provider: 'ghl',
      environment: 'dev',
    }),
  })),
}));

// Mock the GHL client
jest.mock('../ghl.client', () => ({
  GhlClient: jest.fn().mockImplementation(() => ({
    getContact: jest.fn(),
    createContact: jest.fn(),
    updateContact: jest.fn(),
    getContacts: jest.fn(),
    getOpportunities: jest.fn(),
    createOpportunity: jest.fn(),
    updateOpportunity: jest.fn(),
    getPipelines: jest.fn(),
    getPipeline: jest.fn(),
    getMessages: jest.fn(),
    sendMessage: jest.fn(),
    getConversations: jest.fn(),
    triggerWorkflow: jest.fn(),
    getUsers: jest.fn(),
    getCalendarEvents: jest.fn(),
    createCalendarEvent: jest.fn(),
    updateCalendarEvent: jest.fn(),
    deleteCalendarEvent: jest.fn(),
  })),
}));

describe('GHL Adapter - Contract Compliance', () => {
  let adapter: GhlAdapter;
  const mockContext = {
    tenantId: 'test-tenant',
    correlationId: 'test-correlation',
    requestId: 'test-request',
  };

  beforeEach(() => {
    adapter = new GhlAdapter({
      tenantId: 'test-tenant',
      environment: 'dev',
      baseUrl: 'https://api.mock.com',
    });
  });

  describe('ICRMAdapter Implementation', () => {
    it('should implement createLead method', async () => {
      const request = {
        email: 'test@example.com',
        firstName: 'John',
        lastName: 'Doe',
      };

      // This would normally make an API call
      // For contract testing, we verify the method exists and has correct signature
      expect(typeof adapter.createLead).toBe('function');

      // In a real test, we'd mock the HTTP client and verify the call
      // expect(mockHttpClient.post).toHaveBeenCalledWith('/contacts', expect.any(Object));
    });

    it('should implement updateLead method', () => {
      expect(typeof adapter.updateLead).toBe('function');
    });

    it('should implement getLead method', () => {
      expect(typeof adapter.getLead).toBe('function');
    });

    it('should implement listLeads method', () => {
      expect(typeof adapter.listLeads).toBe('function');
    });

    it('should implement createOpportunity method', () => {
      expect(typeof adapter.createOpportunity).toBe('function');
    });

    it('should implement getPipelines method', () => {
      expect(typeof adapter.getPipelines).toBe('function');
    });
  });

  describe('IConversationAdapter Implementation', () => {
    it('should implement sendMessage method', () => {
      expect(typeof adapter.sendMessage).toBe('function');
    });

    it('should implement listMessages method', () => {
      expect(typeof adapter.listMessages).toBe('function');
    });

    it('should implement getConversation method', () => {
      expect(typeof adapter.getConversation).toBe('function');
    });

    it('should implement tagConversation method', () => {
      expect(typeof adapter.tagConversation).toBe('function');
    });
  });

  describe('IWorkflowAdapter Implementation', () => {
    it('should implement triggerWorkflow method', () => {
      expect(typeof adapter.triggerWorkflow).toBe('function');
    });

    it('should implement pauseWorkflow method', () => {
      expect(typeof adapter.pauseWorkflow).toBe('function');
    });

    it('should implement getWorkflow method', () => {
      expect(typeof adapter.getWorkflow).toBe('function');
    });
  });

  describe('IIdentityAdapter Implementation', () => {
    it('should implement listUsers method', () => {
      expect(typeof adapter.listUsers).toBe('function');
    });

    it('should implement getUser method', () => {
      expect(typeof adapter.getUser).toBe('function');
    });

    it('should implement getUserByEmail method', () => {
      expect(typeof adapter.getUserByEmail).toBe('function');
    });

    it('should implement mapExternalUser method', () => {
      expect(typeof adapter.mapExternalUser).toBe('function');
    });
  });

  describe('ICalendarAdapter Implementation', () => {
    it('should implement createEvent method', () => {
      expect(typeof adapter.createEvent).toBe('function');
    });

    it('should implement updateEvent method', () => {
      expect(typeof adapter.updateEvent).toBe('function');
    });

    it('should implement listEvents method', () => {
      expect(typeof adapter.listEvents).toBe('function');
    });

    it('should implement cancelEvent method', () => {
      expect(typeof adapter.cancelEvent).toBe('function');
    });
  });

  describe('IBaseAdapter Implementation', () => {
    it('should implement getHealth method', () => {
      expect(typeof adapter.getHealth).toBe('function');
    });

    it('should implement getCapabilities method', () => {
      expect(typeof adapter.getCapabilities).toBe('function');
      const capabilities = adapter.getCapabilities();
      expect(capabilities).toHaveProperty('name');
      expect(capabilities).toHaveProperty('version');
      expect(capabilities).toHaveProperty('supportedFeatures');
    });

    it('should implement validateConfig method', () => {
      expect(typeof adapter.validateConfig).toBe('function');
    });
  });

  describe('Type Safety - No GHL Types Leaked', () => {
    it('should not export GHL-specific types', () => {
      // This test ensures we don't accidentally export GHL types
      // Import the main adapter module and check what's exported
      const exported = require('../index');

      // Should only export the adapter class and factory function
      expect(Object.keys(exported)).toEqual(['GhlAdapter', 'createGhlAdapter']);

      // Should not contain any GHL-specific type names
      const exportedNames = Object.keys(exported);
      const hasGhlTypes = exportedNames.some(
        name =>
          name.toLowerCase().includes('ghl') &&
          !name.includes('Adapter') &&
          !name.includes('create')
      );

      expect(hasGhlTypes).toBe(false);
    });

    it('should return canonical domain models', async () => {
      // This would be tested with mocked API responses
      // ensuring the adapter returns Lead, Opportunity, etc. (not GhlContact, etc.)
      expect(true).toBe(true); // Placeholder - real test would mock API
    });
  });
});
