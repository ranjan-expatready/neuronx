import { ReadinessGuardService } from '../readiness-guard.service';
import { Test, TestingModule } from '@nestjs/testing';
import { ReadinessService } from '../../observability/readiness.service';

describe('ReadinessGuardService', () => {
  let service: ReadinessGuardService;
  let readinessService: jest.Mocked<ReadinessService>;

  beforeEach(async () => {
    const readinessServiceMock = {
      checkDatabase: jest.fn(),
      checkSecretsProvider: jest.fn(),
      checkStorageProvider: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReadinessGuardService,
        {
          provide: ReadinessService,
          useValue: readinessServiceMock,
        },
      ],
    }).compile();

    service = module.get<ReadinessGuardService>(ReadinessGuardService);
    readinessService = module.get(ReadinessService);
  });

  describe('shouldRunBackgroundJob', () => {
    it('should allow job when all checks pass', async () => {
      readinessService.checkDatabase.mockResolvedValue({ status: 'ok' });
      readinessService.checkSecretsProvider.mockResolvedValue({ status: 'ok' });
      readinessService.checkStorageProvider.mockResolvedValue({ status: 'ok' });

      const result = await service.shouldRunBackgroundJob('test-job');

      expect(result).toBe(true);
    });

    it('should block job when database is not ready', async () => {
      readinessService.checkDatabase.mockResolvedValue({
        status: 'error',
        message: 'Connection failed',
      });

      const result = await service.shouldRunBackgroundJob('test-job');

      expect(result).toBe(false);
    });

    it('should block storage-dependent jobs when storage is not ready', async () => {
      readinessService.checkDatabase.mockResolvedValue({ status: 'ok' });
      readinessService.checkSecretsProvider.mockResolvedValue({ status: 'ok' });
      readinessService.checkStorageProvider.mockResolvedValue({
        status: 'error',
        message: 'Storage unavailable',
      });

      const result = await service.shouldRunBackgroundJob('cleanup-runner');

      expect(result).toBe(false);
    });

    it('should allow non-storage jobs when storage is not ready', async () => {
      readinessService.checkDatabase.mockResolvedValue({ status: 'ok' });
      readinessService.checkSecretsProvider.mockResolvedValue({ status: 'ok' });
      readinessService.checkStorageProvider.mockResolvedValue({
        status: 'error',
        message: 'Storage unavailable',
      });

      const result = await service.shouldRunBackgroundJob('outbox-dispatcher');

      expect(result).toBe(true);
    });

    it('should block secrets-dependent jobs when secrets are not ready', async () => {
      readinessService.checkDatabase.mockResolvedValue({ status: 'ok' });
      readinessService.checkSecretsProvider.mockResolvedValue({
        status: 'error',
        message: 'Secrets unavailable',
      });

      const result = await service.shouldRunBackgroundJob('webhook-dispatcher');

      expect(result).toBe(false);
    });

    it('should fail open when readiness check throws', async () => {
      readinessService.checkDatabase.mockRejectedValue(
        new Error('Unexpected error')
      );

      const result = await service.shouldRunBackgroundJob('test-job');

      expect(result).toBe(true); // Fail-open behavior
    });
  });

  describe('job dependency detection', () => {
    it('should identify storage-dependent jobs', () => {
      expect((service as any).jobNeedsStorage('cleanup-runner')).toBe(true);
      expect((service as any).jobNeedsStorage('webhook-dispatcher')).toBe(
        false
      );
      expect((service as any).jobNeedsStorage('unknown-job')).toBe(false);
    });

    it('should identify secrets-dependent jobs', () => {
      expect((service as any).jobNeedsSecrets('webhook-dispatcher')).toBe(true);
      expect((service as any).jobNeedsSecrets('voice-runner')).toBe(true);
      expect((service as any).jobNeedsSecrets('outbox-dispatcher')).toBe(false);
    });
  });
});
