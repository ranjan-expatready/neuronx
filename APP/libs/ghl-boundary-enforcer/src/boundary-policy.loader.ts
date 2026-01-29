import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  GhlBoundaryPolicySchema,
  type GhlBoundaryPolicy,
} from './boundary-policy.schema';

export class BoundaryPolicyLoadError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'BoundaryPolicyLoadError';
  }
}

export class BoundaryPolicyValidationError extends Error {
  constructor(
    message: string,
    public readonly validationErrors: any[]
  ) {
    super(message);
    this.name = 'BoundaryPolicyValidationError';
  }
}

/**
 * Loads and validates the GHL boundary policy from YAML configuration
 * Implements fail-fast behavior - any validation error prevents startup
 */
export class BoundaryPolicyLoader {
  private static readonly DEFAULT_POLICY_PATH = path.join(
    process.cwd(),
    'config',
    'ghl-boundary-policy.yaml'
  );

  /**
   * Load policy from default location or custom path
   */
  static load(policyPath?: string): GhlBoundaryPolicy {
    const configPath = policyPath || this.DEFAULT_POLICY_PATH;

    try {
      // Check if file exists
      if (!fs.existsSync(configPath)) {
        throw new BoundaryPolicyLoadError(
          `Boundary policy file not found at: ${configPath}`
        );
      }

      // Read and parse YAML
      const fileContents = fs.readFileSync(configPath, 'utf-8');
      const rawConfig = yaml.load(fileContents);

      if (!rawConfig || typeof rawConfig !== 'object') {
        throw new BoundaryPolicyLoadError(
          `Invalid YAML structure in boundary policy file: ${configPath}`
        );
      }

      // Validate against schema
      const validationResult = GhlBoundaryPolicySchema.safeParse(rawConfig);

      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((err: any) => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        throw new BoundaryPolicyValidationError(
          `Boundary policy validation failed:\n${errors
            .map((err: any) => `  ${err.path}: ${err.message}`)
            .join('\n')}`,
          errors
        );
      }

      return validationResult.data;
    } catch (error) {
      if (
        error instanceof BoundaryPolicyLoadError ||
        error instanceof BoundaryPolicyValidationError
      ) {
        throw error;
      }

      throw new BoundaryPolicyLoadError(
        `Failed to load boundary policy from ${configPath}`,
        error as Error
      );
    }
  }

  /**
   * Validate policy without loading (for testing)
   */
  static validate(rawConfig: any): GhlBoundaryPolicy {
    const validationResult = GhlBoundaryPolicySchema.safeParse(rawConfig);

    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((err: any) => ({
        path: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));

      throw new BoundaryPolicyValidationError(
        `Boundary policy validation failed:\n${errors
          .map((err: any) => `  ${err.path}: ${err.message}`)
          .join('\n')}`,
        errors
      );
    }

    return validationResult.data;
  }
}
