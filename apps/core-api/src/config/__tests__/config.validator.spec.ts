import { ConfigValidator } from '../config.validator';

// Mock process.env
const originalEnv = process.env;

describe('ConfigValidator', () => {
  beforeEach(() => {
    // Reset environment
    process.env = { ...originalEnv };
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('validateConfig', () => {
    it('should pass with valid configuration', () => {
      // Set up valid environment
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL =
        'postgresql://user:pass@localhost:5432/neuronx';
      process.env.SECRETS_PROVIDER = 'env';
      process.env.STORAGE_PROVIDER = 'local';
      process.env.STORAGE_LOCAL_PATH = '/tmp/storage';

      const result = ConfigValidator.validateConfig();

      expect(result.isValid).toBe(true);
      expect(result.errors).toHaveLength(0);
      expect(result.configSummary).toBeDefined();
    });

    it('should fail with missing required DATABASE_URL', () => {
      process.env.NODE_ENV = 'development';
      delete process.env.DATABASE_URL;

      const result = ConfigValidator.validateConfig();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('DATABASE_URL: DATABASE_URL is required');
    });

    it('should fail with invalid DATABASE_URL', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL = 'invalid-url';

      const result = ConfigValidator.validateConfig();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'DATABASE_URL: DATABASE_URL must be a PostgreSQL connection string'
      );
    });

    it('should fail with invalid NODE_ENV', () => {
      process.env.NODE_ENV = 'invalid';
      process.env.DATABASE_URL =
        'postgresql://user:pass@localhost:5432/neuronx';

      const result = ConfigValidator.validateConfig();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'NODE_ENV: NODE_ENV must be one of: development, staging, production'
      );
    });

    it('should warn for missing optional values with defaults', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL =
        'postgresql://user:pass@localhost:5432/neuronx';
      process.env.SECRETS_PROVIDER = 'env';
      process.env.STORAGE_PROVIDER = 'local';

      const result = ConfigValidator.validateConfig();

      expect(result.isValid).toBe(true);
      expect(result.warnings).toContain(
        'STORAGE_LOCAL_PATH: STORAGE_LOCAL_PATH is required when STORAGE_PROVIDER=local (using default: undefined)'
      );
    });

    it('should validate cross-dependencies', () => {
      process.env.NODE_ENV = 'development';
      process.env.DATABASE_URL =
        'postgresql://user:pass@localhost:5432/neuronx';
      process.env.SECRETS_PROVIDER = 'env';
      process.env.STORAGE_PROVIDER = 'local';
      process.env.STORAGE_LOCAL_PATH = '/tmp/storage';
      process.env.OUTBOX_RETENTION_DAYS_PUBLISHED = '30';
      process.env.OUTBOX_RETENTION_DAYS_DEAD = '7'; // Dead < Published - invalid

      const result = ConfigValidator.validateConfig();

      expect(result.isValid).toBe(false);
      expect(result.errors).toContain(
        'cleanup-retention-relationship: OUTBOX_RETENTION_DAYS_DEAD should not be less than OUTBOX_RETENTION_DAYS_PUBLISHED'
      );
    });
  });

  describe('validateBootConfig', () => {
    it('should exit process on validation failure', () => {
      const mockExit = jest.spyOn(process, 'exit').mockImplementation(() => {
        throw new Error('Process exited');
      });

      delete process.env.DATABASE_URL;

      expect(() => {
        ConfigValidator.validateBootConfig();
      }).toThrow('Process exited');

      expect(mockExit).toHaveBeenCalledWith(1);
      mockExit.mockRestore();
    });
  });
});
