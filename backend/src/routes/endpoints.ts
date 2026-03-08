/**
 * Endpoint Management Routes
 * PRD: US-1.1 (Create), FR-1 (Webhook Capture setup)
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { eq, and, desc } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { createDb } from '../lib/db';
import { webhookEndpoints } from '../db/schema';
import { encrypt } from '../lib/crypto';
import { AppEnv } from '../types';

const endpoints = new Hono<AppEnv>();

const CreateEndpointSchema = z.object({
  name: z.string().min(1).max(255),
  provider: z.enum(['stripe', 'github', 'shopify', 'twilio', 'sendgrid', 'generic']).optional(),
  signingSecret: z.string().min(1).max(500).optional(),
  description: z.string().max(1000).optional(),
});

const UpdateEndpointSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  provider: z.enum(['stripe', 'github', 'shopify', 'twilio', 'sendgrid', 'generic']).optional(),
  signingSecret: z.string().min(1).max(500).optional(),
  description: z.string().max(1000).optional(),
  active: z.boolean().optional(),
});

// POST /api/endpoints
endpoints.post('/', zValidator('json', CreateEndpointSchema), async (c) => {
  const userId = c.get('userId');
  const { name, provider, signingSecret, description } = c.req.valid('json');
  const db = createDb(c.env.DATABASE_URL);

  const slug = nanoid(9);

  let encryptedSecret = null;
  if (signingSecret) {
    encryptedSecret = await encrypt(signingSecret, c.env.ENCRYPTION_KEY);
  }

  const [endpoint] = await db.insert(webhookEndpoints).values({
    userId,
    name,
    slug,
    description: description || null,
    provider: provider || null,
    signingSecret: encryptedSecret,
  }).returning();

  return c.json({
    id: endpoint.id,
    slug: endpoint.slug,
    url: `${c.env.FRONTEND_URL?.replace('localhost:3000', 'localhost:8787')}/w/${endpoint.slug}`,
    name: endpoint.name,
    provider: endpoint.provider,
    description: endpoint.description,
    active: endpoint.active,
    createdAt: endpoint.createdAt,
  }, 201);
});

// GET /api/endpoints
endpoints.get('/', async (c) => {
  const userId = c.get('userId');
  const db = createDb(c.env.DATABASE_URL);

  const result = await db.select({
    id: webhookEndpoints.id,
    slug: webhookEndpoints.slug,
    name: webhookEndpoints.name,
    provider: webhookEndpoints.provider,
    description: webhookEndpoints.description,
    active: webhookEndpoints.active,
    webhookCount: webhookEndpoints.webhookCount,
    lastWebhookAt: webhookEndpoints.lastWebhookAt,
    createdAt: webhookEndpoints.createdAt,
  }).from(webhookEndpoints)
    .where(eq(webhookEndpoints.userId, userId))
    .orderBy(desc(webhookEndpoints.createdAt));

  const endpointsWithUrl = result.map((ep) => ({
    ...ep,
    url: `${c.env.FRONTEND_URL?.replace('localhost:3000', 'localhost:8787')}/w/${ep.slug}`,
  }));

  return c.json({ endpoints: endpointsWithUrl, total: result.length });
});

// GET /api/endpoints/:id
endpoints.get('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const db = createDb(c.env.DATABASE_URL);

  const [endpoint] = await db.select().from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.userId, userId)))
    .limit(1);

  if (!endpoint) {
    return c.json({ error: 'Endpoint not found' }, 404);
  }

  return c.json({
    ...endpoint,
    signingSecret: endpoint.signingSecret ? '********' : null, // Never expose encrypted secret
    url: `${c.env.FRONTEND_URL?.replace('localhost:3000', 'localhost:8787')}/w/${endpoint.slug}`,
  });
});

// PATCH /api/endpoints/:id
endpoints.patch('/:id', zValidator('json', UpdateEndpointSchema), async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const updates = c.req.valid('json');
  const db = createDb(c.env.DATABASE_URL);

  // Verify ownership
  const [existing] = await db.select({ id: webhookEndpoints.id }).from(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.userId, userId)))
    .limit(1);

  if (!existing) {
    return c.json({ error: 'Endpoint not found' }, 404);
  }

  const updateData: Record<string, unknown> = { updatedAt: new Date() };
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.provider !== undefined) updateData.provider = updates.provider;
  if (updates.description !== undefined) updateData.description = updates.description;
  if (updates.active !== undefined) updateData.active = updates.active;
  if (updates.signingSecret !== undefined) {
    updateData.signingSecret = await encrypt(updates.signingSecret, c.env.ENCRYPTION_KEY);
  }

  const [updated] = await db.update(webhookEndpoints)
    .set(updateData)
    .where(eq(webhookEndpoints.id, id))
    .returning();

  return c.json({
    id: updated.id,
    name: updated.name,
    provider: updated.provider,
    active: updated.active,
    updatedAt: updated.updatedAt,
  });
});

// DELETE /api/endpoints/:id
endpoints.delete('/:id', async (c) => {
  const userId = c.get('userId');
  const id = c.req.param('id');
  const db = createDb(c.env.DATABASE_URL);

  const result = await db.delete(webhookEndpoints)
    .where(and(eq(webhookEndpoints.id, id), eq(webhookEndpoints.userId, userId)))
    .returning({ id: webhookEndpoints.id });

  if (result.length === 0) {
    return c.json({ error: 'Endpoint not found' }, 404);
  }

  return c.json({ success: true, message: 'Endpoint deleted' });
});

export default endpoints;
