/**
 * Policy Guard - WI-034: Multi-Channel Execution Authority
 *
 * Interface for execution policy enforcement.
 */

import { ExecutionContext, RiskAssessment } from './types';

/**
 * Policy guard interface
 */
export interface PolicyGuard {
  /**
   * Check if execution is allowed by policy
   */
  checkPolicy(context: ExecutionContext): Promise<{
    allowed: boolean;
    reason: string;
    riskAssessment: RiskAssessment;
  }>;
}
