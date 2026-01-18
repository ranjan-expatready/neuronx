/**
 * Scorecard Policy Loader - WI-065: Scorecard Engine & Analytics Integration
 *
 * Loads and validates scorecard policy configuration from YAML with strict typing.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { z } from 'zod';
import {
  RoleSurface,
  TimeRange,
  PerformanceBand,
  ScorecardMetric,
  ScorecardSection,
} from './types';

// Policy schema definitions
const ThresholdBandSchema = z.object({
  min: z.number(),
  max: z.number(),
});

const MetricThresholdsSchema = z.object({
  green: ThresholdBandSchema,
  yellow: ThresholdBandSchema,
  red: ThresholdBandSchema,
});

const MetricDefinitionSchema = z.object({
  key: z.string(),
  label: z.string(),
  description: z.string(),
  unit: z.string(),
  enabled: z.boolean(),
  surfaces: z.array(z.enum(['OPERATOR', 'MANAGER', 'EXECUTIVE'])),
  source: z.enum([
    'audit_log',
    'usage_meter',
    'drift_events',
    'readiness',
    'billing',
    'fsm',
    'decisions',
  ]),
  queryType: z.string(),
  thresholds: MetricThresholdsSchema,
});

const SectionDefinitionSchema = z.object({
  key: z.string(),
  title: z.string(),
  description: z.string(),
  metrics: z.array(z.string()),
});

const SurfaceConfigSchema = z.object({
  sections: z.array(z.string()),
  maxMetricsPerSection: z.number().optional(),
  includeTrends: z.boolean().optional(),
  includeDrilldown: z.boolean().optional(),
});

const ScorecardPolicySchema = z.object({
  version: z.string(),
  description: z.string(),
  global: z.object({
    enabledSurfaces: z.array(z.enum(['OPERATOR', 'MANAGER', 'EXECUTIVE'])),
    defaultTimeRanges: z.array(z.enum(['7d', '30d', '90d'])),
    trendCalculationEnabled: z.boolean(),
  }),
  metrics: z.record(z.record(MetricDefinitionSchema)),
  sections: z.record(SectionDefinitionSchema),
  surfaces: z.record(SurfaceConfigSchema),
  dataRetention: z.object({
    auditEventsDays: z.number(),
    metricCacheMinutes: z.number(),
    drilldownCacheMinutes: z.number(),
  }),
  queryOptimization: z.object({
    maxConcurrentQueries: z.number(),
    queryTimeoutSeconds: z.number(),
    enableQueryCaching: z.boolean(),
    cacheTtlMinutes: z.number(),
  }),
});

export type ScorecardPolicy = z.infer<typeof ScorecardPolicySchema>;
export type MetricDefinition = z.infer<typeof MetricDefinitionSchema>;
export type SectionDefinition = z.infer<typeof SectionDefinitionSchema>;
export type SurfaceConfig = z.infer<typeof SurfaceConfigSchema>;

/**
 * Scorecard Policy Loader
 *
 * Loads and validates scorecard policy from YAML configuration.
 */
export class ScorecardPolicyLoader {
  private policy: ScorecardPolicy | null = null;
  private policyPath: string;

  constructor(policyPath?: string) {
    this.policyPath =
      policyPath || path.join(process.cwd(), 'config', 'scorecard-policy.yaml');
  }

  /**
   * Load and validate policy configuration
   */
  loadPolicy(): ScorecardPolicy {
    if (this.policy) {
      return this.policy;
    }

    try {
      const policyContent = fs.readFileSync(this.policyPath, 'utf8');
      const parsedPolicy = yaml.load(policyContent) as any;

      this.policy = ScorecardPolicySchema.parse(parsedPolicy);
      return this.policy;
    } catch (error) {
      if (error instanceof z.ZodError) {
        throw new Error(`Scorecard policy validation failed: ${error.message}`);
      }
      throw new Error(
        `Failed to load scorecard policy: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }

  /**
   * Get metric definition by key
   */
  getMetricDefinition(metricKey: string): MetricDefinition | null {
    const policy = this.loadPolicy();

    for (const category of Object.values(policy.metrics)) {
      if (category[metricKey]) {
        return category[metricKey];
      }
    }

    return null;
  }

  /**
   * Get all enabled metrics for a surface
   */
  getEnabledMetricsForSurface(surface: RoleSurface): MetricDefinition[] {
    const policy = this.loadPolicy();
    const surfaceConfig = policy.surfaces[surface];

    if (!surfaceConfig) {
      return [];
    }

    const enabledMetrics: MetricDefinition[] = [];

    // Get metrics from enabled sections
    for (const sectionKey of surfaceConfig.sections) {
      const section = policy.sections[sectionKey];
      if (!section) continue;

      for (const metricKey of section.metrics) {
        const metricDef = this.getMetricDefinition(metricKey);
        if (
          metricDef &&
          metricDef.enabled &&
          metricDef.surfaces.includes(surface)
        ) {
          enabledMetrics.push(metricDef);
        }
      }
    }

    return enabledMetrics;
  }

  /**
   * Get section definitions for a surface
   */
  getSectionsForSurface(surface: RoleSurface): Array<{
    definition: SectionDefinition;
    metrics: MetricDefinition[];
  }> {
    const policy = this.loadPolicy();
    const surfaceConfig = policy.surfaces[surface];

    if (!surfaceConfig) {
      return [];
    }

    const sections: Array<{
      definition: SectionDefinition;
      metrics: MetricDefinition[];
    }> = [];

    for (const sectionKey of surfaceConfig.sections) {
      const sectionDef = policy.sections[sectionKey];
      if (!sectionDef) continue;

      const sectionMetrics: MetricDefinition[] = [];
      for (const metricKey of sectionDef.metrics) {
        const metricDef = this.getMetricDefinition(metricKey);
        if (
          metricDef &&
          metricDef.enabled &&
          metricDef.surfaces.includes(surface)
        ) {
          sectionMetrics.push(metricDef);
        }
      }

      if (sectionMetrics.length > 0) {
        sections.push({
          definition: sectionDef,
          metrics: sectionMetrics,
        });
      }
    }

    return sections;
  }

  /**
   * Calculate performance band for a metric value
   */
  calculatePerformanceBand(metricKey: string, value: number): PerformanceBand {
    const metricDef = this.getMetricDefinition(metricKey);
    if (!metricDef) {
      return PerformanceBand.YELLOW; // Default to yellow for unknown metrics
    }

    const thresholds = metricDef.thresholds;

    if (value >= thresholds.green.min && value <= thresholds.green.max) {
      return PerformanceBand.GREEN;
    } else if (
      value >= thresholds.yellow.min &&
      value <= thresholds.yellow.max
    ) {
      return PerformanceBand.YELLOW;
    } else {
      return PerformanceBand.RED;
    }
  }

  /**
   * Get surface configuration
   */
  getSurfaceConfig(surface: RoleSurface): SurfaceConfig | null {
    const policy = this.loadPolicy();
    return policy.surfaces[surface] || null;
  }

  /**
   * Get global configuration
   */
  getGlobalConfig() {
    return this.loadPolicy().global;
  }

  /**
   * Get data retention settings
   */
  getDataRetentionConfig() {
    return this.loadPolicy().dataRetention;
  }

  /**
   * Get query optimization settings
   */
  getQueryOptimizationConfig() {
    return this.loadPolicy().queryOptimization;
  }

  /**
   * Validate policy configuration
   */
  validatePolicy(): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    try {
      const policy = this.loadPolicy();

      // Validate surface references
      for (const [surfaceName, surfaceConfig] of Object.entries(
        policy.surfaces
      )) {
        for (const sectionKey of surfaceConfig.sections) {
          if (!policy.sections[sectionKey]) {
            errors.push(
              `Surface ${surfaceName} references unknown section: ${sectionKey}`
            );
          }
        }
      }

      // Validate section metric references
      for (const [sectionKey, sectionDef] of Object.entries(policy.sections)) {
        for (const metricKey of sectionDef.metrics) {
          if (!this.getMetricDefinition(metricKey)) {
            errors.push(
              `Section ${sectionKey} references unknown metric: ${metricKey}`
            );
          }
        }
      }

      // Validate threshold ranges
      for (const category of Object.values(policy.metrics)) {
        for (const [metricKey, metricDef] of Object.entries(category)) {
          const thresholds = metricDef.thresholds;

          // Check for overlapping ranges
          if (
            thresholds.yellow.min < thresholds.green.max &&
            thresholds.yellow.max > thresholds.green.min
          ) {
            errors.push(
              `Metric ${metricKey} has overlapping green/yellow thresholds`
            );
          }

          if (
            thresholds.red.min < thresholds.yellow.max &&
            thresholds.red.max > thresholds.yellow.min
          ) {
            errors.push(
              `Metric ${metricKey} has overlapping yellow/red thresholds`
            );
          }
        }
      }
    } catch (error) {
      errors.push(
        `Policy validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    return {
      valid: errors.length === 0,
      errors,
    };
  }

  /**
   * Clear cached policy (for testing)
   */
  clearCache(): void {
    this.policy = null;
  }
}

// Export singleton instance
export const scorecardPolicyLoader = new ScorecardPolicyLoader();
