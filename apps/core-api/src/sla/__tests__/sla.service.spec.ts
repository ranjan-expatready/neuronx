import { Test, TestingModule } from '@nestjs/testing';
import { SlaService } from '../sla.service';
import { ConfigService } from '../../config/config.service';
import { AuditService } from '../../audit/audit.service';
import { EventBus } from '@neuronx/eventing';

describe('SlaService', () => {
  let service: SlaService;
  let eventBus: jest.Mocked<EventBus>;
  let configService: jest.Mocked<ConfigService>;
  let auditService: jest.Mocked<AuditService>;

  beforeEach(async () => {
    const mockEventBus = {
      publish: jest.fn(),
      subscribe: jest.fn(),
    };

    const mockConfigService = {
      getSlaConfig: jest.fn().mockResolvedValue({
        followupWindowMinutes: 30,
        escalationEnabled: true,
      }),
    };

    const mockAuditService = {
      logEvent: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SlaService,
        {
          provide: EventBus,
          useValue: mockEventBus,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
        {
          provide: AuditService,
          useValue: mockAuditService,
        },
      ],
    }).compile();

    service = module.get<SlaService>(SlaService);
    eventBus = module.get(EventBus);
    configService = module.get(ConfigService);
    auditService = module.get(AuditService);
  });

  afterEach(() => {
    // Clean up any timers
    jest.clearAllTimers();
  });

  it('should start SLA timer on lead qualified event', async () => {
    // Arrange
    const qualifiedEvent = {
      id: 'event-qualified',
      tenantId: 'tenant-sla',
      type: 'sales.lead.qualified',
      data: { leadId: 'lead-123' },
      metadata: { correlationId: 'corr-123' },
    };

    // Mock timer
    jest.useFakeTimers();

    // Act
    await service.handle(qualifiedEvent as any);

    // Assert
    expect(configService.getSlaConfig).toHaveBeenCalledWith('tenant-sla');

    // Fast-forward time to trigger escalation
    jest.advanceTimersByTime(30 * 60 * 1000); // 30 minutes

    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        tenantId: 'tenant-sla',
        type: 'sales.lead.escalated',
        data: {
          leadId: 'lead-123',
          escalationReason: 'sla_breach',
        },
      })
    );

    expect(auditService.logEvent).toHaveBeenCalledWith('escalation.triggered', {
      leadId: 'lead-123',
      escalationReason: 'sla_breach',
      tenantId: 'tenant-sla',
      correlationId: 'corr-123',
    });
  });

  it('should cancel SLA timer on follow-up events', async () => {
    // Arrange
    const qualifiedEvent = {
      id: 'event-qualified',
      tenantId: 'tenant-sla',
      type: 'sales.lead.qualified',
      data: { leadId: 'lead-456' },
      metadata: { correlationId: 'corr-456' },
    };

    const followupEvent = {
      id: 'event-contacted',
      tenantId: 'tenant-sla',
      type: 'sales.lead.contacted',
      data: { leadId: 'lead-456' },
      metadata: { correlationId: 'corr-456' },
    };

    jest.useFakeTimers();

    // Act - Qualify lead
    await service.handle(qualifiedEvent as any);

    // Act - Follow up before SLA expires
    await service.handle(followupEvent as any);

    // Fast-forward time past SLA window
    jest.advanceTimersByTime(30 * 60 * 1000);

    // Assert - No escalation should occur
    expect(eventBus.publish).not.toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'sales.lead.escalated',
      })
    );
  });
});
