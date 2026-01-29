/**
 * Work Queue API Client - WI-061: UI Infrastructure & Governance Layer
 *
 * Typed client for work queue management endpoints.
 */

import { ApiResponse } from '../types';
import { httpClient } from '../http/client';
import { getTenantId } from '../auth/principal';
import { CorrelationContext } from '../http/correlation';

export interface WorkQueueItem {
  id: string;
  opportunityId: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  reason: string;
  assignedTo?: string;
  createdAt: string;
  slaDeadline?: string;
  context: {
    dealValue?: number;
    riskScore?: number;
    lastActivity?: string;
  };
}

export interface WorkQueueFilters {
  reason?: string[];
  priority?: string[];
  assignedTo?: string;
  tenantId?: string;
  slaUrgent?: boolean;
}

export interface PaginationParams {
  page?: number;
  limit?: number;
}

export interface WorkQueueActionRequest {
  itemId: string;
  actionType: 'assign' | 'take' | 'release' | 'complete';
  notes?: string;
  correlationId?: string;
}

/**
 * Work Queue API Client
 * Provides typed access to work queue management endpoints
 */
export class WorkQueueApiClient {
  /**
   * Get work queue items with filtering and pagination
   */
  async getWorkQueue(
    filters: WorkQueueFilters = {},
    pagination: PaginationParams = {}
  ): Promise<{ items: WorkQueueItem[]; total: number }> {
    const tenantId = await getTenantId();
    const correlationId = CorrelationContext.get();

    // Build query parameters
    const params = new URLSearchParams();

    if (filters.reason?.length) {
      params.set('reason', filters.reason.join(','));
    }
    if (filters.priority?.length) {
      params.set('priority', filters.priority.join(','));
    }
    if (filters.assignedTo) {
      params.set('assignedTo', filters.assignedTo);
    }
    if (filters.slaUrgent) {
      params.set('slaUrgent', 'true');
    }

    if (pagination.page) {
      params.set('page', pagination.page.toString());
    }
    if (pagination.limit) {
      params.set('limit', pagination.limit.toString());
    }

    const queryString = params.toString();
    const endpoint = `/work-queue${queryString ? `?${queryString}` : ''}`;

    const response: ApiResponse<{ items: WorkQueueItem[]; total: number }> =
      await httpClient.get(endpoint, {
        correlationId,
        tenantId,
      });

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get work queue');
    }

    return response.data;
  }

  /**
   * Take action on a work queue item
   */
  async takeAction(request: WorkQueueActionRequest): Promise<any> {
    const tenantId = await getTenantId();
    const correlationId = request.correlationId || CorrelationContext.get();

    const response: ApiResponse<any> = await httpClient.post(
      '/work-queue/actions',
      {
        ...request,
        correlationId,
      },
      {
        correlationId,
        tenantId,
      }
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to take work queue action');
    }

    return response.data;
  }

  /**
   * Assign work queue item to operator
   */
  async assignItem(itemId: string, operatorId: string): Promise<any> {
    const tenantId = await getTenantId();
    const correlationId = CorrelationContext.get();

    const response: ApiResponse<any> = await httpClient.post(
      `/work-queue/${itemId}/assign`,
      {
        operatorId,
        correlationId,
      },
      {
        correlationId,
        tenantId,
      }
    );

    if (!response.success) {
      throw new Error(response.error || 'Failed to assign work queue item');
    }

    return response.data;
  }

  /**
   * Get work queue statistics
   */
  async getStatistics(): Promise<any> {
    const tenantId = await getTenantId();
    const correlationId = CorrelationContext.get();

    const response: ApiResponse<any> = await httpClient.get(
      '/work-queue/statistics',
      {
        correlationId,
        tenantId,
      }
    );

    if (!response.success || !response.data) {
      throw new Error(response.error || 'Failed to get work queue statistics');
    }

    return response.data;
  }
}

/**
 * Default work queue API client instance
 */
export const workQueueApiClient = new WorkQueueApiClient();
