import { Test, TestingModule } from '@nestjs/testing';
import { SalesService } from '../sales.service';
import { LeadScorerService } from '../lead-scorer.service';
import { LeadRouterService } from '../lead-router.service';
import { ConfigService } from '../../config/config.service';
import { AuditService } from '../../audit/audit.service';
import { EventBus } from '@neuronx/eventing';
import { PrismaClient } from '@prisma/client';
import { NeuronxEvent } from '@neuronx/contracts';

describe('LeadRouterService Integration Tests', () => {
  let salesService: SalesService;
  let prisma: PrismaClient;
  let eventBus: jest.Mocked<EventBus>;

  beforeEach(async () => {
    prisma = new PrismaClient();

    const mockEventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    };

    const mockConfigService = {
      getScoringConfig: jest.fn().mockResolvedValue({
        routingThreshold: 70,
        weights: { source: { paid: 80, organic: 30 } },
      }),
      getRoutingConfig: jest.fn().mockResolvedValue({
        countryMapping: {
          IN: 'india-team',
          default: 'global-team',
        },
      }),
    };

    const mockAuditService = {
      logEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SalesService,
        LeadScorerService,
        LeadRouterService,
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
        {
          provide: EventBus,
          useValue: mockEventBus,
        },
      ],
    }).compile();

    salesService = module.get<SalesService>(SalesService);
    eventBus = module.get(EventBus);
  });

  afterEach(async () => {
    await prisma.event.deleteMany();
    await prisma.auditLog.deleteMany();
  });

  it('should emit routed event for India leads', async () => {
    // Arrange
    const indiaLeadEvent: NeuronxEvent = {
      id: 'event-india-route',
      tenantId: 'tenant-routing',
      type: 'sales.lead.created',
      data: {
        externalId: 'ghl-india',
        email: 'india@example.com',
        country: 'IN', // Should route to india-team
      },
      metadata: {
        timestamp: new Date(),
        correlationId: 'corr-india-route',
        source: 'test',
        idempotencyKey: 'ghl-india',
      },
    };

    // Act
    await salesService.handle(indiaLeadEvent);

    // Assert
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-routing',
        type: 'sales.lead.routed',
        data: {
          leadId: 'ghl-india',
          routedTo: 'india-team',
          routingReason: 'country_india',
          country: 'IN',
        },
        metadata: expect.objectContaining({
          correlationId: 'corr-india-route',
          causationId: 'event-india-route',
        }),
      })
    );
  });

  it('should emit routed event for non-India leads', async () => {
    // Arrange
    const globalLeadEvent: NeuronxEvent = {
      id: 'event-global-route',
      tenantId: 'tenant-routing',
      type: 'sales.lead.created',
      data: {
        externalId: 'ghl-global',
        email: 'global@example.com',
        country: 'US', // Should route to global-team
      },
      metadata: {
        timestamp: new Date(),
        correlationId: 'corr-global-route',
        source: 'test',
        idempotencyKey: 'ghl-global',
      },
    };

    // Act
    await salesService.handle(globalLeadEvent);

    // Assert
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-routing',
        type: 'sales.lead.routed',
        data: {
          leadId: 'ghl-global',
          routedTo: 'global-team',
          routingReason: 'country_default',
          country: 'US',
        },
        metadata: expect.objectContaining({
          correlationId: 'corr-global-route',
          causationId: 'event-global-route',
        }),
      })
    );
  });
});
