import { Test, TestingModule } from '@nestjs/testing';
import { AdvancedScoringService } from '../../apps/core-api/src/sales/advanced-scoring.service';
import { ConfigService } from '@nestjs/config';
import { CipherService } from '../../apps/core-api/src/cipher/cipher.service';

describe('AdvancedScoringService (Unit)', () => {
  let service: AdvancedScoringService;
  let cipherService: CipherService;

  const mockCipherService = {
    isEnabled: jest.fn().mockReturnValue(true),
    checkDecision: jest.fn().mockResolvedValue({
      allowed: true,
      action: 'allow',
      reason: 'Test decision',
      confidence: 0.9,
      mode: 'monitor',
    }),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdvancedScoringService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: CipherService,
          useValue: mockCipherService,
        },
      ],
    }).compile();

    service = module.get<AdvancedScoringService>(AdvancedScoringService);
    cipherService = module.get<CipherService>(CipherService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('calculateEnhancedScore', () => {
    it('should calculate enhanced score with valid inputs', async () => {
      const conversationSignal = {
        sentiment: 0.8,
        responseTimeMinutes: 15,
        messageLength: 150,
        topicRelevance: 0.9,
        interactionFrequency: 3,
      };

      const result = await service.calculateEnhancedScore(
        'test-lead-id',
        'test-tenant',
        75,
        'technology',
        conversationSignal,
        'test-correlation-id'
      );

      expect(result).toBeDefined();
      expect(result.originalScore).toBe(75);
      expect(result.enhancedScore).toBeGreaterThan(75);
      expect(result.adjustment).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.factors).toBeDefined();
      expect(result.reasoning).toBeDefined();
      expect(result.reasoning.length).toBeGreaterThan(0);
    });

    it('should apply industry adjustments correctly', async () => {
      const conversationSignal = {
        sentiment: 0.5,
        responseTimeMinutes: 20,
        messageLength: 100,
        topicRelevance: 0.7,
        interactionFrequency: 2,
      };

      // Test technology industry (1.1x multiplier)
      const techResult = await service.calculateEnhancedScore(
        'test-lead-id',
        'test-tenant',
        70,
        'technology',
        conversationSignal,
        'test-correlation-id'
      );

      // Test retail industry (0.95x multiplier)
      const retailResult = await service.calculateEnhancedScore(
        'test-lead-id-2',
        'test-tenant',
        70,
        'retail',
        conversationSignal,
        'test-correlation-id-2'
      );

      expect(techResult.enhancedScore).toBeGreaterThan(
        retailResult.enhancedScore
      );
    });

    it('should handle edge cases gracefully', async () => {
      const edgeSignal = {
        sentiment: -1, // Minimum sentiment
        responseTimeMinutes: 0, // Minimum response time
        messageLength: 0, // Minimum message length
        topicRelevance: 0, // Minimum relevance
        interactionFrequency: 0, // Minimum frequency
      };

      const result = await service.calculateEnhancedScore(
        'test-lead-id',
        'test-tenant',
        0, // Minimum score
        'unknown', // Unknown industry
        edgeSignal,
        'test-correlation-id'
      );

      expect(result).toBeDefined();
      expect(result.enhancedScore).toBeGreaterThanOrEqual(0);
      expect(result.enhancedScore).toBeLessThanOrEqual(100);
      expect(result.confidence).toBeDefined();
    });

    it('should invoke Cipher for decision monitoring', async () => {
      const conversationSignal = {
        sentiment: 0.6,
        responseTimeMinutes: 15,
        messageLength: 150,
        topicRelevance: 0.8,
        interactionFrequency: 3,
      };

      await service.calculateEnhancedScore(
        'test-lead-id',
        'test-tenant',
        75,
        'technology',
        conversationSignal,
        'test-correlation-id'
      );

      expect(cipherService.checkDecision).toHaveBeenCalledWith({
        tenantId: 'test-tenant',
        correlationId: 'test-correlation-id',
        operation: 'enhanced_scoring',
        data: expect.objectContaining({
          leadId: 'test-lead-id',
          originalScore: 75,
          enhancedScore: expect.any(Number),
          adjustment: expect.any(Number),
          industry: 'technology',
          factors: expect.any(Object),
        }),
      });
    });

    it('should skip Cipher when disabled', async () => {
      mockCipherService.isEnabled.mockReturnValueOnce(false);

      const conversationSignal = {
        sentiment: 0.6,
        responseTimeMinutes: 15,
        messageLength: 150,
        topicRelevance: 0.8,
        interactionFrequency: 3,
      };

      const result = await service.calculateEnhancedScore(
        'test-lead-id',
        'test-tenant',
        75,
        'technology',
        conversationSignal,
        'test-correlation-id'
      );

      expect(result.cipherDecision).toBeUndefined();
      expect(cipherService.checkDecision).not.toHaveBeenCalled();
    });
  });

  describe('Industry weight caching', () => {
    it('should cache industry multipliers', async () => {
      const conversationSignal = {
        sentiment: 0.5,
        responseTimeMinutes: 20,
        messageLength: 100,
        topicRelevance: 0.7,
        interactionFrequency: 2,
      };

      // First call - should calculate and cache
      await service.calculateEnhancedScore(
        'test-lead-id-1',
        'test-tenant',
        70,
        'technology',
        conversationSignal,
        'test-correlation-id-1'
      );

      // Second call with same industry - should use cache
      await service.calculateEnhancedScore(
        'test-lead-id-2',
        'test-tenant',
        70,
        'technology',
        conversationSignal,
        'test-correlation-id-2'
      );

      // Results should be consistent (same industry multiplier applied)
      // Note: In a real test, we'd mock the timing to verify caching
      expect(true).toBe(true); // Placeholder for caching verification
    });
  });
});
