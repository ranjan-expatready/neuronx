import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import { VoicePolicySchema, type VoicePolicy } from './voice-policy.schema';

export class VoicePolicyLoadError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'VoicePolicyLoadError';
  }
}

export class VoicePolicyValidationError extends Error {
  constructor(
    message: string,
    public readonly validationErrors: any[]
  ) {
    super(message);
    this.name = 'VoicePolicyValidationError';
  }
}

/**
 * Loads and validates the voice orchestration policy from YAML configuration
 * Implements fail-fast behavior - any validation error prevents startup
 */
export class VoicePolicyLoader {
  private static readonly DEFAULT_POLICY_PATH = path.join(
    process.cwd(),
    'config',
    'voice-policy.yaml'
  );

  /**
   * Load policy from default location or custom path
   */
  static load(policyPath?: string): VoicePolicy {
    const configPath = policyPath || this.DEFAULT_POLICY_PATH;

    try {
      // Check if file exists
      if (!fs.existsSync(configPath)) {
        throw new VoicePolicyLoadError(
          `Voice policy file not found at: ${configPath}`
        );
      }

      // Read and parse YAML
      const fileContents = fs.readFileSync(configPath, 'utf-8');
      const rawConfig = yaml.load(fileContents);

      if (!rawConfig || typeof rawConfig !== 'object') {
        throw new VoicePolicyLoadError(
          `Invalid YAML structure in voice policy file: ${configPath}`
        );
      }

      // Validate against schema
      const validationResult = VoicePolicySchema.safeParse(rawConfig);

      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((err: any) => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        throw new VoicePolicyValidationError(
          `Voice policy validation failed:\n${errors
            .map((err: any) => `  ${err.path}: ${err.message}`)
            .join('\n')}`,
          errors
        );
      }

      return validationResult.data;
    } catch (error) {
      if (
        error instanceof VoicePolicyLoadError ||
        error instanceof VoicePolicyValidationError
      ) {
        throw error;
      }

      throw new VoicePolicyLoadError(
        `Failed to load voice policy from ${configPath}`,
        error as Error
      );
    }
  }

  /**
   * Validate policy without loading (for testing)
   */
  static validate(rawConfig: any): VoicePolicy {
    const validationResult = VoicePolicySchema.safeParse(rawConfig);

    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((err: any) => ({
        path: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));

      throw new VoicePolicyValidationError(
        `Voice policy validation failed:\n${errors
          .map((err: any) => `  ${err.path}: ${err.message}`)
          .join('\n')}`,
        errors
      );
    }

    return validationResult.data;
  }
}
