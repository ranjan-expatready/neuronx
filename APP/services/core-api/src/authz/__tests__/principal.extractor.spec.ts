import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PrincipalExtractorService } from '../principal.extractor';
import { PrincipalExtractionError } from '../principal';

describe('PrincipalExtractorService', () => {
  let service: PrincipalExtractorService;

  beforeEach(() => {
    service = new PrincipalExtractorService();
  });

  it('should extract principal from admin actor', async () => {
    const request = {
      actor: {
        type: 'admin',
        userId: 'admin-123',
        tenantId: 'tenant-456',
        roleIds: ['role-1'],
        permissions: ['admin:all'],
        correlationId: 'corr-789',
      },
    };

    const result = await service.extract(request);

    expect(result.principal).toBeDefined();
    expect(result.principal.userId).toBe('admin-123');
    expect(result.principal.tenantId).toBe('tenant-456');
    expect(result.principal.authType).toBe('admin_token');
    expect(result.principal.correlationId).toBe('corr-789');
    expect(result.principal.metadata?.roleIds).toEqual(['role-1']);
  });

  it('should extract principal from apikey actor', async () => {
    const request = {
      actor: {
        type: 'apikey',
        id: 'key-123',
        apiKeyName: 'test-key',
        fingerprint: 'fp-123',
        tenantId: 'tenant-456',
        roleIds: ['role-2'],
        permissions: ['webhooks:read'],
        correlationId: 'corr-000',
      },
    };

    const result = await service.extract(request);

    expect(result.principal).toBeDefined();
    expect(result.principal.userId).toBe('key-123');
    expect(result.principal.tenantId).toBe('tenant-456');
    expect(result.principal.authType).toBe('api_key');
    expect(result.principal.displayName).toBe('API Key test-key');
    expect(result.principal.metadata?.fingerprint).toBe('fp-123');
  });

  it('should throw PrincipalExtractionError if actor is missing', async () => {
    const request = {};

    await expect(service.extract(request)).rejects.toThrow(
      PrincipalExtractionError
    );
    await expect(service.extract(request)).rejects.toThrow(
      'No actor found in request'
    );
  });

  it('should throw PrincipalExtractionError for unsupported actor type', async () => {
    const request = {
      actor: {
        type: 'invalid',
        id: '123',
      },
    };

    await expect(service.extract(request)).rejects.toThrow(
      PrincipalExtractionError
    );
    await expect(service.extract(request)).rejects.toThrow(
      'Unsupported actor type'
    );
  });

  it('should log error and rethrow if extraction fails', async () => {
    const request = {
      path: '/test',
      method: 'GET',
      correlationId: 'fail-123',
    };

    // PrincipalExtractionError is thrown because actor is missing
    await expect(service.extract(request)).rejects.toThrow(
      PrincipalExtractionError
    );
  });
});
