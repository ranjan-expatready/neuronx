/**
 * Principal Extractor - WI-036: Production Identity & Principal Model
 *
 * Extracts Principal from authenticated requests.
 * Integrates with existing guard system.
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  PrincipalExtractor,
  DefaultPrincipalExtractor,
  PrincipalExtractionResult,
} from './principal';

@Injectable()
export class PrincipalExtractorService implements PrincipalExtractor {
  private readonly logger = new Logger(PrincipalExtractorService.name);
  private readonly extractor = new DefaultPrincipalExtractor();

  async extract(request: any): Promise<PrincipalExtractionResult> {
    try {
      const result = await this.extractor.extract(request);

      this.logger.debug('Principal extracted successfully', {
        tenantId: result.principal.tenantId,
        userId: result.principal.userId,
        authType: result.principal.authType,
        correlationId: result.principal.correlationId,
      });

      return result;
    } catch (error) {
      this.logger.error('Principal extraction failed', {
        error: error.message,
        path: request.path,
        method: request.method,
        hasActor: !!request.actor,
        actorType: request.actor?.type,
        correlationId: request.correlationId,
      });

      throw error;
    }
  }
}
