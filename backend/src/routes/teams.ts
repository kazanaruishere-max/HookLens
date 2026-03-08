/**
 * Team Routes — Phase 3
 * Full team management: invite, list, remove, role management
 */
import { Hono } from 'hono';
import { eq, and, inArray } from 'drizzle-orm';
import { z } from 'zod';
import { createDb } from '../lib/db';
import { teams, teamMembers, webhookEndpoints, users, activityLog } from '../db/schema';
import { AppEnv } from '../types';

const teamRoutes = new Hono<AppEnv>();

// ==========================================
// GET /api/teams — List user's teams
// ==========================================
teamRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const db = createDb(c.env.DATABASE_URL);

  // Teams where user is a member
  const memberships = await db.select({
    teamId: teamMembers.teamId,
    role: teamMembers.role,
    status: teamMembers.status,
  }).from(teamMembers)
    .where(and(eq(teamMembers.userId, userId), eq(teamMembers.status, 'active')));

  if (memberships.length === 0) return c.json({ teams: [] });

  const teamIds = memberships.map(m => m.teamId as string).filter(Boolean);
  const teamList = await db.select().from(teams).where(inArray(teams.id, teamIds));

  const result = teamList.map(team => ({
    ...team,
    role: memberships.find(m => m.teamId === team.id)?.role || 'member',
  }));

  return c.json({ teams: result });
});

// ==========================================
// POST /api/teams — Create team
// ==========================================
teamRoutes.post('/', async (c) => {
  const userId = c.get('userId');
  const userPlan = c.get('userPlan');

  if (userPlan !== 'team') {
    return c.json({ error: 'Team features require Team plan' }, 403);
  }

  const body = await c.req.json<{ name: string }>();
  if (!body.name?.trim()) return c.json({ error: 'Team name required' }, 400);

  const db = createDb(c.env.DATABASE_URL);

  const slug = body.name.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-') + '-' + Math.random().toString(36).slice(2, 6);

  const [team] = await db.insert(teams).values({
    ownerId: userId,
    name: body.name.trim(),
    slug,
  }).returning();

  // Add owner as a member
  await db.insert(teamMembers).values({
    teamId: team.id,
    userId,
    email: '', // Will be filled from user
    role: 'owner',
    status: 'active',
    acceptedAt: new Date(),
  });

  return c.json({ team }, 201);
});

// ==========================================
// GET /api/teams/:id — Team details
// ==========================================
teamRoutes.get('/:id', async (c) => {
  const userId = c.get('userId');
  const teamId = c.req.param('id');
  const db = createDb(c.env.DATABASE_URL);

  // Check membership
  const [membership] = await db.select().from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId), eq(teamMembers.status, 'active')));

  if (!membership) return c.json({ error: 'Team not found' }, 404);

  const [team] = await db.select().from(teams).where(eq(teams.id, teamId));
  if (!team) return c.json({ error: 'Team not found' }, 404);

  // Get all members with user info
  const members = await db.select({
    id: teamMembers.id,
    userId: teamMembers.userId,
    email: teamMembers.email,
    role: teamMembers.role,
    status: teamMembers.status,
    invitedAt: teamMembers.invitedAt,
    acceptedAt: teamMembers.acceptedAt,
    name: users.name,
    avatarUrl: users.avatarUrl,
  }).from(teamMembers)
    .leftJoin(users, eq(teamMembers.userId, users.id))
    .where(eq(teamMembers.teamId, teamId));

  return c.json({ team, members, myRole: membership.role });
});

// ==========================================
// POST /api/teams/:id/invite
// ==========================================
teamRoutes.post('/:id/invite', async (c) => {
  const userId = c.get('userId');
  const teamId = c.req.param('id');
  const body = await c.req.json<{ email: string; role?: string }>();

  if (!body.email?.includes('@')) return c.json({ error: 'Valid email required' }, 400);

  const db = createDb(c.env.DATABASE_URL);

  // Check that current user is owner/admin
  const [membership] = await db.select().from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId), eq(teamMembers.status, 'active')));

  if (!membership || !['owner', 'admin'].includes(membership.role || '')) {
    return c.json({ error: 'Insufficient permissions' }, 403);
  }

  // Generate invite token
  const inviteToken = crypto.randomUUID();

  await db.insert(teamMembers).values({
    teamId,
    userId: null,
    email: body.email.toLowerCase(),
    role: body.role || 'member',
    status: 'pending',
    inviteToken,
  });

  const inviteUrl = `${c.env.FRONTEND_URL}/teams/invite/${inviteToken}`;

  return c.json({ inviteUrl, inviteToken }, 201);
});

// ==========================================
// POST /api/teams/invite/:token/accept
// ==========================================
teamRoutes.post('/invite/:token/accept', async (c) => {
  const userId = c.get('userId');
  const token = c.req.param('token');
  const db = createDb(c.env.DATABASE_URL);

  const [invite] = await db.select().from(teamMembers)
    .where(and(eq(teamMembers.inviteToken, token), eq(teamMembers.status, 'pending')));

  if (!invite) return c.json({ error: 'Invalid or expired invite' }, 404);

  await db.update(teamMembers).set({
    userId,
    status: 'active',
    acceptedAt: new Date(),
    inviteToken: null,
  }).where(eq(teamMembers.id, invite.id));

  return c.json({ success: true, teamId: invite.teamId });
});

// ==========================================
// PATCH /api/teams/:id/members/:memberId — Update role
// ==========================================
teamRoutes.patch('/:id/members/:memberId', async (c) => {
  const userId = c.get('userId');
  const { id: teamId, memberId } = c.req.param();
  const body = await c.req.json<{ role: string }>();

  const validRoles = ['admin', 'member', 'viewer'];
  if (!validRoles.includes(body.role)) return c.json({ error: 'Invalid role' }, 400);

  const db = createDb(c.env.DATABASE_URL);

  const [myMembership] = await db.select().from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));

  if (myMembership?.role !== 'owner') return c.json({ error: 'Only owner can change roles' }, 403);

  await db.update(teamMembers).set({ role: body.role })
    .where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, teamId)));

  return c.json({ success: true });
});

// ==========================================
// DELETE /api/teams/:id/members/:memberId
// ==========================================
teamRoutes.delete('/:id/members/:memberId', async (c) => {
  const userId = c.get('userId');
  const { id: teamId, memberId } = c.req.param();
  const db = createDb(c.env.DATABASE_URL);

  const [myMembership] = await db.select().from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId)));

  if (!myMembership || !['owner', 'admin'].includes(myMembership.role || '')) {
    return c.json({ error: 'Insufficient permissions' }, 403);
  }

  await db.update(teamMembers).set({ status: 'removed' })
    .where(and(eq(teamMembers.id, memberId), eq(teamMembers.teamId, teamId)));

  return c.json({ success: true });
});

// ==========================================
// GET /api/teams/:id/activity
// ==========================================
teamRoutes.get('/:id/activity', async (c) => {
  const userId = c.get('userId');
  const teamId = c.req.param('id');
  const db = createDb(c.env.DATABASE_URL);

  const [membership] = await db.select().from(teamMembers)
    .where(and(eq(teamMembers.teamId, teamId), eq(teamMembers.userId, userId), eq(teamMembers.status, 'active')));

  if (!membership) return c.json({ error: 'Access denied' }, 403);

  const logs = await db.select({
    id: activityLog.id,
    action: activityLog.action,
    resourceType: activityLog.resourceType,
    resourceId: activityLog.resourceId,
    metadata: activityLog.metadata,
    createdAt: activityLog.createdAt,
    userName: users.name,
    userAvatar: users.avatarUrl,
  }).from(activityLog)
    .leftJoin(users, eq(activityLog.userId, users.id))
    .where(eq(activityLog.teamId, teamId))
    .orderBy(activityLog.createdAt)
    .limit(50);

  return c.json({ logs });
});

export default teamRoutes;
