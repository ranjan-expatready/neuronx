// GHL Integration Module - Production wiring for NeuronX core API

import { Module } from '@nestjs/common';
import { ConfigModule } from '@neuronx/config';
import {
  TokenVault,
  createPostgresTokenStore,
  createMemoryTokenStore,
} from '@neuronx/token-vault';
import { createGhlAuthServices } from '@neuronx/ghl-auth';
import { WebhookNormalizer } from '@neuronx/webhooks';
import { EventBus } from '../eventing/eventing.module';
import {
  PipelineStageRegistry,
  StageTransitionValidator,
  InMemoryPipelineStageRegistry,
  StageTransitionValidatorImpl,
} from '@neuronx/pipeline';
import {
  PlaybookRegistry,
  StageEvaluator,
  ActionPlanner,
  PlaybookEnforcer,
  InMemoryPlaybookRegistry,
  StageEvaluatorImpl,
  ActionPlannerImpl,
  PlaybookEnforcerImpl,
} from '@neuronx/playbook-engine';

import { GhlAuthController } from './ghl-auth.controller';
import { GhlWebhookController } from './ghl-webhook.controller';
import { GhlHealthController } from './ghl-health.controller';

@Module({
  imports: [ConfigModule],
  controllers: [GhlAuthController, GhlWebhookController, GhlHealthController],
  providers: [
    // Token Vault with appropriate store based on environment
    {
      provide: TokenVault,
      useFactory: config => {
        const store = config.USE_MEMORY_STORES
          ? createMemoryTokenStore()
          : createPostgresTokenStore(config.DATABASE_URL);

        return new TokenVault(
          config.TOKEN_VAULT_MASTER_KEY,
          config.TOKEN_VAULT_KEY_ID,
          store
        );
      },
      inject: ['CONFIG'], // Will be injected by ConfigModule
    },
    // GHL Auth Services
    {
      provide: 'GHL_AUTH_SERVICES',
      useFactory: tokenVault => createGhlAuthServices(tokenVault),
      inject: [TokenVault],
    },
    // Pipeline Stage Registry
    {
      provide: PipelineStageRegistry,
      useClass: InMemoryPipelineStageRegistry,
    },
    // Stage Transition Validator
    {
      provide: StageTransitionValidator,
      useFactory: registry => {
        const validator = new StageTransitionValidatorImpl(registry);
        // Set enforcement mode from config (default: monitor_only)
        validator.setEnforcementMode(
          (process.env.STAGE_ENFORCEMENT_MODE as any) || 'monitor_only'
        );
        return validator;
      },
      inject: [PipelineStageRegistry],
    },
    // Webhook Normalizer
    {
      provide: WebhookNormalizer,
      useFactory: (eventBus, config) => {
        return new WebhookNormalizer(eventBus, {
          webhookSecret: config.SKIP_WEBHOOK_VERIFICATION
            ? undefined
            : config.GHL_WEBHOOK_SECRET,
        });
      },
      inject: [EventBus, 'CONFIG'],
    },
    // Playbook Engine
    {
      provide: PlaybookRegistry,
      useClass: InMemoryPlaybookRegistry,
    },
    {
      provide: StageEvaluator,
      useClass: StageEvaluatorImpl,
    },
    {
      provide: ActionPlanner,
      useClass: ActionPlannerImpl,
    },
    {
      provide: PlaybookEnforcer,
      useFactory: (registry, evaluator, planner) => {
        const enforcer = new PlaybookEnforcerImpl(registry, evaluator, planner);
        enforcer.setEnforcementMode(
          (process.env.PLAYBOOK_ENFORCEMENT_MODE as any) || 'monitor_only'
        );
        return enforcer;
      },
      inject: [PlaybookRegistry, StageEvaluator, ActionPlanner],
    },
  ],
  exports: [
    TokenVault,
    WebhookNormalizer,
    PipelineStageRegistry,
    StageTransitionValidator,
    PlaybookRegistry,
    StageEvaluator,
    ActionPlanner,
    PlaybookEnforcer,
  ],
})
export class GhlIntegrationModule {}
