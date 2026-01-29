import { Test, TestingModule } from '@nestjs/testing';
import { AdvancedScoringService } from '../advanced-scoring.service';
import { ConfigService } from '@nestjs/config';
import { CipherService } from '../../cipher/cipher.service';

describe('AdvancedScoringService', () => {
  let service: AdvancedScoringService;
  let cipherService: CipherService;

  beforeEach(async () => {
    const mockCipherService = {
      isEnabled: jest.fn().mockReturnValue(false),
      checkDecision: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdvancedScoringService,
        {
          provide: ConfigService,
          useValue: {},
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
    it('should calculate enhanced score with positive sentiment', async () => {
      const conversationSignal = {
        sentiment: 0.8, // Positive sentiment
        responseTimeMinutes: 10,
        messageLength: 200,
        topicRelevance: 0.9,
        interactionFrequency: 4,
      };

      const result = await service.calculateEnhancedScore(
        'lead-123',
        'tenant-456',
        75,
        'technology',
        conversationSignal,
        'corr-789'
      );

      expect(result.originalScore).toBe(75);
      expect(result.enhancedScore).toBeGreaterThan(75);
      expect(result.adjustment).toBeGreaterThan(0);
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.factors).toBeDefined();
      expect(result.reasoning).toBeDefined();
      expect(result.reasoning.length).toBeGreaterThan(0);
    });

    it('should apply industry adjustment for technology', async () => {
      const conversationSignal = {
        sentiment: 0.5,
        responseTimeMinutes: 20,
        messageLength: 100,
        topicRelevance: 0.7,
        interactionFrequency: 2,
      };

      const result = await service.calculateEnhancedScore(
        'lead-123',
        'tenant-456',
        70,
        'technology',
        conversationSignal,
        'corr-789'
      );

      // Technology should get a 1.1x multiplier
      expect(result.enhancedScore).toBeGreaterThan(70);
      expect(
        result.reasoning.some(
          r => r.includes('technology') && r.includes('boosted')
        )
      ).toBe(true);
    });

    it('should handle negative sentiment appropriately', async () => {
      const conversationSignal = {
        sentiment: -0.3, // Negative sentiment
        responseTimeMinutes: 45,
        messageLength: 50,
        topicRelevance: 0.4,
        interactionFrequency: 1,
      };

      const result = await service.calculateEnhancedScore(
        'lead-123',
        'tenant-456',
        80,
        'retail',
        conversationSignal,
        'corr-789'
      );

      expect(result.enhancedScore).toBeLessThan(80);
      expect(result.adjustment).toBeLessThan(0);
    });

    it('should cap enhanced score at 100', async () => {
      const conversationSignal = {
        sentiment: 1.0, // Perfect sentiment
        responseTimeMinutes: 1, // Very fast response
        messageLength: 500, // Long message
        topicRelevance: 1.0, // Perfect relevance
        interactionFrequency: 10, // High frequency
      };

      const result = await service.calculateEnhancedScore(
        'lead-123',
        'tenant-456',
        95,
        'technology',
        conversationSignal,
        'corr-789'
      );

      expect(result.enhancedScore).toBeLessThanOrEqual(100);
    });

    it('should handle Cipher monitoring when enabled', async () => {
      // Mock Cipher as enabled
      jest.spyOn(cipherService, 'isEnabled').mockReturnValue(true);
      jest.spyOn(cipherService, 'checkDecision').mockResolvedValue({
        allowed: true,
        decision: 'allow',
        reason: 'All checks passed',
        confidence: 0.9,
        metadata: {
          checkpoint: 'enhanced_scoring',
          policyVersion: '1.0.0',
          processingTimeMs: 15,
        },
      });

      const conversationSignal = {
        sentiment: 0.6,
        responseTimeMinutes: 15,
        messageLength: 150,
        topicRelevance: 0.8,
        interactionFrequency: 3,
      };

      const result = await service.calculateEnhancedScore(
        'lead-123',
        'tenant-456',
        75,
        'technology',
        conversationSignal,
        'corr-789'
      );

      expect(cipherService.checkDecision).toHaveBeenCalled();
      expect(result.cipherDecision).toBeDefined();
      expect(result.cipherDecision.decision).toBe('allow');
    });

    it('should handle missing or edge case data gracefully', async () => {
      const conversationSignal = {
        sentiment: 0,
        responseTimeMinutes: 0,
        messageLength: 0,
        topicRelevance: 0,
        interactionFrequency: 0,
      };

      const result = await service.calculateEnhancedScore(
        'lead-123',
        'tenant-456',
        50,
        'unknown',
        conversationSignal,
        'corr-789'
      );

      expect(result.enhancedScore).toBeDefined();
      expect(result.confidence).toBeDefined();
      expect(result.reasoning).toBeDefined();
      // Should not throw errors with edge case data
    });
  });
});
