/**
 * Webhook Routes — Query, Forward, Analyze, Export
 * PRD: US-1.3, US-3.1, US-4.1, US-6.1
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc, sql } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createDb } from '../lib/db';
import { createRedis } from '../lib/redis';
import { webhookEndpoints, webhooks } from '../db/schema';
import { analyzeWebhook } from '../services/ai-analyzer';
import { AppEnv } from '../types';

const webhookRoutes = new Hono<AppEnv>();

// GET /api/webhooks?endpointId=xxx&page=1&limit=20
webhookRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const endpointId = c.req.query('endpointId');
  const page = parseInt(c.req.query('page') || '1');
  const limit = Math.min(parseInt(c.req.query('limit') || '20'), 100);
  const offset = (page - 1) * limit;

  if (!endpointId) {
    return c.json({ error: 'endpointId is required' }, 400);
  }

  const db = createDb(c.env.DATABASE_URL);

  // Verify endpoint ownership
  const [endpoint] = await db.select({ id: webhookEndpoints.id }).from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.userId, userId)))
    .limit(1);

  if (!endpoint) {
    return c.json({ error: 'Endpoint not found' }, 404);
  }

  // Get webhooks
  const result = await db.select({
    id: webhooks.id,
    endpointId: webhooks.endpointId,
    provider: webhooks.provider,
    eventType: webhooks.eventType,
    method: webhooks.method,
    responseCode: webhooks.responseCode,
    responseTimeMs: webhooks.responseTimeMs,
    signatureValid: webhooks.signatureValid,
    aiAnalyzed: webhooks.aiAnalyzed,
    forwarded: webhooks.forwarded,
    shared: webhooks.shared,
    createdAt: webhooks.createdAt,
  }).from(webhooks)
    .where(eq(webhooks.endpointId, endpointId))
    .orderBy(desc(webhooks.createdAt))
    .limit(limit)
    .offset(offset);

  // Get total count
  const [{ count }] = await db.select({ count: sql<number>`count(*)` })
    .from(webhooks)
    .where(eq(webhooks.endpointId, endpointId));

  return c.json({
    webhooks: result,
    pagination: {
      page,
      limit,
      total: Number(count),
      totalPages: Math.ceil(Number(count) / limit),
    },
  });
});

// GET /api/webhooks/:id — Full detail view
webhookRoutes.get('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const db = createDb(c.env.DATABASE_URL);

  const [webhook] = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);

  if (!webhook) {
    return c.json({ error: 'Webhook not found' }, 404);
  }

  // Verify ownership
  const [endpoint] = await db.select({ userId: webhookEndpoints.userId }).from(webhookEndpoints)
    .where(eq(webhookEndpoints.id, webhook.endpointId))
    .limit(1);

  if (!endpoint || endpoint.userId !== userId) {
    return c.json({ error: 'Not authorized' }, 403);
  }

  return c.json({ webhook });
});

// POST /api/webhooks/:id/analyze — AI Analysis
webhookRoutes.post('/:id/analyze', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const db = createDb(c.env.DATABASE_URL);
  const redis = createRedis(c.env.UPSTASH_REDIS_REST_URL, c.env.UPSTASH_REDIS_REST_TOKEN);

  const [webhook] = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
  if (!webhook) return c.json({ error: 'Webhook not found' }, 404);

  // Verify ownership
  const [endpoint] = await db.select({ userId: webhookEndpoints.userId }).from(webhookEndpoints)
    .where(eq(webhookEndpoints.id, webhook.endpointId)).limit(1);
  if (!endpoint || endpoint.userId !== userId) return c.json({ error: 'Not authorized' }, 403);

  const analysis = await analyzeWebhook(
    {
      provider: webhook.provider,
      eventType: webhook.eventType,
      responseCode: webhook.responseCode,
      signatureValid: webhook.signatureValid,
      headers: webhook.headers as Record<string, unknown>,
      payload: webhook.payload as Record<string, unknown>,
      responseBody: webhook.responseBody,
    },
    c.env.OPENROUTER_API_KEY,
    redis
  );

  // Save analysis to webhook
  await db.update(webhooks).set({
    aiAnalyzed: true,
    aiInsights: analysis,
  }).where(eq(webhooks.id, id));

  return c.json({ webhookId: id, analysis, analyzedAt: new Date().toISOString() });
});

// POST /api/webhooks/:id/forward — Forward to URL
const ForwardSchema = z.object({
  targetUrl: z.string().url(),
});

webhookRoutes.post('/:id/forward', zValidator('json', ForwardSchema), async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const { targetUrl } = c.req.valid('json');
  const db = createDb(c.env.DATABASE_URL);

  const [webhook] = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
  if (!webhook) return c.json({ error: 'Webhook not found' }, 404);

  // Verify ownership
  const [endpoint] = await db.select({ userId: webhookEndpoints.userId }).from(webhookEndpoints)
    .where(eq(webhookEndpoints.id, webhook.endpointId)).limit(1);
  if (!endpoint || endpoint.userId !== userId) return c.json({ error: 'Not authorized' }, 403);

  const startTime = Date.now();

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    const forwardHeaders = new Headers();
    const origHeaders = webhook.headers as Record<string, string>;
    for (const [key, value] of Object.entries(origHeaders)) {
      if (!['host', 'content-length', 'cf-connecting-ip'].includes(key.toLowerCase())) {
        forwardHeaders.set(key, value);
      }
    }
    forwardHeaders.set('X-Forwarded-By', 'HookLens');

    const response = await fetch(targetUrl, {
      method: 'POST',
      headers: forwardHeaders,
      body: JSON.stringify(webhook.payload),
      signal: controller.signal,
    });

    clearTimeout(timeout);
    const responseBody = await response.text();
    const responseTime = Date.now() - startTime;

    // Mark as forwarded
    await db.update(webhooks).set({ forwarded: true }).where(eq(webhooks.id, id));

    return c.json({
      webhookId: id,
      targetUrl,
      status: response.status,
      responseBody: responseBody.substring(0, 1000),
      responseTime,
      forwardedAt: new Date().toISOString(),
    });
  } catch (err) {
    return c.json({
      webhookId: id,
      targetUrl,
      status: 0,
      error: err instanceof Error ? err.message : 'Forward failed',
      responseTime: Date.now() - startTime,
    }, 502);
  }
});

// POST /api/webhooks/:id/share
webhookRoutes.post('/:id/share', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const db = createDb(c.env.DATABASE_URL);

  const [webhook] = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
  if (!webhook) return c.json({ error: 'Webhook not found' }, 404);

  const [endpoint] = await db.select({ userId: webhookEndpoints.userId }).from(webhookEndpoints)
    .where(eq(webhookEndpoints.id, webhook.endpointId)).limit(1);
  if (!endpoint || endpoint.userId !== userId) return c.json({ error: 'Not authorized' }, 403);

  const shareToken = nanoid(12);
  await db.update(webhooks).set({ shared: true, shareToken }).where(eq(webhooks.id, id));

  return c.json({
    webhookId: id,
    shareToken,
    shareUrl: `${c.env.FRONTEND_URL}/share/${shareToken}`,
  });
});

// GET /api/webhooks/:id/export?format=curl
webhookRoutes.get('/:id/export', async (c) => {
  const id = c.req.param('id');
  const format = c.req.query('format') || 'curl';
  const db = createDb(c.env.DATABASE_URL);

  const [webhook] = await db.select().from(webhooks).where(eq(webhooks.id, id)).limit(1);
  if (!webhook) return c.json({ error: 'Webhook not found' }, 404);

  const headers = webhook.headers as Record<string, string>;
  const payload = JSON.stringify(webhook.payload);

  if (format === 'curl') {
    const headerFlags = Object.entries(headers)
      .filter(([key]) => !['host', 'content-length', 'cf-connecting-ip'].includes(key.toLowerCase()))
      .map(([key, value]) => `-H "${key}: ${value}"`)
      .join(' \\\n  ');

    const curl = `curl -X POST YOUR_URL \\\n  ${headerFlags} \\\n  -d '${payload.replace(/'/g, "'\\''")}'`;

    return c.json({ format: 'curl', content: curl });
  }

  if (format === 'json') {
    return c.json({
      format: 'json',
      content: { method: 'POST', headers, body: webhook.payload },
    });
  }

  return c.json({ error: 'Unsupported format' }, 400);
});

// GET /api/share/:token — Public shared webhook view
webhookRoutes.get('/share/:token', async (c) => {
  const token = c.req.param('token');
  const db = createDb(c.env.DATABASE_URL);

  const [webhook] = await db.select().from(webhooks)
    .where(and(eq(webhooks.shareToken, token), eq(webhooks.shared, true)))
    .limit(1);

  if (!webhook) return c.json({ error: 'Shared webhook not found' }, 404);

  return c.json({ webhook, shared: true });
});

export default webhookRoutes;
