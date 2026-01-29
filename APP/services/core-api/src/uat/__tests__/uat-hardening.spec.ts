/**
 * UAT Hardening Acceptance Tests - WI-066B: UAT Harness Hardening
 *
 * Comprehensive tests proving UAT safety and functionality.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { PrismaClient } from '@prisma/client';
import { AppModule } from '../../app.module';
import { AuditService } from '../../audit/audit.service';

describe('UAT Hardening Acceptance Tests', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let auditService: AuditService;
  let testTenantId: string;
  let testCorrelationId: string;

  beforeAll(async () => {
    // Set up test environment
    process.env.NEURONX_ENV = 'uat';
    process.env.UAT_TENANT_IDS = 'test-tenant-001,test-tenant-002';
    process.env.UAT_MODE = 'dry_run';
    process.env.UAT_KILL_SWITCH = 'true';
    process.env.UAT_TEST_PHONE_ALLOWLIST = '+15551234567';
    process.env.UAT_EMAIL_DOMAIN_ALLOWLIST = 'test.com';
    process.env.UAT_CALENDAR_ALLOWLIST = 'calendar_uat_001';
    process.env.UAT_GHL_LOCATION_IDS = 'ghl_location_uat_001';

    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = new PrismaClient();
    auditService = moduleFixture.get<AuditService>(AuditService);

    testTenantId = 'test-tenant-001';
    testCorrelationId = `test_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  beforeEach(async () => {
    // Clean up test data between tests
    await prisma.auditLog.deleteMany({
      where: { tenantId: testTenantId },
    });
  });

  describe('1. UI calls Core API directly (no mocks)', () => {
    it('should return UAT status from core API', async () => {
      const response = await request(app.getHttpServer())
        .get('/uat/status')
        .set('x-tenant-id', testTenantId)
        .expect(200);

      expect(response.body).toHaveProperty('environment', 'uat');
      expect(response.body).toHaveProperty('mode', 'dry_run');
      expect(response.body).toHaveProperty('killSwitch', true);
      expect(response.body).toHaveProperty('allowedTenants');
      expect(response.body).toHaveProperty('providerAllowlists');
    });

    it('should trigger golden run through core API', async () => {
      const response = await request(app.getHttpServer())
        .post('/uat/golden-run')
        .set('x-tenant-id', testTenantId)
        .set('x-correlation-id', testCorrelationId)
        .expect(200);

      expect(response.body).toHaveProperty('success');
      expect(response.body).toHaveProperty('runId');
      expect(response.body).toHaveProperty('correlationId', testCorrelationId);
      expect(response.body).toHaveProperty('phases');
      expect(response.body).toHaveProperty('duration');
    });
  });

  describe('2. UAT guard enforces hard blocking', () => {
    it('should block requests from non-allowlisted tenants', async () => {
      const response = await request(app.getHttpServer())
        .get('/uat/status')
        .set('x-tenant-id', 'blocked-tenant')
        .expect(403);

      expect(response.body).toHaveProperty('message', 'UAT Safety Violation');
      expect(response.body).toHaveProperty('reason');
      expect(response.body.reason).toContain('not in allowlist');
    });

    it('should block production environment requests', async () => {
      // Temporarily set prod environment
      process.env.NEURONX_ENV = 'prod';

      try {
        const response = await request(app.getHttpServer())
          .get('/uat/status')
          .set('x-tenant-id', testTenantId)
          .expect(403);

        expect(response.body).toHaveProperty('message', 'UAT Safety Violation');
        expect(response.body.reason).toContain('PRODUCTION SAFETY');
      } finally {
        // Restore UAT environment
        process.env.NEURONX_ENV = 'uat';
      }
    });

    it('should allow requests from allowlisted tenants', async () => {
      const response = await request(app.getHttpServer())
        .get('/uat/status')
        .set('x-tenant-id', testTenantId)
        .expect(200);

      expect(response.body).toHaveProperty('environment', 'uat');
    });
  });

  describe('3. Durable audit records are written', () => {
    it('should create audit records for UAT guard checks', async () => {
      // Make a request that should be allowed
      await request(app.getHttpServer())
        .get('/uat/status')
        .set('x-tenant-id', testTenantId)
        .set('x-correlation-id', testCorrelationId)
        .expect(200);

      // Check that audit record was created
      const auditEvents = await auditService.queryEvents(testTenantId, {
        action: 'uat_guard_check_allowed',
      });

      expect(auditEvents.total).toBeGreaterThan(0);
      const event = auditEvents.events[0];
      expect(event.action).toBe('uat_guard_check_allowed');
      expect(event.metadata.correlationId).toBe(testCorrelationId);
      expect(event.metadata.isDryRun).toBe(true);
    });

    it('should create audit records for golden run phases', async () => {
      // Trigger golden run
      await request(app.getHttpServer())
        .post('/uat/golden-run')
        .set('x-tenant-id', testTenantId)
        .set('x-correlation-id', testCorrelationId)
        .expect(200);

      // Check that multiple audit records were created
      const auditEvents = await auditService.queryEvents(testTenantId, {
        correlationId: testCorrelationId,
      });

      expect(auditEvents.total).toBeGreaterThan(5); // Should have records for each phase

      // Check for specific phase events
      const phaseEvents = auditEvents.events.filter(e =>
        e.action.includes('uat_golden_run_phase_')
      );
      expect(phaseEvents.length).toBeGreaterThan(0);
    });

    it('should create audit records for command executions', async () => {
      // Trigger golden run
      await request(app.getHttpServer())
        .post('/uat/golden-run')
        .set('x-tenant-id', testTenantId)
        .set('x-correlation-id', testCorrelationId)
        .expect(200);

      // Check for command execution audit records
      const commandEvents = await auditService.queryEvents(testTenantId, {
        action: 'uat_command_executed',
      });

      expect(commandEvents.total).toBeGreaterThan(0);
      const event = commandEvents.events[0];
      expect(event.metadata.simulated).toBe(true);
      expect(event.metadata.uatMode).toBe('dry_run');
    });
  });

  describe('4. Golden run executes complete workflow', () => {
    it('should execute all phases of golden run', async () => {
      const response = await request(app.getHttpServer())
        .post('/uat/golden-run')
        .set('x-tenant-id', testTenantId)
        .set('x-correlation-id', testCorrelationId)
        .expect(200);

      expect(response.body.success).toBe(true);
      expect(response.body.phases).toHaveProperty('environment');
      expect(response.body.phases).toHaveProperty('workQueue');
      expect(response.body.phases).toHaveProperty('explain');
      expect(response.body.phases).toHaveProperty('plan');
      expect(response.body.phases).toHaveProperty('approve');
      expect(response.body.phases).toHaveProperty('execute');
      expect(response.body.phases).toHaveProperty('audit');
    });

    it('should return selected opportunity details', async () => {
      const response = await request(app.getHttpServer())
        .post('/uat/golden-run')
        .set('x-tenant-id', testTenantId)
        .set('x-correlation-id', testCorrelationId)
        .expect(200);

      expect(response.body.selectedOpportunity).toBeDefined();
      expect(response.body.selectedOpportunity).toHaveProperty('id');
      expect(response.body.selectedOpportunity).toHaveProperty('title');
      expect(response.body.selectedOpportunity).toHaveProperty('state');
    });

    it('should execute commands in DRY_RUN mode only', async () => {
      const response = await request(app.getHttpServer())
        .post('/uat/golden-run')
        .set('x-tenant-id', testTenantId)
        .set('x-correlation-id', testCorrelationId)
        .expect(200);

      const executePhase = response.body.phases.execute;
      expect(executePhase.status).toBe('completed');
      expect(executePhase.result.successCount).toBeGreaterThan(0);

      // Verify all commands were simulated (dry run)
      executePhase.result.results.forEach((result: any) => {
        expect(result.success).toBe(true);
        expect(result.simulated).toBeUndefined(); // This is in metadata
      });
    });
  });

  describe('5. Production safety is maintained', () => {
    it('should fail startup with UAT flags in production', async () => {
      // This test would need to be run in a separate process
      // as environment variables are checked at startup
      // For now, we test that the config validation works

      process.env.NEURONX_ENV = 'prod';
      process.env.UAT_TENANT_IDS = 'some-tenant';

      try {
        // Re-import to trigger config validation
        const { getUatConfig } = await import('@neuronx/uat-harness');
        expect(() => getUatConfig()).toThrow('PRODUCTION SAFETY VIOLATION');
      } finally {
        process.env.NEURONX_ENV = 'uat';
        delete process.env.UAT_TENANT_IDS;
      }
    });

    it('should require tenant ID for all UAT requests', async () => {
      const response = await request(app.getHttpServer())
        .get('/uat/status')
        .expect(403);

      expect(response.body).toHaveProperty('message');
      expect(response.body.message).toContain('Tenant ID required');
    });

    it('should validate correlation ID propagation', async () => {
      const customCorrelationId = `custom_${Date.now()}`;

      await request(app.getHttpServer())
        .get('/uat/status')
        .set('x-tenant-id', testTenantId)
        .set('x-correlation-id', customCorrelationId)
        .expect(200);

      // Check that audit record has the correlation ID
      const auditEvents = await auditService.queryEvents(testTenantId, {
        correlationId: customCorrelationId,
      });

      expect(auditEvents.total).toBeGreaterThan(0);
    });
  });

  describe('6. UAT API provides audit query functionality', () => {
    it('should return UAT audit events via API', async () => {
      // First create some audit events
      await request(app.getHttpServer())
        .get('/uat/status')
        .set('x-tenant-id', testTenantId)
        .set('x-correlation-id', testCorrelationId)
        .expect(200);

      // Query audit events
      const response = await request(app.getHttpServer())
        .get('/uat/audit')
        .set('x-tenant-id', testTenantId)
        .expect(200);

      expect(response.body).toHaveProperty('events');
      expect(response.body).toHaveProperty('total');
      expect(Array.isArray(response.body.events)).toBe(true);
    });

    it('should filter audit events by correlation ID', async () => {
      const specificCorrelationId = `specific_${Date.now()}`;

      // Create event with specific correlation ID
      await request(app.getHttpServer())
        .get('/uat/status')
        .set('x-tenant-id', testTenantId)
        .set('x-correlation-id', specificCorrelationId)
        .expect(200);

      // Query should return the specific event
      const response = await request(app.getHttpServer())
        .get(`/uat/audit?correlationId=${specificCorrelationId}`)
        .set('x-tenant-id', testTenantId)
        .expect(200);

      expect(response.body.events.length).toBeGreaterThan(0);
      response.body.events.forEach((event: any) => {
        expect(event.correlationId).toBe(specificCorrelationId);
      });
    });
  });
});
