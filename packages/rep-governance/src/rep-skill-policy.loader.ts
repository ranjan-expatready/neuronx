import * as fs from 'fs';
import * as path from 'path';
import * as yaml from 'js-yaml';
import {
  RepSkillPolicySchema,
  type RepSkillPolicy,
} from './rep-skill-policy.schema';

export class RepSkillPolicyLoadError extends Error {
  constructor(
    message: string,
    public readonly cause?: Error
  ) {
    super(message);
    this.name = 'RepSkillPolicyLoadError';
  }
}

export class RepSkillPolicyValidationError extends Error {
  constructor(
    message: string,
    public readonly validationErrors: any[]
  ) {
    super(message);
    this.name = 'RepSkillPolicyValidationError';
  }
}

/**
 * Loads and validates the rep skill governance policy from YAML configuration
 * Implements fail-fast behavior - any validation error prevents startup
 */
export class RepSkillPolicyLoader {
  private static readonly DEFAULT_POLICY_PATH = path.join(
    process.cwd(),
    'config',
    'rep-skill-policy.yaml'
  );

  /**
   * Load policy from default location or custom path
   */
  static load(policyPath?: string): RepSkillPolicy {
    const configPath = policyPath || this.DEFAULT_POLICY_PATH;

    try {
      // Check if file exists
      if (!fs.existsSync(configPath)) {
        throw new RepSkillPolicyLoadError(
          `Rep skill policy file not found at: ${configPath}`
        );
      }

      // Read and parse YAML
      const fileContents = fs.readFileSync(configPath, 'utf-8');
      const rawConfig = yaml.load(fileContents);

      if (!rawConfig || typeof rawConfig !== 'object') {
        throw new RepSkillPolicyLoadError(
          `Invalid YAML structure in rep skill policy file: ${configPath}`
        );
      }

      // Validate against schema
      const validationResult = RepSkillPolicySchema.safeParse(rawConfig);

      if (!validationResult.success) {
        const errors = validationResult.error.issues.map((err: any) => ({
          path: err.path.join('.'),
          message: err.message,
          code: err.code,
        }));

        throw new RepSkillPolicyValidationError(
          `Rep skill policy validation failed:\n${errors
            .map((err: any) => `  ${err.path}: ${err.message}`)
            .join('\n')}`,
          errors
        );
      }

      return validationResult.data;
    } catch (error) {
      if (
        error instanceof RepSkillPolicyLoadError ||
        error instanceof RepSkillPolicyValidationError
      ) {
        throw error;
      }

      throw new RepSkillPolicyLoadError(
        `Failed to load rep skill policy from ${configPath}`,
        error as Error
      );
    }
  }

  /**
   * Validate policy without loading (for testing)
   */
  static validate(rawConfig: any): RepSkillPolicy {
    const validationResult = RepSkillPolicySchema.safeParse(rawConfig);

    if (!validationResult.success) {
      const errors = validationResult.error.issues.map((err: any) => ({
        path: err.path.join('.'),
        message: err.message,
        code: err.code,
      }));

      throw new RepSkillPolicyValidationError(
        `Rep skill policy validation failed:\n${errors
          .map((err: any) => `  ${err.path}: ${err.message}`)
          .join('\n')}`,
        errors
      );
    }

    return validationResult.data;
  }
}
