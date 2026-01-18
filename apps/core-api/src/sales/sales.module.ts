import { Module } from '@nestjs/common';
import { SalesController } from './sales.controller';
import { SalesService } from './sales.service';
import { LeadScorerService } from './lead-scorer.service';
import { LeadRouterService } from './lead-router.service';
import { QualificationService } from './qualification.service';
import { OpportunityService } from './opportunity.service';
import { OpportunityTeamBackfillRunner } from './opportunity-team-backfill.runner';
import { ConversationSignalService } from './conversation-signal.service';
import { AdvancedScoringService } from './advanced-scoring.service';
import { PredictiveRoutingService } from './predictive-routing.service';
import { QualificationHandler } from './qualification.handler';
import { AdvancedScoringHandler } from './advanced-scoring.handler';
import { PredictiveRoutingHandler } from './predictive-routing.handler';
import { ConfigModule } from '../config/config.module';
import { AuditModule } from '../audit/audit.module';
import { CipherModule } from '../cipher/cipher.module';
import { OrgAuthorityModule } from '../org-authority/org-authority.module';

@Module({
  imports: [ConfigModule, AuditModule, CipherModule, OrgAuthorityModule],
  controllers: [SalesController],
  providers: [
    SalesService,
    LeadScorerService,
    LeadRouterService,
    QualificationService,
    OpportunityService,
    OpportunityTeamBackfillRunner,
    ConversationSignalService,
    AdvancedScoringService,
    PredictiveRoutingService,
    QualificationHandler,
    AdvancedScoringHandler,
    PredictiveRoutingHandler,
  ],
  exports: [
    SalesService,
    QualificationService,
    OpportunityService,
    ConversationSignalService,
    AdvancedScoringService,
    PredictiveRoutingService,
  ],
})
export class SalesModule {}
