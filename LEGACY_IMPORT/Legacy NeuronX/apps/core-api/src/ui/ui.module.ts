/**
 * UI Module - WI-069: Branding Kit + UI Beautification
 *
 * Module for UI theming and branding functionality.
 */

import { Module } from '@nestjs/common';
import { UiController } from './ui.controller';
import { UiService } from './ui.service';

@Module({
  controllers: [UiController],
  providers: [UiService],
  exports: [UiService],
})
export class UiModule {}
