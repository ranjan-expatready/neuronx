/**
 * Artifacts API Authorization Tests - WI-022: Access Control & API Key Governance
 *
 * Tests for artifacts endpoints with API key and permission-based access control.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { ArtifactsService } from '../artifacts.service';
import { ArtifactsController } from '../artifacts.controller';
import { ApiKeyService } from '../../authz/api-key.service';
import { AuditService } from '../../authz/audit.service';

// Mock dependencies
const mockArtifactsService = {
  createUploadUrl: jest.fn(),
  createDownloadUrl: jest.fn(),
  listArtifacts: jest.fn(),
  getArtifact: jest.fn(),
  deleteArtifact: jest.fn(),
  getArtifactStats: jest.fn(),
};

const mockApiKeyService = {
  validateApiKey: jest.fn(),
  updateLastUsed: jest.fn(),
};

const mockAuditService = {
  logEvent: jest.fn(),
};

describe('Artifacts API Authorization (WI-022)', () => {
  let app: INestApplication;

  const tenantA = 'tenant-a';
  const tenantB = 'tenant-b';
  const adminToken = 'Bearer admin-token-123';
  const apiKey = 'nxk_live_testkey12345678901234567890';
  const apiKeyFingerprint = 'testkey12'; // First 8 chars of sha256

  const adminActor = {
    type: 'admin' as const,
    id: 'admin-user',
    tenantId: tenantA,
    roleIds: ['TenantAdmin'],
    permissions: ['admin:all'],
    correlationId: 'admin-correlation-123',
  };

  const apiKeyActor = {
    type: 'apikey' as const,
    id: 'apikey-123',
    tenantId: tenantA,
    roleIds: ['IntegrationBot'],
    permissions: [
      'artifacts:read',
      'artifacts:write',
      'webhooks:read',
      'events:read',
      'usage:read',
    ],
    correlationId: 'apikey-correlation-123',
    apiKeyId: 'apikey-123',
    apiKeyName: 'Test API Key',
    fingerprint: apiKeyFingerprint,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArtifactsController],
      providers: [
        {
          provide: ArtifactsService,
          useValue: mockArtifactsService,
        },
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

    // Mock authentication middleware
    app.use((req: any, res: any, next: any) => {
      const authHeader = req.headers.authorization;
      const apiKeyHeader = req.headers['x-api-key'];

      if (authHeader === adminToken) {
        // Admin authentication
        req.tenantId = tenantA;
        req.actor = adminActor;
      } else if (apiKeyHeader === apiKey) {
        // API key authentication
        mockApiKeyService.validateApiKey.mockResolvedValue(apiKeyActor);
        req.tenantId = tenantA;
        req.actor = apiKeyActor;
      }

      req.correlationId = req.actor?.correlationId || 'test-correlation-123';
      next();
    });

    await app.init();

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Authentication Methods', () => {
    it('should accept admin Bearer token authentication', async () => {
      mockArtifactsService.listArtifacts.mockResolvedValue({
        artifacts: [],
        total: 0,
      });

      await request(app.getHttpServer())
        .get('/api/artifacts')
        .set('Authorization', adminToken)
        .expect(200);

      expect(mockArtifactsService.listArtifacts).toHaveBeenCalledWith(
        tenantA,
        undefined,
        50,
        0
      );
    });

    it('should accept API key authentication via X-API-Key header', async () => {
      mockArtifactsService.listArtifacts.mockResolvedValue({
        artifacts: [],
        total: 0,
      });

      await request(app.getHttpServer())
        .get('/api/artifacts')
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(mockApiKeyService.validateApiKey).toHaveBeenCalledWith(apiKey);
      expect(mockArtifactsService.listArtifacts).toHaveBeenCalledWith(
        tenantA,
        undefined,
        50,
        0
      );
    });

    it('should accept API key authentication via Authorization header', async () => {
      mockArtifactsService.listArtifacts.mockResolvedValue({
        artifacts: [],
        total: 0,
      });

      await request(app.getHttpServer())
        .get('/api/artifacts')
        .set('Authorization', `ApiKey ${apiKey}`)
        .expect(200);

      expect(mockApiKeyService.validateApiKey).toHaveBeenCalledWith(apiKey);
    });

    it('should reject requests without authentication', async () => {
      await request(app.getHttpServer()).get('/api/artifacts').expect(403);
    });

    it('should reject invalid API keys', async () => {
      mockApiKeyService.validateApiKey.mockRejectedValue(
        new Error('Invalid API key')
      );

      await request(app.getHttpServer())
        .get('/api/artifacts')
        .set('X-API-Key', 'invalid-key')
        .expect(401);
    });
  });

  describe('Permission-Based Access Control', () => {
    describe('POST /api/artifacts/upload-url - Create Upload URL', () => {
      it('should allow admin access', async () => {
        const mockResponse = {
          artifactId: 'artifact-123',
          uploadUrl: 'https://upload.example.com',
          objectKey: 'tenant-a/voice-recording/file.webm',
          expiresAt: new Date(),
        };

        mockArtifactsService.createUploadUrl.mockResolvedValue(mockResponse);

        await request(app.getHttpServer())
          .post('/api/artifacts/upload-url')
          .set('Authorization', adminToken)
          .send({
            type: 'voice-recording',
            contentType: 'audio/webm',
            size: 1024 * 1024,
          })
          .expect(200);

        expect(mockArtifactsService.createUploadUrl).toHaveBeenCalled();
      });

      it('should allow API key with artifacts:write permission', async () => {
        const mockResponse = {
          artifactId: 'artifact-123',
          uploadUrl: 'https://upload.example.com',
          objectKey: 'tenant-a/voice-recording/file.webm',
          expiresAt: new Date(),
        };

        mockArtifactsService.createUploadUrl.mockResolvedValue(mockResponse);

        await request(app.getHttpServer())
          .post('/api/artifacts/upload-url')
          .set('X-API-Key', apiKey)
          .send({
            type: 'voice-recording',
            contentType: 'audio/webm',
            size: 1024 * 1024,
          })
          .expect(200);
      });

      it('should deny API key without artifacts:write permission', async () => {
        const insufficientActor = {
          ...apiKeyActor,
          permissions: ['artifacts:read'], // Missing write permission
        };

        mockApiKeyService.validateApiKey.mockResolvedValue(insufficientActor);

        await request(app.getHttpServer())
          .post('/api/artifacts/upload-url')
          .set('X-API-Key', apiKey)
          .send({
            type: 'voice-recording',
            contentType: 'audio/webm',
            size: 1024 * 1024,
          })
          .expect(403);
      });
    });

    describe('GET /api/artifacts - List Artifacts', () => {
      it('should allow admin access', async () => {
        mockArtifactsService.listArtifacts.mockResolvedValue({
          artifacts: [],
          total: 0,
        });

        await request(app.getHttpServer())
          .get('/api/artifacts')
          .set('Authorization', adminToken)
          .expect(200);
      });

      it('should allow API key with artifacts:read permission', async () => {
        mockArtifactsService.listArtifacts.mockResolvedValue({
          artifacts: [],
          total: 0,
        });

        await request(app.getHttpServer())
          .get('/api/artifacts')
          .set('X-API-Key', apiKey)
          .expect(200);
      });

      it('should deny API key without artifacts:read permission', async () => {
        const insufficientActor = {
          ...apiKeyActor,
          permissions: ['artifacts:write'], // Missing read permission
        };

        mockApiKeyService.validateApiKey.mockResolvedValue(insufficientActor);

        await request(app.getHttpServer())
          .get('/api/artifacts')
          .set('X-API-Key', apiKey)
          .expect(403);
      });
    });

    describe('DELETE /api/artifacts/:id - Delete Artifact', () => {
      it('should allow admin access', async () => {
        mockArtifactsService.deleteArtifact.mockResolvedValue(undefined);

        await request(app.getHttpServer())
          .delete('/api/artifacts/artifact-123')
          .set('Authorization', adminToken)
          .expect(204);
      });

      it('should deny API key even with artifacts:write permission', async () => {
        // artifacts:manage is required for delete, not just write
        await request(app.getHttpServer())
          .delete('/api/artifacts/artifact-123')
          .set('X-API-Key', apiKey)
          .expect(403);
      });
    });
  });

  describe('Tenant Isolation', () => {
    it('should scope all operations to authenticated tenant', async () => {
      mockArtifactsService.listArtifacts.mockResolvedValue({
        artifacts: [],
        total: 0,
      });

      await request(app.getHttpServer())
        .get('/api/artifacts')
        .set('Authorization', adminToken)
        .expect(200);

      // Verify tenant isolation - service should only see tenantA data
      expect(mockArtifactsService.listArtifacts).toHaveBeenCalledWith(
        tenantA, // Should be tenantA, not tenantB
        undefined,
        50,
        0
      );
    });

    it('should prevent cross-tenant access via API keys', async () => {
      // Simulate API key belonging to different tenant
      const crossTenantActor = {
        ...apiKeyActor,
        tenantId: tenantB, // Different tenant
      };

      mockApiKeyService.validateApiKey.mockResolvedValue(crossTenantActor);

      // Request should fail because API key belongs to different tenant
      // than what the endpoint expects (tenantA)
      await request(app.getHttpServer())
        .get('/api/artifacts')
        .set('X-API-Key', apiKey)
        .expect(403);
    });
  });

  describe('Audit Logging', () => {
    it('should log API key usage', async () => {
      mockArtifactsService.listArtifacts.mockResolvedValue({
        artifacts: [],
        total: 0,
      });

      await request(app.getHttpServer())
        .get('/api/artifacts')
        .set('X-API-Key', apiKey)
        .expect(200);

      expect(mockApiKeyService.updateLastUsed).toHaveBeenCalledWith(
        'apikey-123'
      );
    });

    it('should log permission denied attempts', async () => {
      const insufficientActor = {
        ...apiKeyActor,
        permissions: [], // No permissions
      };

      mockApiKeyService.validateApiKey.mockResolvedValue(insufficientActor);

      await request(app.getHttpServer())
        .get('/api/artifacts')
        .set('X-API-Key', apiKey)
        .expect(403);

      // Should log permission denied (fire-and-forget)
      expect(mockAuditService.logEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: tenantA,
          actor: insufficientActor,
          action: 'denied.artifacts.list',
        })
      );
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockArtifactsService.listArtifacts.mockRejectedValue(
        new Error('Database connection failed')
      );

      await request(app.getHttpServer())
        .get('/api/artifacts')
        .set('Authorization', adminToken)
        .expect(500);
    });

    it('should provide clear error messages for auth failures', async () => {
      mockApiKeyService.validateApiKey.mockRejectedValue(
        new Error('Invalid API key')
      );

      const response = await request(app.getHttpServer())
        .get('/api/artifacts')
        .set('X-API-Key', 'invalid-key')
        .expect(401);

      expect(response.body.error).toBe('Invalid API key');
    });
  });
});
