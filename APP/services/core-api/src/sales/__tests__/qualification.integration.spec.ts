import { Test, TestingModule } from '@nestjs/testing';
import { QualificationHandler } from '../qualification.handler';
import { QualificationService } from '../qualification.service';
import { OpportunityService } from '../opportunity.service';
import { EventBus } from '../../eventing';
import { NeuronxEvent } from '../../../packages/contracts';

// Mock services
const mockQualificationService = {
  qualifyLead: jest.fn(),
};

const mockOpportunityService = {
  createOpportunityFromLead: jest.fn(),
};

const mockEventBus = {
  publish: jest.fn(),
};

describe('QualificationHandler', () => {
  let handler: QualificationHandler;
  let qualificationService: QualificationService;
  let opportunityService: OpportunityService;
  let eventBus: EventBus;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QualificationHandler,
        { provide: QualificationService, useValue: mockQualificationService },
        { provide: OpportunityService, useValue: mockOpportunityService },
        { provide: EventBus, useValue: mockEventBus },
      ],
    }).compile();

    handler = module.get<QualificationHandler>(QualificationHandler);
    qualificationService =
      module.get<QualificationService>(QualificationService);
    opportunityService = module.get<OpportunityService>(OpportunityService);
    eventBus = module.get<EventBus>(EventBus);

    // Reset mocks
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(handler).toBeDefined();
  });

  describe('handle', () => {
    it('should handle sales.lead.scored event and create opportunity for qualified lead', async () => {
      const event: NeuronxEvent = {
        id: 'event-123',
        tenantId: 'tenant-123',
        type: 'sales.lead.scored',
        correlationId: 'correlation-456',
        timestamp: new Date(),
        payload: {
          leadId: 'lead-789',
          score: 85,
          leadData: {
            email: 'john@example.com',
            companyName: 'Tech Corp',
          },
        },
      };

      // Mock qualification service to return qualified
      mockQualificationService.qualifyLead.mockResolvedValue({
        qualified: true,
        score: 85,
        reasons: ['Meets all criteria'],
        threshold: 70,
      });

      // Mock opportunity service to return success
      mockOpportunityService.createOpportunityFromLead.mockResolvedValue({
        success: true,
        opportunityId: 'opp-123',
      });

      await handler.handle(event);

      // Verify qualification was called
      expect(mockQualificationService.qualifyLead).toHaveBeenCalledWith(
        'tenant-123',
        'lead-789',
        expect.objectContaining({
          email: 'john@example.com',
          score: 85,
        }),
        'correlation-456'
      );

      // Verify opportunity creation was called
      expect(
        mockOpportunityService.createOpportunityFromLead
      ).toHaveBeenCalledWith(
        'tenant-123',
        'location-123',
        expect.objectContaining({
          leadId: 'lead-789',
          contactEmail: 'john@example.com',
          score: 85,
        }),
        'correlation-456'
      );

      // Verify events were published
      expect(mockEventBus.publish).toHaveBeenCalledTimes(2); // qualification + opportunity created
    });

    it('should handle sales.lead.scored event and skip opportunity creation for unqualified lead', async () => {
      const event: NeuronxEvent = {
        id: 'event-123',
        tenantId: 'tenant-123',
        type: 'sales.lead.scored',
        correlationId: 'correlation-456',
        timestamp: new Date(),
        payload: {
          leadId: 'lead-789',
          score: 45,
          leadData: {
            email: 'john@example.com',
          },
        },
      };

      // Mock qualification service to return not qualified
      mockQualificationService.qualifyLead.mockResolvedValue({
        qualified: false,
        score: 45,
        reasons: ['Below threshold'],
        threshold: 70,
      });

      await handler.handle(event);

      // Verify qualification was called
      expect(mockQualificationService.qualifyLead).toHaveBeenCalled();

      // Verify opportunity creation was NOT called
      expect(
        mockOpportunityService.createOpportunityFromLead
      ).not.toHaveBeenCalled();

      // Verify only qualification event was published
      expect(mockEventBus.publish).toHaveBeenCalledTimes(1);
      expect(mockEventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'sales.lead.qualified',
        })
      );
    });

    it('should handle errors gracefully', async () => {
      const event: NeuronxEvent = {
        id: 'event-123',
        tenantId: 'tenant-123',
        type: 'sales.lead.scored',
        correlationId: 'correlation-456',
        timestamp: new Date(),
        payload: {
          leadId: 'lead-789',
          score: 85,
        },
      };

      // Mock qualification service to throw error
      mockQualificationService.qualifyLead.mockRejectedValue(
        new Error('Database connection failed')
      );

      // Should not throw
      await expect(handler.handle(event)).resolves.not.toThrow();

      // Verify opportunity creation was not called due to error
      expect(
        mockOpportunityService.createOpportunityFromLead
      ).not.toHaveBeenCalled();
    });
  });
});
