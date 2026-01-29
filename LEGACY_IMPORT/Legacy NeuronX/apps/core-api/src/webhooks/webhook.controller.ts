/**
 * Webhook Management Controller - WI-020: Webhook Endpoint Management APIs
 *
 * Tenant-scoped REST API for managing outbound webhook endpoints.
 * Admin-only operations with comprehensive validation and audit.
 */

import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  HttpCode,
  HttpStatus,
  UseGuards,
  Request,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import {
  CreateWebhookEndpointRequest,
  UpdateWebhookEndpointRequest,
  RotateWebhookSecretRequest,
  TestWebhookDeliveryRequest,
  WebhookEndpointResponse,
  WebhookEndpointsListResponse,
  RotateWebhookSecretResponse,
  TestWebhookDeliveryResponse,
  WebhookValidation,
} from './webhook.dto';
import { WebhookService } from './webhook.service';

// TODO: Replace with actual admin RBAC guard
// For now, this is a stub guard that accepts all requests
class AdminGuard {
  canActivate(context: any): boolean {
    // STUB: In production, implement proper admin authentication
    // Check JWT token, roles, permissions, etc.
    const request = context.switchToHttp().getRequest();
    const authHeader = request.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ForbiddenException('Admin authentication required');
    }

    // Extract tenant from JWT or headers (stub implementation)
    const tenantId = request.headers['x-tenant-id'] || 'default-tenant';
    request.tenantId = tenantId;

    return true;
  }
}

@Controller('api/webhooks/endpoints')
@UseGuards(AdminGuard)
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  // ============================================================================
  // CRUD OPERATIONS
  // ============================================================================

  /**
   * Create webhook endpoint
   */
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async createEndpoint(
    @Body() request: CreateWebhookEndpointRequest,
    @Request() req: any
  ): Promise<WebhookEndpointResponse> {
    const tenantId = req.tenantId;
    const correlationId = WebhookValidation.generateCorrelationId(
      'create',
      tenantId
    );

    this.logger.log(`Creating webhook endpoint`, {
      tenantId,
      name: request.name,
      correlationId,
    });

    try {
      // Validate inputs
      WebhookValidation.validateHttpsUrl(request.url);
      WebhookValidation.validateEventTypes(request.eventTypes);

      const endpoint = await this.webhookService.createEndpoint(
        tenantId,
        request,
        correlationId
      );

      this.logger.log(`Created webhook endpoint`, {
        tenantId,
        endpointId: endpoint.id,
        correlationId,
      });

      return endpoint;
    } catch (error: any) {
      this.logger.error(`Failed to create webhook endpoint`, {
        tenantId,
        name: request.name,
        error: error.message,
        correlationId,
      });
      throw error;
    }
  }

  /**
   * List webhook endpoints
   */
  @Get()
  async listEndpoints(
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
    @Request() req: any
  ): Promise<WebhookEndpointsListResponse> {
    const tenantId = req.tenantId;
    const parsedLimit = limit ? parseInt(limit, 10) : 50;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    if (parsedLimit > 100) {
      throw new BadRequestException('Limit cannot exceed 100');
    }

    this.logger.debug(`Listing webhook endpoints`, {
      tenantId,
      limit: parsedLimit,
      offset: parsedOffset,
    });

    const result = await this.webhookService.listEndpoints(
      tenantId,
      parsedLimit,
      parsedOffset
    );

    return {
      endpoints: result.endpoints,
      total: result.total,
      limit: parsedLimit,
      offset: parsedOffset,
    };
  }

  /**
   * Get webhook endpoint by ID
   */
  @Get(':id')
  async getEndpoint(
    @Param('id') endpointId: string,
    @Request() req: any
  ): Promise<WebhookEndpointResponse> {
    const tenantId = req.tenantId;

    this.logger.debug(`Getting webhook endpoint`, {
      tenantId,
      endpointId,
    });

    const endpoint = await this.webhookService.getEndpoint(
      tenantId,
      endpointId
    );

    if (!endpoint) {
      throw new NotFoundException(`Webhook endpoint ${endpointId} not found`);
    }

    return endpoint;
  }

  /**
   * Update webhook endpoint
   */
  @Patch(':id')
  async updateEndpoint(
    @Param('id') endpointId: string,
    @Body() request: UpdateWebhookEndpointRequest,
    @Request() req: any
  ): Promise<WebhookEndpointResponse> {
    const tenantId = req.tenantId;
    const correlationId = WebhookValidation.generateCorrelationId(
      'update',
      tenantId
    );

    this.logger.log(`Updating webhook endpoint`, {
      tenantId,
      endpointId,
      correlationId,
    });

    try {
      // Validate inputs if provided
      if (request.url) {
        WebhookValidation.validateHttpsUrl(request.url);
      }

      if (request.eventTypes) {
        WebhookValidation.validateEventTypes(request.eventTypes);
      }

      const endpoint = await this.webhookService.updateEndpoint(
        tenantId,
        endpointId,
        request,
        correlationId
      );

      if (!endpoint) {
        throw new NotFoundException(`Webhook endpoint ${endpointId} not found`);
      }

      this.logger.log(`Updated webhook endpoint`, {
        tenantId,
        endpointId,
        correlationId,
      });

      return endpoint;
    } catch (error: any) {
      this.logger.error(`Failed to update webhook endpoint`, {
        tenantId,
        endpointId,
        error: error.message,
        correlationId,
      });
      throw error;
    }
  }

  /**
   * Delete (disable) webhook endpoint
   */
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async deleteEndpoint(
    @Param('id') endpointId: string,
    @Request() req: any
  ): Promise<void> {
    const tenantId = req.tenantId;
    const correlationId = WebhookValidation.generateCorrelationId(
      'delete',
      tenantId
    );

    this.logger.log(`Disabling webhook endpoint`, {
      tenantId,
      endpointId,
      correlationId,
    });

    const success = await this.webhookService.disableEndpoint(
      tenantId,
      endpointId,
      correlationId
    );

    if (!success) {
      throw new NotFoundException(`Webhook endpoint ${endpointId} not found`);
    }

    this.logger.log(`Disabled webhook endpoint`, {
      tenantId,
      endpointId,
      correlationId,
    });
  }

  // ============================================================================
  // SECRET MANAGEMENT
  // ============================================================================

  /**
   * Rotate webhook endpoint secret
   */
  @Post(':id/rotate-secret')
  async rotateSecret(
    @Param('id') endpointId: string,
    @Body() request: RotateWebhookSecretRequest,
    @Request() req: any
  ): Promise<RotateWebhookSecretResponse> {
    const tenantId = req.tenantId;
    const correlationId = WebhookValidation.generateCorrelationId(
      'rotate-secret',
      tenantId
    );

    this.logger.log(`Rotating webhook endpoint secret`, {
      tenantId,
      endpointId,
      correlationId,
    });

    try {
      const result = await this.webhookService.rotateEndpointSecret(
        tenantId,
        endpointId,
        req.user?.id || 'admin-user',
        correlationId,
        request.reason
      );

      this.logger.log(`Rotated webhook endpoint secret`, {
        tenantId,
        endpointId,
        previousRef: result.previousSecretRef,
        newRef: result.newSecretRef,
        correlationId,
      });

      return result;
    } catch (error: any) {
      this.logger.error(`Failed to rotate webhook endpoint secret`, {
        tenantId,
        endpointId,
        error: error.message,
        correlationId,
      });
      throw error;
    }
  }

  // ============================================================================
  // TESTING
  // ============================================================================

  /**
   * Test webhook delivery
   */
  @Post(':id/test')
  async testDelivery(
    @Param('id') endpointId: string,
    @Body() request: TestWebhookDeliveryRequest,
    @Request() req: any
  ): Promise<TestWebhookDeliveryResponse> {
    const tenantId = req.tenantId;
    const correlationId = WebhookValidation.generateCorrelationId(
      'test-delivery',
      tenantId
    );

    this.logger.log(`Testing webhook delivery`, {
      tenantId,
      endpointId,
      correlationId,
    });

    try {
      const result = await this.webhookService.testEndpointDelivery(
        tenantId,
        endpointId,
        req.user?.id || 'admin-user',
        correlationId,
        request.message
      );

      this.logger.log(`Queued webhook test delivery`, {
        tenantId,
        endpointId,
        deliveryId: result.deliveryId,
        correlationId,
      });

      return result;
    } catch (error: any) {
      this.logger.error(`Failed to test webhook delivery`, {
        tenantId,
        endpointId,
        error: error.message,
        correlationId,
      });
      throw error;
    }
  }
}
