/**
 * Analytics Routes — Phase 4
 * Time-series aggregations, charts data, summary stats
 */
import { Hono } from 'hono';
import { eq, sql } from 'drizzle-orm';
import { createDb } from '../lib/db';
import { webhookEndpoints, webhooks, activityLog, teamMembers, apiKeys } from '../db/schema';
import { AppEnv } from '../types';

const analyticsRoutes = new Hono<AppEnv>();

// ==========================================
// GET /api/analytics/overview
// Returns summary stats for dashboard
// ==========================================
analyticsRoutes.get('/overview', async (c) => {
  const userId = c.get('userId');
  const days = parseInt(c.req.query('days') || '7');
  const db = createDb(c.env.DATABASE_URL);

  const since = new Date();
  since.setDate(since.getDate() - days);

  // Get user endpoints
  const endpoints = await db.select({ id: webhookEndpoints.id })
    .from(webhookEndpoints).where(eq(webhookEndpoints.userId, userId));

  const endpointIds = endpoints.map(e => e.id);
  if (endpointIds.length === 0) {
    return c.json({ totalWebhooks: 0, successRate: 0, avgResponseTime: 0, errorCount: 0, providerBreakdown: [], topEvents: [] });
  }

  // Total webhooks in period (using raw SQL for flexibility)
  const statsResult = (await db.execute(sql`
    SELECT
      COUNT(*) AS total,
      COUNT(CASE WHEN response_code >= 200 AND response_code < 300 THEN 1 END) AS successes,
      COUNT(CASE WHEN response_code >= 400 THEN 1 END) AS errors,
      AVG(response_time_ms)::int AS avg_response_ms
    FROM webhooks
    WHERE endpoint_id = ANY(${endpointIds})
    AND created_at >= ${since.toISOString()}
  `));

  const stats = statsResult[0] as {
    total: string; successes: string; errors: string; avg_response_ms: string | null;
  };

  const total = parseInt(stats?.total || '0');
  const successes = parseInt(stats?.successes || '0');

  // Provider breakdown
  const providerResult = (await db.execute(sql`
    SELECT provider, COUNT(*) AS c
    FROM webhooks
    WHERE endpoint_id = ANY(${endpointIds})
    AND created_at >= ${since.toISOString()}
    AND provider IS NOT NULL
    GROUP BY provider
    ORDER BY c DESC
    LIMIT 10
  `));

  // Top event types
  const eventResult = (await db.execute(sql`
    SELECT event_type, COUNT(*) AS c
    FROM webhooks
    WHERE endpoint_id = ANY(${endpointIds})
    AND created_at >= ${since.toISOString()}
    AND event_type IS NOT NULL
    GROUP BY event_type
    ORDER BY c DESC
    LIMIT 10
  `));

  return c.json({
    totalWebhooks: total,
    successRate: total > 0 ? Math.round((successes / total) * 100) : 0,
    errorCount: parseInt(stats?.errors || '0'),
    avgResponseTime: stats?.avg_response_ms ? parseInt(stats.avg_response_ms) : 0,
    providerBreakdown: providerResult.map((r: any) => ({
      provider: r.provider,
      count: parseInt(r.c),
    })),
    topEvents: eventResult.map((r: any) => ({
      eventType: r.event_type,
      count: parseInt(r.c),
    })),
  });
});

// ==========================================
// GET /api/analytics/timeseries
// Returns hourly/daily chart data
// ==========================================
analyticsRoutes.get('/timeseries', async (c) => {
  const userId = c.get('userId');
  const days = parseInt(c.req.query('days') || '7');
  const granularity = c.req.query('granularity') || 'day'; // hour | day
  const db = createDb(c.env.DATABASE_URL);

  const since = new Date();
  since.setDate(since.getDate() - days);

  const endpoints = await db.select({ id: webhookEndpoints.id })
    .from(webhookEndpoints).where(eq(webhookEndpoints.userId, userId));

  const endpointIds = endpoints.map(e => e.id);
  if (endpointIds.length === 0) return c.json({ series: [] });

  const truncFn = granularity === 'hour' ? sql.raw('hour') : sql.raw('day');

  const result = (await db.execute(sql`
    SELECT
      DATE_TRUNC(${truncFn}, created_at) AS period,
      COUNT(*) AS total,
      COUNT(CASE WHEN response_code >= 200 AND response_code < 300 THEN 1 END) AS successes,
      COUNT(CASE WHEN response_code >= 400 THEN 1 END) AS errors,
      COUNT(CASE WHEN signature_valid = false THEN 1 END) AS sig_failures,
      AVG(response_time_ms)::int AS avg_ms
    FROM webhooks
    WHERE endpoint_id = ANY(${endpointIds})
    AND created_at >= ${since.toISOString()}
    GROUP BY period
    ORDER BY period ASC
  `));

  return c.json({
    series: result.map((r: any) => ({
      period: r.period,
      total: parseInt(r.total),
      successes: parseInt(r.successes),
      errors: parseInt(r.errors),
      signatureFailures: parseInt(r.sig_failures),
      avgResponseMs: r.avg_ms ? parseInt(r.avg_ms) : 0,
    })),
  });
});

// ==========================================
// GET /api/analytics/endpoints
// Per-endpoint stats
// ==========================================
analyticsRoutes.get('/endpoints', async (c) => {
  const userId = c.get('userId');
  const db = createDb(c.env.DATABASE_URL);

  const result = (await db.execute(sql`
    SELECT
      we.id,
      we.name,
      we.provider,
      we.webhook_count,
      we.last_webhook_at,
      COUNT(w.id) FILTER (WHERE w.created_at > NOW() - INTERVAL '24 hours') AS last_24h,
      COUNT(w.id) FILTER (WHERE w.response_code >= 400 AND w.created_at > NOW() - INTERVAL '7 days') AS errors_7d,
      AVG(w.response_time_ms) FILTER (WHERE w.created_at > NOW() - INTERVAL '7 days')::int AS avg_ms_7d
    FROM webhook_endpoints we
    LEFT JOIN webhooks w ON w.endpoint_id = we.id
    WHERE we.user_id = ${userId}
    GROUP BY we.id, we.name, we.provider, we.webhook_count, we.last_webhook_at
    ORDER BY we.last_webhook_at DESC NULLS LAST
  `));

  return c.json({
    endpoints: result.map((r: any) => ({
      id: r.id,
      name: r.name,
      provider: r.provider,
      totalWebhooks: parseInt(r.webhook_count || '0'),
      last24h: parseInt(r.last_24h || '0'),
      errors7d: parseInt(r.errors_7d || '0'),
      avgResponseMs7d: r.avg_ms_7d ? parseInt(r.avg_ms_7d) : 0,
      lastWebhookAt: r.last_webhook_at,
    })),
  });
});

export default analyticsRoutes;
