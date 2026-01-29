// E2E Tests for GHL OAuth Flow

import { Test, TestingModule } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';
import { createMemoryTokenStore } from '@neuronx/token-vault';

// Mock the OAuth service to avoid real HTTP calls
jest.mock('@neuronx/ghl-auth', () => ({
  GhlOAuthService: jest.fn().mockImplementation(() => ({
    generateAuthUrl: jest.fn().mockReturnValue({
      url: 'https://marketplace.gohighlevel.com/oauth/chooselocation?response_type=code&client_id=test_client&redirect_uri=http://localhost:3000/integrations/ghl/auth/callback&scope=contacts.readonly&state=test_state',
      state: 'test_state',
    }),
    processCallback: jest.fn().mockResolvedValue({
      success: true,
      tokensStored: 2,
    }),
  })),
}));

describe('GHL OAuth Flow (E2E)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    })
      .overrideProvider('TokenVault')
      .useFactory(() => {
        const store = createMemoryTokenStore();
        // Mock the token vault for testing
        return {
          storeToken: jest.fn().mockResolvedValue({ id: 'test_token' }),
          getToken: jest.fn().mockResolvedValue({ accessToken: 'test_token' }),
          listTenantTokens: jest.fn().mockResolvedValue([]),
        };
      })
      .compile();

    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true })
    );

    prisma = app.get<PrismaService>(PrismaService);

    // Clear test data
    await prisma.tokenCredential.deleteMany();
    await prisma.auditLog.deleteMany();

    await app.init();
  });

  afterAll(async () => {
    await app.close();
    await prisma.$disconnect();
  });

  describe('GET /integrations/ghl/auth/install', () => {
    it('should generate OAuth install URL', () => {
      return request(app.getHttpServer())
        .get('/integrations/ghl/auth/install')
        .query({ tenantId: 'test-tenant' })
        .expect(200)
        .expect(res => {
          expect(res.body).toHaveProperty('installUrl');
          expect(res.body).toHaveProperty('state');
          expect(res.body.installUrl).toContain('marketplace.gohighlevel.com');
          expect(res.body.installUrl).toContain('response_type=code');
          expect(res.body.installUrl).toContain('client_id=');
        });
    });

    it('should support direct redirect', () => {
      return request(app.getHttpServer())
        .get('/integrations/ghl/auth/install')
        .query({ tenantId: 'test-tenant', redirect: 'true' })
        .expect(302) // Redirect status
        .expect(res => {
          expect(res.headers.location).toContain('marketplace.gohighlevel.com');
        });
    });

    it('should handle missing tenant ID', () => {
      return request(app.getHttpServer())
        .get('/integrations/ghl/auth/install')
        .expect(400);
    });
  });

  describe('GET /integrations/ghl/auth/callback', () => {
    it('should process successful OAuth callback', () => {
      return request(app.getHttpServer())
        .get('/integrations/ghl/auth/callback')
        .query({
          code: 'test_auth_code',
          state: 'test_state',
        })
        .expect(200)
        .expect(res => {
          expect(res.text).toContain('GHL Integration Successful');
          expect(res.text).toContain('Tokens Stored');
        });
    });

    it('should handle OAuth provider errors', () => {
      return request(app.getHttpServer())
        .get('/integrations/ghl/auth/callback')
        .query({
          error: 'access_denied',
          error_description: 'User denied authorization',
        })
        .expect(400)
        .expect(res => {
          expect(res.text).toContain('OAuth Authorization Failed');
          expect(res.text).toContain('User denied authorization');
        });
    });

    it('should handle missing authorization code', () => {
      return request(app.getHttpServer())
        .get('/integrations/ghl/auth/callback')
        .query({ state: 'test_state' })
        .expect(400)
        .expect(res => {
          expect(res.text).toContain('Validation Error');
        });
    });
  });
});
