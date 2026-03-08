/**
 * Auth Routes — Signup, Login, Me
 */
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { SignJWT } from 'jose';
import bcrypt from 'bcryptjs';
import { eq } from 'drizzle-orm';
import { createDb } from '../lib/db';
import { users } from '../db/schema';
import { AppEnv } from '../types';

async function hashPassword(password: string): Promise<string> {
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(password, salt);
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  return bcrypt.compare(password, storedHash);
}
const auth = new Hono<AppEnv>();

const SignupSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(8).max(128),
  name: z.string().min(1).max(255),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

// POST /auth/signup
auth.post('/signup', zValidator('json', SignupSchema), async (c) => {
  console.log('--- START SIGNUP ---');
  const { email, password, name } = c.req.valid('json');
  console.log('1. Connecting to DB with URL:', c.env.DATABASE_URL.substring(0, 15) + '...');
  const db = createDb(c.env.DATABASE_URL);

  // Check if user exists
  console.log('2. Checking if user exists');
  const existing = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (existing.length > 0) {
    return c.json({ error: 'Email already registered' }, 409);
  }

  // Hash password
  console.log('3. Hashing password');
  const passwordHash = await hashPassword(password);

  // Create user
  console.log('4. Inserting user');
  const [newUser] = await db.insert(users).values({
    email,
    passwordHash,
    name,
    authProvider: 'email',
  }).returning({
    id: users.id,
    email: users.email,
    name: users.name,
    plan: users.plan,
    createdAt: users.createdAt,
  });

  // Generate JWT
  console.log('5. Generating JWT');
  const token = await generateToken(newUser.id, newUser.email!, c.env.JWT_SECRET);

  console.log('--- END SIGNUP ---');
  return c.json({ user: newUser, token }, 201);
});

// POST /auth/login
auth.post('/login', zValidator('json', LoginSchema), async (c) => {
  const { email, password } = c.req.valid('json');
  const db = createDb(c.env.DATABASE_URL);

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);

  if (!user || !user.passwordHash) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  const passwordValid = await verifyPassword(password, user.passwordHash);
  if (!passwordValid) {
    return c.json({ error: 'Invalid credentials' }, 401);
  }

  // Update last seen
  await db.update(users).set({ lastSeenAt: new Date() }).where(eq(users.id, user.id));

  const token = await generateToken(user.id, user.email, c.env.JWT_SECRET);

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      plan: user.plan,
      avatarUrl: user.avatarUrl,
    },
    token,
  });
});

// GET /auth/me
auth.get('/me', async (c) => {
  const userId = c.get('userId');
  if (!userId) {
    return c.json({ error: 'Not authenticated' }, 401);
  }

  const db = createDb(c.env.DATABASE_URL);
  const [user] = await db.select({
    id: users.id,
    email: users.email,
    name: users.name,
    plan: users.plan,
    avatarUrl: users.avatarUrl,
    createdAt: users.createdAt,
  }).from(users).where(eq(users.id, userId)).limit(1);

  if (!user) {
    return c.json({ error: 'User not found' }, 404);
  }

  return c.json({ user });
});

async function generateToken(userId: string, email: string, jwtSecret: string): Promise<string> {
  const secret = new TextEncoder().encode(jwtSecret);
  return new SignJWT({ userId, email })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('7d')
    .sign(secret);
}

export default auth;
