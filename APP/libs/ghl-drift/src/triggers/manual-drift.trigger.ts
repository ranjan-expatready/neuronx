/**
 * Manual Drift Trigger - WI-053: Drift Detection Engine
 *
 * API-triggered drift detection for manual operations.
 */

import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { GhlDriftDetectionService } from '../ghl-drift-detection.service';
import {
  SnapshotType,
  DriftDetectionRequest,
  DriftDetectionResponse,
} from '../drift-types';

export interface ManualDriftRequest {
  tenantId: string;
  ghlAccountId?: string; // Optional, will use default if not provided
  snapshotTypes?: SnapshotType[]; // Optional, defaults to all types
  beforeSnapshotId?: string; // Optional, uses latest - 1 if not provided
  afterSnapshotId?: string; // Optional, uses latest if not provided
  priority?: 'low' | 'normal' | 'high'; // Affects processing priority
  reason?: string; // Audit reason for manual trigger
}

export interface ManualDriftResponse {
  requestId: string;
  tenantId: string;
  ghlAccountId: string;
  requestedTypes: SnapshotType[];
  status: 'accepted' | 'running' | 'completed' | 'failed';
  results?: DriftDetectionResponse[];
  startedAt: Date;
  completedAt?: Date;
  durationMs?: number;
  error?: string;
}

@Injectable()
export class ManualDriftTrigger {
  private readonly logger = new Logger(ManualDriftTrigger.name);
  private activeRequests = new Map<string, ManualDriftResponse>();

  constructor(private readonly driftService: GhlDriftDetectionService) {}

  /**
   * Trigger manual drift detection
   */
  async triggerDriftDetection(
    request: ManualDriftRequest
  ): Promise<ManualDriftResponse> {
    this.validateRequest(request);

    const requestId = this.generateRequestId();
    const ghlAccountId =
      request.ghlAccountId ||
      (await this.getDefaultGhlAccountId(request.tenantId));
    const snapshotTypes = request.snapshotTypes || Object.values(SnapshotType);

    const response: ManualDriftResponse = {
      requestId,
      tenantId: request.tenantId,
      ghlAccountId,
      requestedTypes: snapshotTypes,
      status: 'accepted',
      startedAt: new Date(),
    };

    this.activeRequests.set(requestId, response);

    this.logger.log('Manual drift detection request accepted', {
      requestId,
      tenantId: request.tenantId,
      ghlAccountId,
      snapshotTypes: snapshotTypes.length,
      reason: request.reason,
      priority: request.priority,
    });

    // Start async processing
    this.processDriftRequest(requestId, request, response);

    return response;
  }

  /**
   * Get status of manual drift request
   */
  getRequestStatus(requestId: string): ManualDriftResponse | null {
    return this.activeRequests.get(requestId) || null;
  }

  /**
   * List active manual drift requests
   */
  getActiveRequests(): ManualDriftResponse[] {
    return Array.from(this.activeRequests.values()).filter(
      request => request.status === 'accepted' || request.status === 'running'
    );
  }

  /**
   * Cancel a manual drift request
   */
  async cancelRequest(requestId: string): Promise<boolean> {
    const request = this.activeRequests.get(requestId);
    if (!request) {
      throw new NotFoundException(
        `Manual drift request ${requestId} not found`
      );
    }

    if (request.status === 'completed' || request.status === 'failed') {
      throw new BadRequestException(`Cannot cancel ${request.status} request`);
    }

    request.status = 'failed';
    request.error = 'Cancelled by user';
    request.completedAt = new Date();

    this.logger.warn('Manual drift request cancelled', { requestId });

    return true;
  }

  /**
   * Process the drift request asynchronously
   */
  private async processDriftRequest(
    requestId: string,
    request: ManualDriftRequest,
    response: ManualDriftResponse
  ): Promise<void> {
    try {
      response.status = 'running';
      const results: DriftDetectionResponse[] = [];

      // Run drift detection for each requested type
      for (const snapshotType of response.requestedTypes) {
        const driftRequest: DriftDetectionRequest = {
          tenantId: request.tenantId,
          ghlAccountId: response.ghlAccountId,
          snapshotType,
          beforeSnapshotId: request.beforeSnapshotId,
          afterSnapshotId: request.afterSnapshotId,
          correlationId: `${requestId}_${snapshotType}`,
        };

        try {
          const result = await this.driftService.detectDrift(driftRequest);
          results.push(result);

          this.logger.debug('Completed drift detection for type', {
            requestId,
            snapshotType,
            success: result.success,
            changesFound: result.driftResult?.summary.totalChanges || 0,
          });
        } catch (error) {
          // Create failed result
          const failedResult: DriftDetectionResponse = {
            success: false,
            error: error.message,
            durationMs: 0,
          };
          results.push(failedResult);

          this.logger.error('Failed drift detection for type', {
            requestId,
            snapshotType,
            error: error.message,
          });
        }
      }

      // Update response
      response.status = 'completed';
      response.results = results;
      response.completedAt = new Date();
      response.durationMs =
        response.completedAt.getTime() - response.startedAt.getTime();

      const successful = results.filter(r => r.success).length;
      const total = results.length;
      const totalChanges = results
        .filter(r => r.success && r.driftResult)
        .reduce((sum, r) => sum + r.driftResult!.summary.totalChanges, 0);

      this.logger.log('Manual drift detection processing completed', {
        requestId,
        tenantId: request.tenantId,
        totalTypes: total,
        successfulTypes: successful,
        totalChanges,
        durationMs: response.durationMs,
      });
    } catch (error) {
      response.status = 'failed';
      response.error = error.message;
      response.completedAt = new Date();
      response.durationMs =
        response.completedAt.getTime() - response.startedAt.getTime();

      this.logger.error('Manual drift detection processing failed', {
        requestId,
        tenantId: request.tenantId,
        error: error.message,
      });
    }
  }

  /**
   * Validate manual drift request
   */
  private validateRequest(request: ManualDriftRequest): void {
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
    return `manual_drift_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
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
