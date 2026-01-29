/**
 * Health Endpoints Tests - WI-024: Observability & Metrics Foundation
 *
 * Tests for health check endpoints and readiness probes.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { HealthController } from '../health.controller';
import { ReadinessService } from '../readiness.service';
import { SecretService } from '../../secrets/secret.service';
import { StorageProvider } from '../../storage/storage.types';

// Mock dependencies
const mockReadinessService = {
  checkReadiness: jest.fn(),
};

const mockSecretService = {
  putSecret: jest.fn(),
  getSecret: jest.fn(),
  rotateSecret: jest.fn(),
};

const mockStorageProvider = {
  deleteObject: jest.fn(),
};

describe('Health Endpoints (WI-024)', () => {
  let app: INestApplication;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: ReadinessService,
          useValue: mockReadinessService,
        },
        {
          provide: SecretService,
          useValue: mockSecretService,
        },
        {
          provide: 'STORAGE_PROVIDER',
          useValue: mockStorageProvider,
        },
      ],
    }).compile();

    app = module.createNestApplication();
    await app.init();

    // Reset mocks
    jest.clearAllMocks();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /health/live - Liveness Probe', () => {
    it('should always return 200 OK', async () => {
      const response = await request(app.getHttpServer())
        .get('/health/live')
        .expect(200);

      expect(response.body).toMatchObject({
        status: 'ok',
        timestamp: expect.any(String),
      });

      // Should not call readiness service
      expect(mockReadinessService.checkReadiness).not.toHaveBeenCalled();
    });

    it('should include timestamp', async () => {
      const before = new Date().toISOString();

      const response = await request(app.getHttpServer())
        .get('/health/live')
        .expect(200);

      const after = new Date().toISOString();

      expect(response.body.timestamp).toBeDefined();
      expect(response.body.timestamp).toBeGreaterThanOrEqual(before);
      expect(response.body.timestamp).toBeLessThanOrEqual(after);
    });
  });

  describe('GET /health/ready - Readiness Probe', () => {
    it('should return readiness status from service', async () => {
      const mockReadinessResult = {
        status: 'ok' as const,
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        checks: {
          database: { status: 'ok' as const },
          secrets: { status: 'ok' as const },
          storage: { status: 'ok' as const },
        },
      };

      mockReadinessService.checkReadiness.mockResolvedValue(
        mockReadinessResult
      );

      const response = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(200);

      expect(response.body).toEqual(mockReadinessResult);
      expect(mockReadinessService.checkReadiness).toHaveBeenCalled();
    });

    it('should return error status when dependencies fail', async () => {
      const mockReadinessResult = {
        status: 'error' as const,
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: 'error' as const, message: 'Connection failed' },
          secrets: { status: 'ok' as const },
          storage: { status: 'error' as const, message: 'Bucket not found' },
        },
      };

      mockReadinessService.checkReadiness.mockResolvedValue(
        mockReadinessResult
      );

      const response = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(200); // HTTP 200 even with error status

      expect(response.body.status).toBe('error');
      expect(response.body.checks.database.status).toBe('error');
      expect(response.body.checks.secrets.status).toBe('ok');
      expect(response.body.checks.storage.status).toBe('error');
    });

    it('should handle service errors gracefully', async () => {
      mockReadinessService.checkReadiness.mockRejectedValue(
        new Error('Service unavailable')
      );

      const response = await request(app.getHttpServer())
        .get('/health/ready')
        .expect(500); // Should return 500 when service fails

      expect(response.body).toMatchObject({
        status: 'error',
        timestamp: expect.any(String),
        checks: {
          database: { status: 'error', message: 'Readiness check failed' },
          secrets: { status: 'error', message: 'Readiness check failed' },
          storage: { status: 'error', message: 'Readiness check failed' },
        },
      });
    });
  });

  describe('GET /health - Combined Health Check', () => {
    it('should delegate to readiness check', async () => {
      const mockReadinessResult = {
        status: 'ok' as const,
        timestamp: new Date().toISOString(),
        checks: {
          database: { status: 'ok' as const },
          secrets: { status: 'ok' as const },
          storage: { status: 'ok' as const },
        },
      };

      mockReadinessService.checkReadiness.mockResolvedValue(
        mockReadinessResult
      );

      const response = await request(app.getHttpServer())
        .get('/health')
        .expect(200);

      expect(response.body).toEqual(mockReadinessResult);
      expect(mockReadinessService.checkReadiness).toHaveBeenCalled();
    });
  });
});
