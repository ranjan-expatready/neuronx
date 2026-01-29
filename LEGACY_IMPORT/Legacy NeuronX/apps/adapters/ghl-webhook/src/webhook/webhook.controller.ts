import { Controller, Post, Body, Headers, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WebhookService } from './webhook.service';

@ApiTags('webhooks')
@Controller('webhooks')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(private readonly webhookService: WebhookService) {}

  @Post('ghl/lead-created')
  @ApiOperation({ summary: 'Receive lead created webhook from GoHighLevel' })
  @ApiResponse({ status: 200, description: 'Webhook processed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid webhook payload' })
  @ApiResponse({ status: 401, description: 'Invalid webhook signature' })
  async handleLeadCreatedWebhook(
    @Body() payload: any,
    @Headers('x-ghl-signature') signature?: string
  ): Promise<{ status: string }> {
    try {
      this.logger.log(`Received GHL lead created webhook: ${payload.id}`);

      // Validate webhook signature (stub for now)
      if (
        signature &&
        !this.webhookService.validateWebhookSignature(payload, signature)
      ) {
        this.logger.warn(`Invalid webhook signature for lead: ${payload.id}`);
        throw new Error('Invalid webhook signature');
      }

      // TODO: Extract tenant ID from webhook configuration
      // For now, use a default tenant ID
      const tenantId = process.env.DEFAULT_TENANT_ID || 'default-tenant';

      // Process the webhook
      await this.webhookService.processLeadCreatedWebhook(payload, tenantId);

      this.logger.log(
        `Successfully processed lead created webhook: ${payload.id}`
      );

      return { status: 'ok' };
    } catch (error) {
      this.logger.error(
        `Failed to process lead created webhook: ${payload.id}`,
        error
      );
      throw error;
    }
  }
}
