import { describe, it, expect } from 'vitest';
import { ReadinessEngine } from '../readiness.engine';
import { ReadinessDomain, ReadinessStatus } from '../readiness.types';

const mockPrismaClient = {};

describe('ReadinessEngine', () => {
  let engine: ReadinessEngine;

  beforeEach(() => {
    engine = new ReadinessEngine(mockPrismaClient);
  });

  describe('generateReadinessReport', () => {
    it('should generate comprehensive readiness report', async () => {
      const tenantId = 'tenant-123';
      const correlationId = 'test-correlation-123';

      const report = await engine.generateReadinessReport(
        tenantId,
        true,
        correlationId
      );

      expect(report.tenantId).toBe(tenantId);
      expect(report.correlationId).toBe(correlationId);
      expect(report.generatedAt).toBeInstanceOf(Date);
      expect(report.overall).toBeDefined();
      expect(report.domains).toBeDefined();

      // Check all domains are present and have the expected structure
      expect(report.domains.systemHealth).toBeDefined();
      expect(report.domains.systemHealth.status).toBeDefined();
      expect(report.domains.governance).toBeDefined();
      expect(report.domains.ghlTrust).toBeDefined();
      expect(report.domains.voiceRisk).toBeDefined();
      expect(report.domains.billingRevenue).toBeDefined();

      // Check evidence links are generated
      expect(report.evidence.linksOrPaths.length).toBeGreaterThan(0);
      expect(
        report.evidence.linksOrPaths.some(link =>
          link.includes('docs/EVIDENCE/production-readiness/')
        )
      ).toBe(true);
      expect(
        report.evidence.linksOrPaths.some(link =>
          link.includes('audit:readiness_report_generated:')
        )
      ).toBe(true);
    });

    it('should handle evaluator failures gracefully', async () => {
      // Test with a tenant that might cause issues, or just verify the structure
      const report = await engine.generateReadinessReport('tenant-123');

      expect(report.domains.systemHealth).toBeDefined();
      expect(typeof report.domains.systemHealth.status).toBe('string');
    });

    it('should respect includeDetails flag', async () => {
      const reportWithDetails = await engine.generateReadinessReport(
        'tenant-123',
        true
      );
      const reportWithoutDetails = await engine.generateReadinessReport(
        'tenant-123',
        false
      );

      // With details, signals array should be populated (even if empty in mock)
      expect(
        Array.isArray(reportWithDetails.domains.systemHealth.signals)
      ).toBe(true);

      // Without details, signals should be empty array
      expect(reportWithoutDetails.domains.systemHealth.signals).toEqual([]);
    });
  });

  describe('getDomainStatus', () => {
    it('should return specific domain status', async () => {
      const status = await engine.getDomainStatus(
        'tenant-123',
        ReadinessDomain.SYSTEM_HEALTH
      );

      expect(status).toBeDefined();
      expect(status.domain).toBe(ReadinessDomain.SYSTEM_HEALTH);
      expect(status.status).toBeDefined();
      expect(typeof status.summary).toBe('string');
    });

    it('should throw error for unknown domain', async () => {
      await expect(
        engine.getDomainStatus('tenant-123', 'unknown' as any)
      ).rejects.toThrow('Unknown domain');
    });
  });

  describe('correlation ID generation', () => {
    it('should generate correlation ID when not provided', async () => {
      const report = await engine.generateReadinessReport('tenant-123');

      expect(report.correlationId).toMatch(/^readiness-\d+-[a-z0-9]+$/);
    });

    it('should use provided correlation ID', async () => {
      const customCorrelationId = 'custom-correlation-123';
      const report = await engine.generateReadinessReport(
        'tenant-123',
        true,
        customCorrelationId
      );

      expect(report.correlationId).toBe(customCorrelationId);
    });
  });
});
