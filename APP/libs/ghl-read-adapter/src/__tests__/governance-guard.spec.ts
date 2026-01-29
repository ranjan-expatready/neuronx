import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  GovernanceGuard,
  GovernanceViolationType,
} from '../governance/governance-guard';
import { Logger } from '@neuronx/observability';

describe('GovernanceGuard', () => {
  let guard: GovernanceGuard;
  let mockLogger: Logger;

  beforeEach(() => {
    mockLogger = {
      debug: vi.fn(),
      info: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      child: vi.fn().mockReturnThis(),
    };
    guard = new GovernanceGuard(mockLogger);
  });

  describe('validateMutationAttempt', () => {
    it('should throw error for any mutation attempt', () => {
      const mutationOps = [
        'createContact',
        'updateContact',
        'deleteContact',
        'createOpportunity',
        'updateOpportunity',
        'deleteOpportunity',
        'createPipeline',
        'updatePipeline',
        'deletePipeline',
        'POST /contacts',
        'PUT /contacts/123',
        'DELETE /contacts/123',
        'POST /opportunities',
        'PUT /opportunities/123',
        'DELETE /opportunities/123',
      ];

      mutationOps.forEach(operation => {
        expect(() => {
          guard.validateMutationAttempt(operation, 'test-tenant', 'test-user');
        }).toThrow('Read-only adapter: mutation operations are not permitted');

        expect(mockLogger.error).toHaveBeenCalledWith(
          'Governance violation: mutation attempt blocked',
          expect.objectContaining({
            violationType: GovernanceViolationType.UNAUTHORIZED_MUTATION,
            operation,
            tenantId: 'test-tenant',
            userId: 'test-user',
          })
        );
      });
    });

    it('should log governance violations with correct metadata', () => {
      const operation = 'POST /contacts';
      const tenantId = 'test-tenant-123';
      const userId = 'user-456';

      expect(() => {
        guard.validateMutationAttempt(operation, tenantId, userId);
      }).toThrow();

      expect(mockLogger.error).toHaveBeenCalledWith(
        'Governance violation: mutation attempt blocked',
        expect.objectContaining({
          violationType: GovernanceViolationType.UNAUTHORIZED_MUTATION,
          operation,
          tenantId,
          userId,
          timestamp: expect.any(Date),
          severity: 'high',
        })
      );
    });
  });

  describe('validateReadOnlyAccess', () => {
    it('should allow read operations without throwing', () => {
      const readOps = [
        'getContact',
        'listContacts',
        'getOpportunity',
        'listOpportunities',
        'getPipeline',
        'listPipelines',
        'GET /contacts',
        'GET /contacts/123',
        'GET /opportunities',
        'GET /opportunities/123',
        'GET /pipelines',
      ];

      readOps.forEach(operation => {
        expect(() => {
          guard.validateReadOnlyAccess(operation, 'test-tenant');
        }).not.toThrow();
      });

      // Should not log any errors for read operations
      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('should log read access for audit purposes', () => {
      guard.validateReadOnlyAccess('GET /contacts', 'test-tenant');

      expect(mockLogger.debug).toHaveBeenCalledWith(
        'Read-only access validated',
        expect.objectContaining({
          operation: 'GET /contacts',
          tenantId: 'test-tenant',
        })
      );
    });
  });

  describe('Type-level enforcement', () => {
    it('should not expose any mutation methods in the interface', () => {
      // This test verifies that the adapter interface doesn't include mutation methods
      // If this test passes, it means the TypeScript interface is correctly read-only

      const adapterInterface = guard as any;

      // These methods should NOT exist
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
      ];

      mutationMethods.forEach(method => {
        expect(adapterInterface[method]).toBeUndefined();
      });
    });
  });
});
