// Jest setup file for minimal test environment
// Provides required environment variables to prevent config validation failures

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = 'postgresql://test:test@localhost:5432/test';
process.env.REDIS_URL = 'redis://localhost:6379';

// Disable config validation exit for tests
process.env.SKIP_CONFIG_VALIDATION = 'true';
