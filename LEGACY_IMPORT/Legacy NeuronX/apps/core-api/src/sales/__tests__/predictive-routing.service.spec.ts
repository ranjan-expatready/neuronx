import { Test, TestingModule } from '@nestjs/testing';
import { PredictiveRoutingService } from '../predictive-routing.service';
import { ConfigService } from '@nestjs/config';
import { CipherService } from '../../cipher/cipher.service';
import { vi } from 'vitest';

describe('PredictiveRoutingService', () => {
  let service: PredictiveRoutingService;
  let cipherService: CipherService;

  beforeEach(async () => {
    const mockCipherService = {
      isEnabled: vi.fn().mockReturnValue(false),
      checkDecision: vi.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PredictiveRoutingService,
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

    service = module.get<PredictiveRoutingService>(PredictiveRoutingService);
    cipherService = module.get<CipherService>(CipherService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('predictOptimalRouting', () => {
    it('should recommend best team for high-score technology lead', async () => {
      const leadProfile = {
        leadId: 'lead-123',
        score: 85,
        industry: 'technology',
        region: 'north-america',
        urgency: 'high' as const,
      };

      const result = await service.predictOptimalRouting(
        'tenant-456',
        leadProfile,
        'corr-789'
      );

      expect(result.recommendedTeam).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.reasoning).toBeDefined();
      expect(result.reasoning.length).toBeGreaterThan(0);
      expect(result.alternatives).toBeDefined();
      expect(result.factors).toBeDefined();
    });

    it('should prefer teams with industry expertise', async () => {
      const leadProfile = {
        leadId: 'lead-123',
        score: 75,
        industry: 'healthcare',
        region: 'north-america',
        urgency: 'medium' as const,
      };

      const result = await service.predictOptimalRouting(
        'tenant-456',
        leadProfile,
        'corr-789'
      );

      // Should recommend enterprise team which has healthcare expertise
      expect(result.recommendedTeam.industryExpertise).toContain('healthcare');
      expect(result.reasoning.some(r => r.includes('industry expertise'))).toBe(
        true
      );
    });

    it('should consider capacity constraints', async () => {
      // Test would need mock team data with capacity constraints
      // This is a placeholder for the concept
      const leadProfile = {
        leadId: 'lead-123',
        score: 70,
        industry: 'technology',
        region: 'north-america',
        urgency: 'medium' as const,
      };

      const result = await service.predictOptimalRouting(
        'tenant-456',
        leadProfile,
        'corr-789'
      );

      expect(result.recommendedTeam).toBeDefined();
      expect(result.recommendedTeam.currentLoad).toBeLessThan(
        result.recommendedTeam.capacityLimit
      );
    });

    it('should provide alternatives with reasoning', async () => {
      const leadProfile = {
        leadId: 'lead-123',
        score: 80,
        industry: 'technology',
        region: 'north-america',
        urgency: 'high' as const,
      };

      const result = await service.predictOptimalRouting(
        'tenant-456',
        leadProfile,
        'corr-789'
      );

      expect(result.alternatives.length).toBeGreaterThan(0);
      result.alternatives.forEach(alt => {
        expect(alt.team).toBeDefined();
        expect(alt.score).toBeDefined();
        expect(alt.reason).toBeDefined();
      });
    });

    it('should calculate confidence based on score distribution', async () => {
      const leadProfile = {
        leadId: 'lead-123',
        score: 90,
        industry: 'technology',
        region: 'north-america',
        urgency: 'high' as const,
      };

      const result = await service.predictOptimalRouting(
        'tenant-456',
        leadProfile,
        'corr-789'
      );

      expect(result.confidence).toBeDefined();
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });

    it('should handle Cipher monitoring when enabled', async () => {
      // Mock Cipher as enabled
      vi.spyOn(cipherService, 'isEnabled').mockReturnValue(true);
      vi.spyOn(cipherService, 'checkDecision').mockResolvedValue({
        allowed: true,
        decision: 'allow',
        reason: 'Routing decision approved',
        confidence: 0.85,
        metadata: {
          checkpoint: 'predictive_routing',
          policyVersion: '1.0.0',
          processingTimeMs: 20,
        },
      });

      const leadProfile = {
        leadId: 'lead-123',
        score: 75,
        industry: 'technology',
        region: 'north-america',
        urgency: 'medium' as const,
      };

      const result = await service.predictOptimalRouting(
        'tenant-456',
        leadProfile,
        'corr-789'
      );

      expect(cipherService.checkDecision).toHaveBeenCalled();
      expect(result.cipherDecision).toBeDefined();
      expect(result.cipherDecision.decision).toBe('allow');
    });

    it('should reject leads when no eligible teams are available', async () => {
      const leadProfile = {
        leadId: 'lead-123',
        score: 70,
        industry: 'unknown',
        region: 'unknown-region',
        urgency: 'low' as const,
      };

      await expect(
        service.predictOptimalRouting('tenant-456', leadProfile, 'corr-789')
      ).rejects.toThrow('No eligible teams found');
    });

    it('should build comprehensive reasoning', async () => {
      const leadProfile = {
        leadId: 'lead-123',
        score: 85,
        industry: 'technology',
        region: 'north-america',
        urgency: 'high' as const,
      };

      const result = await service.predictOptimalRouting(
        'tenant-456',
        leadProfile,
        'corr-789'
      );

      expect(result.reasoning.length).toBeGreaterThan(2); // At least team name, expertise, performance
      expect(result.reasoning.some(r => r.includes('expertise'))).toBe(true);
      expect(
        result.reasoning.some(
          r => r.includes('performance') || r.includes('success')
        )
      ).toBe(true);
    });
  });
});
