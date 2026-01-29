import { Test, TestingModule } from '@nestjs/testing';
import { LeadScorerService } from '../lead-scorer.service';
import { ConfigService } from '../../config/config.service';

describe('LeadScorerService', () => {
  let service: LeadScorerService;
  let configService: jest.Mocked<ConfigService>;

  beforeEach(async () => {
    const mockConfigService = {
      getScoringConfig: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LeadScorerService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<LeadScorerService>(LeadScorerService);
    configService = module.get(ConfigService);
  });

  it('should score paid source lead at 80', async () => {
    // Arrange
    const mockConfig = {
      routingThreshold: 70,
      weights: {
        source: { paid: 80, organic: 30 },
        companySize: { enterprise: 20, mid: 10 },
        industry: { technology: 15 },
      },
    };
    configService.getScoringConfig.mockResolvedValue(mockConfig);

    const event = {
      data: {
        source: 'paid',
        externalId: 'lead-123',
      },
    };

    // Act
    const result = await service.evaluateLead(event as any);

    // Assert
    expect(result.score).toBe(80);
    expect(result.routingThreshold).toBe(70);
    expect(result.shouldRoute).toBe(true);
  });

  it('should score organic source lead at 30', async () => {
    // Arrange
    const mockConfig = {
      routingThreshold: 70,
      weights: {
        source: { paid: 80, organic: 30 },
        companySize: { enterprise: 20, mid: 10 },
        industry: { technology: 15 },
      },
    };
    configService.getScoringConfig.mockResolvedValue(mockConfig);

    const event = {
      data: {
        source: 'organic',
        externalId: 'lead-123',
      },
    };

    // Act
    const result = await service.evaluateLead(event as any);

    // Assert
    expect(result.score).toBe(30);
    expect(result.shouldRoute).toBe(false);
  });

  it('should apply industry bonus for technology leads', async () => {
    // Arrange
    const mockConfig = {
      routingThreshold: 70,
      weights: {
        source: { paid: 80, organic: 30 },
        companySize: { enterprise: 20, mid: 10 },
        industry: { technology: 15 },
      },
    };
    configService.getScoringConfig.mockResolvedValue(mockConfig);

    const event = {
      data: {
        source: 'paid',
        industry: 'technology',
        externalId: 'lead-123',
      },
    };

    // Act
    const result = await service.evaluateLead(event as any);

    // Assert
    expect(result.score).toBe(95); // 80 (paid) + 15 (technology)
    expect(result.shouldRoute).toBe(true);
  });

  it('should apply company size bonus for enterprise leads', async () => {
    // Arrange
    const mockConfig = {
      routingThreshold: 70,
      weights: {
        source: { paid: 80, organic: 30 },
        companySize: { enterprise: 20, mid: 10 },
        industry: { technology: 15 },
      },
    };
    configService.getScoringConfig.mockResolvedValue(mockConfig);

    const event = {
      data: {
        source: 'paid',
        companySize: 5000, // Enterprise
        externalId: 'lead-123',
      },
    };

    // Act
    const result = await service.evaluateLead(event as any);

    // Assert
    expect(result.score).toBe(100); // 80 (paid) + 20 (enterprise) = 100, capped at 100
    expect(result.shouldRoute).toBe(true);
  });
});
