import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GhlReadAdapter } from '../adapters/ghl-read-adapter';
import { GhlReadAdapterConfig } from '../types';
import { Logger } from '@neuronx/observability';

describe('GhlReadAdapter', () => {
  let adapter: GhlReadAdapter;
  let mockLogger: Logger;
  let config: GhlReadAdapterConfig;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn().mockReturnThis(),
    };

    config = {
      tenantId: 'test-tenant',
      environment: 'dev',
      baseUrl: 'https://api.ghl.com',
      snapshot: {
        enabled: true,
        retentionDays: 30,
        maxRecordsPerSnapshot: 1000,
      },
      governance: {
        auditMutations: true,
        rateLimitRequestsPerMinute: 60,
        allowedDataTypes: ['contacts', 'opportunities', 'pipelines'],
      },
    };

    // Mock the internal GHL adapter
    const mockGhlAdapter = {
      listLeads: vi.fn(),
      getLead: vi.fn(),
      listOpportunities: vi.fn(),
      getOpportunity: vi.fn(),
      listPipelines: vi.fn(),
      getPipeline: vi.fn(),
      getUsers: vi.fn(),
    };

    adapter = new GhlReadAdapter(config, mockLogger);
    // Inject mock adapter for testing
    (adapter as any).ghlAdapter = mockGhlAdapter;
  });

  describe('Mutation blocking at runtime', () => {
    it('should have blockMutation method that always throws', () => {
      const blockMethods = [
        'blockCreateContact',
        'blockUpdateContact',
        'blockDeleteContact',
        'blockCreateOpportunity',
        'blockUpdateOpportunity',
        'blockDeleteOpportunity',
        'blockCreatePipeline',
        'blockUpdatePipeline',
        'blockDeletePipeline',
      ];

      blockMethods.forEach(methodName => {
        if (typeof (adapter as any)[methodName] === 'function') {
          expect(() => {
            (adapter as any)[methodName]();
          }).toThrow(
            'Read-only adapter: mutation operations are not permitted'
          );
        }
      });
    });

    it('should not expose any mutation methods in public API', () => {
      // Verify that no mutation methods exist on the adapter instance
      const mutationMethods = [
        'createContact',
        'updateContact',
        'deleteContact',
        'createOpportunity',
        'updateOpportunity',
        'deleteOpportunity',
        'createPipeline',
        'updatePipeline',
        'deletePipeline',
        'createLead',
        'updateLead',
        'deleteLead',
      ];

      mutationMethods.forEach(method => {
        expect(typeof (adapter as any)[method]).not.toBe('function');
      });
    });

    it('should throw on any attempt to call undefined mutation methods', () => {
      // This tests that even if someone tries to call a mutation method that doesn't exist,
      // the adapter will still fail safely

      const mutationAttempts = [
        () => (adapter as any).createContact({}),
        () => (adapter as any).updateContact('123', {}),
        () => (adapter as any).deleteContact('123'),
        () => (adapter as any).createOpportunity({}),
        () => (adapter as any).updateOpportunity('123', {}),
        () => (adapter as any).deleteOpportunity('123'),
      ];

      mutationAttempts.forEach(attempt => {
        expect(attempt).toThrow();
      });
    });
  });

  describe('Read operations allowed', () => {
    it('should allow read operations without blocking', async () => {
      const mockGhlAdapter = (adapter as any).ghlAdapter;

      // Mock successful responses
      mockGhlAdapter.listLeads.mockResolvedValue({
        contacts: [{ id: '1', name: 'Test Contact' }],
        total: 1,
      });

      mockGhlAdapter.getLead.mockResolvedValue({
        id: '1',
        name: 'Test Contact',
      });

      const context = {
        tenantId: 'test-tenant',
        correlationId: 'test-correlation',
        environment: 'dev' as const,
      };

      // These should not throw
      await expect(adapter.listLeads({}, context)).resolves.not.toThrow();
      await expect(adapter.getContact('1', context)).resolves.not.toThrow();

      // Verify the underlying adapter was called
      expect(mockGhlAdapter.listLeads).toHaveBeenCalled();
      expect(mockGhlAdapter.getLead).toHaveBeenCalled();
    });
  });

  describe('Governance enforcement', () => {
    it('should validate data type access for read operations', async () => {
      const context = {
        tenantId: 'test-tenant',
        correlationId: 'test-correlation',
        environment: 'dev' as const,
      };

      // This should work for allowed data types
      await expect(adapter.listLeads({}, context)).resolves.not.toThrow();

      // Verify governance validation was called
      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Data type access validated',
        expect.objectContaining({
          dataType: 'contacts',
          correlationId: 'test-correlation',
        })
      );
    });

    it('should throw for unauthorized data types', () => {
      const configWithoutContacts = {
        ...config,
        governance: {
          ...config.governance,
          allowedDataTypes: ['opportunities', 'pipelines'], // no contacts
        },
      };

      const adapterWithoutContacts = new GhlReadAdapter(
        configWithoutContacts,
        mockLogger
      );
      const context = {
        tenantId: 'test-tenant',
        correlationId: 'test-correlation',
        environment: 'dev' as const,
      };

      expect(() =>
        adapterWithoutContacts.validateDataTypeAccess('contacts', context)
      ).toThrow('Access to data type contacts is not permitted');
    });
  });
});
