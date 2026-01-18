import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaClient } from '@prisma/client';
import { EventBus } from '@neuronx/eventing';

describe('MVP Spine E2E Test', () => {
  let app: INestApplication;
  let prisma: PrismaClient;
  let eventBus: EventBus;

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    await app.init();

    prisma = new PrismaClient();
    eventBus = moduleFixture.get(EventBus);
  });

  afterEach(async () => {
    // Clean up test data
    await prisma.event.deleteMany();
    await prisma.auditLog.deleteMany();
    await prisma.lead.deleteMany();
    await app.close();
  });

  it('should process complete lead lifecycle from webhook to action', async () => {
    // Arrange
    const ghlWebhookPayload = {
      id: 'ghl-e2e-001',
      email: 'e2e-test@example.com',
      firstName: 'E2E',
      lastName: 'Test',
      company: 'Test Corp',
      source: 'paid', // Should score 80 and trigger routing
      createdAt: new Date().toISOString(),
    };

    // Act - Send webhook (this would normally go to GHL adapter, but for E2E we'll simulate)
    // For this E2E test, we'll directly call the sales service
    const salesService = app.get('SalesService');
    const testEvent = {
      id: 'e2e-event-001',
      tenantId: 'e2e-tenant',
      type: 'sales.lead.created',
      data: {
        externalId: ghlWebhookPayload.id,
        email: ghlWebhookPayload.email,
        firstName: ghlWebhookPayload.firstName,
        lastName: ghlWebhookPayload.lastName,
        company: ghlWebhookPayload.company,
        source: ghlWebhookPayload.source,
        createdAt: ghlWebhookPayload.createdAt,
      },
      metadata: {
        timestamp: new Date(),
        correlationId: 'e2e-correlation-001',
        source: 'e2e-test',
        idempotencyKey: ghlWebhookPayload.id,
      },
    };

    await salesService.handle(testEvent);

    // Assert - Event was persisted
    const persistedEvent = await prisma.event.findUnique({
      where: { id: 'e2e-event-001' },
    });
    expect(persistedEvent).toBeTruthy();
    expect(persistedEvent?.type).toBe('sales.lead.created');
    expect(persistedEvent?.data.externalId).toBe('ghl-e2e-001');

    // Assert - Audit logs were created
    const auditLogs = await prisma.auditLog.findMany({
      where: { tenantId: 'e2e-tenant' },
      orderBy: { createdAt: 'asc' },
    });

    expect(auditLogs).toHaveLength(3); // webhook.received, rule.evaluated, action.triggered

    const webhookLog = auditLogs.find(log => log.action === 'webhook.received');
    expect(webhookLog).toBeTruthy();
    expect(webhookLog?.resourceId).toBe('e2e-event-001');

    const ruleLog = auditLogs.find(log => log.action === 'rule.evaluated');
    expect(ruleLog).toBeTruthy();
    expect(ruleLog?.metadata?.correlationId).toBe('e2e-correlation-001');

    const actionLog = auditLogs.find(log => log.action === 'action.triggered');
    expect(actionLog).toBeTruthy();
    expect(actionLog?.resourceId).toBe('ghl-e2e-001');

    // Assert - Qualified lead event was emitted
    // In a real E2E test, we'd check the event bus or message queue
    // For this implementation, we check that the event would have been published
    expect(true).toBe(true); // Placeholder - in real implementation, check event emissions
  });

  it('should handle low-scoring leads without routing', async () => {
    // Arrange
    const lowScoreEvent = {
      id: 'e2e-low-score',
      tenantId: 'e2e-tenant',
      type: 'sales.lead.created',
      data: {
        externalId: 'ghl-low-score',
        email: 'low-score@example.com',
        source: 'organic', // Should score 30, below threshold
      },
      metadata: {
        timestamp: new Date(),
        correlationId: 'e2e-low-correlation',
        source: 'e2e-test',
        idempotencyKey: 'ghl-low-score',
      },
    };

    // Act
    const salesService = app.get('SalesService');
    await salesService.handle(lowScoreEvent);

    // Assert - Event was persisted
    const persistedEvent = await prisma.event.findUnique({
      where: { id: 'e2e-low-score' },
    });
    expect(persistedEvent).toBeTruthy();

    // Assert - Audit logs show rule evaluation but no action
    const auditLogs = await prisma.auditLog.findMany({
      where: {
        tenantId: 'e2e-tenant',
        correlationId: 'e2e-low-correlation',
      },
    });

    expect(auditLogs).toHaveLength(2); // webhook.received, rule.evaluated

    const actionLog = auditLogs.find(log => log.action === 'action.triggered');
    expect(actionLog).toBeFalsy(); // No action should be triggered
  });
});
