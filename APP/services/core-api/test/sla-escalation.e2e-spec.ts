import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication } from '@nestjs/common';
import { AppModule } from '../src/app.module';
import { PrismaClient } from '@prisma/client';
import { EventBus } from '@neuronx/eventing';

describe('SLA Escalation E2E Test', () => {
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
    await prisma.slaTimer.deleteMany();
    await app.close();
  });

  it('should escalate lead after SLA breach', async () => {
    // Arrange - Mock event bus to capture escalation events
    const publishedEvents: any[] = [];
    const originalPublish = eventBus.publish;
    eventBus.publish = async (event: any) => {
      publishedEvents.push(event);
      return originalPublish.call(eventBus, event);
    };

    // Act - Simulate lead qualification (this would normally come from sales service)
    const slaService = app.get('SlaService');
    const qualifiedEvent = {
      id: 'e2e-qualified-event',
      tenantId: 'e2e-tenant',
      type: 'sales.lead.qualified',
      data: { leadId: 'e2e-lead-sla' },
      metadata: {
        timestamp: new Date(),
        correlationId: 'e2e-sla-correlation',
        source: 'e2e-test',
      },
    };

    await slaService.handle(qualifiedEvent);

    // Verify SLA timer was created
    const slaTimer = await prisma.slaTimer.findFirst({
      where: { leadId: 'e2e-lead-sla' },
    });
    expect(slaTimer).toBeTruthy();
    expect(slaTimer?.status).toBe('active');

    // Simulate SLA breach by directly triggering escalation
    // (In real scenario, this would happen via timer)
    await slaService['escalateLead'](
      'e2e-lead-sla',
      'e2e-tenant',
      'e2e-sla-correlation'
    );

    // Assert - Escalation event was published
    const escalationEvent = publishedEvents.find(
      e => e.type === 'sales.lead.escalated'
    );
    expect(escalationEvent).toBeTruthy();
    expect(escalationEvent.data.leadId).toBe('e2e-lead-sla');
    expect(escalationEvent.data.escalationReason).toBe('sla_breach');

    // Assert - SLA timer was updated
    const updatedTimer = await prisma.slaTimer.findFirst({
      where: { leadId: 'e2e-lead-sla' },
    });
    expect(updatedTimer?.status).toBe('escalated');
    expect(updatedTimer?.escalatedAt).toBeTruthy();

    // Assert - Audit log was created
    const auditLogs = await prisma.auditLog.findMany({
      where: { tenantId: 'e2e-tenant' },
    });
    const escalationAudit = auditLogs.find(
      log => log.action === 'escalation.triggered'
    );
    expect(escalationAudit).toBeTruthy();
  });

  it('should cancel SLA timer on follow-up', async () => {
    // Arrange
    const slaService = app.get('SlaService');

    // Act - Qualify lead
    const qualifiedEvent = {
      id: 'e2e-qualified-event-2',
      tenantId: 'e2e-tenant',
      type: 'sales.lead.qualified',
      data: { leadId: 'e2e-lead-cancel' },
      metadata: {
        timestamp: new Date(),
        correlationId: 'e2e-cancel-correlation',
        source: 'e2e-test',
      },
    };
    await slaService.handle(qualifiedEvent);

    // Act - Follow up (contacted)
    const followupEvent = {
      id: 'e2e-contacted-event',
      tenantId: 'e2e-tenant',
      type: 'sales.lead.contacted',
      data: { leadId: 'e2e-lead-cancel' },
      metadata: {
        timestamp: new Date(),
        correlationId: 'e2e-cancel-correlation',
        source: 'e2e-test',
      },
    };
    await slaService.handle(followupEvent);

    // Assert - SLA timer was cancelled
    const slaTimer = await prisma.slaTimer.findFirst({
      where: { leadId: 'e2e-lead-cancel' },
    });
    expect(slaTimer?.status).toBe('cancelled');
    expect(slaTimer?.cancellationReason).toBe('sales.lead.contacted');
  });
});
