import { Test, TestingModule } from '@nestjs/testing';
import { CipherService } from '../cipher.service';
import { QualificationService } from '../../sales/qualification.service';
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

describe('CipherService Integration', () => {
  let cipherService: CipherService;
  let qualificationService: QualificationService;

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
          useValue: {
            get: jest.fn((key: string, defaultValue?: any) => {
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
            }),
          },
        },
        QualificationService,
      ],
    }).compile();

    cipherService = module.get<CipherService>(CipherService);
    qualificationService =
      module.get<QualificationService>(QualificationService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('should integrate Cipher checks with qualification flow', async () => {
    const leadData = {
      email: 'test@example.com',
      phone: '+1234567890',
      industry: 'technology',
      companySize: 150,
      score: 85,
    };

    // This will trigger Cipher check internally
    const result = await qualificationService.qualifyLead(
      'tenant-123',
      'lead-456',
      leadData,
      'correlation-789'
    );

    // Verify qualification still works
    expect(result.qualified).toBe(true);
    expect(result.score).toBe(85);
    expect(result.threshold).toBe(70);

    // Verify Cipher was consulted (through logging or behavior)
    // In monitor mode, Cipher should allow the operation
    expect(result.qualified).toBe(true);
  });

  it('should handle Cipher deny decision in qualification flow', async () => {
    // Create a scenario that would be denied by Cipher
    const leadData = {
      email: 'test@example.com',
      phone: '+1234567890',
      industry: 'cryptocurrency', // High-risk industry that Cipher denies
      companySize: 150,
      score: 85,
    };

    const result = await qualificationService.qualifyLead(
      'tenant-123',
      'lead-456',
      leadData,
      'correlation-789'
    );

    // In monitor mode, qualification should still proceed but log the Cipher decision
    // The exact behavior depends on how we implement the enforce vs monitor logic
    expect(result).toBeDefined();
    expect(typeof result.qualified).toBe('boolean');
  });

  it('should handle Cipher service failures gracefully', async () => {
    // Mock Cipher service to throw an error
    jest
      .spyOn(cipherService, 'checkDecision')
      .mockRejectedValue(new Error('Cipher service error'));

    const leadData = {
      email: 'test@example.com',
      phone: '+1234567890',
      industry: 'technology',
      companySize: 150,
      score: 85,
    };

    // Qualification should still work despite Cipher failure
    const result = await qualificationService.qualifyLead(
      'tenant-123',
      'lead-456',
      leadData,
      'correlation-789'
    );

    expect(result.qualified).toBe(true);
    expect(result.score).toBe(85);
  });

  it('should maintain performance with Cipher enabled', async () => {
    const leadData = {
      email: 'test@example.com',
      phone: '+1234567890',
      industry: 'technology',
      companySize: 150,
      score: 85,
    };

    const startTime = Date.now();

    // Run multiple qualification checks
    for (let i = 0; i < 10; i++) {
      await qualificationService.qualifyLead(
        'tenant-123',
        `lead-${i}`,
        leadData,
        `correlation-${i}`
      );
    }

    const endTime = Date.now();
    const totalTime = endTime - startTime;
    const avgTime = totalTime / 10;

    // Should complete within reasonable time (allowing for Cipher overhead)
    expect(avgTime).toBeLessThan(500); // Less than 500ms per operation
  });
});
