/**
 * Manual Snapshot Trigger - WI-049: GHL Snapshot Ingestion (Read-Only)
 *
 * API-triggered snapshot ingestion for manual operations.
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { GhlSnapshotService } from '../ghl-snapshot.service';
import { SnapshotType, SnapshotIngestionResult } from '../snapshot-types';

export interface ManualSnapshotRequest {
  tenantId: string;
  ghlAccountId?: string; // Optional, will use default if not provided
  snapshotTypes?: SnapshotType[]; // Optional, defaults to all types
  priority?: 'low' | 'normal' | 'high'; // Affects processing priority
  reason?: string; // Audit reason for manual trigger
}

export interface ManualSnapshotResponse {
  requestId: string;
  tenantId: string;
  ghlAccountId: string;
  requestedTypes: SnapshotType[];
  status: 'accepted' | 'running' | 'completed' | 'failed';
  results?: SnapshotIngestionResult[];
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  error?: string;
}

@Injectable()
export class ManualSnapshotTrigger {
  private readonly logger = new Logger(ManualSnapshotTrigger.name);
  private activeRequests = new Map<string, ManualSnapshotResponse>();

  constructor(private readonly snapshotService: GhlSnapshotService) {}

  /**
   * Trigger manual snapshot ingestion
   */
  async triggerSnapshot(
    request: ManualSnapshotRequest
  ): Promise<ManualSnapshotResponse> {
    this.validateRequest(request);

    const requestId = this.generateRequestId();
    const ghlAccountId =
      request.ghlAccountId ||
      (await this.getDefaultGhlAccountId(request.tenantId));
    const snapshotTypes = request.snapshotTypes || Object.values(SnapshotType);

    const response: ManualSnapshotResponse = {
      requestId,
      tenantId: request.tenantId,
      ghlAccountId,
      requestedTypes: snapshotTypes,
      status: 'accepted',
      startedAt: new Date(),
    };

    this.activeRequests.set(requestId, response);

    this.logger.log('Manual snapshot request accepted', {
      requestId,
      tenantId: request.tenantId,
      ghlAccountId,
      snapshotTypes: snapshotTypes.length,
      reason: request.reason,
      priority: request.priority,
    });

    // Start async processing
    this.processSnapshotRequest(requestId, request, response);

    return response;
  }

  /**
   * Get status of manual snapshot request
   */
  getRequestStatus(requestId: string): ManualSnapshotResponse | null {
    return this.activeRequests.get(requestId) || null;
  }

  /**
   * List active manual snapshot requests
   */
  getActiveRequests(): ManualSnapshotResponse[] {
    return Array.from(this.activeRequests.values()).filter(
      request => request.status === 'accepted' || request.status === 'running'
    );
  }

  /**
   * Cancel a manual snapshot request
   */
  async cancelRequest(requestId: string): Promise<boolean> {
    const request = this.activeRequests.get(requestId);
    if (!request) {
      throw new NotFoundException(
        `Manual snapshot request ${requestId} not found`
      );
    }

    if (request.status === 'completed' || request.status === 'failed') {
      throw new BadRequestException(`Cannot cancel ${request.status} request`);
    }

    request.status = 'failed';
    request.error = 'Cancelled by user';
    request.completedAt = new Date();

    this.logger.warn('Manual snapshot request cancelled', { requestId });

    return true;
  }

  /**
   * Process the snapshot request asynchronously
   */
  private async processSnapshotRequest(
    requestId: string,
    request: ManualSnapshotRequest,
    response: ManualSnapshotResponse
  ): Promise<void> {
    try {
      response.status = 'running';
      const correlationId = `manual_${requestId}`;

      this.logger.log('Starting manual snapshot processing', {
        requestId,
        tenantId: request.tenantId,
        snapshotTypes: response.requestedTypes.length,
        correlationId,
      });

      const results: SnapshotIngestionResult[] = [];

      // Run snapshots based on request
      if (
        response.requestedTypes.length === Object.values(SnapshotType).length
      ) {
        // Full snapshot
        const fullResult = await this.snapshotService.runFullSnapshot(
          request.tenantId,
          response.ghlAccountId,
          correlationId
        );
        results.push(...fullResult.results);
      } else {
        // Individual snapshots
        for (const snapshotType of response.requestedTypes) {
          const result = await this.snapshotService.runSingleSnapshot(
            snapshotType,
            request.tenantId,
            response.ghlAccountId,
            correlationId
          );
          results.push(result);
        }
      }

      // Update response
      response.status = 'completed';
      response.results = results;
      response.completedAt = new Date();
      response.durationMs =
        response.completedAt.getTime() - response.startedAt.getTime();

      const successCount = results.filter(r => r.success).length;
      const totalCount = results.length;

      this.logger.log('Manual snapshot processing completed', {
        requestId,
        tenantId: request.tenantId,
        totalSnapshots: totalCount,
        successfulSnapshots: successCount,
        durationMs: response.durationMs,
        correlationId,
      });
    } catch (error) {
      response.status = 'failed';
      response.error = error.message;
      response.completedAt = new Date();
      response.durationMs =
        response.completedAt.getTime() - response.startedAt.getTime();

      this.logger.error('Manual snapshot processing failed', {
        requestId,
        tenantId: request.tenantId,
        error: error.message,
      });
    }
  }

  /**
   * Validate manual snapshot request
   */
  private validateRequest(request: ManualSnapshotRequest): void {
    if (!request.tenantId) {
      throw new BadRequestException('tenantId is required');
    }

    if (request.snapshotTypes && request.snapshotTypes.length === 0) {
      throw new BadRequestException('snapshotTypes cannot be empty');
    }

    if (request.snapshotTypes) {
      const validTypes = Object.values(SnapshotType);
      const invalidTypes = request.snapshotTypes.filter(
        type => !validTypes.includes(type)
      );
      if (invalidTypes.length > 0) {
        throw new BadRequestException(
          `Invalid snapshot types: ${invalidTypes.join(', ')}`
        );
      }
    }

    if (
      request.priority &&
      !['low', 'normal', 'high'].includes(request.priority)
    ) {
      throw new BadRequestException(
        'Invalid priority. Must be: low, normal, high'
      );
    }
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `manual_snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get default GHL account ID for tenant
   */
  private async getDefaultGhlAccountId(tenantId: string): Promise<string> {
    // In a real implementation, this would query the database
    // for the tenant's primary GHL account connection
    // For now, return a mock value
    return `ghl_default_${tenantId}`;
  }
}
