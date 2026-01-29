/**
 * Secrets Module - WI-019: Secrets & Encryption Foundation
 *
 * Configures secret storage based on environment variables with security validations.
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { SecretService } from './secret.service';
import { EnvVaultSecretStore } from './env-vault-secret-store';
import { EnvelopeEncryptedDbSecretStore } from './envelope-encrypted-db-secret-store';
import { ExternalSecretManagerStore } from './external-secret-manager-store';

@Global()
@Module({
  imports: [ConfigModule],
  providers: [
    {
      provide: 'SECRET_STORE',
      useFactory: (configService: ConfigService) => {
        const provider = configService.get<string>('SECRETS_PROVIDER', 'dev');

        switch (provider) {
          case 'dev':
            console.warn('⚠️  USING DEVELOPMENT SECRET STORE - NO ENCRYPTION ⚠️');
            return new EnvVaultSecretStore();

          case 'db': {
            const masterKey = configService.get<string>('SECRETS_MASTER_KEY');
            if (!masterKey) {
              throw new Error('SECRETS_MASTER_KEY environment variable is required for DB provider');
            }
            const prisma = new PrismaClient();
            return new EnvelopeEncryptedDbSecretStore(prisma, masterKey);
          }

          case 'aws': {
            const region = configService.get<string>('AWS_REGION');
            if (!region) {
              throw new Error('AWS_REGION environment variable is required for AWS provider');
            }
            return new ExternalSecretManagerStore('aws', region);
          }

          case 'gcp': {
            const projectId = configService.get<string>('GOOGLE_CLOUD_PROJECT');
            if (!projectId) {
              throw new Error('GOOGLE_CLOUD_PROJECT environment variable is required for GCP provider');
            }
            return new ExternalSecretManagerStore('gcp', undefined, projectId);
          }

          default:
            throw new Error(`Unknown secrets provider: ${provider}. Must be one of: dev, db, aws, gcp`);
        }
      },
      inject: [ConfigService],
    },
    SecretService,
    EnvVaultSecretStore,
    EnvelopeEncryptedDbSecretStore,
    ExternalSecretManagerStore,
  ],
  exports: [
    SecretService,
    'SECRET_STORE', // For direct access if needed
  ],
})
export class SecretsModule {}
