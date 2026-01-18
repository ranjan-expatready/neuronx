/**
 * Org Authority Module - WI-035: Tenant & Organization Authority Model
 */

import { Module } from '@nestjs/common';
import { OrgAuthorityService } from './org-authority.service';
import { OrgAuthorityController } from './org-authority.controller';

@Module({
  providers: [OrgAuthorityService],
  controllers: [OrgAuthorityController],
  exports: [OrgAuthorityService],
})
export class OrgAuthorityModule {}
