/**
 * Org Authority Service Tests - WI-036: Production Identity & Principal Model
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { OrgAuthorityService } from '../org-authority.service';
import { PrincipalExtractorService } from '../../authz/principal.extractor';
import { TenantContext } from '../../config/tenant-context';
import { Principal } from '../../authz/principal';
import { Capability } from '@neuronx/org-authority';

// Mock dependencies
vi.mock('../org-authority.service', () => ({
  // We'll mock the actual service methods
}));

vi.mock('../../authz/principal.extractor');
vi.mock('../../config/tenant-context');

describe('OrgAuthorityService Integration', () => {
  let service: OrgAuthorityService;
  let mockPrincipalExtractor: any;
  let mockTenantContext: any;

  beforeEach(() => {
    mockPrincipalExtractor = {
      extract: vi.fn(),
    };

    mockTenantContext = {
      tenantId: 'tenant_1',
    };

    // Create service instance with mocked dependencies
    service = new OrgAuthorityService(
      mockTenantContext,
      mockPrincipalExtractor
    );
  });

  describe('Principal Extraction', () => {
    it('should extract principal from request', async () => {
      const mockPrincipal: Principal = {
        tenantId: 'tenant_1',
        userId: 'user_123',
        authType: 'api_key',
        correlationId: 'corr_123',
      };

      const mockRequest = { path: '/test' };
      mockPrincipalExtractor.extract.mockResolvedValue({
        principal: mockPrincipal,
        actor: { type: 'apikey' },
      });

      const result = await service.extractPrincipal(mockRequest);

      expect(result).toEqual(mockPrincipal);
      expect(mockPrincipalExtractor.extract).toHaveBeenCalledWith(mockRequest);
    });
  });

  describe('Capability Enforcement', () => {
    it('should enforce capability for principal', async () => {
      const mockPrincipal: Principal = {
        tenantId: 'tenant_1',
        userId: 'user_123',
        authType: 'api_key',
        correlationId: 'corr_123',
      };

      // Mock the getAuthorityContext method
      service.getAuthorityContext = vi.fn().mockResolvedValue({
        tenantId: 'tenant_1',
        memberId: 'member_1',
        userId: 'user_123',
        roleAssignments: [],
        resolvedCapabilities: new Set([Capability.ASSIST_EXECUTION]),
      });

      // Mock the resolver assertCapability method
      const mockResolver = {
        assertCapability: vi.fn(),
      };
      (service as any).resolver = mockResolver;

      await service.requireCapability(
        mockPrincipal,
        Capability.ASSIST_EXECUTION
      );

      expect(service.getAuthorityContext).toHaveBeenCalledWith(mockPrincipal);
      expect(mockResolver.assertCapability).toHaveBeenCalled();
    });
  });

  describe('Request-based Operations', () => {
    it('should get authority context from request', async () => {
      const mockPrincipal: Principal = {
        tenantId: 'tenant_1',
        userId: 'user_123',
        authType: 'api_key',
        correlationId: 'corr_123',
      };

      const mockRequest = { path: '/test' };
      mockPrincipalExtractor.extract.mockResolvedValue({
        principal: mockPrincipal,
        actor: { type: 'apikey' },
      });

      service.getAuthorityContext = vi.fn().mockResolvedValue({
        tenantId: 'tenant_1',
        memberId: 'member_1',
        userId: 'user_123',
        roleAssignments: [],
        resolvedCapabilities: new Set(),
      });

      const result = await service.getAuthorityContextFromRequest(mockRequest);

      expect(result.tenantId).toBe('tenant_1');
      expect(result.userId).toBe('user_123');
    });

    it('should require capability from request', async () => {
      const mockPrincipal: Principal = {
        tenantId: 'tenant_1',
        userId: 'user_123',
        authType: 'api_key',
        correlationId: 'corr_123',
      };

      const mockRequest = { path: '/test' };
      mockPrincipalExtractor.extract.mockResolvedValue({
        principal: mockPrincipal,
        actor: { type: 'apikey' },
      });

      service.requireCapability = vi.fn().mockResolvedValue(undefined);

      await service.requireCapabilityFromRequest(
        mockRequest,
        Capability.ASSIST_EXECUTION
      );

      expect(service.requireCapability).toHaveBeenCalledWith(
        mockPrincipal,
        Capability.ASSIST_EXECUTION
      );
    });
  });
});
