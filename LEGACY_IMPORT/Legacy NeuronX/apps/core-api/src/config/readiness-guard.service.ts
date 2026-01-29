/**
 * Readiness Guard Service - WI-026: Release & Environment Hardening
 *
 * Checks system readiness before allowing background jobs to run.
 * Fail-open: if readiness check fails, jobs still run to avoid blocking.
 */

import { Injectable, Logger, Inject } from '@nestjs/common';
import { ReadinessService } from '../observability/readiness.service';

export interface ReadinessCheckResult {
  isReady: boolean;
  reason?: string;
  details?: Record<string, any>;
}

@Injectable()
export class ReadinessGuardService {
  private readonly logger = new Logger(ReadinessGuardService.name);

  constructor(private readonly readinessService: ReadinessService) {}

  /**
   * Check if background job should run based on system readiness
   * Returns true if job should proceed, false if it should skip
   */
  async shouldRunBackgroundJob(jobName: string): Promise<boolean> {
    try {
      // Check database readiness
      const dbCheck = await this.readinessService.checkDatabase();
      if (!dbCheck.status) {
        this.logger.warn(`Skipping ${jobName}: database not ready`, {
          jobName,
          reason: dbCheck.message,
          error: dbCheck.error,
        });
        return false;
      }

      // For jobs that need storage, check storage readiness
      if (this.jobNeedsStorage(jobName)) {
        const storageCheck = await this.readinessService.checkStorageProvider();
        if (!storageCheck.status) {
          this.logger.warn(`Skipping ${jobName}: storage not ready`, {
            jobName,
            reason: storageCheck.message,
            error: storageCheck.error,
          });
          return false;
        }
      }

      // For jobs that need secrets, check secrets readiness
      if (this.jobNeedsSecrets(jobName)) {
        const secretsCheck = await this.readinessService.checkSecretsProvider();
        if (!secretsCheck.status) {
          this.logger.warn(`Skipping ${jobName}: secrets not ready`, {
            jobName,
            reason: secretsCheck.message,
            error: secretsCheck.error,
          });
          return false;
        }
      }

      return true;
    } catch (error: any) {
      // Fail-open: if readiness check fails, allow job to run
      this.logger.error(
        `Readiness check failed for ${jobName}, proceeding anyway`,
        {
          jobName,
          error: error.message,
        }
      );
      return true;
    }
  }

  /**
   * Determine if a job requires storage access
   */
  private jobNeedsStorage(jobName: string): boolean {
    const storageJobs = [
      'cleanup-runner', // Deletes artifacts
      'webhook-dispatcher', // May need storage for signing
    ];

    return storageJobs.some(job => jobName.includes(job));
  }

  /**
   * Determine if a job requires secrets access
   */
  private jobNeedsSecrets(jobName: string): boolean {
    const secretsJobs = [
      'webhook-dispatcher', // Signs webhooks with secrets
      'voice-runner', // May need API keys
    ];

    return secretsJobs.some(job => jobName.includes(job));
  }
}
