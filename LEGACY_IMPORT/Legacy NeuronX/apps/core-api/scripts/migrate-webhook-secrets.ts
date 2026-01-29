#!/usr/bin/env tsx

/**
 * Webhook Secrets Migration Script - WI-019: Secrets & Encryption Foundation
 *
 * One-time migration to move existing plaintext webhook endpoint secrets
 * to secure secret storage. Safe to run multiple times (idempotent).
 *
 * Usage:
 *   npm run migrate:webhook-secrets
 *   or
 *   tsx scripts/migrate-webhook-secrets.ts
 */

import { PrismaClient } from '@prisma/client';
import { SecretsModule } from '../src/secrets/secrets.module';
import { SecretService } from '../src/secrets/secret.service';
import { NestFactory } from '@nestjs/core';
import { ConfigModule, ConfigService } from '@nestjs/config';

async function migrateWebhookSecrets() {
  console.log('🔐 Starting webhook secrets migration...');

  // Create NestJS app context to access services
  const app = await NestFactory.createApplicationContext({
    imports: [
      ConfigModule.forRoot({
        isGlobal: true,
        envFilePath: ['.env.local', '.env'],
      }),
      SecretsModule,
    ],
  });

  const prisma = new PrismaClient();
  const secretService = app.get(SecretService);
  const configService = app.get(ConfigService);

  const secretsProvider = configService.get<string>('SECRETS_PROVIDER', 'dev');
  const nodeEnv = configService.get<string>('NODE_ENV', 'development');

  console.log(`Environment: ${nodeEnv}`);
  console.log(`Secrets Provider: ${secretsProvider}`);

  try {
    // Find webhook endpoints with plaintext secrets
    const endpointsWithPlaintextSecrets = await prisma.webhookEndpoint.findMany(
      {
        where: {
          secret: { not: null }, // Has plaintext secret
          secretRef: null, // Not yet migrated
        },
        select: {
          id: true,
          tenantId: true,
          name: true,
          secret: true,
        },
      }
    );

    if (endpointsWithPlaintextSecrets.length === 0) {
      console.log('✅ No webhook endpoints found needing migration');
      return;
    }

    console.log(
      `📋 Found ${endpointsWithPlaintextSecrets.length} webhook endpoints to migrate`
    );

    let migratedCount = 0;
    let skippedCount = 0;
    let errorCount = 0;

    for (const endpoint of endpointsWithPlaintextSecrets) {
      try {
        console.log(`Migrating endpoint: ${endpoint.name} (${endpoint.id})`);

        if (!endpoint.secret) {
          console.log(
            `  ⚠️  Endpoint ${endpoint.id} has null secret, skipping`
          );
          skippedCount++;
          continue;
        }

        // PRODUCTION SAFETY CHECK
        if (nodeEnv === 'production' && endpoint.secret) {
          console.error(
            `🚨 PRODUCTION SAFETY VIOLATION: Plaintext secret found for endpoint ${endpoint.id}`
          );
          console.error(
            'This should not happen in production. Migration must be run before production deployment.'
          );
          throw new Error(
            'Plaintext webhook secrets detected in production environment'
          );
        }

        // Store secret in secure storage
        const secretRef = await secretService.putSecret(
          endpoint.tenantId,
          `webhook-endpoint-${endpoint.id}`,
          endpoint.secret,
          {
            migratedFrom: 'webhook-endpoint-legacy',
            endpointId: endpoint.id,
            endpointName: endpoint.name,
          }
        );

        // Update endpoint to use secret reference
        await prisma.webhookEndpoint.update({
          where: { id: endpoint.id },
          data: {
            secretRef,
            secretProvider: secretsProvider,
            secretUpdatedAt: new Date(),
            secret: null, // Clear plaintext secret
          },
        });

        console.log(`  ✅ Migrated to: ${secretRef}`);
        migratedCount++;
      } catch (error: any) {
        console.error(
          `  ❌ Failed to migrate endpoint ${endpoint.id}:`,
          error.message
        );
        errorCount++;
      }
    }

    // Summary
    console.log('\n📊 Migration Summary:');
    console.log(`  ✅ Migrated: ${migratedCount}`);
    console.log(`  ⏭️  Skipped: ${skippedCount}`);
    console.log(`  ❌ Errors: ${errorCount}`);

    if (errorCount > 0) {
      console.log('\n⚠️  Migration completed with errors. Check logs above.');
      process.exit(1);
    }

    console.log('\n🎉 Webhook secrets migration completed successfully!');
    console.log('📝 Next steps:');
    console.log('  1. Verify webhook delivery still works');
    console.log(
      '  2. Remove plaintext secret column in future schema migration'
    );
    console.log('  3. Update monitoring to track secret access patterns');
  } catch (error: any) {
    console.error('💥 Migration failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    await app.close();
  }
}

// Run migration if this script is executed directly
if (require.main === module) {
  migrateWebhookSecrets().catch(error => {
    console.error('Unhandled error:', error);
    process.exit(1);
  });
}

export { migrateWebhookSecrets };
