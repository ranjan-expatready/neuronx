/**
 * Global UAT Boundary Guard Tests - STOP-SHIP Hardening Patch
 *
 * Tests the global UAT boundary enforcement at the HTTP layer.
 * Ensures production safety and UAT tenant isolation.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { ExecutionContext, ForbiddenException } from '@nestjs/common';
import { GlobalUatBoundaryGuard } from '../global-uat-boundary.guard';
import { AuditService } from '../../audit/audit.service';

// Mock UAT config for testing
const mockUatConfig = {
  neuronxEnv: 'prod',
  uatTenantIds: [],
  uatMode: 'dry_run',
  uatKillSwitch: true,
  uatGhlLocationIds: [],
  uatLabelPrefix: '[UAT]',
  uatTestPhoneAllowlist: [],
  uatEmailDomainAllowlist: [],
  uatCalendarAllowlist: [],
};

// Mock the uat-harness module
jest.mock('@neuronx/uat-harness', () => ({
  getUatConfig: jest.fn(() => mockUatConfig),
  clearUatConfigCache: jest.fn(),
}));

import { getUatConfig, clearUatConfigCache } from '@neuronx/uat-harness';

describe('GlobalUatBoundaryGuard', () => {
  let guard: GlobalUatBoundaryGuard;
  let auditService: jest.Mocked<AuditService>;
  let mockExecutionContext: ExecutionContext;
  let mockRequest: any;

  beforeEach(async () => {
    // Clear UAT config cache between tests
    (clearUatConfigCache as jest.Mock).mockClear();

    // Mock audit service
    auditService = {
      logEvent: jest.fn().mockResolvedValue(undefined),
    } as any;

    // Create testing module
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GlobalUatBoundaryGuard,
        {
          provide: AuditService,
          useValue: auditService,
        },
      ],
    }).compile();

    guard = module.get<GlobalUatBoundaryGuard>(GlobalUatBoundaryGuard);

    // Mock request object
    mockRequest = {
      method: 'GET',
      url: '/api/health',
      headers: {},
      query: {},
      params: {},
      ip: '127.0.0.1',
      connection: { remoteAddress: '127.0.0.1' },
    };

    // Mock execution context
    mockExecutionContext = {
      switchToHttp: jest.fn().mockReturnValue({
        getRequest: jest.fn().mockReturnValue(mockRequest),
      }),
    } as any;
  });

  afterEach(() => {
    (clearUatConfigCache as jest.Mock).mockClear();
    (getUatConfig as jest.Mock).mockClear();
    jest.clearAllMocks();
  });

  describe('Production Environment', () => {
    beforeEach(() => {
      // Set mock config for production
      mockUatConfig.neuronxEnv = 'prod';
      mockUatConfig.uatTenantIds = [];
      mockUatConfig.uatMode = 'dry_run';
      mockUatConfig.uatKillSwitch = true;
    });

    it('should block requests with UAT path prefix', async () => {
      mockRequest.url = '/uat/status';

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        ForbiddenException
      );

      expect(auditService.logEvent).toHaveBeenCalledWith(
        'uat_boundary_blocked_prod',
        expect.objectContaining({
          reason: 'UAT signals detected in production environment',
          uatSignals: expect.arrayContaining(['path_starts_with_uat']),
          endpoint: 'GET /uat/status',
          environment: 'prod',
        }),
        'uat-boundary-guard',
        'unknown'
      );
    });

    it('should block requests with UAT headers', async () => {
      mockRequest.headers['x-uat-mode'] = 'dry_run';

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        ForbiddenException
      );

      expect(auditService.logEvent).toHaveBeenCalledWith(
        'uat_boundary_blocked_prod',
        expect.objectContaining({
          reason: 'UAT signals detected in production environment',
          uatSignals: expect.arrayContaining(['headers: x-uat-mode']),
        }),
        'uat-boundary-guard',
        'unknown'
      );
    });

    it('should block requests with UAT query parameters', async () => {
      mockRequest.query.dry_run = 'true';

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        ForbiddenException
      );

      expect(auditService.logEvent).toHaveBeenCalledWith(
        'uat_boundary_blocked_prod',
        expect.objectContaining({
          reason: 'UAT signals detected in production environment',
          uatSignals: expect.arrayContaining(['query: dry_run']),
        }),
        'uat-boundary-guard',
        'unknown'
      );
    });

    it('should allow normal requests without UAT signals', async () => {
      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(auditService.logEvent).not.toHaveBeenCalled();
    });

    it('should generate correlation ID if not provided', async () => {
      mockRequest.headers['x-uat-mode'] = 'dry_run';

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        ForbiddenException
      );

      const auditCall = auditService.logEvent.mock.calls[0][1];
      expect(auditCall.correlationId).toMatch(/^uat_boundary_\d+_[a-z0-9]+$/);
    });
  });

  describe('UAT Environment', () => {
    beforeEach(() => {
      // Set mock config for UAT
      mockUatConfig.neuronxEnv = 'uat';
      mockUatConfig.uatTenantIds = ['test-tenant-001', 'test-tenant-002'];
      mockUatConfig.uatMode = 'dry_run';
      mockUatConfig.uatKillSwitch = true;
    });

    it('should block requests without tenant ID', async () => {
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        ForbiddenException
      );

      expect(auditService.logEvent).toHaveBeenCalledWith(
        'uat_boundary_blocked_not_allowlisted',
        expect.objectContaining({
          reason: 'Tenant not in UAT allowlist',
          tenantId: null,
          allowedTenants: ['test-tenant-001', 'test-tenant-002'],
        }),
        'uat-boundary-guard',
        'unknown'
      );
    });

    it('should block requests with non-allowlisted tenant', async () => {
      mockRequest.headers['x-tenant-id'] = 'unauthorized-tenant';

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        ForbiddenException
      );

      expect(auditService.logEvent).toHaveBeenCalledWith(
        'uat_boundary_blocked_not_allowlisted',
        expect.objectContaining({
          tenantId: 'unauthorized-tenant',
          allowedTenants: ['test-tenant-001', 'test-tenant-002'],
        }),
        'uat-boundary-guard',
        'unauthorized-tenant'
      );
    });

    it('should allow allowlisted tenant in dry_run mode', async () => {
      mockRequest.headers['x-tenant-id'] = 'test-tenant-001';

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(auditService.logEvent).toHaveBeenCalledWith(
        'uat_boundary_allowed',
        expect.objectContaining({
          mode: 'dry_run',
          tenantId: 'test-tenant-001',
        }),
        'uat-boundary-guard',
        'test-tenant-001'
      );
    });

    it('should extract tenant ID from various sources', async () => {
      // Test header extraction
      mockRequest.headers['x-tenant-id'] = 'test-tenant-001';
      await guard.canActivate(mockExecutionContext);
      expect(auditService.logEvent).toHaveBeenCalledWith(
        'uat_boundary_allowed',
        expect.objectContaining({ tenantId: 'test-tenant-001' }),
        'uat-boundary-guard',
        'test-tenant-001'
      );

      // Reset mocks
      auditService.logEvent.mockClear();

      // Test query param extraction
      mockRequest.headers = {};
      mockRequest.query.tenantId = 'test-tenant-002';
      await guard.canActivate(mockExecutionContext);
      expect(auditService.logEvent).toHaveBeenCalledWith(
        'uat_boundary_allowed',
        expect.objectContaining({ tenantId: 'test-tenant-002' }),
        'uat-boundary-guard',
        'test-tenant-002'
      );
    });

    it('should extract correlation ID from headers', async () => {
      mockRequest.headers['x-tenant-id'] = 'test-tenant-001';
      mockRequest.headers['x-correlation-id'] = 'test-correlation-123';

      await guard.canActivate(mockExecutionContext);

      expect(auditService.logEvent).toHaveBeenCalledWith(
        'uat_boundary_allowed',
        expect.objectContaining({
          correlationId: 'test-correlation-123',
        }),
        'uat-boundary-guard',
        'test-tenant-001'
      );
    });
  });

  describe('LIVE_UAT Mode Enforcement', () => {
    beforeEach(() => {
      // Base UAT config for this test suite
      mockUatConfig.neuronxEnv = 'uat';
      mockUatConfig.uatTenantIds = ['test-tenant-001'];
      mockUatConfig.uatKillSwitch = true;
    });

    it('should block live_uat requests when config is dry_run', async () => {
      mockUatConfig.uatMode = 'dry_run'; // Config is dry_run

      mockRequest.headers['x-tenant-id'] = 'test-tenant-001';
      mockRequest.headers['x-uat-mode'] = 'live_uat'; // Request wants live_uat

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        ForbiddenException
      );

      expect(auditService.logEvent).toHaveBeenCalledWith(
        'uat_boundary_blocked_live_not_enabled',
        expect.objectContaining({
          reason: 'LIVE_UAT mode requested but not enabled in configuration',
          requestedMode: 'live_uat',
          configMode: 'dry_run',
        }),
        'uat-boundary-guard',
        'test-tenant-001'
      );
    });

    it('should allow live_uat requests when config allows it', async () => {
      mockUatConfig.uatMode = 'live_uat'; // Config allows live_uat

      mockRequest.headers['x-tenant-id'] = 'test-tenant-001';
      mockRequest.headers['x-uat-mode'] = 'live_uat';

      const result = await guard.canActivate(mockExecutionContext);

      expect(result).toBe(true);
      expect(auditService.logEvent).toHaveBeenCalledWith(
        'uat_boundary_allowed',
        expect.objectContaining({
          mode: 'live_uat',
          tenantId: 'test-tenant-001',
        }),
        'uat-boundary-guard',
        'test-tenant-001'
      );
    });
  });

  describe('UAT Signal Detection', () => {
    beforeEach(() => {
      process.env.NEURONX_ENV = 'prod';
    });

    it('should detect path-based UAT signals', async () => {
      mockRequest.url = '/uat/health';

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow();

      const auditCall = auditService.logEvent.mock.calls[0][1];
      expect(auditCall.uatSignals).toContain('path_starts_with_uat');
    });

    it('should detect header-based UAT signals', async () => {
      mockRequest.headers['x-uat-tenant'] = 'test';
      mockRequest.headers['x-uat-mode'] = 'dry_run';

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow();

      const auditCall = auditService.logEvent.mock.calls[0][1];
      expect(auditCall.uatSignals).toContain(
        'headers: x-uat-tenant, x-uat-mode'
      );
    });

    it('should detect query-based UAT signals', async () => {
      mockRequest.query.uatMode = 'dry_run';
      mockRequest.query.live_uat = 'true';

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow();

      const auditCall = auditService.logEvent.mock.calls[0][1];
      expect(auditCall.uatSignals).toContain('query: uatMode, live_uat');
    });

    it('should handle multiple signal types', async () => {
      mockRequest.url = '/uat/status';
      mockRequest.headers['x-uat-mode'] = 'dry_run';
      mockRequest.query.dry_run = 'true';

      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow();

      const auditCall = auditService.logEvent.mock.calls[0][1];
      expect(auditCall.uatSignals).toContain('path_starts_with_uat');
      expect(auditCall.uatSignals).toContain('headers: x-uat-mode');
      expect(auditCall.uatSignals).toContain('query: dry_run');
    });
  });

  describe('Error Handling', () => {
    it('should handle audit service failures gracefully', async () => {
      mockUatConfig.neuronxEnv = 'prod';
      mockUatConfig.uatTenantIds = [];

      mockRequest.url = '/uat/status';

      // Mock audit service to throw
      auditService.logEvent.mockRejectedValue(new Error('Audit failure'));

      // Should still block the request despite audit failure
      await expect(guard.canActivate(mockExecutionContext)).rejects.toThrow(
        ForbiddenException
      );

      // Audit was still called
      expect(auditService.logEvent).toHaveBeenCalled();
    });
  });
});
