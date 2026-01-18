import { FeatureFlagsService } from '../feature-flags.service';
import { Test, TestingModule } from '@nestjs/testing';
import { ConfigValidator } from '../config.validator';

describe('FeatureFlagsService', () => {
  let service: FeatureFlagsService;
  let config: any;

  beforeEach(async () => {
    // Mock validated config
    config = {
      outbox: { processingEnabled: true },
      webhooks: { processingEnabled: false },
      cleanup: { enabled: true },
      voice: { retryEnabled: false },
      metrics: { enabled: true },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        FeatureFlagsService,
        {
          provide: 'VALIDATED_CONFIG',
          useValue: config,
        },
      ],
    }).compile();

    service = module.get<FeatureFlagsService>(FeatureFlagsService);
  });

  describe('getFlags', () => {
    it('should return current feature flags', () => {
      const flags = service.getFlags();

      expect(flags).toEqual({
        outboxProcessingEnabled: true,
        webhookProcessingEnabled: false,
        cleanupEnabled: true,
        voiceRetryEnabled: false,
        metricsEnabled: true,
      });
    });

    it('should cache flags and refresh after TTL', () => {
      // Mock environment variables
      const originalEnv = process.env;
      process.env.OUTBOX_PROCESSING_ENABLED = 'false';

      try {
        // First call should use cached value
        let flags = service.getFlags();
        expect(flags.outboxProcessingEnabled).toBe(true);

        // Simulate TTL expiration by clearing cache (implementation detail)
        (service as any).lastCheck = 0;

        // Second call should refresh from environment
        flags = service.getFlags();
        expect(flags.outboxProcessingEnabled).toBe(false);
      } finally {
        process.env = originalEnv;
      }
    });
  });

  describe('individual flag checks', () => {
    it('should check outbox processing enabled', () => {
      expect(service.isOutboxProcessingEnabled()).toBe(true);
    });

    it('should check webhook processing enabled', () => {
      expect(service.isWebhookProcessingEnabled()).toBe(false);
    });

    it('should check cleanup enabled', () => {
      expect(service.isCleanupEnabled()).toBe(true);
    });

    it('should check voice retry enabled', () => {
      expect(service.isVoiceRetryEnabled()).toBe(false);
    });

    it('should check metrics enabled', () => {
      expect(service.isMetricsEnabled()).toBe(true);
    });
  });

  describe('logFeatureDisabled', () => {
    it('should log when feature is disabled', () => {
      const loggerSpy = jest
        .spyOn(service['logger'], 'warn')
        .mockImplementation();

      service.logFeatureDisabled('webhookProcessingEnabled', 'test context');

      expect(loggerSpy).toHaveBeenCalledWith(
        'Feature disabled: webhookProcessingEnabled',
        expect.objectContaining({
          feature: 'webhookProcessingEnabled',
          context: 'test context',
          timestamp: expect.any(String),
        })
      );
    });
  });

  describe('environment variable parsing', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('should parse true values', () => {
      process.env.OUTBOX_PROCESSING_ENABLED = 'true';
      (service as any).lastCheck = 0; // Force refresh

      expect(service.isOutboxProcessingEnabled()).toBe(true);
    });

    it('should parse false values', () => {
      process.env.OUTBOX_PROCESSING_ENABLED = 'false';
      (service as any).lastCheck = 0;

      expect(service.isOutboxProcessingEnabled()).toBe(false);
    });

    it('should default to true for missing values', () => {
      delete process.env.OUTBOX_PROCESSING_ENABLED;
      (service as any).lastCheck = 0;

      expect(service.isOutboxProcessingEnabled()).toBe(true);
    });

    it('should default to true for invalid values', () => {
      process.env.OUTBOX_PROCESSING_ENABLED = 'invalid';
      (service as any).lastCheck = 0;

      expect(service.isOutboxProcessingEnabled()).toBe(true);
    });
  });
});
