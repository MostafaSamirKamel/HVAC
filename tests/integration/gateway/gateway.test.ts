import { describe, it, expect, vi, beforeEach } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';
import { createApp, setReadiness } from '../../../apps/api-gateway/src/app.js';
import { authMiddleware, revokeToken, clearRevokedTokens } from '../../../apps/api-gateway/src/middleware/auth.middleware.js';
import { createRateLimiter } from '../../../apps/api-gateway/src/middleware/rate-limiter.middleware.js';
import { verifyInternalToken } from '@hvac/auth-context';

describe('Phase 13: Edge API Gateway Integration Tests (Rule 8, Rule 15, Rule 21, Rule 22)', () => {
  const userJwtSecret = 'development-jwt-secret-do-not-use-in-production-12345';
  const internalSecret = 'internal-service-secret-hvac-erp-key-2026';

  beforeEach(() => {
    process.env.JWT_SECRET = userJwtSecret;
    process.env.INTERNAL_SERVICE_SECRET = internalSecret;
    clearRevokedTokens();
    setReadiness(true);
    vi.restoreAllMocks();
  });

  describe('Health & Observability Endpoints (Rule 21 & Rule 22)', () => {
    it('should return 200 OK from /health', async () => {
      const app = createApp();
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.service).toBe('api-gateway');
    });

    it('should return 200 OK from /health/live with uptime', async () => {
      const app = createApp();
      const res = await request(app).get('/health/live');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('alive');
      expect(typeof res.body.uptime).toBe('number');
    });

    it('should return 200 when ready and 503 when terminating from /health/ready', async () => {
      const app = createApp();
      const resReady = await request(app).get('/health/ready');
      expect(resReady.status).toBe(200);
      expect(resReady.body.status).toBe('ready');

      setReadiness(false);
      const resNotReady = await request(app).get('/health/ready');
      expect(resNotReady.status).toBe(503);
      expect(resNotReady.body.status).toBe('terminating');
    });

    it('should return 200 OK from /metrics with flushed metrics count', async () => {
      const app = createApp();
      const res = await request(app).get('/metrics');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.metrics)).toBe(true);
    });
  });

  describe('Signed Internal Token Generation & Propagation (Rule 15)', () => {
    it('should exchange valid client Bearer token for signed short-lived internal service token', async () => {
      const clientPayload = {
        userId: 'usr_branch_mgr_01',
        email: 'manager@cairo.hvac.com',
        companyId: 'comp_cairo_hvac',
        branchId: 'br_nasr_city',
        roles: ['branch_manager'],
        permissions: ['sales:order:create:branch', 'inventory:stock:view:branch'],
      };

      const clientToken = jwt.sign(clientPayload, userJwtSecret, { expiresIn: '1h' });

      const req: any = {
        headers: {
          authorization: `Bearer ${clientToken}`,
        },
      };
      const res: any = {};
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(req.headers['x-internal-token']).toBeDefined();
      expect(req.headers['x-correlation-id']).toBeDefined();
      expect(req.headers['x-company-id']).toBe('comp_cairo_hvac');
      expect(req.headers['x-branch-id']).toBe('br_nasr_city');

      // Verify the generated internal token with @hvac/auth-context
      const verifiedContext = verifyInternalToken(req.headers['x-internal-token'], internalSecret);
      expect(verifiedContext.userId).toBe('usr_branch_mgr_01');
      expect(verifiedContext.companyId).toBe('comp_cairo_hvac');
      expect(verifiedContext.branchId).toBe('br_nasr_city');
      expect(verifiedContext.permissions.has('sales:order:create:branch')).toBe(true);
    });

    it('should reject unauthenticated request missing Authorization header', async () => {
      const req: any = { headers: {} };
      const res: any = {};
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err).toBeDefined();
      expect(err.statusCode).toBe(401);
      expect(err.errorCode).toBe('AUTHENTICATION_REQUIRED');
    });

    it('should reject malformed Authorization header not starting with Bearer', async () => {
      const req: any = { headers: { authorization: 'Basic dXNlcjpwYXNz' } };
      const res: any = {};
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err).toBeDefined();
      expect(err.statusCode).toBe(401);
    });

    it('should reject expired client tokens', async () => {
      const expiredToken = jwt.sign({ userId: 'usr_old' }, userJwtSecret, { expiresIn: '-10s' });
      const req: any = { headers: { authorization: `Bearer ${expiredToken}` } };
      const res: any = {};
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err).toBeDefined();
      expect(err.statusCode).toBe(401);
    });

    it('should reject revoked client tokens (Rule 15 Revocation List)', async () => {
      const validPayload = {
        userId: 'usr_revoked_01',
        email: 'revoked@cairo.hvac.com',
        companyId: 'comp_cairo_hvac',
      };
      const token = jwt.sign(validPayload, userJwtSecret, { expiresIn: '1h' });

      // Add to revocation list
      revokeToken(token);

      const req: any = { headers: { authorization: `Bearer ${token}` } };
      const res: any = {};
      const next = vi.fn();

      authMiddleware(req, res, next);

      expect(next).toHaveBeenCalled();
      const err = next.mock.calls[0][0];
      expect(err).toBeDefined();
      expect(err.statusCode).toBe(401);
      expect(err.message).toContain('revoked');
    });
  });

  describe('Rate Limiter Middleware (Rule 8)', () => {
    it('should attach rate limit headers and track remaining requests', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 5,
        keyGenerator: () => 'test-client-1',
      });

      const req: any = { ip: '127.0.0.1', path: '/api/v1/test', headers: {}, socket: { remoteAddress: '127.0.0.1' } };
      const res: any = {
        headers: {} as Record<string, string>,
        setHeader: vi.fn(function (this: any, k: string, v: any) { this.headers[k.toLowerCase()] = String(v); }),
      };

      const next = vi.fn();
      await limiter(req, res, next);

      expect(next).toHaveBeenCalledWith();
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', 5);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 4);
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Reset', expect.any(Number));
    });

    it('should block requests and return 429 when rate limit is exceeded', async () => {
      const limiter = createRateLimiter({
        windowMs: 60000,
        max: 2,
        keyGenerator: () => 'test-client-blocked',
      });

      const req: any = { ip: '127.0.0.1', path: '/api/v1/test', headers: {}, socket: { remoteAddress: '127.0.0.1' } };
      const res: any = {
        headers: {} as Record<string, string>,
        setHeader: vi.fn(function (this: any, k: string, v: any) { this.headers[k.toLowerCase()] = String(v); }),
      };

      const next1 = vi.fn();
      await limiter(req, res, next1);
      expect(next1).toHaveBeenCalledWith();
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 1);

      const next2 = vi.fn();
      await limiter(req, res, next2);
      expect(next2).toHaveBeenCalledWith();
      expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', 0);

      const next3 = vi.fn();
      await limiter(req, res, next3);
      expect(next3).toHaveBeenCalled();
      const err = next3.mock.calls[0][0];
      expect(err).toBeDefined();
      expect(err.statusCode).toBe(429);
      expect(err.errorCode).toBe('RATE_LIMIT_EXCEEDED');
      expect(res.setHeader).toHaveBeenCalledWith('Retry-After', expect.any(Number));
    });
  });

  describe('Routing & 404 Handler', () => {
    it('should return 404 for unmapped endpoints', async () => {
      const app = createApp();
      const res = await request(app).get('/api/v1/unknown-endpoint-xyz');

      expect(res.status).toBe(404);
      expect(res.body.error.code).toBe('NOT_FOUND');
    });
  });
});
