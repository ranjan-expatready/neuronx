import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LeadRouterService } from '../lead-router.service';

describe('LeadRouterService', () => {
  let service: LeadRouterService;
  let mockConfigLoader: any;
  let mockUsageService: any;

  beforeEach(() => {
    mockConfigLoader = {
      loadConfig: vi.fn(),
    };
    mockUsageService = {
      recordUsage: vi.fn(),
    };
    service = new LeadRouterService(mockConfigLoader, mockUsageService);
  });

  describe('evaluateRoutingRules (indirectly via routeLead)', () => {
    it('should route US leads to north-america team', async () => {
      mockConfigLoader.loadConfig.mockResolvedValue(null); // Force default config

      const event: any = {
        tenantId: 'tenant_1',
        data: { country: 'US', leadId: 'lead_1' },
        id: 'evt_1',
      };

      const result = await service.routeLead(event);

      expect(result?.routedTo).toBe('team-enterprise');
      expect(result?.routingReason).toBe('region_north-america');
    });

    it('should route IN leads to asia-pacific team', async () => {
      mockConfigLoader.loadConfig.mockResolvedValue(null);

      const event: any = {
        tenantId: 'tenant_1',
        data: { country: 'IN', leadId: 'lead_2' },
        id: 'evt_2',
      };

      const result = await service.routeLead(event);

      expect(result?.routedTo).toBe('team-global');
      expect(result?.routingReason).toBe('region_asia-pacific');
    });

    it('should fallback to global-team for unknown country', async () => {
      mockConfigLoader.loadConfig.mockResolvedValue(null);

      const event: any = {
        tenantId: 'tenant_1',
        data: { country: 'XYZ', leadId: 'lead_3' },
        id: 'evt_3',
      };

      const result = await service.routeLead(event);

      expect(result?.routedTo).toBe('global-team');
      expect(result?.routingReason).toBe('region_default');
    });

    it('should use region if provided directly in lead data', async () => {
      mockConfigLoader.loadConfig.mockResolvedValue(null);

      const event: any = {
        tenantId: 'tenant_1',
        data: { region: 'europe', leadId: 'lead_4' },
        id: 'evt_4',
      };

      const result = await service.routeLead(event);

      expect(result?.routedTo).toBe('team-global');
      expect(result?.routingReason).toBe('region_europe');
    });
  });

  describe('Tenant Configuration', () => {
    it('should use tenant geographic preferences if provided', async () => {
      const customConfig = {
        domains: {
          routing: {
            geographicPreferences: {
              'north-america': ['custom-na-team'],
            },
          },
        },
      };
      mockConfigLoader.loadConfig.mockResolvedValue(customConfig);

      const event: any = {
        tenantId: 'tenant_custom',
        data: { country: 'US', leadId: 'lead_5' },
      };

      const result = await service.routeLead(event);

      expect(result?.routedTo).toBe('custom-na-team');
    });
  });
});
