/**
 * Authorization Module - WI-022: Access Control & API Key Governance
 *
 * Wires together authentication, authorization, and access control services.
 */

import { Module, Global } from '@nestjs/common';
import { AuthGuard } from './auth.guard';
import { AdminGuard } from './admin.guard';
import { ApiKeyGuard } from './api-key.guard';
import { PermissionsGuard } from './permissions.guard';
import { ApiKeyService } from './api-key.service';
import { RolesService } from './roles.service';
import { AuditService } from './audit.service';
import { ApiKeyController } from './api-key.controller';
import { PrincipalExtractorService } from './principal.extractor';
import { SecretsModule } from '../secrets/secrets.module';

@Global()
@Module({
  imports: [
    SecretsModule, // For API key secret storage
  ],
  controllers: [
    ApiKeyController, // API key management endpoints
  ],
  providers: [
    // Guards
    AuthGuard, // Composite auth guard
    AdminGuard, // Admin bearer token auth
    ApiKeyGuard, // API key auth
    PermissionsGuard, // Permission enforcement

    // Services
    ApiKeyService, // API key lifecycle management
    RolesService, // RBAC role management
    AuditService, // Security audit logging
    PrincipalExtractorService, // Principal extraction

    // Database client (shared)
    {
      provide: 'PrismaClient',
      useFactory: () => new (require('@prisma/client').PrismaClient)(),
    },
  ],
  exports: [
    // Guards for use in other modules
    AuthGuard,
    AdminGuard,
    ApiKeyGuard,
    PermissionsGuard,

    // Services for dependency injection
    ApiKeyService,
    RolesService,
    AuditService,
    PrincipalExtractorService,
  ],
})
export class AuthzModule {}
