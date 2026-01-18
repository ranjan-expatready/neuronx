#!/usr/bin/env tsx

/**
 * Observability Artifacts Validation - WI-025: Grafana Dashboards + Prometheus Alerts
 *
 * Validates that:
 * 1. All referenced metrics exist in src/observability/metrics.ts
 * 2. No tenantId labels are used in PromQL queries
 * 3. Alert YAML is syntactically valid
 */

import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';

interface ValidationResult {
  success: boolean;
  errors: string[];
  warnings: string[];
}

interface MetricDefinition {
  name: string;
  type: string;
  labels?: string[];
}

// Load metrics from source code
function loadMetricsFromSource(): MetricDefinition[] {
  const metricsPath = path.join(
    process.cwd(),
    'apps/core-api/src/observability/metrics.ts'
  );
  const content = fs.readFileSync(metricsPath, 'utf-8');

  const metrics: MetricDefinition[] = [];

  // Extract metric definitions from the source code
  const metricPatterns = [
    // Counter metrics
    /new Counter\(\{\s*name:\s*['"]([^'"]+)['"]/g,
    // Gauge metrics
    /new Gauge\(\{\s*name:\s*['"]([^'"]+)['"]/g,
    // Histogram metrics
    /new Histogram\(\{\s*name:\s*['"]([^'"]+)['"]/g,
  ];

  for (const pattern of metricPatterns) {
    let match;
    while ((match = pattern.exec(content)) !== null) {
      const metricName = match[1];
      let metricType = 'unknown';

      if (pattern.source.includes('Counter')) metricType = 'counter';
      else if (pattern.source.includes('Gauge')) metricType = 'gauge';
      else if (pattern.source.includes('Histogram')) metricType = 'histogram';

      // Check for labelNames
      const labelMatch = content
        .substring(match.index - 200, match.index + 200)
        .match(/labelNames:\s*\[([^\]]+)\]/);
      const labels = labelMatch
        ? labelMatch[1].split(',').map(l => l.trim().replace(/['"]/g, ''))
        : [];

      metrics.push({
        name: metricName,
        type: metricType,
        labels: labels.length > 0 ? labels : undefined,
      });
    }
  }

  return metrics;
}

// Load dashboard JSON files
function loadDashboards(): any[] {
  const dashboardsDir = path.join(process.cwd(), 'ops/grafana/dashboards');
  const dashboardFiles = fs
    .readdirSync(dashboardsDir)
    .filter(f => f.endsWith('.json'));

  return dashboardFiles.map(file => {
    const content = fs.readFileSync(path.join(dashboardsDir, file), 'utf-8');
    return { file, content: JSON.parse(content) };
  });
}

// Load alert YAML
function loadAlertRules(): any {
  const alertsPath = path.join(
    process.cwd(),
    'ops/prometheus/alerts/neuronx-alerts.yml'
  );
  const content = fs.readFileSync(alertsPath, 'utf-8');
  return yaml.load(content);
}

// Validate that all metrics referenced in dashboards exist
function validateDashboardMetrics(
  dashboards: any[],
  metrics: MetricDefinition[]
): string[] {
  const errors: string[] = [];
  const metricNames = new Set(metrics.map(m => m.name));
  const histogramNames = new Set(
    metrics.filter(m => m.type === 'histogram').map(m => m.name)
  );

  for (const dashboard of dashboards) {
    const panels = dashboard.content.dashboard?.panels || [];

    for (const panel of panels) {
      const targets = panel.targets || [];

      for (const target of targets) {
        const expr = target.expr || '';

        // Extract metric names from PromQL expressions
        // This is a simplified regex - real PromQL parsing would be more complex
        const metricMatches = expr.match(/neuronx_[a-zA-Z_]+/g) || [];

        for (const metricName of metricMatches) {
          // Check if it's a direct metric reference
          if (metricNames.has(metricName)) {
            continue;
          }

          // Check if it's a histogram bucket reference (for histogram_quantile)
          if (metricName.endsWith('_bucket')) {
            const baseName = metricName.replace('_bucket', '');
            if (histogramNames.has(baseName)) {
              continue;
            }
          }

          errors.push(
            `Dashboard ${dashboard.file}: Metric "${metricName}" not found in metrics.ts`
          );
        }

        // Check for tenantId labels
        if (expr.includes('tenantId') || expr.includes('tenant_id')) {
          errors.push(
            `Dashboard ${dashboard.file}: PromQL contains tenantId label: ${expr}`
          );
        }
      }
    }
  }

  return errors;
}

// Validate alert rules
function validateAlertRules(
  alerts: any,
  metrics: MetricDefinition[]
): string[] {
  const errors: string[] = [];
  const metricNames = new Set(metrics.map(m => m.name));
  const histogramNames = new Set(
    metrics.filter(m => m.type === 'histogram').map(m => m.name)
  );

  if (!alerts.groups || !Array.isArray(alerts.groups)) {
    errors.push('Alert YAML missing groups array');
    return errors;
  }

  for (const group of alerts.groups) {
    if (!group.name || !group.rules) {
      errors.push(
        `Alert group missing name or rules: ${JSON.stringify(group)}`
      );
      continue;
    }

    for (const rule of group.rules) {
      if (!rule.alert || !rule.expr) {
        errors.push(
          `Alert rule missing alert name or expression: ${JSON.stringify(rule)}`
        );
        continue;
      }

      const expr = rule.expr;

      // Extract metric names from PromQL expressions
      const metricMatches = expr.match(/neuronx_[a-zA-Z_]+/g) || [];

      for (const metricName of metricMatches) {
        // Check if it's a direct metric reference
        if (metricNames.has(metricName)) {
          continue;
        }

        // Check if it's a histogram bucket reference (for histogram_quantile)
        if (metricName.endsWith('_bucket')) {
          const baseName = metricName.replace('_bucket', '');
          if (histogramNames.has(baseName)) {
            continue;
          }
        }

        errors.push(
          `Alert ${rule.alert}: Metric "${metricName}" not found in metrics.ts`
        );
      }

      // Check for tenantId labels
      if (expr.includes('tenantId') || expr.includes('tenant_id')) {
        errors.push(
          `Alert ${rule.alert}: PromQL contains tenantId label: ${expr}`
        );
      }

      // Validate annotations
      if (!rule.annotations || !rule.annotations.summary) {
        errors.push(`Alert ${rule.alert}: Missing summary annotation`);
      }

      if (!rule.annotations || !rule.annotations.runbook_url) {
        errors.push(`Alert ${rule.alert}: Missing runbook_url annotation`);
      }
    }
  }

  return errors;
}

// Validate runbook URLs
function validateRunbookUrls(alerts: any): string[] {
  const errors: string[] = [];
  const runbooksDir = path.join(process.cwd(), 'ops/runbooks');
  const runbookFiles = new Set(
    fs.readdirSync(runbooksDir).map(f => f.replace('.md', ''))
  );

  for (const group of alerts.groups || []) {
    for (const rule of group.rules || []) {
      const runbookUrl = rule.annotations?.runbook_url;
      if (runbookUrl) {
        // Extract runbook name from URL
        const match = runbookUrl.match(/\/runbooks\/([^.]+)\.md/);
        if (match) {
          const runbookName = match[1];
          if (!runbookFiles.has(runbookName)) {
            errors.push(
              `Alert ${rule.alert}: Runbook file "${runbookName}.md" not found`
            );
          }
        }
      }
    }
  }

  return errors;
}

// Main validation function
async function validateObservabilityArtifacts(): Promise<ValidationResult> {
  const result: ValidationResult = {
    success: true,
    errors: [],
    warnings: [],
  };

  try {
    // Load metrics from source
    const metrics = loadMetricsFromSource();
    console.log(`📊 Loaded ${metrics.length} metrics from source code`);

    // Load dashboards
    const dashboards = loadDashboards();
    console.log(`📈 Loaded ${dashboards.length} dashboard files`);

    // Load alerts
    const alerts = loadAlertRules();
    console.log(
      `🚨 Loaded alert rules with ${alerts.groups?.length || 0} groups`
    );

    // Validate dashboard metrics
    const dashboardErrors = validateDashboardMetrics(dashboards, metrics);
    result.errors.push(...dashboardErrors);

    // Validate alert rules
    const alertErrors = validateAlertRules(alerts, metrics);
    result.errors.push(...alertErrors);

    // Validate runbook URLs
    const runbookErrors = validateRunbookUrls(alerts);
    result.errors.push(...runbookErrors);

    // Summary
    console.log(`\n✅ Validation Summary:`);
    console.log(`   Metrics defined: ${metrics.length}`);
    console.log(`   Dashboards validated: ${dashboards.length}`);
    console.log(`   Alert groups: ${alerts.groups?.length || 0}`);
    console.log(`   Errors found: ${result.errors.length}`);

    if (result.errors.length > 0) {
      console.log('\n❌ Errors:');
      result.errors.forEach(error => console.log(`   - ${error}`));
      result.success = false;
    } else {
      console.log('\n✅ All validations passed!');
    }
  } catch (error: any) {
    result.success = false;
    result.errors.push(`Validation failed: ${error.message}`);
    console.error('❌ Validation error:', error.message);
  }

  return result;
}

// CLI execution
if (import.meta.url === `file://${process.argv[1]}`) {
  validateObservabilityArtifacts()
    .then(result => {
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('Unexpected error:', error);
      process.exit(1);
    });
}

export { validateObservabilityArtifacts };
