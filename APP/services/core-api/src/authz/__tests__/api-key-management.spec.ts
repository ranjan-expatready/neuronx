/**
 * API Key Management Integration Tests - WI-022: Access Control & API Key Governance
 *
 * Tests for API key lifecycle, authentication, and authorization.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { ApiKeyService } from '../api-key.service';
import { ApiKeyController } from '../api-key.controller';
import { AuditService } from '../audit.service';
import { AdminGuard } from '../admin.guard';

// Mock dependencies
const mockApiKeyService = {
  createApiKey: jest.fn(),
  listApiKeys: jest.fn(),
  getApiKey: jest.fn(),
  rotateApiKey: jest.fn(),
  revokeApiKey: jest.fn(),
};

const mockAuditService = {
  logApiKeyCreated: jest.fn(),
  logApiKeyRotated: jest.fn(),
  logApiKeyRevoked: jest.fn(),
};

describe('API Key Management (WI-022)', () => {
  let app: INestApplication;
  let apiKeyService: ApiKeyService;

  const tenantId = 'tenant-a';
  const adminToken = 'Bearer admin-token-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApiKeyController],
      providers: [
        {
          provide: ApiKeyService,
          useValue: mockApiKeyService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    app = module.createNestApplication();

    // Add validation pipe
    app.useGlobalPipes(
      new ValidationPipe({
        transform: true,
        whitelist: true,
        forbidNonWhitelisted: true,
      })
    );

    // Mock admin guard
    app.use((req: any, res: any, next: any) => {
      if (req.headers.authorization === adminToken) {
        req.tenantId = tenantId;
        req.actor = {
          type: 'admin',
          id: 'admin-user',
          tenantId,
          permissions: ['admin:all'],
        };
        (global as any).currentTenantId = tenantId;
      }
      next();
    });

    await app.init();

    apiKeyService = module.get<ApiKeyService>(ApiKeyService);

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/auth/api-keys - Create API Key', () => {
    const validRequest = {
      name: 'Test Integration Key',
      roleIds: ['IntegrationBot'],
    };

    it('should create API key successfully', async () => {
      const mockResponse = {
        id: 'apikey-123',
        name: 'Test Integration Key',
        key: 'nxk_live_abc123def456...', // Would be real key
        fingerprint: 'abc123de',
        roleIds: ['IntegrationBot'],
        permissions: [
          'webhooks:read',
          'events:read',
          'usage:read',
          'artifacts:write',
        ],
        createdAt: new Date(),
      };

      mockApiKeyService.createApiKey.mockResolvedValue(mockResponse);

      const response = await request(app.getHttpServer())
        .post('/api/auth/api-keys')
        .set('Authorization', adminToken)
        .send(validRequest)
        .expect(201);

      expect(response.body).toMatchObject({
        id: 'apikey-123',
        name: 'Test Integration Key',
        key: expect.stringContaining('nxk_live_'),
        fingerprint: 'abc123de',
        roleIds: ['IntegrationBot'],
        permissions: expect.any(Array),
        createdAt: expect.any(String),
      });

      expect(mockApiKeyService.createApiKey).toHaveBeenCalledWith(
        tenantId,
        validRequest
      );
      expect(mockAuditService.logApiKeyCreated).toHaveBeenCalled();
    });

    it('should create API key with explicit permissions', async () => {
      const requestWithPermissions = {
        name: 'Custom Key',
        permissions: ['artifacts:read', 'artifacts:write'],
      };

      const mockResponse = {
        id: 'apikey-456',
        name: 'Custom Key',
        key: 'nxk_live_xyz789...',
        fingerprint: 'xyz789ab',
        roleIds: [],
        permissions: ['artifacts:read', 'artifacts:write'],
        createdAt: new Date(),
      };

      mockApiKeyService.createApiKey.mockResolvedValue(mockResponse);

      const response = await request(app.getHttpServer())
        .post('/api/auth/api-keys')
        .set('Authorization', adminToken)
        .send(requestWithPermissions)
        .expect(201);

      expect(response.body.permissions).toEqual([
        'artifacts:read',
        'artifacts:write',
      ]);
    });

    it('should validate required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/api-keys')
        .set('Authorization', adminToken)
        .send({})
        .expect(400);
    });

    it('should require either roleIds or permissions', async () => {
      const invalidRequest = {
        name: 'Invalid Key',
        // No roleIds or permissions
      };

      await request(app.getHttpServer())
        .post('/api/auth/api-keys')
        .set('Authorization', adminToken)
        .send(invalidRequest)
        .expect(400);
    });

    it('should require admin authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/api-keys')
        .send(validRequest)
        .expect(403);
    });
  });

  describe('GET /api/auth/api-keys - List API Keys', () => {
    it('should list API keys for tenant', async () => {
      const mockApiKeys = [
        {
          id: 'apikey-1',
          name: 'Key 1',
          fingerprint: 'abc123',
          roleIds: ['IntegrationBot'],
          permissions: ['webhooks:read'],
          status: 'ACTIVE',
          createdAt: new Date(),
        },
        {
          id: 'apikey-2',
          name: 'Key 2',
          fingerprint: 'def456',
          roleIds: [],
          permissions: ['artifacts:read'],
          status: 'REVOKED',
          createdAt: new Date(),
        },
      ];

      mockApiKeyService.listApiKeys.mockResolvedValue(mockApiKeys);

      const response = await request(app.getHttpServer())
        .get('/api/auth/api-keys')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toMatchObject({
        apiKeys: [
          {
            id: 'apikey-1',
            name: 'Key 1',
            fingerprint: 'abc123',
            roleIds: ['IntegrationBot'],
            permissions: ['webhooks:read'],
            status: 'ACTIVE',
          },
          {
            id: 'apikey-2',
            name: 'Key 2',
            fingerprint: 'def456',
            roleIds: [],
            permissions: ['artifacts:read'],
            status: 'REVOKED',
          },
        ],
      });

      expect(mockApiKeyService.listApiKeys).toHaveBeenCalledWith(tenantId);
    });
  });

  describe('GET /api/auth/api-keys/:id - Get API Key', () => {
    it('should return API key details', async () => {
      const mockApiKey = {
        id: 'apikey-123',
        name: 'Test Key',
        fingerprint: 'abc123de',
        roleIds: ['IntegrationBot'],
        permissions: ['webhooks:read', 'events:read'],
        status: 'ACTIVE',
        createdAt: new Date(),
      };

      mockApiKeyService.getApiKey.mockResolvedValue(mockApiKey);

      const response = await request(app.getHttpServer())
        .get('/api/auth/api-keys/apikey-123')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toEqual(mockApiKey);

      expect(mockApiKeyService.getApiKey).toHaveBeenCalledWith(
        tenantId,
        'apikey-123'
      );
    });

    it('should return 404 for non-existent API key', async () => {
      mockApiKeyService.getApiKey.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/auth/api-keys/non-existent')
        .set('Authorization', adminToken)
        .expect(404);
    });
  });

  describe('POST /api/auth/api-keys/:id/rotate - Rotate API Key', () => {
    it('should rotate API key successfully', async () => {
      const mockResponse = {
        id: 'apikey-123',
        name: 'Test Key',
        newKey: 'nxk_live_newkey123...', // New key returned once
        fingerprint: 'new456ab',
        roleIds: ['IntegrationBot'],
        permissions: ['webhooks:read', 'events:read'],
        rotatedAt: new Date(),
      };

      mockApiKeyService.rotateApiKey.mockResolvedValue(mockResponse);

      const response = await request(app.getHttpServer())
        .post('/api/auth/api-keys/apikey-123/rotate')
        .set('Authorization', adminToken)
        .send()
        .expect(200);

      expect(response.body).toMatchObject({
        id: 'apikey-123',
        name: 'Test Key',
        newKey: expect.stringContaining('nxk_live_'),
        fingerprint: 'new456ab',
        roleIds: ['IntegrationBot'],
        permissions: expect.any(Array),
        rotatedAt: expect.any(String),
      });

      expect(mockApiKeyService.rotateApiKey).toHaveBeenCalledWith(
        tenantId,
        'apikey-123'
      );
      expect(mockAuditService.logApiKeyRotated).toHaveBeenCalled();
    });
  });

  describe('POST /api/auth/api-keys/:id/revoke - Revoke API Key', () => {
    it('should revoke API key successfully', async () => {
      mockApiKeyService.revokeApiKey.mockResolvedValue(undefined);

      await request(app.getHttpServer())
        .post('/api/auth/api-keys/apikey-123/revoke')
        .set('Authorization', adminToken)
        .send()
        .expect(204);

      expect(mockApiKeyService.revokeApiKey).toHaveBeenCalledWith(
        tenantId,
        'apikey-123'
      );
      expect(mockAuditService.logApiKeyRevoked).toHaveBeenCalled();
    });
  });

  describe('Security Validation', () => {
    it('should require admin authentication for all operations', async () => {
      await request(app.getHttpServer())
        .post('/api/auth/api-keys')
        .send({ name: 'Test', roleIds: ['IntegrationBot'] })
        .expect(403);

      await request(app.getHttpServer()).get('/api/auth/api-keys').expect(403);

      await request(app.getHttpServer())
        .get('/api/auth/api-keys/apikey-123')
        .expect(403);
    });

    it('should validate input sanitization', async () => {
      const maliciousRequest = {
        name: 'Test Key',
        roleIds: ['IntegrationBot'],
        maliciousField: 'should be stripped',
      };

      mockApiKeyService.createApiKey.mockResolvedValue({
        id: 'apikey-123',
        name: 'Test Key',
        key: 'nxk_live_test',
        fingerprint: 'test',
        roleIds: ['IntegrationBot'],
        permissions: [],
        createdAt: new Date(),
      });

      await request(app.getHttpServer())
        .post('/api/auth/api-keys')
        .set('Authorization', adminToken)
        .send(maliciousRequest)
        .expect(400); // Should reject extra fields
    });
  });
});
