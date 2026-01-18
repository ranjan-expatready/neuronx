/**
 * Artifacts Service Tests - WI-021: Object Storage & Artifact Management
 *
 * Tests for artifact metadata management with tenant isolation.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ArtifactsService } from '../artifacts.service';
import { StorageProvider } from '../storage.types';

// Mock storage provider
const mockStorageProvider = {
  generateUploadUrl: jest.fn(),
  generateDownloadUrl: jest.fn(),
  objectExists: jest.fn(),
  deleteObject: jest.fn(),
  getObjectMetadata: jest.fn(),
  listObjects: jest.fn(),
};

// Mock Prisma
const mockPrisma = {
  artifactRecord: {
    create: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    updateMany: jest.fn(),
    deleteMany: jest.fn(),
    count: jest.fn(),
  },
};

describe('ArtifactsService', () => {
  let service: ArtifactsService;

  const tenantId = 'tenant-a';
  const tenantB = 'tenant-b';

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ArtifactsService,
        {
          provide: StorageProvider,
          useValue: mockStorageProvider,
        },
        {
          provide: 'PrismaClient',
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<ArtifactsService>(ArtifactsService);

    // Reset mocks
    jest.clearAllMocks();

    // Setup default mocks
    mockStorageProvider.generateUploadUrl.mockResolvedValue(
      'https://upload.example.com'
    );
    mockStorageProvider.generateDownloadUrl.mockResolvedValue(
      'https://download.example.com'
    );
    mockStorageProvider.objectExists.mockResolvedValue(true);
  });

  afterEach(async () => {
    jest.clearAllMocks();
  });

  describe('createUploadUrl', () => {
    const request = {
      tenantId,
      type: 'voice-recording' as const,
      contentType: 'audio/webm',
      size: 1024 * 1024, // 1MB
      metadata: { duration: '30s' },
    };

    it('should create artifact record and return upload URL', async () => {
      mockPrisma.artifactRecord.create.mockResolvedValue({
        id: 'artifact-123',
        tenantId,
        objectKey: `${tenantId}/voice-recording/2024-01-15/12345/file.webm`,
        type: 'voice-recording',
        size: 1024 * 1024,
        contentType: 'audio/webm',
        checksum: '',
        metadata: { duration: '30s' },
        createdAt: new Date(),
      });

      const result = await service.createUploadUrl(request);

      expect(result).toMatchObject({
        artifactId: 'artifact-123',
        uploadUrl: 'https://upload.example.com',
        objectKey: expect.stringContaining(`${tenantId}/voice-recording/`),
        expiresAt: expect.any(Date),
      });

      expect(mockStorageProvider.generateUploadUrl).toHaveBeenCalledWith(
        tenantId,
        expect.stringContaining(`${tenantId}/voice-recording/`),
        'audio/webm',
        900 // 15 minutes
      );

      expect(mockPrisma.artifactRecord.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          tenantId,
          type: 'voice-recording',
          contentType: 'audio/webm',
          size: 1024 * 1024,
          metadata: { duration: '30s' },
        }),
      });
    });

    it('should reject oversized artifacts', async () => {
      const oversizedRequest = {
        ...request,
        size: 200 * 1024 * 1024, // 200MB
      };

      await expect(service.createUploadUrl(oversizedRequest)).rejects.toThrow(
        'Artifact size exceeds maximum allowed: 100MB'
      );
    });
  });

  describe('createDownloadUrl', () => {
    it('should generate download URL for existing artifact', async () => {
      const mockArtifact = {
        id: 'artifact-123',
        tenantId,
        objectKey: `${tenantId}/document/2024-01-15/12345/file.pdf`,
        type: 'document',
        size: 2048,
        contentType: 'application/pdf',
        checksum: 'abc123',
        metadata: {},
        createdAt: new Date(),
      };

      mockPrisma.artifactRecord.findFirst.mockResolvedValue(mockArtifact);

      const result = await service.createDownloadUrl(tenantId, 'artifact-123');

      expect(result).toMatchObject({
        downloadUrl: 'https://download.example.com',
        expiresAt: expect.any(Date),
        artifact: mockArtifact,
      });

      expect(mockStorageProvider.generateDownloadUrl).toHaveBeenCalledWith(
        tenantId,
        mockArtifact.objectKey,
        900 // 15 minutes
      );
    });

    it('should reject non-existent artifact', async () => {
      mockPrisma.artifactRecord.findFirst.mockResolvedValue(null);

      await expect(
        service.createDownloadUrl(tenantId, 'non-existent')
      ).rejects.toThrow('Artifact not found: non-existent');
    });

    it('should reject cross-tenant access', async () => {
      const mockArtifact = {
        id: 'artifact-123',
        tenantId: tenantB, // Different tenant
        objectKey: `${tenantB}/document/file.pdf`,
        type: 'document',
        size: 2048,
        contentType: 'application/pdf',
        checksum: 'abc123',
        metadata: {},
        createdAt: new Date(),
      };

      mockPrisma.artifactRecord.findFirst.mockResolvedValue(mockArtifact);

      await expect(
        service.createDownloadUrl(tenantId, 'artifact-123')
      ).rejects.toThrow('Artifact not found: artifact-123');
    });

    it('should reject artifacts where storage object does not exist', async () => {
      const mockArtifact = {
        id: 'artifact-123',
        tenantId,
        objectKey: `${tenantId}/document/file.pdf`,
        type: 'document',
        size: 2048,
        contentType: 'application/pdf',
        checksum: 'abc123',
        metadata: {},
        createdAt: new Date(),
      };

      mockPrisma.artifactRecord.findFirst.mockResolvedValue(mockArtifact);
      mockStorageProvider.objectExists.mockResolvedValue(false);

      await expect(
        service.createDownloadUrl(tenantId, 'artifact-123')
      ).rejects.toThrow('Artifact storage object not found: artifact-123');
    });
  });

  describe('listArtifacts', () => {
    it('should list artifacts for tenant with pagination', async () => {
      const mockArtifacts = [
        {
          id: 'artifact-1',
          tenantId,
          type: 'document',
          size: 1024,
          contentType: 'application/pdf',
          checksum: 'hash1',
          createdAt: new Date(),
        },
        {
          id: 'artifact-2',
          tenantId,
          type: 'voice-recording',
          size: 2048,
          contentType: 'audio/webm',
          checksum: 'hash2',
          createdAt: new Date(),
        },
      ];

      mockPrisma.artifactRecord.findMany.mockResolvedValue(mockArtifacts);
      mockPrisma.artifactRecord.count.mockResolvedValue(2);

      const result = await service.listArtifacts(tenantId, undefined, 10, 0);

      expect(result).toMatchObject({
        artifacts: mockArtifacts,
        total: 2,
      });

      expect(mockPrisma.artifactRecord.findMany).toHaveBeenCalledWith({
        where: {
          tenantId,
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 0,
      });
    });

    it('should filter by artifact type', async () => {
      mockPrisma.artifactRecord.findMany.mockResolvedValue([]);
      mockPrisma.artifactRecord.count.mockResolvedValue(0);

      await service.listArtifacts(tenantId, 'document', 50, 0);

      expect(mockPrisma.artifactRecord.findMany).toHaveBeenCalledWith({
        where: {
          tenantId,
          deletedAt: null,
          type: 'document',
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });
  });

  describe('deleteArtifact', () => {
    it('should soft delete artifact', async () => {
      const mockArtifact = {
        id: 'artifact-123',
        tenantId,
        objectKey: `${tenantId}/document/file.pdf`,
      };

      mockPrisma.artifactRecord.findFirst.mockResolvedValue(mockArtifact);

      await service.deleteArtifact(tenantId, 'artifact-123');

      expect(mockPrisma.artifactRecord.updateMany).toHaveBeenCalledWith({
        where: {
          id: 'artifact-123',
          tenantId,
          deletedAt: null,
        },
        data: { deletedAt: expect.any(Date) },
      });
    });

    it('should reject deleting non-existent artifact', async () => {
      mockPrisma.artifactRecord.findFirst.mockResolvedValue(null);

      await expect(
        service.deleteArtifact(tenantId, 'non-existent')
      ).rejects.toThrow('Artifact not found: non-existent');
    });
  });

  describe('Tenant Isolation', () => {
    it('should only return artifacts for requested tenant', async () => {
      mockPrisma.artifactRecord.findMany.mockResolvedValue([]);
      mockPrisma.artifactRecord.count.mockResolvedValue(0);

      await service.listArtifacts(tenantId, undefined, 50, 0);

      expect(mockPrisma.artifactRecord.findMany).toHaveBeenCalledWith({
        where: {
          tenantId, // Only this tenant
          deletedAt: null,
        },
        orderBy: { createdAt: 'desc' },
        take: 50,
        skip: 0,
      });
    });

    it('should prevent cross-tenant artifact access', async () => {
      // Artifact belongs to tenantB
      mockPrisma.artifactRecord.findFirst.mockResolvedValue({
        id: 'artifact-123',
        tenantId: tenantB,
        objectKey: `${tenantB}/document/file.pdf`,
      });

      // Request from tenantA should not find it
      await expect(
        service.getArtifact(tenantId, 'artifact-123')
      ).resolves.toBeNull();
    });
  });

  describe('cleanupExpiredArtifacts', () => {
    it('should clean up expired artifacts', async () => {
      const expiredArtifacts = [
        {
          id: 'expired-1',
          tenantId,
          objectKey: `${tenantId}/temp/file.pdf`,
        },
        {
          id: 'expired-2',
          tenantId,
          objectKey: `${tenantId}/cache/file.txt`,
        },
      ];

      mockPrisma.artifactRecord.findMany.mockResolvedValue(expiredArtifacts);
      mockPrisma.artifactRecord.deleteMany.mockResolvedValue({ count: 2 });

      const deletedCount = await service.cleanupExpiredArtifacts();

      expect(deletedCount).toBe(2);
      expect(mockPrisma.artifactRecord.deleteMany).toHaveBeenCalledWith({
        where: {
          id: { in: ['expired-1', 'expired-2'] },
        },
      });

      // Should attempt to delete from storage
      expect(mockStorageProvider.deleteObject).toHaveBeenCalledTimes(2);
    });
  });

  describe('getArtifactStats', () => {
    it('should return artifact statistics', async () => {
      const mockArtifacts = [
        { type: 'document', size: 1024 },
        { type: 'document', size: 2048 },
        { type: 'voice-recording', size: 1024000 },
      ];

      mockPrisma.artifactRecord.findMany.mockResolvedValue(mockArtifacts);

      const stats = await service.getArtifactStats(tenantId);

      expect(stats).toMatchObject({
        total: 3,
        byType: {
          document: 2,
          'voice-recording': 1,
        },
        totalSize: 1024000 + 2048 + 1024,
      });
    });
  });
});
