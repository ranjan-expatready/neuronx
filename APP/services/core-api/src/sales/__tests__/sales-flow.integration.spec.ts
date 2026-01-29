
import { Test, TestingModule } from '@nestjs/testing';
import { SalesService } from '../sales.service';
import { LeadScorerService } from '../lead-scorer.service';
import { LeadRouterService } from '../lead-router.service';
import { ConfigService } from '../../config/config.service';
import { ConfigLoader } from '../../config/config.loader';
import { AuditService } from '../../audit/audit.service';
import { UsageService } from '../../usage/usage.service';
import { EventBus } from '@neuronx/eventing';
import { NeuronxEvent } from '@neuronx/contracts';
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('Sales Flow Integration (Real Chain)', () => {
  let salesService: SalesService;
  let eventBus: any;
  let prisma: any;

  // Mock Data
  const tenantId = 'tenant-integration';
  const correlationId = 'corr-integration';

  beforeEach(async () => {
    // 1. Mock External Boundaries
    const mockEventBus = {
      publish: vi.fn(),
      subscribe: vi.fn(),
    };

    const mockPrisma = {
      event: {
        findFirst: vi.fn().mockResolvedValue(null), // No duplicate
        create: vi.fn().mockResolvedValue({ id: 'evt-1' }),
      },
    };

    const mockConfigService = {
      getScoringConfig: vi.fn().mockResolvedValue({
        routingThreshold: 50,
        weights: {
          source: { paid: 80, organic: 30 },
        },
      }),
    };

    const mockConfigLoader = {
      loadConfig: vi.fn().mockResolvedValue({
        domains: {
          routing: {
            geographicPreferences: {
              'asia-pacific': ['team-india'],
              'north-america': ['team-usa'],
            },
          },
        },
      }),
    };

    const mockAuditService = {
      logEvent: vi.fn(),
    };

    const mockUsageService = {
      recordUsage: vi.fn(),
    };

    // 2. Construct Services Manually (Real Chain, Manual Wiring)
    // This avoids DI complexity and ensures we control the exact "Real" instances
    const leadScorer = new LeadScorerService(mockConfigService as any);
    const leadRouter = new LeadRouterService(mockConfigLoader as any, mockUsageService as any);
    
    salesService = new SalesService(
      mockEventBus as any,
      leadScorer,
      leadRouter,
      mockConfigService as any,
      mockAuditService as any
    );
    
    eventBus = mockEventBus;

    // Inject Mock Prisma (Private property hack for testing)
    (salesService as any).prisma = mockPrisma;
    prisma = mockPrisma;
  });

  it('should route a HIGH SCORE lead (Real Chain)', async () => {
    // Arrange: High score lead (Paid source = 80 > 50)
    const event: NeuronxEvent = {
      id: 'evt-high',
      tenantId,
      type: 'sales.lead.created',
      data: {
        externalId: 'lead-high',
        source: 'paid',
        country: 'IN',
      },
      metadata: { correlationId, idempotencyKey: 'key-high' },
    };

    // Act
    await salesService.handle(event);

    // Assert: Side Effects
    // 1. Qualified Event Emitted
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'sales.lead.qualified',
        data: expect.objectContaining({ score: 80 }),
      })
    );

    // 2. Routed Event Emitted (Correctly routed to India)
    expect(eventBus.publish).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'sales.lead.routed',
        data: expect.objectContaining({
          routedTo: 'team-india',
          country: 'IN',
        }),
      })
    );
  });

  it('should NOT route a LOW SCORE lead (Real Chain)', async () => {
    // Arrange: Low score lead (Organic source = 30 < 50)
    const event: NeuronxEvent = {
      id: 'evt-low',
      tenantId,
      type: 'sales.lead.created',
      data: {
        externalId: 'lead-low',
        source: 'organic',
        country: 'US',
      },
      metadata: { correlationId, idempotencyKey: 'key-low' },
    };

    // Act
    await salesService.handle(event);

    // Assert
    // 1. NO Qualified Event
    expect(eventBus.publish).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sales.lead.qualified' })
    );

    // 2. NO Routed Event
    expect(eventBus.publish).not.toHaveBeenCalledWith(
      expect.objectContaining({ type: 'sales.lead.routed' })
    );
  });

  it('should handle duplicates idempotently (Idempotency Test)', async () => {
    // Arrange: Event with same Idempotency Key
    const event: NeuronxEvent = {
      id: 'evt-dup',
      tenantId,
      type: 'sales.lead.created',
      data: { externalId: 'lead-dup', source: 'paid' },
      metadata: { correlationId, idempotencyKey: 'key-dup' },
    };

    // Mock Prisma to return EXISTING event on first check
    prisma.event.findFirst.mockResolvedValueOnce({ id: 'existing-evt' });

    // Act
    await salesService.handle(event);

    // Assert
    // 1. Should NOT create new event
    expect(prisma.event.create).not.toHaveBeenCalled();
    
    // 2. Should NOT trigger routing logic (short-circuit)
    expect(eventBus.publish).not.toHaveBeenCalled();
  });
});
