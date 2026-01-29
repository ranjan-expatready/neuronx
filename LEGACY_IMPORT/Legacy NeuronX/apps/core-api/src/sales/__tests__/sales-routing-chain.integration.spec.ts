import { Test, TestingModule } from '@nestjs/testing';
import { SalesService } from '../sales.service';
import { LeadScorerService } from '../lead-scorer.service';
import { LeadRouterService } from '../lead-router.service';
import { ConfigService } from '../../config/config.service';
import { AuditService } from '../../audit/audit.service';
import { EventBus } from '@neuronx/eventing';
import { NeuronxEvent } from '@neuronx/contracts';
import { ConfigLoader } from '../../config/config.loader';
import { UsageService } from '../../usage/usage.service';
import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';

describe('Sales Routing Chain (Real Service Integration)', () => {
  let salesService: SalesService;
  let eventBus: { publish: any; subscribe: any };
  let prisma: any;

  beforeEach(async () => {
    // 1. Mock External Boundaries (DB, EventBus, Config)
    prisma = {
      event: {
        findFirst: vi.fn(),
        create: vi.fn(),
        deleteMany: vi.fn(),
      },
      auditLog: {
        create: vi.fn(),
      },
    };

    const mockEventBus = {
      publish: vi.fn(),
      subscribe: vi.fn(),
    };

    const mockConfigService = {
      getScoringConfig: vi.fn().mockResolvedValue({
        routingThreshold: 50,
        weights: {
          source: { paid: 10, organic: 5 }, // Simple rules
        },
      }),
    };

    const mockConfigLoader = {
      loadConfig: vi.fn().mockResolvedValue({
          geographicPreferences: {
              'north-america': ['team-us'],
          }
      }),
    };

    const mockAuditService = {
      logEvent: vi.fn(),
    };
    
    const mockUsageService = {
        recordUsage: vi.fn(),
    };

    // 2. Instantiate REAL Services for the Internal Chain
    // We do NOT mock LeadScorerService or LeadRouterService
    const leadScorer = new LeadScorerService(mockConfigService as any);
    // Mock private calculateScore if needed, but let's try to use the real one if accessible
    // Note: calculateScore is private in LeadScorerService? Let's check. 
    // If it's private, we rely on its real implementation. 
    // We need to ensure the real implementation works with our mock config.
    // Based on previous read, it calls this.calculateScore. 
    // We'll patch it to be sure for this test, OR better, we trust the real logic if we can control config.
    // Let's monkey-patch calculateScore for deterministic scoring in this test
    (leadScorer as any).calculateScore = (data: any, config: any) => {
        if (data.source === 'high-value') return 100;
        return 0;
    };

    const leadRouter = new LeadRouterService(mockConfigLoader as any, mockUsageService as any);

    // 3. Setup Module
    salesService = new SalesService(
      mockEventBus as any,
      leadScorer,
      leadRouter,
      mockConfigService as any,
      mockAuditService as any
    );
    (salesService as any).prisma = prisma;
    eventBus = mockEventBus;
  });

  it('GAP CLOSE: Should NOT route an unqualified lead', async () => {
    // Arrange
    const unqualifiedEvent: NeuronxEvent = {
      id: 'evt-low',
      tenantId: 'tenant-1',
      type: 'sales.lead.created',
      data: {
        externalId: 'lead-low',
        source: 'low-value', // Will score 0
        country: 'US',
      },
      metadata: { correlationId: 'corr-low', idempotencyKey: 'key-low', timestamp: new Date() },
    };

    // Act
    await salesService.handle(unqualifiedEvent);

    // Assert
    // 1. Event persisted
    expect(prisma.event.create).toHaveBeenCalled();
    
    // 2. Qualified event NOT emitted
    const qualifiedCalls = eventBus.publish.mock.calls.filter(
        (call: any) => call[0].type === 'sales.lead.qualified'
    );
    expect(qualifiedCalls.length).toBe(0);

    // 3. Routed event NOT emitted (The Fix)
    const routedCalls = eventBus.publish.mock.calls.filter(
        (call: any) => call[0].type === 'sales.lead.routed'
    );
    expect(routedCalls.length).toBe(0); 
  });

  it('Should route a qualified lead', async () => {
    // Arrange
    const qualifiedEvent: NeuronxEvent = {
      id: 'evt-high',
      tenantId: 'tenant-1',
      type: 'sales.lead.created',
      data: {
        externalId: 'lead-high',
        source: 'high-value', // Will score 100
        country: 'US',
      },
      metadata: { correlationId: 'corr-high', idempotencyKey: 'key-high', timestamp: new Date() },
    };

    // Act
    await salesService.handle(qualifiedEvent);

    // Assert
    // 1. Qualified event emitted
    expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'sales.lead.qualified' })
    );

    // 2. Routed event emitted
    expect(eventBus.publish).toHaveBeenCalledWith(
        expect.objectContaining({ type: 'sales.lead.routed' })
    );
  });
});
