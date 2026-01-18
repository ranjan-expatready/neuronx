/**
 * Storage Module - WI-021: Object Storage & Artifact Management
 *
 * Configures object storage providers and artifact management services.
 */

import { Module, Global } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PrismaClient } from '@prisma/client';
import { StorageProvider, StorageConfig } from './storage.types';
import { S3StorageProvider } from './s3-storage.provider';
import { LocalStorageProvider } from './local-storage.provider';
import { ArtifactsService } from './artifacts.service';
import { ArtifactsController } from './artifacts.controller';

@Global()
@Module({
  imports: [ConfigModule],
  controllers: [
    ArtifactsController, // WI-021: Artifact management APIs
  ],
  providers: [
    {
      provide: 'STORAGE_PROVIDER',
      useFactory: (configService: ConfigService): StorageProvider => {
        const provider = configService.get<string>('STORAGE_PROVIDER', 'local');
        const bucketName = configService.get<string>(
          'STORAGE_BUCKET',
          'neuronx-artifacts'
        );
        const region = configService.get<string>('STORAGE_REGION', 'us-east-1');
        const endpoint = configService.get<string>('STORAGE_ENDPOINT');
        const accessKeyId = configService.get<string>('STORAGE_ACCESS_KEY_ID');
        const secretAccessKey = configService.get<string>(
          'STORAGE_SECRET_ACCESS_KEY'
        );
        const maxUploadSizeBytes = configService.get<number>(
          'STORAGE_MAX_UPLOAD_SIZE',
          100 * 1024 * 1024
        ); // 100MB
        const urlExpirySeconds = configService.get<number>(
          'STORAGE_URL_EXPIRY',
          900
        ); // 15 minutes

        const storageConfig: StorageConfig = {
          provider: provider as 's3' | 'local',
          bucketName,
          region,
          endpoint,
          accessKeyId,
          secretAccessKey,
          maxUploadSizeBytes,
          urlExpirySeconds,
        };

        switch (provider) {
          case 's3':
            return new S3StorageProvider(storageConfig);

          case 'local':
            console.warn(
              '⚠️  USING LOCAL FILESYSTEM STORAGE - NO ENCRYPTION ⚠️'
            );
            console.warn(
              'This provides NO security and should NEVER be used in production'
            );
            return new LocalStorageProvider(storageConfig);

          default:
            throw new Error(
              `Unknown storage provider: ${provider}. Must be 's3' or 'local'`
            );
        }
      },
      inject: [ConfigService],
    },
    {
      provide: 'PRISMA_CLIENT',
      useFactory: (): PrismaClient => new PrismaClient(),
    },
    {
      provide: ArtifactsService,
      useFactory: (storageProvider: StorageProvider, prisma: PrismaClient) => {
        return new ArtifactsService(prisma, storageProvider);
      },
      inject: ['STORAGE_PROVIDER', 'PRISMA_CLIENT'],
    },
  ],
  exports: [ArtifactsService, 'STORAGE_PROVIDER'],
})
export class StorageModule {}
