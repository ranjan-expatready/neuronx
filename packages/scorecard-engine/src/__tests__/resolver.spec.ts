/**
 * Scorecard Resolver Tests - WI-065: Scorecard Engine & Analytics Integration
 */

import {
  ScorecardResolver,
  IAuditService,
  IDatabaseService,
} from '../resolver';
import {
  RoleSurface,
  TimeRange,
  ScorecardQuery,
  PerformanceBand,
} from '../types';

// Mock the policy loader
jest.mock('../policy', () => ({
  scorecardPolicyLoader: {
    loadPolicy: jest.fn().mockReturnValue({
      version: '1.0.0',
      global: {
        enabledSurfaces: ['OPERATOR', 'MANAGER', 'EXECUTIVE'],
        defaultTimeRanges: ['7d', '30d', '90d'],
        trendCalculationEnabled: true,
      },
    }),
    getSectionsForSurface: jest.fn().mockReturnValue([]),
    calculatePerformanceBand: jest
      .fn()
      .mockReturnValue('GREEN' as PerformanceBand),
  },
}));

// Mock services
const mockDatabaseService: IDatabaseService = {
  opportunity: {
    count: jest.fn().mockResolvedValue(0),
    findMany: jest.fn().mockResolvedValue([]),
  },
  decisionExplanation: {
    count: jest.fn().mockResolvedValue(0),
  },
};

const mockAuditService: IAuditService = {
  queryEvents: jest.fn().mockResolvedValue({ events: [], total: 0 }),
  logEvent: jest.fn().mockResolvedValue(undefined),
};

describe('ScorecardResolver', () => {
  let resolver: ScorecardResolver;

  beforeEach(() => {
    resolver = new ScorecardResolver(mockAuditService, mockDatabaseService);
    jest.clearAllMocks();
  });

  describe('resolveScorecard', () => {
    it('should resolve scorecard for OPERATOR surface', async () => {
      const query: ScorecardQuery = {
        tenantId: 'test-tenant',
        surface: RoleSurface.OPERATOR,
        timeRange: TimeRange.LAST_7_DAYS,
      };

      const scorecard = await resolver.resolveScorecard(query);

      expect(scorecard.tenantId).toBe('test-tenant');
      expect(scorecard.surface).toBe(RoleSurface.OPERATOR);
      expect(scorecard.timeRange).toBe(TimeRange.LAST_7_DAYS);
      expect(scorecard.sections).toBeDefined();
      expect(scorecard.overallBand).toBeDefined();
      expect(scorecard.correlationId).toBeDefined();
      expect(typeof scorecard.correlationId).toBe('string');
      expect(scorecard.correlationId.length).toBeGreaterThan(0);
    });

    it('should include correlation ID in results', async () => {
      const query: ScorecardQuery = {
        tenantId: 'test-tenant',
        surface: RoleSurface.OPERATOR,
        timeRange: TimeRange.LAST_30_DAYS,
      };

      const scorecard = await resolver.resolveScorecard(query);

      expect(scorecard.correlationId).toContain(
        'scorecard_test-tenant_OPERATOR'
      );
    });
  });

  describe('buildTimeRangeFilter', () => {
    it('should build correct time range filter for 7 days', () => {
      const filter = (resolver as any).buildTimeRangeFilter(
        TimeRange.LAST_7_DAYS
      );

      expect(filter.createdAt).toBeDefined();
      expect(filter.createdAt.gte).toBeInstanceOf(Date);
      expect(filter.createdAt.lte).toBeInstanceOf(Date);
    });

    it('should build correct time range filter for 30 days', () => {
      const filter = (resolver as any).buildTimeRangeFilter(
        TimeRange.LAST_30_DAYS
      );

      expect(filter.createdAt).toBeDefined();
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      expect(filter.createdAt.gte.getTime()).toBeLessThanOrEqual(
        thirtyDaysAgo.getTime() + 2000
      );
      expect(filter.createdAt.gte.getTime()).toBeGreaterThanOrEqual(
        thirtyDaysAgo.getTime() - 2000
      );
    });
  });

  describe('calculateSectionBand', () => {
    it('should return GREEN when all metrics are green', () => {
      const metrics = [
        { band: PerformanceBand.GREEN },
        { band: PerformanceBand.GREEN },
      ];

      const band = (resolver as any).calculateSectionBand(metrics);
      expect(band).toBe(PerformanceBand.GREEN);
    });

    it('should return RED when any metric is red', () => {
      const metrics = [
        { band: PerformanceBand.GREEN },
        { band: PerformanceBand.RED },
      ];

      const band = (resolver as any).calculateSectionBand(metrics);
      expect(band).toBe(PerformanceBand.RED);
    });

    it('should return YELLOW when worst is yellow', () => {
      const metrics = [
        { band: PerformanceBand.GREEN },
        { band: PerformanceBand.YELLOW },
      ];

      const band = (resolver as any).calculateSectionBand(metrics);
      expect(band).toBe(PerformanceBand.YELLOW);
    });
  });

  describe('getMetricDrilldown', () => {
    it('should return drill-down data structure', async () => {
      const query = {
        tenantId: 'test-tenant',
        metricKey: 'test_metric',
        timeRange: TimeRange.LAST_7_DAYS,
        page: 1,
        limit: 10,
      };

      const result = await resolver.getMetricDrilldown(query);

      expect(result.metricKey).toBe('test_metric');
      expect(Array.isArray(result.records)).toBe(true);
      expect(result.pagination).toBeDefined();
      expect(typeof result.pagination.total).toBe('number');
      expect(result.pagination.page).toBe(1);
      expect(result.pagination.limit).toBe(10);
    });
  });
});
