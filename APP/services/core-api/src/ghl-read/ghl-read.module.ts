/**
 * GHL Read Module - WI-070C: Read-Only GHL Live Data Integration (Truth Lock)
 *
 * Module for read-only GHL data access and trust validation.
 */

import { Module } from '@nestjs/common';
import { GhlReadController } from './ghl-read.controller';
import { GhlReadService } from './ghl-read.service';

@Module({
  controllers: [GhlReadController],
  providers: [GhlReadService],
  exports: [GhlReadService],
})
export class GhlReadModule {}
