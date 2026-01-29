// Observability Package - FAANG-grade monitoring and debugging

export * from './logger';
export * from './metrics';
export * from './tracing';

import { logger } from './logger';
import { metrics } from './metrics';
import { tracing } from './tracing';

// Convenience exports for common usage patterns
export const observability = {
  logger,
  metrics,
  tracing,
};
