import { Test, TestingModule } from '@nestjs/testing';
import { QualificationService } from '../qualification.service';
import { EventBus } from '../../eventing';
import { ConfigService } from '@nestjs/config';

// Mock EventBus
const mockEventBus = {
  publish: jest.fn(),
};

// Mock ConfigService
const mockConfigService = {
  get: jest.fn(),
};

describe('QualificationService', () => {
  let service: QualificationService;
  let eventBus: EventBus;
  let configService: ConfigService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QualificationService,
        { provide: EventBus, useValue: mockEventBus },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<QualificationService>(QualificationService);
    eventBus = module.get<EventBus>(EventBus);
    configService = module.get<ConfigService>(ConfigService);

    // Reset mocks
    jest.clearAllMocks();

    // Setup default config mocks
    mockConfigService.get.mockImplementation(
      (key: string, defaultValue?: any) => {
        switch (key) {
          case 'QUALIFICATION_THRESHOLD':
            return 70;
          case 'QUALIFICATION_REQUIRE_EMAIL':
            return true;
          case 'QUALIFICATION_REQUIRE_PHONE':
            return false;
          case 'QUALIFICATION_COMPANY_SIZE_MIN':
            return 10;
          default:
            return defaultValue;
        }
      }
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('qualifyLead', () => {
    it('should qualify a lead that meets all criteria', async () => {
      const leadData = {
        email: 'test@example.com',
        phone: '+1234567890',
        industry: 'technology',
        companySize: 150,
        score: 85,
      };

      const result = await service.qualifyLead(
        'tenant-123',
        'lead-456',
        leadData,
        'correlation-789'
      );

      expect(result.qualified).toBe(true);
      expect(result.score).toBe(85); // No industry adjustment in this case
      expect(result.threshold).toBe(70);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sales.lead.qualified',
          tenantId: 'tenant-123',
        })
      );
    });

    it('should apply industry priority multiplier', async () => {
      const leadData = {
        email: 'test@example.com',
        phone: '+1234567890',
        industry: 'technology',
        companySize: 150,
        score: 80,
      };

      const result = await service.qualifyLead(
        'tenant-123',
        'lead-456',
        leadData,
        'correlation-789'
      );

      expect(result.qualified).toBe(true);
      expect(result.score).toBe(104); // 80 * 1.3 = 104, capped at 100
      expect(result.reasons).toContain(
        'Industry technology priority applied (1.2x)'
      );
    });

    it('should not qualify a lead below threshold', async () => {
      const leadData = {
        email: 'test@example.com',
        phone: '+1234567890',
        industry: 'retail',
        companySize: 150,
        score: 50,
      };

      const result = await service.qualifyLead(
        'tenant-123',
        'lead-456',
        leadData,
        'correlation-789'
      );

      expect(result.qualified).toBe(false);
      expect(result.score).toBe(50);
      expect(result.threshold).toBe(70);
    });

    it('should fail qualification when email is required but missing', async () => {
      const leadData = {
        phone: '+1234567890',
        industry: 'technology',
        companySize: 150,
        score: 85,
      };

      const result = await service.qualifyLead(
        'tenant-123',
        'lead-456',
        leadData,
        'correlation-789'
      );

      expect(result.qualified).toBe(false);
      expect(result.reasons).toContain('Email required but missing');
    });

    it('should fail qualification when company size is too small', async () => {
      const leadData = {
        email: 'test@example.com',
        phone: '+1234567890',
        industry: 'technology',
        companySize: 5,
        score: 85,
      };

      const result = await service.qualifyLead(
        'tenant-123',
        'lead-456',
        leadData,
        'correlation-789'
      );

      expect(result.qualified).toBe(false);
      expect(result.reasons).toContain('Company size 5 below minimum 10');
    });
  });
});
