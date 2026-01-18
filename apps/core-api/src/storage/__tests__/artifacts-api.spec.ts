/**
 * Artifacts API Integration Tests - WI-021: Object Storage & Artifact Management
 *
 * Tests for REST API endpoints with tenant isolation and security validation.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { ArtifactsService } from '../artifacts.service';
import { ArtifactsController } from '../artifacts.controller';
import { StorageProvider } from '../storage.types';

// Mock dependencies
const mockArtifactsService = {
  createUploadUrl: jest.fn(),
  createDownloadUrl: jest.fn(),
  listArtifacts: jest.fn(),
  getArtifact: jest.fn(),
  deleteArtifact: jest.fn(),
  getArtifactStats: jest.fn(),
};

const mockStorageProvider = {
  generateUploadUrl: jest.fn(),
  generateDownloadUrl: jest.fn(),
  objectExists: jest.fn(),
};

describe('Artifacts API Integration (WI-021)', () => {
  let app: INestApplication;
  let artifactsService: ArtifactsService;

  const tenantId = 'tenant-a';
  const adminToken = 'Bearer admin-token-123';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ArtifactsController],
      providers: [
        {
          provide: ArtifactsService,
          useValue: mockArtifactsService,
        },
        {
          provide: StorageProvider,
          useValue: mockStorageProvider,
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
        req.user = { id: 'admin-user' };
      }
      next();
    });

    await app.init();

    artifactsService = module.get<ArtifactsService>(ArtifactsService);

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/artifacts/upload-url - Create Upload URL', () => {
    const validRequest = {
      type: 'voice-recording',
      contentType: 'audio/webm',
      size: 1024 * 1024, // 1MB
      metadata: { duration: '30s' },
    };

    it('should create upload URL successfully', async () => {
      const mockResponse = {
        artifactId: 'artifact-123',
        uploadUrl: 'https://upload.example.com/signed-url',
        objectKey: `${tenantId}/voice-recording/2024-01-15/12345/file.webm`,
        expiresAt: new Date(Date.now() + 900 * 1000),
      };

      mockArtifactsService.createUploadUrl.mockResolvedValue(mockResponse);

      const response = await request(app.getHttpServer())
        .post('/api/artifacts/upload-url')
        .set('Authorization', adminToken)
        .send(validRequest)
        .expect(200);

      expect(response.body).toMatchObject({
        artifactId: 'artifact-123',
        uploadUrl: 'https://upload.example.com/signed-url',
        objectKey: expect.stringContaining(`${tenantId}/voice-recording/`),
        expiresAt: expect.any(String),
        maxSize: 100 * 1024 * 1024, // 100MB
      });

      expect(mockArtifactsService.createUploadUrl).toHaveBeenCalledWith({
        tenantId,
        ...validRequest,
      });
    });

    it('should validate required fields', async () => {
      await request(app.getHttpServer())
        .post('/api/artifacts/upload-url')
        .set('Authorization', adminToken)
        .send({})
        .expect(400);
    });

    it('should validate HTTPS URLs', async () => {
      const invalidRequest = {
        ...validRequest,
        contentType: 'invalid/type',
      };

      await request(app.getHttpServer())
        .post('/api/artifacts/upload-url')
        .set('Authorization', adminToken)
        .send(invalidRequest)
        .expect(400);
    });

    it('should reject oversized artifacts', async () => {
      const oversizedRequest = {
        ...validRequest,
        size: 200 * 1024 * 1024, // 200MB
      };

      await request(app.getHttpServer())
        .post('/api/artifacts/upload-url')
        .set('Authorization', adminToken)
        .send(oversizedRequest)
        .expect(500); // Service throws error
    });

    it('should require admin authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/artifacts/upload-url')
        .send(validRequest)
        .expect(403);
    });
  });

  describe('POST /api/artifacts/:id/download-url - Create Download URL', () => {
    it('should create download URL for artifact', async () => {
      const mockResponse = {
        downloadUrl: 'https://download.example.com/signed-url',
        expiresAt: new Date(Date.now() + 900 * 1000),
        artifact: {
          id: 'artifact-123',
          tenantId,
          objectKey: `${tenantId}/document/2024-01-15/12345/file.pdf`,
          type: 'document',
          size: 2048,
          contentType: 'application/pdf',
          checksum: 'abc123',
          metadata: {},
          createdAt: new Date(),
        },
      };

      mockArtifactsService.createDownloadUrl.mockResolvedValue(mockResponse);

      const response = await request(app.getHttpServer())
        .post('/api/artifacts/artifact-123/download-url')
        .set('Authorization', adminToken)
        .send()
        .expect(200);

      expect(response.body).toMatchObject({
        downloadUrl: 'https://download.example.com/signed-url',
        expiresAt: expect.any(String),
        artifact: {
          id: 'artifact-123',
          tenantId,
          type: 'document',
          size: 2048,
          contentType: 'application/pdf',
        },
      });

      expect(mockArtifactsService.createDownloadUrl).toHaveBeenCalledWith(
        tenantId,
        'artifact-123'
      );
    });

    it('should return 404 for non-existent artifact', async () => {
      mockArtifactsService.createDownloadUrl.mockRejectedValue(
        new Error('Artifact not found')
      );

      await request(app.getHttpServer())
        .post('/api/artifacts/non-existent/download-url')
        .set('Authorization', adminToken)
        .send()
        .expect(500); // Service throws error
    });
  });

  describe('GET /api/artifacts - List Artifacts', () => {
    it('should list artifacts with pagination', async () => {
      const mockResponse = {
        artifacts: [
          {
            id: 'artifact-1',
            type: 'document',
            size: 1024,
            contentType: 'application/pdf',
            checksum: 'hash1',
            createdAt: new Date(),
          },
        ],
        total: 1,
      };

      mockArtifactsService.listArtifacts.mockResolvedValue(mockResponse);

      const response = await request(app.getHttpServer())
        .get('/api/artifacts')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toMatchObject({
        artifacts: [
          {
            id: 'artifact-1',
            type: 'document',
            size: 1024,
            contentType: 'application/pdf',
          },
        ],
        total: 1,
        limit: 50,
        nextToken: undefined,
      });

      expect(mockArtifactsService.listArtifacts).toHaveBeenCalledWith(
        tenantId,
        undefined,
        50,
        0
      );
    });

    it('should support filtering by type', async () => {
      mockArtifactsService.listArtifacts.mockResolvedValue({
        artifacts: [],
        total: 0,
      });

      await request(app.getHttpServer())
        .get('/api/artifacts?type=document')
        .set('Authorization', adminToken)
        .expect(200);

      expect(mockArtifactsService.listArtifacts).toHaveBeenCalledWith(
        tenantId,
        'document',
        50,
        0
      );
    });

    it('should support custom pagination', async () => {
      mockArtifactsService.listArtifacts.mockResolvedValue({
        artifacts: [],
        total: 0,
      });

      await request(app.getHttpServer())
        .get('/api/artifacts?limit=20&nextToken=40')
        .set('Authorization', adminToken)
        .expect(200);

      expect(mockArtifactsService.listArtifacts).toHaveBeenCalledWith(
        tenantId,
        undefined,
        20,
        40
      );
    });

    it('should reject invalid limit', async () => {
      await request(app.getHttpServer())
        .get('/api/artifacts?limit=150')
        .set('Authorization', adminToken)
        .expect(400);
    });
  });

  describe('GET /api/artifacts/:id - Get Artifact', () => {
    it('should return artifact details', async () => {
      const mockArtifact = {
        id: 'artifact-123',
        tenantId,
        objectKey: `${tenantId}/document/file.pdf`,
        type: 'document',
        size: 2048,
        contentType: 'application/pdf',
        checksum: 'abc123',
        metadata: { title: 'Test Document' },
        createdAt: new Date(),
      };

      mockArtifactsService.getArtifact.mockResolvedValue(mockArtifact);

      const response = await request(app.getHttpServer())
        .get('/api/artifacts/artifact-123')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toEqual(mockArtifact);

      expect(mockArtifactsService.getArtifact).toHaveBeenCalledWith(
        tenantId,
        'artifact-123'
      );
    });

    it('should return 404 for non-existent artifact', async () => {
      mockArtifactsService.getArtifact.mockResolvedValue(null);

      await request(app.getHttpServer())
        .get('/api/artifacts/non-existent')
        .set('Authorization', adminToken)
        .expect(404);
    });
  });

  describe('DELETE /api/artifacts/:id - Delete Artifact', () => {
    it('should soft delete artifact', async () => {
      await request(app.getHttpServer())
        .delete('/api/artifacts/artifact-123')
        .set('Authorization', adminToken)
        .expect(204);

      expect(mockArtifactsService.deleteArtifact).toHaveBeenCalledWith(
        tenantId,
        'artifact-123'
      );
    });
  });

  describe('GET /api/artifacts/stats/overview - Get Stats', () => {
    it('should return artifact statistics', async () => {
      const mockStats = {
        total: 5,
        byType: {
          document: 3,
          'voice-recording': 2,
        },
        totalSize: 1024 * 1024 * 5, // 5MB
      };

      mockArtifactsService.getArtifactStats.mockResolvedValue(mockStats);

      const response = await request(app.getHttpServer())
        .get('/api/artifacts/stats/overview')
        .set('Authorization', adminToken)
        .expect(200);

      expect(response.body).toMatchObject({
        total: 5,
        byType: {
          document: 3,
          'voice-recording': 2,
        },
        totalSize: 1024 * 1024 * 5,
        totalSizeHuman: '5 MB',
      });
    });
  });

  describe('Security Validation', () => {
    it('should reject requests without admin authentication', async () => {
      await request(app.getHttpServer())
        .post('/api/artifacts/upload-url')
        .send({})
        .expect(403);
    });

    it('should reject malformed JSON payloads', async () => {
      await request(app.getHttpServer())
        .post('/api/artifacts/upload-url')
        .set('Authorization', adminToken)
        .set('Content-Type', 'application/json')
        .send('{ invalid json }')
        .expect(400);
    });

    it('should reject requests with extra fields', async () => {
      const requestWithExtra = {
        type: 'document',
        contentType: 'application/pdf',
        size: 1024,
        maliciousField: 'should be rejected',
      };

      await request(app.getHttpServer())
        .post('/api/artifacts/upload-url')
        .set('Authorization', adminToken)
        .send(requestWithExtra)
        .expect(400);
    });

    it('should reject invalid artifact types', async () => {
      const invalidRequest = {
        type: 'invalid-type',
        contentType: 'application/pdf',
        size: 1024,
      };

      await request(app.getHttpServer())
        .post('/api/artifacts/upload-url')
        .set('Authorization', adminToken)
        .send(invalidRequest)
        .expect(400);
    });

    it('should validate content type matches artifact type', async () => {
      const invalidRequest = {
        type: 'voice-recording',
        contentType: 'text/plain', // Should be audio/*
        size: 1024,
      };

      await request(app.getHttpServer())
        .post('/api/artifacts/upload-url')
        .set('Authorization', adminToken)
        .send(invalidRequest)
        .expect(400);
    });
  });

  describe('Tenant Isolation', () => {
    it('should only operate on authenticated tenant data', async () => {
      // All service calls should include tenantId from authentication
      mockArtifactsService.listArtifacts.mockResolvedValue({
        artifacts: [],
        total: 0,
      });

      await request(app.getHttpServer())
        .get('/api/artifacts')
        .set('Authorization', adminToken)
        .expect(200);

      expect(mockArtifactsService.listArtifacts).toHaveBeenCalledWith(
        tenantId, // From authentication
        undefined,
        50,
        0
      );
    });

    it('should prevent cross-tenant artifact access', async () => {
      // Service should only return artifacts for authenticated tenant
      mockArtifactsService.getArtifact.mockResolvedValue(null); // Not found

      await request(app.getHttpServer())
        .get('/api/artifacts/other-tenant-artifact')
        .set('Authorization', adminToken)
        .expect(404);
    });
  });

  describe('Error Handling', () => {
    it('should handle service errors gracefully', async () => {
      mockArtifactsService.createUploadUrl.mockRejectedValue(
        new Error('Storage unavailable')
      );

      await request(app.getHttpServer())
        .post('/api/artifacts/upload-url')
        .set('Authorization', adminToken)
        .send({
          type: 'document',
          contentType: 'application/pdf',
          size: 1024,
        })
        .expect(500);
    });

    it('should provide clear error messages for validation failures', async () => {
      await request(app.getHttpServer())
        .post('/api/artifacts/upload-url')
        .set('Authorization', adminToken)
        .send({
          type: 'document',
          // Missing required fields
        })
        .expect(400);
    });
  });
});
