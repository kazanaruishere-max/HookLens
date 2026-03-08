# ⚙️ HookLens - Tech Stack Specification

**Version:** 1.0  
**Last Updated:** 2026-03-01  
**Document Owner:** Engineering Team  
**Status:** Approved for Implementation  
**Related Documents:**
- [HookLens PRD v1.0](./HookLens-PRD.md)
- [HookLens Design Document v1.0](./HookLens-DesignDoc.md)

---

## 📑 Table of Contents

1. [Stack Overview](#stack-overview)
2. [Frontend Stack](#frontend-stack)
3. [Backend Stack](#backend-stack)
4. [Database & Storage](#database--storage)
5. [Infrastructure & Deployment](#infrastructure--deployment)
6. [Third-Party Services](#third-party-services)
7. [Development Tools](#development-tools)
8. [Dependencies & Versions](#dependencies--versions)
9. [Configuration & Environment](#configuration--environment)
10. [Setup Instructions](#setup-instructions)
11. [CI/CD Pipeline](#cicd-pipeline)
12. [Cost Breakdown](#cost-breakdown)

---

## 🏗️ Stack Overview

### Technology Selection Principles

All technology choices are driven by **PRD requirements** and **Design Document architecture**:

1. **Performance First** (PRD NFR-1): Edge computing, CDN, caching
2. **Developer Experience** (PRD NFR-6): TypeScript, type-safe ORMs, modern tooling
3. **Scalability** (PRD NFR-2): Serverless, auto-scaling, horizontal scalability
4. **Cost Efficiency**: Maximize free tiers, serverless pricing models
5. **Security** (PRD NFR-4): Industry-standard encryption, secure dependencies

### Stack at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                         FRONTEND                                │
│                                                                 │
│  Next.js 15 (App Router) + React 19 + TypeScript               │
│  Tailwind CSS v4 + Shadcn UI                                    │
│  Socket.io-client (Real-time)                                   │
│  React Query + Zustand (State)                                  │
│                                                                 │
│  Deployed on: Vercel                                            │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         BACKEND                                 │
│                                                                 │
│  Hono.js (Cloudflare Workers) - API + Ingestion                 │
│  Node.js 20 (Railway) - WebSocket Server                        │
│  TypeScript (Strict Mode)                                       │
│  Drizzle ORM (Type-safe queries)                                │
│                                                                 │
│  Deployed on: Cloudflare Workers + Railway                      │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                      DATABASE & CACHE                           │
│                                                                 │
│  PostgreSQL 16 (Supabase) - User data, endpoints                │
│  TimescaleDB Extension - Webhooks (time-series)                 │
│  Redis 7 (Upstash) - Cache, Pub/Sub, Job Queue                  │
│                                                                 │
│  Managed Services                                               │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                   THIRD-PARTY SERVICES                          │
│                                                                 │
│  OpenRouter (Claude 3.5 Sonnet) - AI Analysis                  │
│  Stripe - Payment Processing                                    │
│  Resend - Transactional Emails                                  │
│  Sentry - Error Tracking                                        │
│  Plausible - Privacy-First Analytics                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🎨 Frontend Stack

### Core Framework: Next.js 15

**Why Next.js 15?**
- ✅ **App Router** (Server Components, Suspense, Streaming) → PRD NFR-1.2 (<2s page load)
- ✅ **Edge Rendering** → Fast global performance
- ✅ **Built-in API Routes** → Simplifies architecture
- ✅ **Vercel Deployment** → Zero-config, auto-scaling

**Version:** `15.1.0`  
**PRD Alignment:** TR-1 (Frontend Stack requirement)

**Key Features Used:**
```typescript
// app/dashboard/page.tsx (Server Component)
export default async function DashboardPage() {
  // Fetch data on server (fast, SEO-friendly)
  const endpoints = await getEndpoints();
  
  return (
    <div>
      <EndpointList endpoints={endpoints} />
      <RealtimeUpdates /> {/* Client component for WebSocket */}
    </div>
  );
}
```

---

### UI Framework: React 19

**Why React 19?**
- ✅ **Server Components** → Reduce JavaScript bundle size
- ✅ **Concurrent Rendering** → Smooth UI updates
- ✅ **Suspense for Data Fetching** → Better loading states

**Version:** `19.0.0`

**Usage Example:**
```typescript
// components/WebhookList.tsx
import { Suspense } from 'react';

export function WebhookList({ endpointId }: { endpointId: string }) {
  return (
    <Suspense fallback={<LoadingSkeleton />}>
      <WebhookListAsync endpointId={endpointId} />
    </Suspense>
  );
}
```

---

### Styling: Tailwind CSS v4 + Shadcn UI

**Why Tailwind CSS v4?**
- ✅ **Lightning-Fast Builds** (Oxide engine in Rust)
- ✅ **Zero Runtime** → No JavaScript overhead
- ✅ **JIT Compiler** → Only includes used classes
- ✅ **PRD UX-4:** Mobile responsive (360px breakpoints)

**Version:** `4.0.0-alpha.20`

**Configuration:**
```typescript
// tailwind.config.ts
import type { Config } from 'tailwindcss';

export default {
  content: [
    './app/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // HookLens brand colors
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          500: '#0ea5e9', // Teal
          600: '#0284c7',
          700: '#0369a1',
        },
      },
      screens: {
        xs: '360px', // PRD UX-4: Mobile breakpoint
      },
    },
  },
  darkMode: 'class', // PRD Phase 2: Dark mode
} satisfies Config;
```

**Why Shadcn UI?**
- ✅ **Copy-Paste Components** → No npm bloat
- ✅ **Accessible** (WCAG 2.1 AA) → PRD NFR-5.4
- ✅ **Customizable** → Match HookLens brand
- ✅ **Radix UI Primitives** → Production-ready

**Installed Components:**
```bash
npx shadcn-ui@latest add button
npx shadcn-ui@latest add card
npx shadcn-ui@latest add dialog
npx shadcn-ui@latest add dropdown-menu
npx shadcn-ui@latest add input
npx shadcn-ui@latest add toast
npx shadchn-ui@latest add tabs
npx shadcn-ui@latest add badge
```

---

### State Management

#### Global State: Zustand

**Why Zustand?**
- ✅ **Lightweight** (1KB) → Fast page loads
- ✅ **No Boilerplate** → Simple API
- ✅ **TypeScript First** → Type-safe

**Version:** `4.5.0`

**Usage:**
```typescript
// stores/auth-store.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      token: null,
      login: async (email, password) => {
        const response = await fetch('/api/auth/login', {
          method: 'POST',
          body: JSON.stringify({ email, password }),
        });
        const { user, token } = await response.json();
        set({ user, token });
      },
      logout: () => set({ user: null, token: null }),
    }),
    {
      name: 'auth-storage',
    }
  )
);
```

#### Server State: React Query (TanStack Query)

**Why React Query?**
- ✅ **Automatic Caching** → Reduce API calls
- ✅ **Background Refetching** → Always fresh data
- ✅ **Optimistic Updates** → Instant UI feedback
- ✅ **PRD NFR-1:** Performance optimization

**Version:** `5.17.0`

**Usage:**
```typescript
// hooks/use-webhooks.ts
import { useQuery } from '@tanstack/react-query';

export function useWebhooks(endpointId: string) {
  return useQuery({
    queryKey: ['webhooks', endpointId],
    queryFn: async () => {
      const response = await fetch(`/api/webhooks?endpointId=${endpointId}`);
      return response.json();
    },
    refetchInterval: 5000, // Refetch every 5s (backup to WebSocket)
    staleTime: 3000, // Consider data fresh for 3s
  });
}
```

---

### Real-Time: Socket.io Client

**Why Socket.io?**
- ✅ **WebSocket + Fallback** → Works everywhere (PRD FR-2.3)
- ✅ **Reconnection Logic** → Handles network issues
- ✅ **Room-Based** → Subscribe to specific endpoints

**Version:** `4.7.0`

**Usage:**
```typescript
// hooks/use-realtime.ts
import { useEffect } from 'react';
import { io, Socket } from 'socket.io-client';
import { useAuthStore } from '@/stores/auth-store';

export function useRealtime(endpointId: string) {
  const token = useAuthStore((state) => state.token);
  
  useEffect(() => {
    const socket = io(process.env.NEXT_PUBLIC_WS_URL!, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    
    socket.on('connect', () => {
      console.log('Connected to WebSocket');
      socket.emit('subscribe', endpointId);
    });
    
    socket.on('webhook_received', (data) => {
      // Update React Query cache
      queryClient.invalidateQueries(['webhooks', endpointId]);
      
      // Show toast notification
      toast.success('New webhook received');
    });
    
    return () => {
      socket.emit('unsubscribe', endpointId);
      socket.disconnect();
    };
  }, [endpointId, token]);
}
```

---

### Code Display: Monaco Editor

**Why Monaco?**
- ✅ **VSCode's Editor** → Familiar to developers
- ✅ **Syntax Highlighting** → JSON, JavaScript, Python
- ✅ **Search (Ctrl+F)** → PRD US-1.3

**Version:** `0.45.0` (via `@monaco-editor/react`)

**Usage:**
```typescript
// components/JsonViewer.tsx
import Editor from '@monaco-editor/react';

export function JsonViewer({ json }: { json: object }) {
  return (
    <Editor
      height="400px"
      language="json"
      value={JSON.stringify(json, null, 2)}
      theme="vs-dark"
      options={{
        readOnly: true,
        minimap: { enabled: false },
        fontSize: 14,
        scrollBeyondLastLine: false,
      }}
    />
  );
}
```

---

### Additional Frontend Dependencies

```json
{
  "dependencies": {
    // Core
    "next": "15.1.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "typescript": "5.3.3",
    
    // Styling
    "tailwindcss": "4.0.0-alpha.20",
    "@tailwindcss/typography": "0.5.10",
    "clsx": "2.1.0",
    "tailwind-merge": "2.2.0",
    
    // UI Components
    "@radix-ui/react-dialog": "1.0.5",
    "@radix-ui/react-dropdown-menu": "2.0.6",
    "@radix-ui/react-toast": "1.1.5",
    "@radix-ui/react-tabs": "1.0.4",
    
    // State Management
    "zustand": "4.5.0",
    "@tanstack/react-query": "5.17.0",
    
    // Real-time
    "socket.io-client": "4.7.0",
    
    // Code Editor
    "@monaco-editor/react": "4.6.0",
    
    // Forms
    "react-hook-form": "7.49.0",
    "zod": "3.22.4",
    "@hookform/resolvers": "3.3.3",
    
    // Charts (for analytics)
    "recharts": "2.10.0",
    
    // Utilities
    "date-fns": "3.0.0",
    "copy-to-clipboard": "3.3.3",
    "nanoid": "5.0.4"
  }
}
```

---

## ⚙️ Backend Stack

### API Framework: Hono.js

**Why Hono?**
- ✅ **Ultra-Fast** (3x faster than Express) → PRD NFR-1.1 (<100ms)
- ✅ **Edge-Compatible** → Runs on Cloudflare Workers
- ✅ **TypeScript Native** → Type-safe routing
- ✅ **Lightweight** (12KB) → Cold start <10ms

**Version:** `4.0.0`  
**PRD Alignment:** TR-2 (Backend Stack), Design Doc Component 1 & 2

**Project Structure:**
```
backend/
├── src/
│   ├── index.ts              # Main entry point
│   ├── routes/
│   │   ├── auth.ts           # /api/auth/*
│   │   ├── endpoints.ts      # /api/endpoints/*
│   │   ├── webhooks.ts       # /api/webhooks/*
│   │   └── ingestion.ts      # /w/:endpointId (webhook receiver)
│   ├── middleware/
│   │   ├── auth.ts           # JWT validation
│   │   ├── rate-limit.ts     # Rate limiting (PRD NFR-4.3)
│   │   └── cors.ts           # CORS config
│   ├── services/
│   │   ├── provider-detector.ts
│   │   ├── signature-validator.ts
│   │   └── ai-analyzer.ts
│   └── lib/
│       ├── db.ts             # Database client
│       ├── redis.ts          # Redis client
│       └── crypto.ts         # Encryption helpers
└── wrangler.toml             # Cloudflare config
```

**Main Application:**
```typescript
// src/index.ts
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { logger } from 'hono/logger';
import { authMiddleware } from './middleware/auth';
import { rateLimitMiddleware } from './middleware/rate-limit';
import authRoutes from './routes/auth';
import endpointsRoutes from './routes/endpoints';
import webhooksRoutes from './routes/webhooks';
import ingestionRoute from './routes/ingestion';

const app = new Hono();

// Global middleware
app.use('*', logger());
app.use('*', cors({
  origin: process.env.FRONTEND_URL!,
  credentials: true,
}));

// Public routes (no auth)
app.route('/auth', authRoutes);
app.route('/w', ingestionRoute); // Webhook ingestion

// Protected routes (require auth)
app.use('/api/*', authMiddleware);
app.use('/api/*', rateLimitMiddleware);
app.route('/api/endpoints', endpointsRoutes);
app.route('/api/webhooks', webhooksRoutes);

// Health check
app.get('/health', (c) => c.json({ status: 'ok' }));

export default app;
```

**Example Route:**
```typescript
// src/routes/endpoints.ts
import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { nanoid } from 'nanoid';

const endpoints = new Hono();

const CreateEndpointSchema = z.object({
  name: z.string().min(1).max(255),
  provider: z.enum(['stripe', 'github', 'shopify', 'twilio', 'sendgrid', 'generic']).optional(),
  signingSecret: z.string().optional(),
});

endpoints.post('/', zValidator('json', CreateEndpointSchema), async (c) => {
  const userId = c.get('userId'); // From auth middleware
  const { name, provider, signingSecret } = c.req.valid('json');
  
  // Generate unique slug (PRD US-1.1)
  const slug = nanoid(9); // abc123xyz
  
  // Encrypt signing secret (PRD NFR-4.2)
  const encryptedSecret = signingSecret 
    ? await encrypt(signingSecret, c.env.ENCRYPTION_KEY)
    : null;
  
  // Insert into database
  const endpoint = await c.env.DB.query(
    `INSERT INTO webhook_endpoints 
     (user_id, name, slug, provider, signing_secret) 
     VALUES ($1, $2, $3, $4, $5) 
     RETURNING *`,
    [userId, name, slug, provider, encryptedSecret]
  );
  
  return c.json({
    id: endpoint.id,
    slug: endpoint.slug,
    url: `https://hooks.hooklens.dev/w/${endpoint.slug}`,
    name: endpoint.name,
    provider: endpoint.provider,
    active: true,
    createdAt: endpoint.created_at,
  }, 201);
});

endpoints.get('/', async (c) => {
  const userId = c.get('userId');
  
  const endpoints = await c.env.DB.query(
    'SELECT * FROM webhook_endpoints WHERE user_id = $1 ORDER BY created_at DESC',
    [userId]
  );
  
  return c.json({ endpoints, total: endpoints.length });
});

export default endpoints;
```

---

### WebSocket Server: Node.js 20 + Socket.io

**Why Node.js + Socket.io?**
- ✅ **Real-Time** → PRD FR-2 (WebSocket requirement)
- ✅ **Mature Ecosystem** → Socket.io battle-tested
- ✅ **Redis Pub/Sub** → Horizontal scaling

**Version:** Node.js `20.11.0`, Socket.io `4.7.0`  
**Deployed on:** Railway (Free $5 credit, then $5/month)

**Implementation:**
```typescript
// websocket-server/src/index.ts
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';

const PORT = process.env.PORT || 3001;

const httpServer = createServer();
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
  transports: ['websocket', 'polling'],
});

// Redis clients
const redis = new Redis(process.env.REDIS_URL!);
const subscriber = new Redis(process.env.REDIS_URL!);

// Authenticate connections
io.use((socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) return next(new Error('Authentication required'));
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET!);
    socket.data.userId = decoded.userId;
    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
});

// Connection handler
io.on('connection', (socket) => {
  console.log(`User connected: ${socket.data.userId}`);
  
  socket.on('subscribe', (endpointId: string) => {
    socket.join(`endpoint:${endpointId}`);
  });
  
  socket.on('unsubscribe', (endpointId: string) => {
    socket.leave(`endpoint:${endpointId}`);
  });
  
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.data.userId}`);
  });
});

// Subscribe to Redis Pub/Sub
subscriber.subscribe('webhooks:new', 'webhooks:analyzed');

subscriber.on('message', (channel, message) => {
  const data = JSON.parse(message);
  
  if (channel === 'webhooks:new') {
    io.to(`endpoint:${data.endpointId}`).emit('webhook_received', data);
  } else if (channel === 'webhooks:analyzed') {
    io.to(`endpoint:${data.endpointId}`).emit('analysis_complete', data);
  }
});

httpServer.listen(PORT, () => {
  console.log(`WebSocket server listening on port ${PORT}`);
});
```

**Package.json:**
```json
{
  "name": "hooklens-websocket",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "socket.io": "^4.7.0",
    "ioredis": "^5.3.2",
    "jsonwebtoken": "^9.0.2"
  },
  "devDependencies": {
    "@types/node": "^20.11.0",
    "tsx": "^4.7.0",
    "typescript": "^5.3.3"
  }
}
```

---

### ORM: Drizzle ORM

**Why Drizzle?**
- ✅ **Type-Safe** → No SQL injection (PRD NFR-4.5)
- ✅ **Zero Runtime** → Compiles to SQL
- ✅ **Edge-Compatible** → Works on Cloudflare Workers
- ✅ **Lightweight** → 7KB (vs Prisma 100KB+)

**Version:** `0.29.0`  
**PRD Alignment:** TR-2 (ORM requirement)

**Schema Definition:**
```typescript
// db/schema.ts
import { pgTable, uuid, varchar, text, timestamp, boolean, bigint, jsonb, inet, integer } from 'drizzle-orm/pg-core';

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  name: varchar('name', { length: 255 }),
  avatarUrl: text('avatar_url'),
  authProvider: varchar('auth_provider', { length: 50 }).default('email'),
  plan: varchar('plan', { length: 50 }).default('free'),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  provider: varchar('provider', { length: 50 }),
  signingSecret: text('signing_secret'), // Encrypted
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastWebhookAt: timestamp('last_webhook_at'),
  webhookCount: bigint('webhook_count', { mode: 'number' }).default(0),
});

export const webhooks = pgTable('webhooks', {
  time: timestamp('time', { withTimezone: true }).notNull(),
  id: uuid('id').primaryKey().defaultRandom(),
  endpointId: uuid('endpoint_id').notNull(),
  provider: varchar('provider', { length: 50 }),
  eventType: varchar('event_type', { length: 255 }),
  method: varchar('method', { length: 10 }).default('POST'),
  headers: jsonb('headers').notNull(),
  payload: jsonb('payload').notNull(),
  ipAddress: inet('ip_address'),
  userAgent: text('user_agent'),
  responseCode: integer('response_code'),
  responseBody: text('response_body'),
  responseTimeMs: integer('response_time_ms'),
  signatureValid: boolean('signature_valid'),
  signatureHeader: varchar('signature_header', { length: 255 }),
  signatureAlgorithm: varchar('signature_algorithm', { length: 50 }),
  aiAnalyzed: boolean('ai_analyzed').default(false),
  aiInsights: jsonb('ai_insights'),
  forwarded: boolean('forwarded').default(false),
  shared: boolean('shared').default(false),
  shareToken: varchar('share_token', { length: 100 }).unique(),
});
```

**Usage:**
```typescript
// Example query
import { eq } from 'drizzle-orm';
import { db } from './db';
import { webhookEndpoints } from './schema';

// Type-safe query
const endpoint = await db
  .select()
  .from(webhookEndpoints)
  .where(eq(webhookEndpoints.slug, 'abc123xyz'))
  .limit(1);

// Type-safe insert
const newEndpoint = await db
  .insert(webhookEndpoints)
  .values({
    userId: 'user-uuid',
    name: 'Production Stripe',
    slug: 'abc123xyz',
  })
  .returning();
```

---

## 🗄️ Database & Storage

### Primary Database: PostgreSQL 16 (Supabase)

**Why Supabase?**
- ✅ **Managed PostgreSQL** → No DevOps overhead
- ✅ **Free Tier** → 500MB database, 2GB transfer (PRD: zero-cost MVP)
- ✅ **Built-in Auth** → Can use Supabase Auth (optional)
- ✅ **Auto-Scaling** → Upgrade to Pro when needed

**Version:** PostgreSQL `16.1`  
**Free Tier Limits:**
- 500MB database storage
- Unlimited API requests
- 2GB bandwidth/month
- Daily backups (7 days retention)

**Upgrade Path:**
- Pro tier: $25/month (8GB database, 250GB bandwidth)
- Activate when: >300 users or >400MB data

**Connection String:**
```
postgresql://postgres.[PROJECT_ID]:[PASSWORD]@aws-0-us-west-1.pooler.supabase.com:6543/postgres
```

**Extensions Enabled:**
```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";
CREATE EXTENSION IF NOT EXISTS "timescaledb"; -- For time-series
```

---

### Time-Series Database: TimescaleDB

**Why TimescaleDB?**
- ✅ **Optimized for Webhooks** → Time-series data (PRD Design Doc)
- ✅ **PostgreSQL Extension** → No separate database
- ✅ **Auto-Partitioning** → Fast queries even with millions of webhooks
- ✅ **Retention Policies** → Auto-delete old data (PRD FR-1.3: 90 days)

**Version:** `2.13.0` (via Supabase)

**Limitations on Supabase Free Tier:**
- ⚠️ TimescaleDB extension NOT available on free tier
- **Workaround for MVP:** Use regular PostgreSQL with time-based indexes
- **Upgrade when:** Move to paid tier ($25/month) or self-host

**Alternative (Zero-Cost):**
```sql
-- Use regular table with efficient indexes (good for 0-100k webhooks)
CREATE TABLE webhooks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  endpoint_id UUID NOT NULL,
  -- ... other fields
);

CREATE INDEX idx_webhooks_time ON webhooks(created_at DESC);
CREATE INDEX idx_webhooks_endpoint_time ON webhooks(endpoint_id, created_at DESC);

-- Auto-delete with pg_cron (built into Supabase)
SELECT cron.schedule(
  'delete-old-webhooks',
  '0 2 * * *', -- Daily at 2 AM
  $$DELETE FROM webhooks WHERE created_at < NOW() - INTERVAL '90 days'$$
);
```

---

### Cache & Pub/Sub: Redis (Upstash)

**Why Upstash?**
- ✅ **Serverless Redis** → Pay-per-request (PRD: zero-cost)
- ✅ **Global Edge** → Low latency (<50ms)
- ✅ **Free Tier** → 10,000 commands/day (enough for MVP)
- ✅ **Pub/Sub Support** → WebSocket real-time (PRD FR-2)

**Version:** Redis `7.2`  
**Free Tier:**
- 10,000 commands/day
- 256MB max memory
- Regional deployment (us-east-1)

**Upgrade Path:**
- Pay-as-you-go: $0.2 per 100k commands
- Activate when: >8k commands/day

**Usage:**
```typescript
// lib/redis.ts
import { Redis } from '@upstash/redis';

export const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// Cache example (PRD FR-4.5)
export async function getCachedAnalysis(webhookId: string) {
  const cached = await redis.get(`analysis:${webhookId}`);
  if (cached) return JSON.parse(cached as string);
  return null;
}

export async function setCachedAnalysis(webhookId: string, analysis: any) {
  await redis.setex(`analysis:${webhookId}`, 3600, JSON.stringify(analysis)); // 1 hour
}

// Pub/Sub example (PRD FR-2)
export async function publishWebhookEvent(endpointId: string, webhookData: any) {
  await redis.publish('webhooks:new', JSON.stringify({
    endpointId,
    ...webhookData,
  }));
}
```

---

## 🌐 Infrastructure & Deployment

### Frontend Hosting: Vercel

**Why Vercel?**
- ✅ **Next.js Native** → Zero-config deployment
- ✅ **Edge Network** → Global CDN (PRD NFR-1.2)
- ✅ **Auto-Scaling** → Handles traffic spikes
- ✅ **Free Tier** → 100GB bandwidth/month

**Free Tier:**
- Unlimited deployments
- 100GB bandwidth/month
- Automatic HTTPS
- Preview deployments (PRs)

**Deployment:**
```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Production
vercel --prod
```

**Environment Variables:**
```bash
# .env.production
NEXT_PUBLIC_API_URL=https://api.hooklens.dev
NEXT_PUBLIC_WS_URL=https://ws.hooklens.dev
NEXT_PUBLIC_WEB_URL=https://hooklens.dev
```

---

### API Hosting: Cloudflare Workers

**Why Cloudflare Workers?**
- ✅ **Global Edge** → <50ms latency worldwide (PRD NFR-1.1)
- ✅ **Auto-Scaling** → 0 to 1M requests/sec
- ✅ **Free Tier** → 100,000 requests/day
- ✅ **DDoS Protection** → Built-in (PRD NFR-4.4)

**Free Tier:**
- 100,000 requests/day
- 10ms CPU time per request
- 128MB memory

**Upgrade Path:**
- $5/month: 10M requests/month
- Activate when: >3k requests/day

**Configuration:**
```toml
# wrangler.toml
name = "hooklens-api"
main = "src/index.ts"
compatibility_date = "2024-01-01"

[env.production]
route = "https://api.hooklens.dev/*"

[[env.production.durable_objects.bindings]]
name = "WEBHOOK_QUEUE"
class_name = "WebhookQueue"

[env.production.vars]
FRONTEND_URL = "https://hooklens.dev"
JWT_SECRET = "" # Set via `wrangler secret put JWT_SECRET`

[[env.production.r2_buckets]]
binding = "BUCKET"
bucket_name = "hooklens-uploads"
```

**Deployment:**
```bash
# Install Wrangler CLI
npm i -g wrangler

# Login to Cloudflare
wrangler login

# Deploy
wrangler deploy
```

---

### WebSocket Hosting: Railway

**Why Railway?**
- ✅ **Node.js Native** → Easy WebSocket deployment
- ✅ **Redis Included** → Built-in Redis (no Upstash needed)
- ✅ **Free $5 Credit** → Lasts ~2-3 weeks
- ✅ **Auto-Deploy** → Git push to deploy

**Free Trial:**
- $5 credit (one-time)
- ~500 hours uptime
- After trial: $5/month minimum

**Deployment:**
```bash
# Install Railway CLI
npm i -g @railway/cli

# Login
railway login

# Link project
railway link

# Deploy
railway up
```

**Environment Variables:**
```bash
PORT=3001
REDIS_URL=redis://default:password@redis.railway.internal:6379
JWT_SECRET=your_jwt_secret
FRONTEND_URL=https://hooklens.dev
```

---

### Domain & DNS: Cloudflare

**Why Cloudflare DNS?**
- ✅ **Free** → No DNS hosting costs
- ✅ **Fast** → 20ms average resolution
- ✅ **Integrated** → Works with Cloudflare Workers

**Domain Purchase:**
- Buy domain: Namecheap, Google Domains, or Cloudflare Registrar
- Cost: ~$12-15/year for `.dev` domain
- Recommended: `hooklens.dev`

**DNS Configuration:**
```
Type    Name    Content
A       @       [Vercel IP]       (hooklens.dev)
CNAME   api     api.hooklens.dev  (Cloudflare Workers)
CNAME   ws      ws.railway.app    (Railway WebSocket)
CNAME   hooks   hooks.hooklens.dev (Cloudflare Workers)
```

---

## 🔌 Third-Party Services

### AI: OpenRouter (Claude 3.5 Sonnet)

**Why OpenRouter?**
- ✅ **Unified API** → Access Claude, GPT, etc with one API
- ✅ **Cost Tracking** → Built-in usage dashboard
- ✅ **Fallback Models** → Auto-fallback if Claude unavailable

**Pricing:**
- Claude 3.5 Sonnet: $3 per 1M input tokens, $15 per 1M output tokens
- Average cost per analysis: $0.006 (2k tokens)
- With caching: ~$0.002 per analysis

**Setup:**
```bash
# Sign up at openrouter.ai
# Get API key
export OPENROUTER_API_KEY=sk-or-v1-...
```

**Usage:**
```typescript
import Anthropic from '@anthropic-ai/sdk';

const client = new Anthropic({
  apiKey: process.env.OPENROUTER_API_KEY!,
  baseURL: 'https://openrouter.ai/api/v1',
});

const message = await client.messages.create({
  model: 'anthropic/claude-sonnet-4-20250514',
  max_tokens: 1500,
  messages: [{ role: 'user', content: prompt }],
});
```

---

### Payments: Stripe

**Why Stripe?**
- ✅ **Industry Standard** → Trusted by developers
- ✅ **Global** → Supports 135+ currencies
- ✅ **Webhooks** → Perfect for HookLens (meta!)

**Pricing:**
- 2.9% + $0.30 per transaction (US)
- No monthly fee

**Products:**
```typescript
// Stripe products
const PRODUCTS = {
  free: null, // No subscription
  pro: {
    priceId: 'price_xxx',
    amount: 1200, // $12.00
  },
  team: {
    priceId: 'price_yyy',
    amount: 3900, // $39.00
  },
};
```

**Setup:**
```bash
# Install Stripe CLI
brew install stripe/stripe-cli/stripe

# Login
stripe login

# Forward webhooks to localhost (dev)
stripe listen --forward-to localhost:3000/api/webhooks/stripe
```

---

### Email: Resend

**Why Resend?**
- ✅ **Developer-Friendly** → React Email templates
- ✅ **Affordable** → $1/month (10k emails)
- ✅ **Fast** → 99.9% inbox delivery

**Pricing:**
- Free: 100 emails/day
- $1/month: 10,000 emails/month
- $20/month: 100,000 emails/month

**Usage:**
```typescript
import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

await resend.emails.send({
  from: 'HookLens <noreply@hooklens.dev>',
  to: 'user@example.com',
  subject: 'Welcome to HookLens!',
  html: '<p>Your webhook endpoint is ready.</p>',
});
```

---

### Monitoring: Sentry

**Why Sentry?**
- ✅ **Error Tracking** → Catch bugs before users report
- ✅ **Performance Monitoring** → API latency tracking
- ✅ **Free Tier** → 5k events/month

**Pricing:**
- Free: 5,000 events/month
- Team: $26/month (50k events)

**Setup:**
```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0.1, // Sample 10% of transactions
  environment: process.env.NODE_ENV,
});
```

---

### Analytics: Plausible

**Why Plausible?**
- ✅ **Privacy-First** → No cookies, GDPR compliant
- ✅ **Lightweight** → <1KB script
- ✅ **Simple** → No complex setup

**Pricing:**
- $9/month (10k pageviews/month)
- $19/month (100k pageviews)

**Setup:**
```html
<!-- In app/layout.tsx -->
<script defer data-domain="hooklens.dev" src="https://plausible.io/js/script.js"></script>
```

---

## 🔧 Development Tools

### Package Manager: pnpm

**Why pnpm?**
- ✅ **Fast** → 2x faster than npm
- ✅ **Efficient** → Saves disk space (symlinks)
- ✅ **Strict** → No phantom dependencies

**Installation:**
```bash
npm install -g pnpm
```

**Usage:**
```bash
pnpm install       # Install dependencies
pnpm dev          # Start dev server
pnpm build        # Build for production
pnpm test         # Run tests
```

---

### Testing: Vitest + Playwright

**Unit Tests:** Vitest (faster than Jest)  
**E2E Tests:** Playwright (cross-browser)

**Setup:**
```bash
pnpm add -D vitest @vitest/ui
pnpm add -D @playwright/test
```

**Configuration:**
```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'jsdom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      threshold: {
        lines: 80, // PRD NFR-6.1: 80% coverage
        functions: 80,
        branches: 75,
        statements: 80,
      },
    },
  },
});
```

---

### Linting & Formatting

**ESLint + Prettier + TypeScript**

```json
// .eslintrc.json
{
  "extends": [
    "next/core-web-vitals",
    "plugin:@typescript-eslint/recommended",
    "prettier"
  ],
  "rules": {
    "@typescript-eslint/no-unused-vars": "error",
    "@typescript-eslint/no-explicit-any": "warn"
  }
}
```

```json
// .prettierrc
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5"
}
```

---

## 📦 Dependencies & Versions

### Complete Package.json (Frontend)

```json
{
  "name": "hooklens-frontend",
  "version": "1.0.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest",
    "test:e2e": "playwright test",
    "type-check": "tsc --noEmit"
  },
  "dependencies": {
    "next": "15.1.0",
    "react": "19.0.0",
    "react-dom": "19.0.0",
    "typescript": "5.3.3",
    "tailwindcss": "4.0.0-alpha.20",
    "@tailwindcss/typography": "0.5.10",
    "clsx": "2.1.0",
    "tailwind-merge": "2.2.0",
    "@radix-ui/react-dialog": "1.0.5",
    "@radix-ui/react-dropdown-menu": "2.0.6",
    "@radix-ui/react-toast": "1.1.5",
    "@radix-ui/react-tabs": "1.0.4",
    "zustand": "4.5.0",
    "@tanstack/react-query": "5.17.0",
    "socket.io-client": "4.7.0",
    "@monaco-editor/react": "4.6.0",
    "react-hook-form": "7.49.0",
    "zod": "3.22.4",
    "@hookform/resolvers": "3.3.3",
    "recharts": "2.10.0",
    "date-fns": "3.0.0",
    "copy-to-clipboard": "3.3.3",
    "nanoid": "5.0.4",
    "@sentry/nextjs": "7.99.0"
  },
  "devDependencies": {
    "@types/node": "20.11.0",
    "@types/react": "18.2.48",
    "@types/react-dom": "18.2.18",
    "vitest": "1.2.0",
    "@vitest/ui": "1.2.0",
    "@playwright/test": "1.41.0",
    "eslint": "8.56.0",
    "eslint-config-next": "15.1.0",
    "prettier": "3.2.4"
  }
}
```

### Complete Package.json (Backend)

```json
{
  "name": "hooklens-backend",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy",
    "test": "vitest"
  },
  "dependencies": {
    "hono": "4.0.0",
    "@hono/zod-validator": "0.2.1",
    "zod": "3.22.4",
    "drizzle-orm": "0.29.0",
    "@upstash/redis": "1.28.0",
    "nanoid": "5.0.4",
    "jsonwebtoken": "9.0.2",
    "@anthropic-ai/sdk": "0.17.0",
    "bcrypt": "5.1.1"
  },
  "devDependencies": {
    "@cloudflare/workers-types": "4.20240117.0",
    "wrangler": "3.25.0",
    "typescript": "5.3.3",
    "vitest": "1.2.0",
    "drizzle-kit": "0.20.0"
  }
}
```

---

## ⚙️ Configuration & Environment

### Environment Variables

**Frontend (.env.local):**
```bash
# API URLs
NEXT_PUBLIC_API_URL=http://localhost:8787
NEXT_PUBLIC_WS_URL=http://localhost:3001
NEXT_PUBLIC_WEB_URL=http://localhost:3000

# Feature Flags
NEXT_PUBLIC_ENABLE_AI=true

# Analytics
NEXT_PUBLIC_PLAUSIBLE_DOMAIN=hooklens.dev

# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://...@sentry.io/...
```

**Backend (Cloudflare Workers):**
```bash
# Set via: wrangler secret put <KEY>
JWT_SECRET=your_jwt_secret_here
ENCRYPTION_KEY=your_32_byte_hex_key_here

# Database
DATABASE_URL=postgresql://...

# Redis
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=...

# OpenRouter
OPENROUTER_API_KEY=sk-or-v1-...

# Stripe
STRIPE_SECRET_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Resend
RESEND_API_KEY=re_...
```

**WebSocket Server (.env):**
```bash
PORT=3001
REDIS_URL=redis://localhost:6379
JWT_SECRET=your_jwt_secret_here
FRONTEND_URL=http://localhost:3000
```

---

## 🚀 Setup Instructions

### Prerequisites

```bash
# Required software
node --version   # v20.11.0+
pnpm --version   # 8.0.0+
docker --version # 24.0.0+ (for local Redis)
```

### 1. Clone & Install

```bash
# Clone repo
git clone https://github.com/yourusername/hooklens.git
cd hooklens

# Install dependencies (frontend)
cd frontend
pnpm install

# Install dependencies (backend)
cd ../backend
pnpm install

# Install dependencies (WebSocket)
cd ../websocket-server
pnpm install
```

### 2. Setup Database (Local Development)

```bash
# Start PostgreSQL (Docker)
docker run -d \
  --name hooklens-postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=hooklens \
  -p 5432:5432 \
  postgres:16

# Run migrations
cd backend
pnpm drizzle-kit push:pg
```

### 3. Setup Redis (Local Development)

```bash
# Start Redis (Docker)
docker run -d \
  --name hooklens-redis \
  -p 6379:6379 \
  redis:7
```

### 4. Configure Environment

```bash
# Frontend
cd frontend
cp .env.example .env.local
# Edit .env.local with your values

# Backend
cd ../backend
cp .env.example .env
# Edit .env with your values

# WebSocket
cd ../websocket-server
cp .env.example .env
# Edit .env with your values
```

### 5. Run Development Servers

```bash
# Terminal 1: Frontend
cd frontend
pnpm dev
# → http://localhost:3000

# Terminal 2: Backend (Cloudflare Workers)
cd backend
pnpm dev
# → http://localhost:8787

# Terminal 3: WebSocket Server
cd websocket-server
pnpm dev
# → http://localhost:3001
```

### 6. Test Webhook Endpoint

```bash
# Send test webhook
curl -X POST http://localhost:8787/w/test123 \
  -H "Content-Type: application/json" \
  -d '{"test": "webhook"}'

# Should return: 200 OK
```

---

## 🔄 CI/CD Pipeline

### GitHub Actions Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy HookLens

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: pnpm/action-setup@v2
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'pnpm'
      
      - name: Install dependencies
        run: pnpm install
      
      - name: Run tests
        run: pnpm test
      
      - name: Type check
        run: pnpm type-check
      
      - name: Lint
        run: pnpm lint

  deploy-frontend:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: amondnet/vercel-action@v25
        with:
          vercel-token: ${{ secrets.VERCEL_TOKEN }}
          vercel-org-id: ${{ secrets.VERCEL_ORG_ID }}
          vercel-project-id: ${{ secrets.VERCEL_PROJECT_ID }}
          vercel-args: '--prod'

  deploy-backend:
    needs: test
    if: github.ref == 'refs/heads/main'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: cloudflare/wrangler-action@v3
        with:
          apiToken: ${{ secrets.CLOUDFLARE_API_TOKEN }}
          accountId: ${{ secrets.CLOUDFLARE_ACCOUNT_ID }}
          command: deploy
```

---

## 💰 Cost Breakdown

### MVP Phase (Month 0-3): ~$15-20/month

| Service | Tier | Cost | Notes |
|---------|------|------|-------|
| **Vercel** | Free | $0 | 100GB bandwidth |
| **Cloudflare Workers** | Free | $0 | 100k requests/day |
| **Supabase** | Free | $0 | 500MB database |
| **Upstash Redis** | Free | $0 | 10k commands/day |
| **Railway** | Free | $0 | $5 credit (2-3 weeks) |
| **Domain** | Registrar | $1.25/mo | $15/year amortized |
| **OpenRouter** | Pay-per-use | $10-15/mo | AI analyses |
| **Resend** | Free | $0 | 100 emails/day |
| **Sentry** | Free | $0 | 5k events/month |
| **Plausible** | - | $0 | Use free tier or skip |
| **TOTAL** | | **$11.25-16.25/mo** | |

### Growth Phase (Month 3-6): ~$50-80/month

| Service | Tier | Cost |
|---------|------|------|
| Vercel | Pro | $20 |
| Cloudflare Workers | Paid | $5 |
| Supabase | Pro | $25 |
| Upstash Redis | Pay-as-you-go | $5-10 |
| Railway | Paid | $5 |
| Domain | | $1.25 |
| OpenRouter | Pay-per-use | $20-30 |
| Resend | Starter | $1 |
| Sentry | Free | $0 |
| Plausible | Starter | $9 |
| **TOTAL** | | **$91.25-106.25/mo** |

**Revenue to Cover Costs:** 8-9 Pro subscriptions ($12/month each)

---

## ✅ PRD Tech Stack Alignment

### Requirements Checklist

- [x] **TR-1:** Next.js 15 + React 19 + Tailwind + Shadcn ✅
- [x] **TR-2:** Hono.js + Cloudflare Workers + Node.js 20 ✅
- [x] **TR-3:** Vercel + Cloudflare + Railway + Supabase ✅
- [x] **TR-4:** OpenRouter + Stripe + Resend + Sentry ✅
- [x] **TR-5:** AES-256 + TLS 1.3 + Rate Limiting + Zod ✅

### Design Document Alignment

- [x] **Component 1:** Webhook Ingestion (Hono.js + Cloudflare Workers) ✅
- [x] **Component 2:** Provider Detection (TypeScript service) ✅
- [x] **Component 3:** Signature Validator (crypto module) ✅
- [x] **Component 4:** AI Engine (OpenRouter + Claude) ✅
- [x] **Database:** PostgreSQL + TimescaleDB (or fallback) ✅
- [x] **Cache:** Redis (Upstash) ✅
- [x] **WebSocket:** Socket.io + Node.js ✅

---

**Document End**

**Status:** Ready for Implementation ✅  
**Next Step:** Begin Phase 1 MVP Development (Week 1-2)
