/**
 * Maintenance Module - WI-023: Data Retention & Cleanup Runners
 *
 * Wires together retention policies and cleanup operations.
 */

import { Module, Global } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { CleanupRepository } from './cleanup.repository';
import { CleanupRunner } from './cleanup.runner';
import { loadRetentionConfig } from './retention.config';

@Global()
@Module({
  imports: [
    // Enable cron scheduling
    ScheduleModule.forRoot(),
  ],
  providers: [
    // Retention configuration
    {
      provide: 'RETENTION_CONFIG',
      useFactory: () => {
        const config = loadRetentionConfig();
        console.log(
          'Loaded retention configuration:',
          JSON.stringify(config, null, 2)
        );
        return config;
      },
    },

    // Database client
    {
      provide: 'PrismaClient',
      useFactory: () => new (require('@prisma/client').PrismaClient)(),
    },

    // Storage provider (from storage module)
    {
      provide: 'STORAGE_PROVIDER',
      useFactory: () => {
        // This will be injected from the global storage module
        // In a real implementation, you'd import StorageModule
        throw new Error('STORAGE_PROVIDER must be provided by StorageModule');
      },
    },

    // Cleanup repository
    {
      provide: CleanupRepository,
      useFactory: (prisma, storageProvider, retentionConfig) => {
        return new CleanupRepository(prisma, storageProvider, retentionConfig);
      },
      inject: ['PrismaClient', 'STORAGE_PROVIDER', 'RETENTION_CONFIG'],
    },

    // Cleanup runner
    {
      provide: CleanupRunner,
      useFactory: (cleanupRepository, retentionConfig) => {
        return new CleanupRunner(cleanupRepository, retentionConfig);
      },
      inject: [CleanupRepository, 'RETENTION_CONFIG'],
    },
  ],
  exports: [CleanupRunner, 'RETENTION_CONFIG'],
})
export class MaintenanceModule {}
