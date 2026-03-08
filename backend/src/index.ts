/**
 * HookLens Backend — Main Entry Point
 * Hono.js on Cloudflare Workers
 * Phase 1-4 complete
 */
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rate-limit';
import authRoutes from './routes/auth';
import endpointRoutes from './routes/endpoints';
import webhookRoutes from './routes/webhooks';
import ingestionRoute from './routes/ingestion';
import billingRoutes from './routes/billing';
import teamRoutes from './routes/teams';
import commentRoutes from './routes/comments';
import analyticsRoutes from './routes/analytics';
import apiKeyRoutes from './routes/api-keys';
import searchRoutes from './routes/search';
import { AppEnv } from './types';

const app = new Hono<AppEnv>();

// ==========================================
// Global Middleware
// ==========================================
app.use('*', logger());
app.use('*', cors({
  origin: (origin) => origin || '*',
  credentials: true,
  allowMethods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));

// ==========================================
// Health / Meta
// ==========================================
app.get('/', (c) => c.json({
  name: 'HookLens API',
  version: '2.0.0',
  status: 'ok',
  docs: 'https://hooklens.dev/docs',
  phases: ['mvp', 'growth', 'team', 'advanced'],
}));

app.get('/health', (c) => c.json({
  status: 'ok',
  timestamp: new Date().toISOString(),
  region: (c.env as any).CF_RAY?.split('-')[1] || 'local',
}));

// ==========================================
// Public Routes (no auth required)
// ==========================================
app.route('/auth', authRoutes);
app.route('/w', ingestionRoute);

// Public shared webhook view
app.get('/share/:token', async (c) => {
  const token = c.req.param('token');
  const { eq } = await import('drizzle-orm');
  const { webhooks } = await import('./db/schema');
  const { createDb } = await import('./lib/db');

  const db = createDb(c.env.DATABASE_URL);

  const [webhook] = await db.select({
    id: webhooks.id,
    provider: webhooks.provider,
    eventType: webhooks.eventType,
    method: webhooks.method,
    headers: webhooks.headers,
    payload: webhooks.payload,
    signatureValid: webhooks.signatureValid,
    signatureAlgorithm: webhooks.signatureAlgorithm,
    createdAt: webhooks.createdAt,
  }).from(webhooks).where(eq(webhooks.shareToken, token));

  if (!webhook) return c.json({ error: 'Shared webhook not found' }, 404);

  return c.json({ webhook });
});

// Team invite accept (public — via email link)
app.post('/teams/invite/:token/accept', authMiddleware, async (c) => {
  const { default: tr } = await import('./routes/teams');
  return tr.fetch(c.req.raw, c.env);
});

// ==========================================
// Stripe Webhook (no auth — uses signature)
// ==========================================
app.post('/billing/webhook', async (c) => {
  return billingRoutes.fetch(c.req.raw, c.env);
});

// ==========================================
// API Key Middleware (alternative to JWT)
// ==========================================
app.use('/api/*', async (c, next) => {
  const apiKey = c.req.header('x-api-key');

  if (apiKey) {
    // Hash the provided key and look it up
    const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(apiKey));
    const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

    const { eq, and } = await import('drizzle-orm');
    const { apiKeys } = await import('./db/schema');
    const { createDb } = await import('./lib/db');

    const db = createDb(c.env.DATABASE_URL);

    const [key] = await db.select().from(apiKeys)
      .where(and(eq(apiKeys.keyHash, keyHash), eq(apiKeys.active, true)));

    if (key) {
      // Check expiry
      if (key.expiresAt && key.expiresAt < new Date()) {
        return c.json({ error: 'API key expired' }, 401);
      }

      // Update last used
      await db.update(apiKeys).set({ lastUsedAt: new Date() }).where(eq(apiKeys.id, key.id));

      c.set('userId', key.userId);
      c.set('userPlan', 'pro'); // API users are at least pro
      return next();
    }
  }

  return next();
});

// JWT auth fallback
app.use('/api/*', authMiddleware);
app.use('/api/*', rateLimitMiddleware(100, 60));

// ==========================================
// Protected Routes
// ==========================================
// Core
app.route('/api/endpoints', endpointRoutes);
app.route('/api/webhooks', webhookRoutes);
app.route('/api/search', searchRoutes);

// Phase 2 — Billing
app.route('/billing', billingRoutes);

// Phase 3 — Teams & Comments
app.route('/api/teams', teamRoutes);

// Comments nested under webhooks
app.use('/api/webhooks/:webhookId/comments*', authMiddleware);
app.all('/api/webhooks/:webhookId/comments*', async (c) => {
  return commentRoutes.fetch(c.req.raw, c.env);
});

// Phase 4 — Analytics & API Keys
app.route('/api/analytics', analyticsRoutes);
app.route('/api/api-keys', apiKeyRoutes);

// ==========================================
// 404 & Error Handlers
// ==========================================
app.notFound((c) => c.json({ error: 'Not found', path: c.req.path }, 404));

import { runMonitoringCheck } from './lib/monitoring';

app.onError((err, c) => {
  console.error('Unhandled error:', err);
  return c.json({ error: 'Internal server error' }, 500);
});

export default {
  fetch: app.fetch,
  scheduled: async (event: any, env: AppEnv['Bindings'], ctx: any) => {
    ctx.waitUntil(runMonitoringCheck(env));
  },
};
