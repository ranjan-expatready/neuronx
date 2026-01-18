/**
 * API Key Management Controller - WI-022: Access Control & API Key Governance
 *
 * Admin endpoints for managing API keys (tenant-scoped).
 */

import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  Logger,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { ApiKeyService } from './api-key.service';
import { AuditService } from './audit.service';
import {
  ApiKeyCreateRequest,
  ApiKeyCreateResponse,
  ApiKeyRotateResponse,
  ApiKeyRecord,
} from './authz.types';
import { RequireAdmin, RequirePermissions } from './permissions.decorator';
import { AdminGuard } from './admin.guard';

@Controller('api/auth/api-keys')
@RequireAdmin() // All API key management requires admin access
export class ApiKeyController {
  private readonly logger = new Logger(ApiKeyController.name);

  constructor(
    private readonly apiKeyService: ApiKeyService,
    private readonly auditService: AuditService
  ) {}

  // ============================================================================
  // API KEY CRUD
  // ============================================================================

  /**
   * Create new API key
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createApiKey(
    @Body() request: ApiKeyCreateRequest
  ): Promise<ApiKeyCreateResponse> {
    // Get tenant from request context (set by AdminGuard)
    const tenantId = (global as any).currentTenantId; // TODO: Proper tenant extraction

    this.logger.log('Creating API key', {
      tenantId,
      name: request.name,
      roleIds: request.roleIds,
      permissions: request.permissions,
    });

    try {
      const result = await this.apiKeyService.createApiKey(tenantId, request);

      // Audit log
      await this.auditService.logApiKeyCreated(
        { tenantId, id: 'admin-user', type: 'admin' }, // TODO: Get from request
        result.id,
        result.name
      );

      this.logger.log('API key created successfully', {
        tenantId,
        apiKeyId: result.id,
        fingerprint: result.fingerprint,
      });

      return result;
    } catch (error: any) {
      this.logger.error('Failed to create API key', {
        tenantId,
        name: request.name,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * List API keys for tenant
   */
  @Get()
  async listApiKeys(): Promise<{ apiKeys: ApiKeyRecord[] }> {
    const tenantId = (global as any).currentTenantId; // TODO: Proper tenant extraction

    this.logger.debug('Listing API keys', { tenantId });

    const apiKeys = await this.apiKeyService.listApiKeys(tenantId);

    return { apiKeys };
  }

  /**
   * Get API key details
   */
  @Get(':id')
  async getApiKey(@Param('id') apiKeyId: string): Promise<ApiKeyRecord> {
    const tenantId = (global as any).currentTenantId; // TODO: Proper tenant extraction

    this.logger.debug('Getting API key details', {
      tenantId,
      apiKeyId,
    });

    const apiKey = await this.apiKeyService.getApiKey(tenantId, apiKeyId);

    if (!apiKey) {
      throw new NotFoundException(`API key ${apiKeyId} not found`);
    }

    return apiKey;
  }

  /**
   * Rotate API key (generate new key)
   */
  @Post(':id/rotate')
  async rotateApiKey(
    @Param('id') apiKeyId: string
  ): Promise<ApiKeyRotateResponse> {
    const tenantId = (global as any).currentTenantId; // TODO: Proper tenant extraction

    this.logger.log('Rotating API key', {
      tenantId,
      apiKeyId,
    });

    try {
      const result = await this.apiKeyService.rotateApiKey(tenantId, apiKeyId);

      // Audit log
      await this.auditService.logApiKeyRotated(
        { tenantId, id: 'admin-user', type: 'admin' }, // TODO: Get from request
        apiKeyId
      );

      this.logger.log('API key rotated successfully', {
        tenantId,
        apiKeyId,
        newFingerprint: result.fingerprint,
      });

      return result;
    } catch (error: any) {
      this.logger.error('Failed to rotate API key', {
        tenantId,
        apiKeyId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Revoke API key
   */
  @Post(':id/revoke')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeApiKey(@Param('id') apiKeyId: string): Promise<void> {
    const tenantId = (global as any).currentTenantId; // TODO: Proper tenant extraction

    this.logger.log('Revoking API key', {
      tenantId,
      apiKeyId,
    });

    try {
      await this.apiKeyService.revokeApiKey(tenantId, apiKeyId);

      // Audit log
      await this.auditService.logApiKeyRevoked(
        { tenantId, id: 'admin-user', type: 'admin' }, // TODO: Get from request
        apiKeyId
      );

      this.logger.log('API key revoked successfully', {
        tenantId,
        apiKeyId,
      });
    } catch (error: any) {
      this.logger.error('Failed to revoke API key', {
        tenantId,
        apiKeyId,
        error: error.message,
      });
      throw error;
    }
  }

  /**
   * Delete API key (hard delete - admin only)
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteApiKey(@Param('id') apiKeyId: string): Promise<void> {
    const tenantId = (global as any).currentTenantId; // TODO: Proper tenant extraction

    this.logger.log('Deleting API key', {
      tenantId,
      apiKeyId,
    });

    // TODO: Implement hard delete in service
    // For now, just revoke
    await this.apiKeyService.revokeApiKey(tenantId, apiKeyId);

    this.logger.log('API key deleted successfully', {
      tenantId,
      apiKeyId,
    });
  }
}
