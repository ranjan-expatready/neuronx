/**
 * Metrics Tests - WI-024: Observability & Metrics Foundation
 *
 * Tests for Prometheus metrics collection and registry.
 */

import {
  getMetricsText,
  resetAllMetrics,
  validateCleanupTableName,
} from '../metrics';

describe('Metrics System (WI-024)', () => {
  beforeEach(() => {
    // Reset metrics before each test
    resetAllMetrics();
  });

  describe('Metrics Registry', () => {
    it('should generate valid Prometheus text format', async () => {
      const metricsText = await getMetricsText();

      expect(typeof metricsText).toBe('string');
      expect(metricsText.length).toBeGreaterThan(0);

      // Should contain HELP and TYPE declarations
      expect(metricsText).toContain('# HELP');
      expect(metricsText).toContain('# TYPE');

      // Should contain some expected metrics
      expect(metricsText).toContain('neuronx_');
    });

    it('should not contain tenant IDs or correlation IDs', async () => {
      // This test ensures tenant-safe metrics (no tenantId/correlationId labels)
      const metricsText = await getMetricsText();

      // Should not contain any tenant or correlation identifiers
      expect(metricsText).not.toContain('tenantId');
      expect(metricsText).not.toContain('correlationId');
      expect(metricsText).not.toContain('tenant-');
      expect(metricsText).not.toContain('corr-');
    });

    it('should contain expected metric names', async () => {
      const metricsText = await getMetricsText();

      // Check for presence of key metrics
      expect(metricsText).toContain('neuronx_outbox_pending_total');
      expect(metricsText).toContain('neuronx_webhook_delivery_success_total');
      expect(metricsText).toContain('neuronx_auth_success_total');
      expect(metricsText).toContain('neuronx_artifacts_upload_url_total');
      expect(metricsText).toContain('neuronx_cleanup_run_total');
    });
  });

  describe('Cleanup Table Name Validation', () => {
    it('should accept valid cleanup table names', () => {
      expect(() => validateCleanupTableName('outbox_events')).not.toThrow();
      expect(() =>
        validateCleanupTableName('webhook_deliveries')
      ).not.toThrow();
      expect(() => validateCleanupTableName('audit_logs')).not.toThrow();
      expect(() => validateCleanupTableName('artifact_records')).not.toThrow();
      expect(() => validateCleanupTableName('usage_events')).not.toThrow();
      expect(() => validateCleanupTableName('usage_aggregates')).not.toThrow();
    });

    it('should reject invalid cleanup table names', () => {
      expect(() => validateCleanupTableName('invalid_table')).toThrow();
      expect(() => validateCleanupTableName('users')).toThrow();
      expect(() => validateCleanupTableName('')).toThrow();
    });

    it('should return validated table name', () => {
      const result = validateCleanupTableName('outbox_events');
      expect(result).toBe('outbox_events');
    });
  });

  describe('Metrics Increment Operations', () => {
    it('should allow metrics to be incremented', async () => {
      // Import metrics to test increment operations
      const { outboxMetrics, webhookMetrics, authzMetrics } =
        await import('../metrics');

      // Increment some counters
      outboxMetrics.publishSuccessTotal.inc();
      outboxMetrics.publishSuccessTotal.inc(5);

      webhookMetrics.deliverySuccessTotal.inc();
      authzMetrics.successTotal.inc();

      // Check that metrics text contains incremented values
      const metricsText = await getMetricsText();
      expect(metricsText).toContain('neuronx_outbox_publish_success_total 6');
      expect(metricsText).toContain('neuronx_webhook_delivery_success_total 1');
      expect(metricsText).toContain('neuronx_auth_success_total 1');
    });

    it('should handle histogram observations', async () => {
      const { outboxMetrics, webhookMetrics } = await import('../metrics');

      // Observe some durations
      outboxMetrics.dispatchDurationMs.observe(150);
      outboxMetrics.dispatchDurationMs.observe(250);
      webhookMetrics.deliveryDurationMs.observe(500);

      const metricsText = await getMetricsText();
      expect(metricsText).toContain('neuronx_outbox_dispatch_duration_ms');
      expect(metricsText).toContain('neuronx_webhook_delivery_duration_ms');
    });

    it('should handle gauge operations', async () => {
      const { outboxMetrics } = await import('../metrics');

      // Set gauge values
      outboxMetrics.pendingTotal.set(10);
      outboxMetrics.processingTotal.set(5);

      const metricsText = await getMetricsText();
      expect(metricsText).toContain('neuronx_outbox_pending_total 10');
      expect(metricsText).toContain('neuronx_outbox_processing_total 5');
    });
  });

  describe('Metrics Isolation', () => {
    it('should maintain separate metric instances', async () => {
      const { outboxMetrics, webhookMetrics } = await import('../metrics');

      // Modify one set of metrics
      outboxMetrics.publishSuccessTotal.inc(10);

      // Check that other metrics are unaffected
      const metricsText = await getMetricsText();
      expect(metricsText).toContain('neuronx_outbox_publish_success_total 10');
      // Other counters should still be at 0 (or not present)
    });

    it('should reset metrics correctly', async () => {
      const { outboxMetrics } = await import('../metrics');

      // Increment metrics
      outboxMetrics.publishSuccessTotal.inc(5);

      // Reset
      resetAllMetrics();

      // Check that metrics are reset
      const metricsText = await getMetricsText();
      // Should not contain the incremented value
      expect(metricsText).not.toContain(
        'neuronx_outbox_publish_success_total 5'
      );
    });
  });
});
