/**
 * Comments Routes — Phase 3
 * Real-time discussion on webhook events
 */
import { Hono } from 'hono';
import { eq, and, isNull } from 'drizzle-orm';
import { webhookComments, users, webhooks } from '../db/schema';
import { AppEnv } from '../types';
import { createDb } from '../lib/db';

const commentRoutes = new Hono<AppEnv>();

// ==========================================
// GET /api/webhooks/:id/comments
// ==========================================
commentRoutes.get('/', async (c) => {
  const webhookId = c.req.param('webhookId');
  if (!webhookId) return c.json({ error: 'Webhook ID required' }, 400);

  const db = createDb(c.env.DATABASE_URL);

  const comments = await db.select({
    id: webhookComments.id,
    content: webhookComments.content,
    parentId: webhookComments.parentId,
    mentions: webhookComments.mentions,
    createdAt: webhookComments.createdAt,
    updatedAt: webhookComments.updatedAt,
    edited: webhookComments.edited,
    deleted: webhookComments.deleted,
    userId: webhookComments.userId,
    userName: users.name,
    userAvatar: users.avatarUrl,
  }).from(webhookComments)
    .leftJoin(users, eq(webhookComments.userId, users.id))
    .where(and(eq(webhookComments.webhookId, webhookId as string), eq(webhookComments.deleted, false)))
    .orderBy(webhookComments.createdAt);

  // Build tree structure
  const roots = comments.filter(c => !c.parentId);
  const replies = comments.filter(c => c.parentId);

  const tree = roots.map(root => ({
    ...root,
    replies: replies.filter(r => r.parentId === root.id),
  }));

  return c.json({ comments: tree, total: comments.length });
});

// ==========================================
// POST /api/webhooks/:id/comments
// ==========================================
commentRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  const webhookId = c.req.param('webhookId');
  if (!webhookId) return c.json({ error: 'Webhook ID required' }, 400);

  const body = await c.req.json<{ content: string; parentId?: string; mentions?: string[] }>();

  if (!body.content?.trim()) return c.json({ error: 'Content required' }, 400);
  if (body.content.length > 2000) return c.json({ error: 'Too long (max 2000 chars)' }, 400);

  const db = createDb(c.env.DATABASE_URL);

  // Verify webhook exists
  const [wh] = await db.select({ id: webhooks.id }).from(webhooks).where(eq(webhooks.id, webhookId as string));
  if (!wh) return c.json({ error: 'Webhook not found' }, 404);

  const [comment] = await db.insert(webhookComments).values({
    webhookId: webhookId as string,
    userId: userId as string,
    content: body.content.trim(),
    parentId: body.parentId || null,
    mentions: body.mentions || [],
  }).returning();

  // Fetch with user info
  const [full] = await db.select({
    id: webhookComments.id,
    content: webhookComments.content,
    parentId: webhookComments.parentId,
    mentions: webhookComments.mentions,
    createdAt: webhookComments.createdAt,
    edited: webhookComments.edited,
    userId: webhookComments.userId,
    userName: users.name,
    userAvatar: users.avatarUrl,
  }).from(webhookComments)
    .leftJoin(users, eq(webhookComments.userId, users.id))
    .where(eq(webhookComments.id, comment.id));

  return c.json({ comment: full }, 201);
});

// ==========================================
// PATCH /api/webhooks/:webhookId/comments/:id
// ==========================================
commentRoutes.patch('/:commentId', async (c) => {
  const userId = c.get('userId');
  const commentId = c.req.param('commentId');
  const body = await c.req.json<{ content: string }>();

  if (!body.content?.trim()) return c.json({ error: 'Content required' }, 400);

  const db = createDb(c.env.DATABASE_URL);

  const [existing] = await db.select().from(webhookComments)
    .where(and(eq(webhookComments.id, commentId), eq(webhookComments.userId, userId)));

  if (!existing) return c.json({ error: 'Comment not found' }, 404);

  await db.update(webhookComments).set({
    content: body.content.trim(),
    edited: true,
    updatedAt: new Date(),
  }).where(eq(webhookComments.id, commentId));

  return c.json({ success: true });
});

// ==========================================
// DELETE /api/webhooks/:webhookId/comments/:id
// ==========================================
commentRoutes.delete('/:commentId', async (c) => {
  const userId = c.get('userId');
  const commentId = c.req.param('commentId');
  const db = createDb(c.env.DATABASE_URL);

  const [existing] = await db.select().from(webhookComments)
    .where(and(eq(webhookComments.id, commentId), eq(webhookComments.userId, userId)));

  if (!existing) return c.json({ error: 'Comment not found' }, 404);

  // Soft delete
  await db.update(webhookComments).set({ deleted: true }).where(eq(webhookComments.id, commentId));

  return c.json({ success: true });
});

export default commentRoutes;
