import { Test, TestingModule } from '@nestjs/testing';
import { CipherService } from '../cipher.service';
import { ConfigService } from '@nestjs/config';

// Mock fs module
jest.mock('fs', () => ({
  readFileSync: jest.fn(),
}));

// Mock path module
jest.mock('path', () => ({
  join: jest.fn(),
}));

import * as fs from 'fs';
import * as path from 'path';

describe('CipherService', () => {
  let service: CipherService;
  let configService: ConfigService;

  const mockPolicy = {
    version: '1.0.0',
    policy: {
      enabled: true,
      mode: 'monitor',
      checkpoints: {
        lead_qualification: {
          enabled: true,
          decisionRules: ['scoreAnomalyDetection', 'industryRiskAssessment'],
        },
      },
      decisionRules: {
        scoreAnomalyDetection: { scoreDeviationThreshold: 2.0 },
        industryRiskAssessment: { highRiskIndustries: ['cryptocurrency'] },
      },
    },
  };

  beforeEach(async () => {
    // Mock file system
    (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(mockPolicy));
    (path.join as jest.Mock).mockReturnValue('/mock/path/cipher_policy.json');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CipherService,
        {
          provide: ConfigService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<CipherService>(CipherService);
    configService = module.get<ConfigService>(ConfigService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkDecision', () => {
    it('should allow decision when Cipher is disabled', async () => {
      // Mock disabled policy
      const disabledPolicy = {
        ...mockPolicy,
        policy: { ...mockPolicy.policy, enabled: false },
      };
      (fs.readFileSync as jest.Mock).mockReturnValue(
        JSON.stringify(disabledPolicy)
      );

      service.reloadPolicy();

      const context = {
        tenantId: 'tenant-123',
        correlationId: 'corr-456',
        operation: 'lead_qualification',
        data: { score: 85 },
      };

      const result = await service.checkDecision(context);

      expect(result.allowed).toBe(true);
      expect(result.decision).toBe('allow');
      expect(result.reason).toBe(
        'Cipher disabled or checkpoint not configured'
      );
    });

    it('should allow normal lead qualification', async () => {
      const context = {
        tenantId: 'tenant-123',
        correlationId: 'corr-456',
        operation: 'lead_qualification',
        data: {
          leadId: 'lead-789',
          score: 85,
          industry: 'technology',
          companySize: 150,
        },
      };

      const result = await service.checkDecision(context);

      expect(result.allowed).toBe(true);
      expect(result.decision).toBe('allow');
      expect(result.reason).toBe('All checks passed');
    });

    it('should flag score anomaly', async () => {
      const context = {
        tenantId: 'tenant-123',
        correlationId: 'corr-456',
        operation: 'lead_qualification',
        data: {
          leadId: 'lead-789',
          score: 98, // High anomaly
          industry: 'technology',
          companySize: 150,
        },
      };

      const result = await service.checkDecision(context);

      expect(result.allowed).toBe(false);
      expect(result.decision).toBe('suggest');
      expect(result.reason).toBe('Score anomaly detected');
      expect(result.suggestions).toBeDefined();
    });

    it('should deny high-risk industry', async () => {
      const context = {
        tenantId: 'tenant-123',
        correlationId: 'corr-456',
        operation: 'lead_qualification',
        data: {
          leadId: 'lead-789',
          score: 85,
          industry: 'cryptocurrency', // High risk
          companySize: 150,
        },
      };

      const result = await service.checkDecision(context);

      expect(result.allowed).toBe(false);
      expect(result.decision).toBe('deny');
      expect(result.reason).toBe('Industry requires additional review');
    });

    it('should flag unusual company size', async () => {
      const context = {
        tenantId: 'tenant-123',
        correlationId: 'corr-456',
        operation: 'lead_qualification',
        data: {
          leadId: 'lead-789',
          score: 85,
          industry: 'technology',
          companySize: 150000, // Unusual size
        },
      };

      const result = await service.checkDecision(context);

      expect(result.allowed).toBe(false);
      expect(result.decision).toBe('suggest');
      expect(result.reason).toBe('Company size appears unusual');
    });

    it('should handle errors gracefully', async () => {
      // Mock file read failure
      (fs.readFileSync as jest.Mock).mockImplementation(() => {
        throw new Error('File not found');
      });

      service.reloadPolicy();

      const context = {
        tenantId: 'tenant-123',
        correlationId: 'corr-456',
        operation: 'lead_qualification',
        data: { score: 85 },
      };

      const result = await service.checkDecision(context);

      expect(result.allowed).toBe(true);
      expect(result.decision).toBe('allow');
      expect(result.reason).toContain('Cipher evaluation failed');
    });
  });

  describe('service methods', () => {
    it('should return correct enabled status', () => {
      expect(service.isEnabled()).toBe(true);
    });

    it('should return correct status', () => {
      const status = service.getStatus();
      expect(status.enabled).toBe(true);
      expect(status.mode).toBe('monitor');
      expect(status.version).toBe('1.0.0');
    });

    it('should reload policy', () => {
      const newPolicy = { ...mockPolicy, version: '1.1.0' };
      (fs.readFileSync as jest.Mock).mockReturnValue(JSON.stringify(newPolicy));

      service.reloadPolicy();

      const status = service.getStatus();
      expect(status.version).toBe('1.1.0');
    });
  });
});
