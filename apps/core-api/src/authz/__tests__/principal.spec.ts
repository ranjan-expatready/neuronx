/**
 * Principal Tests - WI-036: Production Identity & Principal Model
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  DefaultPrincipalExtractor,
  PrincipalContext,
  PrincipalExtractionError,
} from '../principal';
import { AdminActor, ApiKeyActor } from '../authz.types';

describe('Principal Extraction', () => {
  let extractor: DefaultPrincipalExtractor;

  beforeEach(() => {
    extractor = new DefaultPrincipalExtractor();
  });

  describe('API Key Actor', () => {
    it('should extract principal from API key actor', async () => {
      const mockActor: ApiKeyActor = {
        type: 'apikey',
        id: 'api_key_123',
        tenantId: 'tenant_1',
        roleIds: ['operator'],
        permissions: ['execution:plan'],
        correlationId: 'corr_123',
        apiKeyId: 'api_key_123',
        apiKeyName: 'test-key',
        fingerprint: 'fp_123',
      };

      const mockRequest = {
        actor: mockActor,
        tenantId: 'tenant_1',
        correlationId: 'corr_123',
      };

      const result = await extractor.extract(mockRequest);

      expect(result.principal).toEqual({
        tenantId: 'tenant_1',
        userId: 'api_key_123', // API key ID as user ID
        authType: 'api_key',
        displayName: 'API Key test-key',
        correlationId: 'corr_123',
        metadata: {
          actorType: 'apikey',
          apiKeyName: 'test-key',
          fingerprint: 'fp_123',
          roleIds: ['operator'],
          permissions: ['execution:plan'],
        },
      });
      expect(result.actor).toBe(mockActor);
    });
  });

  describe('Admin Actor', () => {
    it('should extract principal from admin actor', async () => {
      const mockActor: AdminActor = {
        type: 'admin',
        id: 'admin_user',
        tenantId: 'tenant_1',
        roleIds: ['TenantAdmin'],
        permissions: ['admin:all'],
        correlationId: 'corr_123',
        userId: 'admin_user',
      };

      const mockRequest = {
        actor: mockActor,
        tenantId: 'tenant_1',
        correlationId: 'corr_123',
      };

      const result = await extractor.extract(mockRequest);

      expect(result.principal).toEqual({
        tenantId: 'tenant_1',
        userId: 'admin_user',
        authType: 'admin_token',
        displayName: 'Admin admin_user',
        correlationId: 'corr_123',
        metadata: {
          actorType: 'admin',
          roleIds: ['TenantAdmin'],
          permissions: ['admin:all'],
        },
      });
    });
  });

  describe('Error Handling', () => {
    it('should throw error when no actor in request', async () => {
      const mockRequest = {};

      await expect(extractor.extract(mockRequest)).rejects.toThrow(
        PrincipalExtractionError
      );

      try {
        await extractor.extract(mockRequest);
      } catch (error) {
        expect(error).toBeInstanceOf(PrincipalExtractionError);
        expect(error.message).toContain('No actor found');
        expect(error.statusCode).toBe(401);
      }
    });

    it('should throw error for unsupported actor type', async () => {
      const mockRequest = {
        actor: { type: 'unsupported' },
      };

      await expect(extractor.extract(mockRequest)).rejects.toThrow(
        PrincipalExtractionError
      );

      try {
        await extractor.extract(mockRequest);
      } catch (error) {
        expect(error).toBeInstanceOf(PrincipalExtractionError);
        expect(error.message).toContain('Unsupported actor type');
      }
    });
  });
});

describe('Principal Context', () => {
  it('should set and get principal on request', () => {
    const mockRequest = {};
    const mockPrincipal = {
      tenantId: 'tenant_1',
      userId: 'user_123',
      authType: 'api_key' as const,
      correlationId: 'corr_123',
    };

    PrincipalContext.setPrincipal(mockRequest, mockPrincipal);
    const retrieved = PrincipalContext.getPrincipalFromRequest(mockRequest);

    expect(retrieved).toEqual(mockPrincipal);
  });

  it('should throw error when requiring principal but none exists', () => {
    const mockRequest = {};

    expect(() => PrincipalContext.requirePrincipal(mockRequest)).toThrow(
      PrincipalExtractionError
    );
  });

  it('should return principal when it exists', () => {
    const mockRequest = {};
    const mockPrincipal = {
      tenantId: 'tenant_1',
      userId: 'user_123',
      authType: 'api_key' as const,
      correlationId: 'corr_123',
    };

    PrincipalContext.setPrincipal(mockRequest, mockPrincipal);
    const retrieved = PrincipalContext.requirePrincipal(mockRequest);

    expect(retrieved).toEqual(mockPrincipal);
  });
});
