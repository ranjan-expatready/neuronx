import { Module } from '@nestjs/common';
import { ReadinessController } from './readiness.controller';
import { ReadinessService } from './readiness.service';
import { ReadinessEngine } from '@neuronx/production-readiness';

@Module({
  controllers: [ReadinessController],
  providers: [
    ReadinessService,
    {
      provide: ReadinessEngine,
      useFactory: prisma => new ReadinessEngine(prisma),
      inject: ['PrismaClient'],
    },
  ],
  exports: [ReadinessService],
})
export class ReadinessModule {}
