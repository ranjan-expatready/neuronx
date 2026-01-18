import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HttpClient } from '../http/client';
import { generateCorrelationId } from '../http/correlation';

// Mock fetch globally
const fetchMock = vi.fn();
global.fetch = fetchMock;

describe('HttpClient', () => {
  let client: HttpClient;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new HttpClient({ baseUrl: 'http://test-api.com' });

    // Mock successful response
    fetchMock.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: 'test' }),
      headers: {
        get: (header: string) =>
          header === 'x-correlation-id' ? 'test-correlation-id' : undefined,
      },
    } as any);
  });

  describe('correlation ID handling', () => {
    it('should include correlation ID in requests', async () => {
      const correlationId = 'test-correlation-123';

      await client.get('/test', { correlationId });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test-api.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-correlation-id': correlationId,
          }),
        })
      );
    });

    it('should generate correlation ID if not provided', async () => {
      await client.get('/test');

      const call = fetchMock.mock.calls[0];
      const headers = call[1].headers as Headers;

      expect(headers.get('x-correlation-id')).toMatch(/^ui_\d+_[a-z0-9]+$/);
    });

    it('should include tenant ID when provided', async () => {
      const tenantId = 'tenant-123';

      await client.get('/test', { tenantId });

      expect(fetchMock).toHaveBeenCalledWith(
        'http://test-api.com/test',
        expect.objectContaining({
          headers: expect.objectContaining({
            'x-tenant-id': tenantId,
          }),
        })
      );
    });
  });

  describe('response handling', () => {
    it('should return successful response data', async () => {
      const result = await client.get('/test');

      expect(result).toEqual({
        success: true,
        data: { data: 'test' },
        correlationId: 'test-correlation-id',
      });
    });

    it('should handle HTTP errors', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: () => Promise.resolve({ message: 'Resource not found' }),
        headers: {
          get: () => 'error-correlation-id',
        },
      } as any);

      const result = await client.get('/test');

      expect(result.success).toBe(false);
      expect(result.error).toContain('HTTP 404');
    });
  });

  describe('retry logic', () => {
    it('should retry GET requests on failure', async () => {
      let attempts = 0;
      fetchMock.mockImplementation(() => {
        attempts++;
        if (attempts < 3) {
          return Promise.resolve({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error',
            headers: { get: () => 'error-id' },
          } as any);
        }
        return Promise.resolve({
          ok: true,
          json: () => Promise.resolve({ data: 'success' }),
          headers: { get: () => 'success-id' },
        } as any);
      });

      await client.get('/test');

      expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it('should not retry non-GET requests', async () => {
      fetchMock.mockResolvedValue({
        ok: false,
        status: 500,
        headers: { get: () => 'error-id' },
      } as any);

      await client.post('/test', { data: 'test' });

      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });
});
