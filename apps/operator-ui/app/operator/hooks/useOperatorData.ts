/**
 * Operator Data Hook - WI-062: Operator Console
 *
 * Fetches work queue and readiness data for operator console.
 */

import { useEffect, useState, useCallback } from 'react';
import { workQueueApiClient, readinessApiClient } from '@neuronx/ui-sdk';

export interface OperatorDataState {
  workQueue: any[];
  readiness: any;
  isLoading: boolean;
  error: string | null;
}

/**
 * Hook for fetching operator console data
 * Work queue items and tenant readiness status
 */
export function useOperatorData() {
  const [state, setState] = useState<OperatorDataState>({
    workQueue: [],
    readiness: null,
    isLoading: true,
    error: null,
  });

  const fetchData = useCallback(async () => {
    try {
      setState(prev => ({ ...prev, isLoading: true, error: null }));

      // Fetch work queue items
      const workQueueResponse = await workQueueApiClient.getWorkQueue();

      // Fetch readiness status
      const readinessResponse = await readinessApiClient.getReadinessReport();

      setState({
        workQueue: workQueueResponse,
        readiness: readinessResponse,
        isLoading: false,
        error: null,
      });
    } catch (error) {
      console.error('Failed to fetch operator data:', error);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Failed to load data',
      }));
    }
  }, []);

  const refreshData = useCallback(() => {
    fetchData();
  }, [fetchData]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return {
    ...state,
    refreshData,
  };
}
