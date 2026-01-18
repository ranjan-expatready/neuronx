/**
 * UI Controller - WI-069: Branding Kit + UI Beautification
 *
 * API endpoints for UI theming and branding configuration.
 * Provides server-driven branding for tenant-specific theming.
 */

import { Controller, Get, Headers, Query } from '@nestjs/common';
import { UiService } from './ui.service';

@Controller('ui')
export class UiController {
  constructor(private readonly uiService: UiService) {}

  /**
   * Get branding configuration for tenant
   */
  @Get('branding')
  getBranding(
    @Headers('x-tenant-id') tenantId?: string,
    @Query('version') version?: string
  ) {
    return this.uiService.getBranding(tenantId, version);
  }
}
