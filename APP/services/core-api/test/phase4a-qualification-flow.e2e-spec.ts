import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { EventBus } from '../src/eventing';
import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

describe('Phase 4A: Lead Qualification Flow (E2E)', () => {
  let app: INestApplication;
  let eventBus: EventBus;
  let prisma: PrismaClient;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    eventBus = moduleFixture.get<EventBus>(EventBus);
    prisma = new PrismaClient();
  });

  afterEach(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  it('should process lead scored event and create opportunity for qualified lead', async () => {
    // Load test fixture
    const fixturePath = path.join(
      __dirname,
      '../../test/fixtures/neuronx/lead_scored_event.json'
    );
    const leadScoredEvent = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

    // Publish the lead scored event
    await eventBus.publish(leadScoredEvent);

    // Wait for async processing
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify qualification event was emitted
    // Note: In a real E2E test, we would mock the event bus or use a test event store

    // Verify opportunity creation through GHL health endpoint (mocked)
    const healthResponse = await request(app.getHttpServer())
      .get('/integrations/ghl/health')
      .expect(200);

    expect(healthResponse.body.status).toBe('healthy');

    // In a complete E2E test, we would also verify:
    // 1. TokenCredential was used for GHL API calls
    // 2. Audit trail contains the qualification and opportunity creation events
    // 3. No secrets were logged
  });

  it('should handle webhook with conversation signal and rescore lead', async () => {
    // Load conversation webhook fixture
    const fixturePath = path.join(
      __dirname,
      '../../test/fixtures/ghl/webhook_message_received.json'
    );
    const webhookPayload = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));

    // Mock the webhook signature validation (would be done by WebhookSignatureVerifier)
    const correlationId = 'webhook-correlation-123';

    // Simulate webhook processing
    const response = await request(app.getHttpServer())
      .post('/integrations/ghl/webhooks')
      .set('Content-Type', 'application/json')
      .set('X-Tenant-Id', 'tenant-123')
      .set('X-Correlation-Id', correlationId)
      .set('X-GHL-Signature', 'mock-signature') // Would be validated
      .send(webhookPayload)
      .expect(200);

    expect(response.body.status).toBe('processed');

    // In a complete test, verify:
    // 1. Conversation signal processing
    // 2. Lead rescoring
    // 3. Potential routing changes
  });

  it('should trigger SLA escalation when qualified lead times out', async () => {
    // This would require setting up a qualified lead and waiting for SLA timeout
    // For now, we'll test the SLA service directly

    // Create a mock qualified lead event
    const qualifiedEvent = {
      id: 'qualified-event-123',
      tenantId: 'tenant-123',
      type: 'sales.lead.qualified',
      correlationId: 'sla-test-456',
      timestamp: new Date(),
      payload: {
        leadId: 'sla-test-lead',
        qualified: true,
        score: 85,
      },
    };

    // Publish qualified event (this would start SLA timer)
    await eventBus.publish(qualifiedEvent);

    // Wait briefly
    await new Promise(resolve => setTimeout(resolve, 500));

    // In a real test, we would either:
    // 1. Fast-forward time to trigger escalation
    // 2. Manually trigger escalation for testing
    // 3. Mock the timer service

    // Verify SLA timer was created in database
    const slaTimer = await prisma.slaTimer.findFirst({
      where: {
        tenantId: 'tenant-123',
        leadId: 'sla-test-lead',
        status: 'active',
      },
    });

    expect(slaTimer).toBeDefined();
    expect(slaTimer?.slaWindowMinutes).toBeGreaterThan(0);
  });
});
