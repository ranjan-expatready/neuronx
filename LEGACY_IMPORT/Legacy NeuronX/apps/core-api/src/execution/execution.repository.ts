/**
 * Execution Repository - WI-034: Multi-Channel Execution Authority
 *
 * Prisma-based repositories for execution tokens and idempotency records.
 */

import { Injectable } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import {
  ExecutionToken,
  IdempotencyRecord,
  TokenRepository,
  IdempotencyRepository,
} from '@neuronx/execution-authority';

@Injectable()
export class ExecutionTokenRepository implements TokenRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(
    token: Omit<ExecutionToken, 'tokenId'>
  ): Promise<ExecutionToken> {
    const result = await this.prisma.executionToken.create({
      data: {
        tokenId: token.tokenId,
        tenantId: token.tenantId,
        opportunityId: token.opportunityId,
        actorType: token.actorType,
        mode: token.mode,
        channelScope: token.channelScope,
        commandType: token.commandType,
        correlationId: token.correlationId,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
        createdBy: token.createdBy,
        metadata: token.metadata,
      },
    });

    return result as ExecutionToken;
  }

  async findById(tokenId: string): Promise<ExecutionToken | null> {
    const result = await this.prisma.executionToken.findUnique({
      where: { tokenId },
    });

    return result as ExecutionToken | null;
  }

  async findByCorrelationId(correlationId: string): Promise<ExecutionToken[]> {
    const results = await this.prisma.executionToken.findMany({
      where: { correlationId },
    });

    return results as ExecutionToken[];
  }

  async update(
    tokenId: string,
    updates: Partial<ExecutionToken>
  ): Promise<ExecutionToken> {
    const result = await this.prisma.executionToken.update({
      where: { tokenId },
      data: updates,
    });

    return result as ExecutionToken;
  }

  async delete(tokenId: string): Promise<void> {
    await this.prisma.executionToken.delete({
      where: { tokenId },
    });
  }

  async findExpired(): Promise<ExecutionToken[]> {
    const now = new Date();
    const results = await this.prisma.executionToken.findMany({
      where: {
        expiresAt: { lt: now },
        usedAt: null, // Only delete unused expired tokens
        revokedAt: null,
      },
    });

    return results as ExecutionToken[];
  }
}

@Injectable()
export class IdempotencyRecordRepository implements IdempotencyRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async get(key: string): Promise<IdempotencyRecord | null> {
    const result = await this.prisma.idempotencyRecord.findUnique({
      where: { idempotencyKey: key },
    });

    return result as IdempotencyRecord | null;
  }

  async set(record: IdempotencyRecord): Promise<void> {
    await this.prisma.idempotencyRecord.upsert({
      where: { idempotencyKey: record.idempotencyKey },
      update: {
        response: record.response,
        statusCode: record.statusCode,
        expiresAt: record.expiresAt,
      },
      create: {
        idempotencyKey: record.idempotencyKey,
        tenantId: record.tenantId,
        endpoint: record.endpoint,
        tokenId: record.tokenId,
        response: record.response,
        statusCode: record.statusCode,
        createdAt: record.createdAt,
        expiresAt: record.expiresAt,
      },
    });
  }

  async delete(key: string): Promise<void> {
    await this.prisma.idempotencyRecord.delete({
      where: { idempotencyKey: key },
    });
  }

  async cleanup(): Promise<number> {
    const now = new Date();
    const result = await this.prisma.idempotencyRecord.deleteMany({
      where: { expiresAt: { lt: now } },
    });

    return result.count;
  }
}
