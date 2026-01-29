import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useOperatorGovernance } from '../hooks/useOperatorGovernance';

// Mock ui-sdk
vi.mock('@neuronx/ui-sdk', () => ({
  requireSurfaceAccess: vi.fn(),
  isOperatorConsoleEnabled: vi.fn(),
  getRuntimeConfig: vi.fn(),
}));

import {
  requireSurfaceAccess,
  isOperatorConsoleEnabled,
  getRuntimeConfig,
} from '@neuronx/ui-sdk';

describe('useOperatorGovernance', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should allow access when console is enabled and surface access granted', async () => {
    // Mock successful access
    (isOperatorConsoleEnabled as any).mockResolvedValue(true);
    (requireSurfaceAccess as any).mockResolvedValue(undefined);
    (getRuntimeConfig as any).mockResolvedValue({
      enableOperatorConsole: true,
      enforcementBannerMode: 'monitor_only',
    });

    const { result } = renderHook(() => useOperatorGovernance());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasAccess).toBe(true);
    expect(result.current.error).toBe(null);
    expect(result.current.enforcementMode).toBe('monitor_only');
  });

  it('should deny access when console is disabled', async () => {
    // Mock disabled console
    (isOperatorConsoleEnabled as any).mockResolvedValue(false);
    (getRuntimeConfig as any).mockResolvedValue({
      enableOperatorConsole: false,
    });

    const { result } = renderHook(() => useOperatorGovernance());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasAccess).toBe(false);
    expect(result.current.error).toBe('Operator Console is disabled by policy');
  });

  it('should deny access when surface access is denied', async () => {
    // Mock enabled console but denied surface access
    (isOperatorConsoleEnabled as any).mockResolvedValue(true);
    (requireSurfaceAccess as any).mockRejectedValue(
      new Error('Surface access denied')
    );
    (getRuntimeConfig as any).mockResolvedValue({
      enableOperatorConsole: true,
    });

    const { result } = renderHook(() => useOperatorGovernance());

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.hasAccess).toBe(false);
    expect(result.current.error).toBe('Surface access denied');
  });

  it('should handle loading state correctly', () => {
    const { result } = renderHook(() => useOperatorGovernance());

    // Initially loading
    expect(result.current.isLoading).toBe(true);
    expect(result.current.hasAccess).toBe(false);
    expect(result.current.error).toBe(null);
  });
});
