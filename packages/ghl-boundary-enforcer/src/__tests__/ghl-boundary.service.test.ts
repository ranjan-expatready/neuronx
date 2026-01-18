import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GhlBoundaryService } from '../ghl-boundary.service';
import { ViolationSeverity } from '../ghl-violation.types';

// Mock Prisma client
const mockPrismaClient = {
  ghlViolation: {
    createManyAndReturn: vi.fn(),
    findMany: vi.fn(),
    count: vi.fn(),
  },
};

describe('GhlBoundaryService', () => {
  let service: GhlBoundaryService;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();

    // Create service with mocked Prisma
    service = new GhlBoundaryService(mockPrismaClient);
  });

  describe('analyzeSnapshot', () => {
    it('should analyze snapshot and store violations', async () => {
      const tenantId = 'tenant-123';
      const snapshotId = 'snapshot-456';
      const snapshotData = {
        workflows: [
          {
            id: 'workflow-1',
            conditions: [{ field: 'score', operator: '>', value: 80 }],
            actions: [{ type: 'qualify_lead' }], // Denied action
          },
        ],
        pipelines: [],
        aiWorkers: [],
        webhooks: [],
        calendars: [],
      };

      // Mock successful storage
      mockPrismaClient.ghlViolation.createManyAndReturn.mockResolvedValue([]);

      const result = await service.analyzeSnapshot(
        tenantId,
        snapshotId,
        snapshotData
      );

      expect(result.tenantId).toBe(tenantId);
      expect(result.snapshotId).toBe(snapshotId);
      expect(result.violations.length).toBeGreaterThan(0);

      // Should have stored violations
      expect(
        mockPrismaClient.ghlViolation.createManyAndReturn
      ).toHaveBeenCalledWith({
        data: expect.any(Array),
        skipDuplicates: true,
      });
    });

    it('should handle analysis errors gracefully', async () => {
      const tenantId = 'tenant-123';
      const snapshotId = 'snapshot-456';
      const invalidSnapshotData = null; // This should cause an analysis error

      const result = await service.analyzeSnapshot(
        tenantId,
        snapshotId,
        invalidSnapshotData
      );

      expect(result.tenantId).toBe(tenantId);
      expect(result.snapshotId).toBe(snapshotId);
      // Should still return a result, but with violations for the error
      expect(result.violations.length).toBeGreaterThan(0);
    });
  });

  describe('shouldBlockTenant', () => {
    it('should return false when enforcement mode is monitor_only', async () => {
      mockPrismaClient.ghlViolation.count.mockResolvedValue(10); // Many violations

      const shouldBlock = await service.shouldBlockTenant('tenant-123');

      expect(shouldBlock).toBe(false);
      // Should not even check for violations when in monitor mode
    });

    it('should return true when in block mode with HIGH violations', async () => {
      // Mock the service to be in block mode by checking policy resolver
      const policyResolver = service.getPolicyResolver();
      vi.spyOn(policyResolver, 'shouldBlockOperations').mockReturnValue(true);

      mockPrismaClient.ghlViolation.count.mockResolvedValue(1); // Has blocking violations

      const shouldBlock = await service.shouldBlockTenant('tenant-123');

      expect(shouldBlock).toBe(true);
      expect(mockPrismaClient.ghlViolation.count).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-123',
          severity: { in: ['HIGH', 'CRITICAL'] },
        },
      });
    });
  });

  describe('getTenantBoundaryStatus', () => {
    it('should return complete tenant status', async () => {
      // Mock policy resolver
      const policyResolver = service.getPolicyResolver();
      vi.spyOn(policyResolver, 'getEnforcementMode').mockReturnValue('block');

      // Mock violation store
      const violationStore = service.getViolationStore();
      vi.spyOn(violationStore, 'hasBlockingViolations').mockResolvedValue(true);
      vi.spyOn(violationStore, 'getViolationSummary').mockResolvedValue({
        totalViolations: 5,
        violationsBySeverity: { HIGH: 2, CRITICAL: 1 },
        violationsByType: {},
        violationsByEntityType: {},
        mostRecentViolation: new Date(),
      });

      const status = await service.getTenantBoundaryStatus('tenant-123');

      expect(status.enforcementMode).toBe('block');
      expect(status.hasBlockingViolations).toBe(true);
      expect(status.shouldBlockTenant).toBe(true);
      expect(status.violationSummary.totalViolations).toBe(5);
    });
  });

  describe('getTenantViolations', () => {
    it('should query violations with filters', async () => {
      const mockViolations = [
        { id: '1', violationType: 'LOGIC_IN_WORKFLOW', severity: 'HIGH' },
      ];

      mockPrismaClient.ghlViolation.findMany.mockResolvedValue(mockViolations);

      const violations = await service.getTenantViolations('tenant-123', {
        limit: 10,
        severity: [ViolationSeverity.HIGH],
      });

      expect(mockPrismaClient.ghlViolation.findMany).toHaveBeenCalledWith({
        where: {
          tenantId: 'tenant-123',
          severity: { in: [ViolationSeverity.HIGH] },
        },
        orderBy: { createdAt: 'desc' },
        take: 10,
        skip: 0,
      });

      expect(violations).toEqual(mockViolations);
    });
  });

  describe('validatePolicy', () => {
    it('should validate policy configuration', () => {
      const validPolicy = {
        enforcementMode: 'monitor_only',
        businessLogicRules: [],
        allowedWorkflowActions: [],
        deniedWorkflowActions: [],
        allowedPipelineMutations: [],
        deniedPipelineMutations: [],
        allowedAiWorkerCapabilities: [],
        deniedAiWorkerCapabilities: [],
        thresholds: {
          maxActionsPerWorkflow: 10,
          maxConditionDepth: 2,
          maxBranchCount: 5,
          maxTriggerCount: 10,
        },
        requireNeuronxTokenHeaderOnWebhookCalls: false,
        riskClassificationRules: {},
        severityLevels: {
          LOW: { description: 'Low', blocksTenant: false },
          MEDIUM: { description: 'Medium', blocksTenant: false },
          HIGH: { description: 'High', blocksTenant: true },
          CRITICAL: { description: 'Critical', blocksTenant: true },
        },
        violationCategories: {},
      };

      const isValid = service.validatePolicy(validPolicy);
      expect(isValid).toBe(true);
    });

    it('should reject invalid policy', () => {
      const invalidPolicy = {
        enforcementMode: 'invalid_mode', // Invalid
      };

      const isValid = service.validatePolicy(invalidPolicy);
      expect(isValid).toBe(false);
    });
  });
});
