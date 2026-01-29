/**
 * Operator Governance Hook - WI-062: Operator Console
 *
 * Enforces surface access control for Operator Console using ui-sdk.
 */

import { useEffect, useState } from 'react';
import { UiSurface } from '@neuronx/ui-sdk';
import {
  requireSurfaceAccess,
  isOperatorConsoleEnabled,
  getRuntimeConfig,
  refreshRuntimeConfig,
} from '@neuronx/ui-sdk';

export interface OperatorGovernanceState {
  isLoading: boolean;
  hasAccess: boolean;
  error: string | null;
  enforcementMode: 'monitor_only' | 'block' | null;
}

/**
 * Hook for enforcing Operator Console access control
 * Checks surface access and runtime configuration
 */
export function useOperatorGovernance(): OperatorGovernanceState {
  const [state, setState] = useState<OperatorGovernanceState>({
    isLoading: true,
    hasAccess: false,
    error: null,
    enforcementMode: null,
  });

  useEffect(() => {
    async function checkAccess() {
      try {
        // Check if operator console is enabled in runtime config
        const config = await getRuntimeConfig();
        const isEnabled = config.enableOperatorConsole;

        if (!isEnabled) {
          setState({
            isLoading: false,
            hasAccess: false,
            error: 'Operator Console is disabled by policy',
            enforcementMode: config.enforcementBannerMode,
          });
          return;
        }

        // Check surface access
        await requireSurfaceAccess(UiSurface.OPERATOR);

        setState({
          isLoading: false,
          hasAccess: true,
          error: null,
          enforcementMode: config.enforcementBannerMode,
        });
      } catch (error) {
        console.error('Operator Console access check failed:', error);
        setState({
          isLoading: false,
          hasAccess: false,
          error: error instanceof Error ? error.message : 'Access check failed',
          enforcementMode: null,
        });
      }
    }

    checkAccess();
  }, []);

  return state;
}
