/**
 * Trust Dashboard Tests - WI-042
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TrustDashboard } from '@/components/dashboard/trust-dashboard';

// Mock the API client
vi.mock('@/lib/api-client', () => ({
  apiClient: {
    getTrustMetrics: vi.fn(),
    getBillingState: vi.fn(),
  },
}));

const createTestQueryClient = () =>
  new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
        cacheTime: 0,
      },
    },
  });

const renderWithProviders = (component: React.ReactElement) => {
  const queryClient = createTestQueryClient();
  return render(
    <QueryClientProvider client={queryClient}>{component}</QueryClientProvider>
  );
};

describe('TrustDashboard', () => {
  it('displays loading state initially', () => {
    renderWithProviders(<TrustDashboard />);

    expect(screen.getByText('NeuronX Trust Portal')).toBeInTheDocument();
    expect(screen.getAllByRole('presentation')).toHaveLength(4); // Loading skeletons
  });

  it('displays trust metrics when loaded', async () => {
    const mockMetrics = {
      totalOperations: 15000,
      successRate: 99.2,
      averageResponseTime: 245,
      activeTenants: 42,
      complianceScore: 95,
    };

    const mockBillingState = {
      billingStatus: 'ACTIVE',
      planTier: 'ENTERPRISE',
    };

    // Mock the API responses
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.getTrustMetrics).mockResolvedValue(mockMetrics);
    vi.mocked(apiClient.getBillingState).mockResolvedValue(mockBillingState);

    renderWithProviders(<TrustDashboard />);

    await waitFor(() => {
      expect(screen.getByText('15,000')).toBeInTheDocument();
      expect(screen.getByText('99.2%')).toBeInTheDocument();
      expect(screen.getByText('245ms')).toBeInTheDocument();
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('95')).toBeInTheDocument();
    });

    expect(screen.getByText('ACTIVE')).toBeInTheDocument();
    expect(screen.getByText('Plan: ENTERPRISE')).toBeInTheDocument();
  });

  it('displays error state when API fails', async () => {
    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.getTrustMetrics).mockRejectedValue(
      new Error('API Error')
    );

    renderWithProviders(<TrustDashboard />);

    await waitFor(() => {
      expect(
        screen.getByText('Unable to load trust metrics')
      ).toBeInTheDocument();
    });
  });

  it('displays system health indicators', async () => {
    const mockMetrics = {
      totalOperations: 1000,
      successRate: 98.5,
      averageResponseTime: 200,
      activeTenants: 10,
      complianceScore: 92,
    };

    const { apiClient } = await import('@/lib/api-client');
    vi.mocked(apiClient.getTrustMetrics).mockResolvedValue(mockMetrics);
    vi.mocked(apiClient.getBillingState).mockResolvedValue({
      billingStatus: 'ACTIVE',
      planTier: 'PRO',
    });

    renderWithProviders(<TrustDashboard />);

    await waitFor(() => {
      expect(screen.getByText('Security Status')).toBeInTheDocument();
      expect(screen.getByText('Compliance')).toBeInTheDocument();
      expect(screen.getByText('Audit Trail')).toBeInTheDocument();
    });

    expect(screen.getByText('All systems secure')).toBeInTheDocument();
    expect(screen.getByText('SOC 2 Type II certified')).toBeInTheDocument();
    expect(screen.getByText('Real-time monitoring active')).toBeInTheDocument();
  });
});
