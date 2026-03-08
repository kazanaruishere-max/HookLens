/**
 * API Keys Routes — Phase 4
 * Public REST API access via long-lived API keys
 */
import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { apiKeys } from '../db/schema';
import { AppEnv } from '../types';
import { createDb } from '../lib/db';

const apiKeyRoutes = new Hono<AppEnv>();

// ==========================================
// GET /api/api-keys — List API keys
// ==========================================
apiKeyRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const db = createDb(c.env.DATABASE_URL);

  const keys = await db.select({
    id: apiKeys.id,
    name: apiKeys.name,
    keyPrefix: apiKeys.keyPrefix,
    scopes: apiKeys.scopes,
    lastUsedAt: apiKeys.lastUsedAt,
    expiresAt: apiKeys.expiresAt,
    active: apiKeys.active,
    createdAt: apiKeys.createdAt,
  }).from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.active, true)))
    .orderBy(apiKeys.createdAt);

  return c.json({ keys });
});

// ==========================================
// POST /api/api-keys — Create API key
// ==========================================
apiKeyRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  const userPlan = c.get('userPlan');

  if (!['pro', 'team'].includes(userPlan)) {
    return c.json({ error: 'API access requires Pro or Team plan' }, 403);
  }

  const body = await c.req.json<{ name: string; scopes?: string[]; expiresInDays?: number }>();
  if (!body.name?.trim()) return c.json({ error: 'Key name required' }, 400);

  const db = createDb(c.env.DATABASE_URL);

  // Check key limit (max 10 per user)
  const existing = await db.select({ id: apiKeys.id }).from(apiKeys)
    .where(and(eq(apiKeys.userId, userId), eq(apiKeys.active, true)));

  if (existing.length >= 10) return c.json({ error: 'Maximum 10 API keys allowed' }, 400);

  // Generate a secure random key
  const rawKey = `hl_${crypto.randomUUID().replace(/-/g, '')}`; // hl_abc123...
  const prefix = rawKey.substring(0, 12);

  // Hash using SHA-256
  const hashBuffer = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rawKey));
  const keyHash = Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');

  const expiresAt = body.expiresInDays
    ? new Date(Date.now() + body.expiresInDays * 86400000)
    : null;

  const [key] = await db.insert(apiKeys).values({
    userId,
    name: body.name.trim(),
    keyHash,
    keyPrefix: prefix,
    scopes: body.scopes || ['read'],
    expiresAt,
  }).returning({
    id: apiKeys.id,
    name: apiKeys.name,
    keyPrefix: apiKeys.keyPrefix,
    scopes: apiKeys.scopes,
    expiresAt: apiKeys.expiresAt,
    createdAt: apiKeys.createdAt,
  });

  // Return the full key ONCE — never again
  return c.json({ key: { ...key, fullKey: rawKey } }, 201);
});

// ==========================================
// DELETE /api/api-keys/:id — Revoke key
// ==========================================
apiKeyRoutes.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const keyId = c.req.param('id');
  const db = createDb(c.env.DATABASE_URL);

  const [key] = await db.select().from(apiKeys)
    .where(and(eq(apiKeys.id, keyId), eq(apiKeys.userId, userId)));

  if (!key) return c.json({ error: 'API key not found' }, 404);

  await db.update(apiKeys).set({ active: false }).where(eq(apiKeys.id, keyId));
  return c.json({ success: true });
});

export default apiKeyRoutes;
