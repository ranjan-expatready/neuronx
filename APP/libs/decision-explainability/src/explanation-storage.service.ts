/**
 * Explanation Storage Service - WI-052: Decision Explainability Engine
 *
 * Immutable storage for decision explanations.
 */

import { Injectable, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { ExplanationStorage, DecisionExplanation } from './explanation-types';

@Injectable()
export class ExplanationStorageService implements ExplanationStorage {
  private readonly logger = new Logger(ExplanationStorageService.name);

  constructor(private readonly prisma: PrismaClient) {}

  /**
   * Store a decision explanation immutably
   */
  async store(explanation: DecisionExplanation): Promise<void> {
    try {
      await this.prisma.decisionExplanation.create({
        data: {
          explanationId: explanation.explanationId,
          decisionId: explanation.decisionId,
          timestamp: explanation.timestamp,
          tenantId: explanation.tenantId,
          opportunityId: explanation.opportunityId,
          decisionSummary: explanation.decisionSummary as any,
          policyFactors: explanation.policyFactors as any,
          authorityFactors: explanation.authorityFactors as any,
          billingFactors: explanation.billingFactors as any,
          driftFactors: explanation.driftFactors as any,
          constraints: explanation.constraints as any,
          finalJustification: explanation.finalJustification as any,
          correlationIds: explanation.correlationIds as any,
          engineVersion: explanation.metadata.engineVersion,
          processingTimeMs: explanation.metadata.processingTimeMs,
          dataCompleteness: explanation.metadata.dataCompleteness,
          missingDataReasons: explanation.metadata.missingDataReasons as any,
        },
      });

      this.logger.debug('Stored decision explanation', {
        explanationId: explanation.explanationId,
        decisionId: explanation.decisionId,
        tenantId: explanation.tenantId,
      });
    } catch (error) {
      this.logger.error('Failed to store decision explanation', {
        explanationId: explanation.explanationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Retrieve a specific explanation by ID
   */
  async retrieve(explanationId: string): Promise<DecisionExplanation | null> {
    try {
      const record = await this.prisma.decisionExplanation.findUnique({
        where: { explanationId },
      });

      if (!record) {
        return null;
      }

      return {
        explanationId: record.explanationId,
        decisionId: record.decisionId,
        timestamp: record.timestamp,
        tenantId: record.tenantId,
        opportunityId: record.opportunityId,
        decisionSummary: record.decisionSummary as any,
        policyFactors: record.policyFactors as any,
        authorityFactors: record.authorityFactors as any,
        billingFactors: record.billingFactors as any,
        driftFactors: record.driftFactors as any,
        constraints: record.constraints as any,
        finalJustification: record.finalJustification as any,
        correlationIds: record.correlationIds as any,
        metadata: {
          engineVersion: record.engineVersion,
          processingTimeMs: record.processingTimeMs,
          dataCompleteness: record.dataCompleteness as any,
          missingDataReasons: record.missingDataReasons as any,
        },
      };
    } catch (error) {
      this.logger.error('Failed to retrieve decision explanation', {
        explanationId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Query explanation by decision ID
   */
  async queryByDecision(
    decisionId: string
  ): Promise<DecisionExplanation | null> {
    try {
      const record = await this.prisma.decisionExplanation.findFirst({
        where: { decisionId },
      });

      if (!record) {
        return null;
      }

      return {
        explanationId: record.explanationId,
        decisionId: record.decisionId,
        timestamp: record.timestamp,
        tenantId: record.tenantId,
        opportunityId: record.opportunityId,
        decisionSummary: record.decisionSummary as any,
        policyFactors: record.policyFactors as any,
        authorityFactors: record.authorityFactors as any,
        billingFactors: record.billingFactors as any,
        driftFactors: record.driftFactors as any,
        constraints: record.constraints as any,
        finalJustification: record.finalJustification as any,
        correlationIds: record.correlationIds as any,
        metadata: {
          engineVersion: record.engineVersion,
          processingTimeMs: record.processingTimeMs,
          dataCompleteness: record.dataCompleteness as any,
          missingDataReasons: record.missingDataReasons as any,
        },
      };
    } catch (error) {
      this.logger.error('Failed to query explanation by decision ID', {
        decisionId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Query explanations by tenant
   */
  async queryByTenant(
    tenantId: string,
    limit?: number
  ): Promise<DecisionExplanation[]> {
    try {
      const records = await this.prisma.decisionExplanation.findMany({
        where: { tenantId },
        orderBy: { timestamp: 'desc' },
        take: limit || 50,
      });

      return records.map(record => ({
        explanationId: record.explanationId,
        decisionId: record.decisionId,
        timestamp: record.timestamp,
        tenantId: record.tenantId,
        opportunityId: record.opportunityId,
        decisionSummary: record.decisionSummary as any,
        policyFactors: record.policyFactors as any,
        authorityFactors: record.authorityFactors as any,
        billingFactors: record.billingFactors as any,
        driftFactors: record.driftFactors as any,
        constraints: record.constraints as any,
        finalJustification: record.finalJustification as any,
        correlationIds: record.correlationIds as any,
        metadata: {
          engineVersion: record.engineVersion,
          processingTimeMs: record.processingTimeMs,
          dataCompleteness: record.dataCompleteness as any,
          missingDataReasons: record.missingDataReasons as any,
        },
      }));
    } catch (error) {
      this.logger.error('Failed to query explanations by tenant', {
        tenantId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Get storage statistics
   */
  async getStats(tenantId?: string): Promise<{
    totalExplanations: number;
    explanationsByCompleteness: Record<string, number>;
    oldestExplanation?: Date;
    newestExplanation?: Date;
  }> {
    try {
      const where = tenantId ? { tenantId } : {};

      const [totalCount, completenessStats, dateRange] = await Promise.all([
        this.prisma.decisionExplanation.count({ where }),
        this.prisma.decisionExplanation.groupBy({
          by: ['dataCompleteness'],
          where,
          _count: { dataCompleteness: true },
        }),
        this.prisma.decisionExplanation.aggregate({
          where,
          _min: { timestamp: true },
          _max: { timestamp: true },
        }),
      ]);

      const explanationsByCompleteness: Record<string, number> = {};
      completenessStats.forEach(stat => {
        explanationsByCompleteness[stat.dataCompleteness] =
          stat._count.dataCompleteness;
      });

      return {
        totalExplanations: totalCount,
        explanationsByCompleteness,
        oldestExplanation: dateRange._min.timestamp || undefined,
        newestExplanation: dateRange._max.timestamp || undefined,
      };
    } catch (error) {
      this.logger.error('Failed to get explanation stats', {
        tenantId,
        error: error.message,
      });
      throw error;
    }
  }
}
