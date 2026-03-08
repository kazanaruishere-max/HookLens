/**
 * Search Route — Phase 2
 * Full-text search across webhook payloads, event types, providers
 */
import { Hono } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import { webhookEndpoints, webhooks } from '../db/schema';
import { AppEnv } from '../types';
import { createDb } from '../lib/db';

const searchRoutes = new Hono<AppEnv>();

// ==========================================
// GET /api/search
// Query params: q, provider, status, from, to, endpointId, page
// ==========================================
searchRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const q = c.req.query('q') || '';
  const provider = c.req.query('provider');
  const status = c.req.query('status'); // 'success' | 'error' | 'invalid_sig'
  const fromDate = c.req.query('from');
  const toDate = c.req.query('to');
  const endpointId = c.req.query('endpointId');
  const page = Math.max(1, parseInt(c.req.query('page') || '1'));
  const limit = 20;

  const db = createDb(c.env.DATABASE_URL);

  // Get user's endpoint IDs first
  let endpointIds: string[];
  if (endpointId) {
    // Verify ownership
    const [ep] = await db.select({ id: webhookEndpoints.id })
      .from(webhookEndpoints)
      .where(and(eq(webhookEndpoints.id, endpointId), eq(webhookEndpoints.userId, userId)));
    if (!ep) return c.json({ error: 'Endpoint not found' }, 404);
    endpointIds = [endpointId];
  } else {
    const eps = await db.select({ id: webhookEndpoints.id })
      .from(webhookEndpoints).where(eq(webhookEndpoints.userId, userId));
    endpointIds = eps.map(e => e.id);
  }

  if (endpointIds.length === 0) return c.json({ results: [], total: 0 });

  // Build search using raw SQL for full-text search capability
  const offset = (page - 1) * limit;

  const conditions = [sql`w.endpoint_id = ANY(${endpointIds})`];

  if (q) {
    conditions.push(sql`(
      w.event_type ILIKE ${`%${q}%`}
      OR w.payload::text ILIKE ${`%${q}%`}
      OR w.ip_address ILIKE ${`%${q}%`}
    )`);
  }

  if (provider) {
    conditions.push(sql`w.provider = ${provider}`);
  }

  if (status === 'success') {
    conditions.push(sql`w.response_code >= 200 AND w.response_code < 300`);
  } else if (status === 'error') {
    conditions.push(sql`w.response_code >= 400`);
  } else if (status === 'invalid_sig') {
    conditions.push(sql`w.signature_valid = false`);
  }

  if (fromDate) {
    conditions.push(sql`w.created_at >= ${fromDate}`);
  }

  if (toDate) {
    conditions.push(sql`w.created_at <= ${toDate}`);
  }

  const where = sql.join(conditions, sql` AND `);

  const countResult = await db.execute(sql`
    SELECT COUNT(*) AS total FROM webhooks w WHERE ${where}
  `);

  const total = parseInt((countResult[0] as { total: string }).total || '0');

  const results = await db.execute(sql`
    SELECT
      w.id, w.endpoint_id, w.provider, w.event_type, w.method,
      w.response_code, w.response_time_ms, w.signature_valid,
      w.ai_analyzed, w.forwarded, w.shared, w.created_at,
      we.name AS endpoint_name
    FROM webhooks w
    LEFT JOIN webhook_endpoints we ON we.id = w.endpoint_id
    WHERE ${where}
    ORDER BY w.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `);

  return c.json({
    results,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  });
});

export default searchRoutes;
