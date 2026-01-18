/**
 * Scorecard Policy Tests - WI-065: Scorecard Engine & Analytics Integration
 */

import * as fs from 'fs';
import * as path from 'path';
import { scorecardPolicyLoader, ScorecardPolicyLoader } from '../policy';
import { RoleSurface, PerformanceBand } from '../types';

// Mock fs module
jest.mock('fs');
const mockedFs = fs as jest.Mocked<typeof fs>;

describe('ScorecardPolicyLoader', () => {
  const mockPolicyPath = path.join(
    process.cwd(),
    'config',
    'scorecard-policy.yaml'
  );

  const mockPolicyContent = `
version: "1.0.0"
description: "Test Scorecard Policy"

global:
  enabledSurfaces: ["OPERATOR", "MANAGER"]
  defaultTimeRanges: ["7d", "30d"]
  trendCalculationEnabled: true

metrics:
  testCategory:
    test_metric:
      key: "test_metric"
      label: "Test Metric"
      description: "A test metric"
      unit: "count"
      enabled: true
      surfaces: ["OPERATOR"]
      source: "fsm"
      queryType: "test_query"
      thresholds:
        green: { min: 0, max: 10 }
        yellow: { min: 11, max: 20 }
        red: { min: 21, max: 100 }

sections:
  testSection:
    key: "testSection"
    title: "Test Section"
    description: "A test section"
    metrics: ["test_metric"]

surfaces:
  OPERATOR:
    sections: ["testSection"]
    maxMetricsPerSection: 5
    includeTrends: true

dataRetention:
  auditEventsDays: 90
  metricCacheMinutes: 15
  drilldownCacheMinutes: 5

queryOptimization:
  maxConcurrentQueries: 5
  queryTimeoutSeconds: 30
  enableQueryCaching: true
  cacheTtlMinutes: 10
`;

  beforeEach(() => {
    jest.clearAllMocks();
    scorecardPolicyLoader.clearCache();
  });

  describe('loadPolicy', () => {
    it('should load and validate policy from YAML', () => {
      mockedFs.readFileSync.mockReturnValue(mockPolicyContent);

      const policy = scorecardPolicyLoader.loadPolicy();

      expect(policy.version).toBe('1.0.0');
      expect(policy.description).toBe('Test Scorecard Policy');
      expect(policy.global.enabledSurfaces).toEqual(['OPERATOR', 'MANAGER']);
    });

    it('should throw error for invalid YAML', () => {
      mockedFs.readFileSync.mockReturnValue('invalid: yaml: content: [');

      expect(() => scorecardPolicyLoader.loadPolicy()).toThrow();
    });

    it('should throw error for invalid policy schema', () => {
      const invalidPolicy = `
version: "1.0.0"
global:
  enabledSurfaces: ["INVALID_SURFACE"]
`;
      mockedFs.readFileSync.mockReturnValue(invalidPolicy);

      expect(() => scorecardPolicyLoader.loadPolicy()).toThrow();
    });
  });

  describe('getMetricDefinition', () => {
    beforeEach(() => {
      mockedFs.readFileSync.mockReturnValue(mockPolicyContent);
    });

    it('should return metric definition by key', () => {
      const metric = scorecardPolicyLoader.getMetricDefinition('test_metric');

      expect(metric).toBeDefined();
      expect(metric?.key).toBe('test_metric');
      expect(metric?.label).toBe('Test Metric');
      expect(metric?.enabled).toBe(true);
    });

    it('should return null for unknown metric', () => {
      const metric =
        scorecardPolicyLoader.getMetricDefinition('unknown_metric');

      expect(metric).toBeNull();
    });
  });

  describe('getEnabledMetricsForSurface', () => {
    beforeEach(() => {
      mockedFs.readFileSync.mockReturnValue(mockPolicyContent);
    });

    it('should return enabled metrics for OPERATOR surface', () => {
      const metrics = scorecardPolicyLoader.getEnabledMetricsForSurface(
        RoleSurface.OPERATOR
      );

      expect(metrics).toHaveLength(1);
      expect(metrics[0].key).toBe('test_metric');
    });

    it('should return empty array for unknown surface', () => {
      const metrics = scorecardPolicyLoader.getEnabledMetricsForSurface(
        RoleSurface.EXECUTIVE
      );

      expect(metrics).toHaveLength(0);
    });
  });

  describe('calculatePerformanceBand', () => {
    beforeEach(() => {
      mockedFs.readFileSync.mockReturnValue(mockPolicyContent);
    });

    it('should calculate GREEN band for value in green range', () => {
      const band = scorecardPolicyLoader.calculatePerformanceBand(
        'test_metric',
        5
      );

      expect(band).toBe(PerformanceBand.GREEN);
    });

    it('should calculate YELLOW band for value in yellow range', () => {
      const band = scorecardPolicyLoader.calculatePerformanceBand(
        'test_metric',
        15
      );

      expect(band).toBe(PerformanceBand.YELLOW);
    });

    it('should calculate RED band for value in red range', () => {
      const band = scorecardPolicyLoader.calculatePerformanceBand(
        'test_metric',
        50
      );

      expect(band).toBe(PerformanceBand.RED);
    });

    it('should return YELLOW for unknown metric', () => {
      const band = scorecardPolicyLoader.calculatePerformanceBand(
        'unknown_metric',
        10
      );

      expect(band).toBe(PerformanceBand.YELLOW);
    });
  });

  describe('validatePolicy', () => {
    it('should validate correct policy', () => {
      mockedFs.readFileSync.mockReturnValue(mockPolicyContent);

      const result = scorecardPolicyLoader.validatePolicy();

      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('should detect invalid surface references', () => {
      const invalidPolicy = `
version: "1.0.0"
sections:
  testSection:
    key: "testSection"
    title: "Test Section"
    description: "A test section"
    metrics: ["unknown_metric"]

surfaces:
  OPERATOR:
    sections: ["testSection"]

global:
  enabledSurfaces: ["OPERATOR"]
  defaultTimeRanges: ["7d"]
  trendCalculationEnabled: true

metrics: {}
dataRetention:
  auditEventsDays: 90
  metricCacheMinutes: 15
  drilldownCacheMinutes: 5
queryOptimization:
  maxConcurrentQueries: 5
  queryTimeoutSeconds: 30
  enableQueryCaching: true
  cacheTtlMinutes: 10
`;
      mockedFs.readFileSync.mockReturnValue(invalidPolicy);

      const result = scorecardPolicyLoader.validatePolicy();

      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0); // Policy validation failed due to missing description
    });
  });

  describe('caching', () => {
    it('should cache policy after first load', () => {
      mockedFs.readFileSync.mockReturnValue(mockPolicyContent);

      // First call
      scorecardPolicyLoader.loadPolicy();
      expect(mockedFs.readFileSync).toHaveBeenCalledTimes(1);

      // Second call should use cache
      scorecardPolicyLoader.loadPolicy();
      expect(mockedFs.readFileSync).toHaveBeenCalledTimes(1);

      // Clear cache and call again
      scorecardPolicyLoader.clearCache();
      scorecardPolicyLoader.loadPolicy();
      expect(mockedFs.readFileSync).toHaveBeenCalledTimes(2);
    });
  });
});
