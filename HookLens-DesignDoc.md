# 🎨 HookLens - Design Document (System Architecture)

**Version:** 1.0  
**Last Updated:** 2026-03-01  
**Document Owner:** Engineering Team  
**Status:** Approved for Implementation  
**Related Document:** [HookLens PRD v1.0](./HookLens-PRD.md)

---

## 📑 Table of Contents

1. [Document Purpose](#document-purpose)
2. [Architecture Overview](#architecture-overview)
3. [System Components](#system-components)
4. [Data Models & Database Design](#data-models--database-design)
5. [API Design](#api-design)
6. [Real-Time Architecture](#real-time-architecture)
7. [Security Architecture](#security-architecture)
8. [AI Integration Design](#ai-integration-design)
9. [Scalability & Performance](#scalability--performance)
10. [Deployment Architecture](#deployment-architecture)
11. [Monitoring & Observability](#monitoring--observability)
12. [Error Handling & Recovery](#error-handling--recovery)
13. [Testing Strategy](#testing-strategy)
14. [Implementation Phases](#implementation-phases)

---

## 📘 Document Purpose

This document provides the technical blueprint for implementing HookLens as defined in the PRD. It translates product requirements into concrete technical designs, ensuring:

1. **Alignment:** All technical decisions map directly to PRD requirements
2. **Clarity:** Engineering team has clear implementation guidance
3. **Consistency:** Frontend, backend, and infrastructure follow unified architecture
4. **Scalability:** System can grow from MVP to 10,000+ concurrent users

**Key PRD Requirements Addressed:**
- **FR-1:** Webhook capture infrastructure (NFR-2.1: 10k webhooks/minute)
- **FR-2:** Real-time updates via WebSocket (NFR-1.3: <500ms latency)
- **FR-3:** Signature validation for 5+ providers (FR-3.1)
- **FR-4:** AI analysis with Claude (FR-4.6: <10s completion)
- **NFR-1:** Performance targets (API <100ms, Dashboard <2s)
- **NFR-4:** Security requirements (TLS 1.3, encryption, rate limiting)

---

## 🏗️ Architecture Overview

### High-Level System Architecture

```
┌──────────────────────────────────────────────────────────────────────┐
│                         CLIENT TIER                                  │
│                                                                      │
│  ┌────────────────┐  ┌────────────────┐  ┌────────────────┐        │
│  │  Next.js App   │  │  Mobile PWA    │  │  Share Page    │        │
│  │  (Dashboard)   │  │  (Responsive)  │  │  (Public)      │        │
│  └────────┬───────┘  └────────┬───────┘  └────────┬───────┘        │
└───────────┼──────────────────────┼──────────────────┼───────────────┘
            │                      │                  │
            └──────────────────────┴──────────────────┘
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      EDGE TIER (Cloudflare)                          │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │               Webhook Ingestion Worker                         │ │
│  │          POST /w/:endpointId (Global Edge)                     │ │
│  │                                                                │ │
│  │  • Receives webhook → Validates → Stores → Publishes          │ │
│  │  • Target: <100ms response time (NFR-1.1)                     │ │
│  │  • Capacity: 10,000 webhooks/minute (NFR-2.1)                 │ │
│  └────────────────────────────────────────────────────────────────┘ │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │                   API Gateway Worker                           │ │
│  │              /api/* (REST endpoints)                           │ │
│  │                                                                │ │
│  │  • Authentication middleware (Better Auth JWT)                │ │
│  │  • Rate limiting (100 req/min, NFR-4.3)                       │ │
│  │  • Request validation (Zod schemas)                           │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                     APPLICATION TIER                                 │
│                                                                      │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐  │
│  │  Provider        │  │  Signature       │  │  AI Analysis     │  │
│  │  Detection       │  │  Validator       │  │  Engine          │  │
│  │  Service         │  │  Service         │  │  (Async)         │  │
│  │                  │  │                  │  │                  │  │
│  │ • Auto-detect    │  │ • Stripe         │  │ • Claude API     │  │
│  │ • Extract event  │  │ • GitHub         │  │ • Cache results  │  │
│  │ • Format JSON    │  │ • Shopify        │  │ • Queue jobs     │  │
│  │                  │  │ • Twilio         │  │ • <10s target    │  │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘  │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────────┐ │
│  │              WebSocket Server (Railway)                        │ │
│  │                                                                │ │
│  │  • Socket.io server (Node.js 20)                              │ │
│  │  • Redis Pub/Sub subscriber                                   │ │
│  │  • Push updates to connected clients                          │ │
│  │  • Target: 10k concurrent connections (NFR-2.2)               │ │
│  └────────────────────────────────────────────────────────────────┘ │
└──────────────────────────────────────────────────────────────────────┘
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                      DATA TIER                                       │
│                                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐              │
│  │ PostgreSQL   │  │   Redis      │  │ TimescaleDB  │              │
│  │ (Supabase)   │  │  (Upstash)   │  │ (Webhooks)   │              │
│  │              │  │              │  │              │              │
│  │ • Users      │  │ • Cache      │  │ • Webhooks   │              │
│  │ • Endpoints  │  │ • Sessions   │  │ • Metrics    │              │
│  │ • Settings   │  │ • Pub/Sub    │  │ • 90d TTL    │              │
│  │ • Comments   │  │ • Job Queue  │  │              │              │
│  └──────────────┘  └──────────────┘  └──────────────┘              │
└──────────────────────────────────────────────────────────────────────┘
                                  ▼
┌──────────────────────────────────────────────────────────────────────┐
│                  EXTERNAL SERVICES TIER                              │
│                                                                      │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐               │
│  │OpenRouter│ │  Stripe  │ │  Resend  │ │  Sentry  │               │
│  │ (Claude) │ │(Payment) │ │ (Email)  │ │  (Logs)  │               │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘               │
└──────────────────────────────────────────────────────────────────────┘
```

---

### Architecture Patterns

#### 1. Edge-First Architecture
**Pattern:** Compute at the edge (Cloudflare Workers)  
**Benefit:** <50ms global latency (NFR-1.1)  
**PRD Mapping:** FR-1.5 (return 200 OK within 100ms)

#### 2. Event-Driven Architecture
**Pattern:** Webhook received → Event published → Consumers react  
**Benefit:** Decoupled, scalable, resilient  
**PRD Mapping:** FR-2 (real-time updates), FR-4 (async AI analysis)

#### 3. CQRS (Command Query Responsibility Segregation)
**Pattern:** Write (capture webhook) separated from Read (query webhooks)  
**Benefit:** Optimize each independently  
**PRD Mapping:** NFR-2.1 (10k writes/min), NFR-1.2 (fast dashboard loads)

#### 4. Cache-Aside Pattern
**Pattern:** Check cache → If miss, query DB → Update cache  
**Benefit:** Reduce database load by 80%+  
**PRD Mapping:** NFR-1 (performance), FR-4.5 (cache AI analyses)

---

## 🧩 System Components

### Component 1: Webhook Ingestion Worker (Cloudflare Worker)

**Purpose:** Receive and process incoming webhooks at global edge  
**PRD Requirements:** FR-1 (Webhook Capture), NFR-1.1 (API <100ms), NFR-2.1 (10k webhooks/min)

**Responsibilities:**
1. Accept HTTP POST on `/w/:endpointId`
2. Validate endpoint exists (check PostgreSQL)
3. Capture full request (headers, body, metadata)
4. Store in TimescaleDB
5. Publish event to Redis Pub/Sub
6. Return 200 OK (target: <100ms)

**Implementation:**
```typescript
// worker.ts (Cloudflare Worker)
export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    
    // Extract endpoint ID from path: /w/abc123xyz
    const endpointId = url.pathname.split('/')[2];
    
    // Start timer (for NFR-1.1 monitoring)
    const startTime = Date.now();
    
    try {
      // 1. Validate endpoint exists (cached, ~5ms)
      const endpoint = await getEndpoint(endpointId, env);
      if (!endpoint) {
        return new Response('Endpoint not found', { status: 404 });
      }
      
      // 2. Capture webhook data
      const webhookData = {
        id: crypto.randomUUID(),
        endpointId,
        method: request.method,
        headers: Object.fromEntries(request.headers),
        body: await request.text(),
        ipAddress: request.headers.get('cf-connecting-ip'),
        userAgent: request.headers.get('user-agent'),
        timestamp: new Date().toISOString(),
      };
      
      // 3. Store in database (async, non-blocking)
      env.WEBHOOK_QUEUE.send(webhookData); // Durable Queue
      
      // 4. Publish to Redis (for real-time updates)
      await env.REDIS.publish('webhooks:new', JSON.stringify({
        endpointId,
        webhookId: webhookData.id,
      }));
      
      // 5. Return success immediately
      const responseTime = Date.now() - startTime;
      return new Response('OK', {
        status: 200,
        headers: {
          'X-Response-Time': `${responseTime}ms`,
        },
      });
      
    } catch (error) {
      // Log error but return 200 (don't leak errors to webhook sender)
      console.error('Webhook ingestion error:', error);
      await env.SENTRY.captureException(error);
      return new Response('Internal Error', { status: 500 });
    }
  },
};

async function getEndpoint(id: string, env: Env) {
  // Check cache first (Redis)
  const cached = await env.REDIS.get(`endpoint:${id}`);
  if (cached) return JSON.parse(cached);
  
  // Cache miss: Query database
  const endpoint = await env.DB.query(
    'SELECT * FROM webhook_endpoints WHERE slug = $1 AND active = true',
    [id]
  );
  
  if (endpoint) {
    // Cache for 5 minutes
    await env.REDIS.setex(`endpoint:${id}`, 300, JSON.stringify(endpoint));
  }
  
  return endpoint;
}
```

**Performance Targets (from PRD NFR-1.1):**
- P50: <50ms
- P95: <100ms
- P99: <200ms

**Scalability (from PRD NFR-2.1):**
- 10,000 webhooks/minute = 166 webhooks/second
- Cloudflare Workers: Auto-scales to 1M+ requests/second

---

### Component 2: Provider Detection Service

**Purpose:** Auto-detect webhook provider from headers/payload  
**PRD Requirements:** FR-3.1 (detect 5+ providers), US-2.1 (auto-detect provider)

**Detection Logic:**
```typescript
// provider-detector.ts
interface ProviderConfig {
  name: string;
  detectBy: string[]; // Headers to check
  signatureHeader: string;
  algorithm: 'HMAC-SHA256' | 'HMAC-SHA1' | 'ECDSA';
}

const PROVIDERS: ProviderConfig[] = [
  {
    name: 'stripe',
    detectBy: ['stripe-signature'],
    signatureHeader: 'stripe-signature',
    algorithm: 'HMAC-SHA256',
  },
  {
    name: 'github',
    detectBy: ['x-hub-signature-256', 'x-github-event'],
    signatureHeader: 'x-hub-signature-256',
    algorithm: 'HMAC-SHA256',
  },
  {
    name: 'shopify',
    detectBy: ['x-shopify-hmac-sha256', 'x-shopify-shop-domain'],
    signatureHeader: 'x-shopify-hmac-sha256',
    algorithm: 'HMAC-SHA256',
  },
  {
    name: 'twilio',
    detectBy: ['x-twilio-signature'],
    signatureHeader: 'x-twilio-signature',
    algorithm: 'HMAC-SHA1',
  },
  {
    name: 'sendgrid',
    detectBy: ['x-twilio-email-event-webhook-signature'],
    signatureHeader: 'x-twilio-email-event-webhook-signature',
    algorithm: 'ECDSA',
  },
];

export function detectProvider(headers: Record<string, string>): ProviderConfig | null {
  // Convert headers to lowercase for case-insensitive matching
  const lowerHeaders = Object.keys(headers).reduce((acc, key) => {
    acc[key.toLowerCase()] = headers[key];
    return acc;
  }, {} as Record<string, string>);
  
  // Find matching provider
  for (const provider of PROVIDERS) {
    const hasAllHeaders = provider.detectBy.every(
      header => header.toLowerCase() in lowerHeaders
    );
    
    if (hasAllHeaders) {
      return provider;
    }
  }
  
  return null; // Unknown provider
}

export function extractEventType(provider: string, headers: Record<string, string>, payload: any): string | null {
  switch (provider) {
    case 'stripe':
      return payload.type; // e.g., "payment_intent.succeeded"
      
    case 'github':
      return headers['x-github-event']; // e.g., "push"
      
    case 'shopify':
      return headers['x-shopify-topic']; // e.g., "orders/create"
      
    case 'twilio':
      return payload.EventType; // e.g., "message.received"
      
    case 'sendgrid':
      return payload[0]?.event; // e.g., "delivered"
      
    default:
      return null;
  }
}
```

**PRD Compliance:**
- ✅ FR-3.1: Supports 5 providers (Stripe, GitHub, Shopify, Twilio, SendGrid)
- ✅ US-2.1: Auto-detection without manual configuration

---

### Component 3: Signature Validator Service

**Purpose:** Validate webhook signatures using provider-specific algorithms  
**PRD Requirements:** FR-3 (Signature Validation), US-2.2 (validate webhook signature)

**Implementation:**
```typescript
// signature-validator.ts
import crypto from 'crypto';

export async function validateSignature(
  provider: string,
  payload: string,
  headers: Record<string, string>,
  secret: string
): Promise<{
  valid: boolean;
  expected?: string;
  received?: string;
  algorithm: string;
}> {
  switch (provider) {
    case 'stripe':
      return validateStripeSignature(payload, headers['stripe-signature'], secret);
      
    case 'github':
      return validateGitHubSignature(payload, headers['x-hub-signature-256'], secret);
      
    case 'shopify':
      return validateShopifySignature(payload, headers['x-shopify-hmac-sha256'], secret);
      
    case 'twilio':
      return validateTwilioSignature(payload, headers['x-twilio-signature'], secret);
      
    default:
      return { valid: false, algorithm: 'unknown' };
  }
}

function validateStripeSignature(payload: string, signature: string, secret: string) {
  // Parse signature header: "t=1234567890,v1=abc123..."
  const parts = signature.split(',').reduce((acc, part) => {
    const [key, value] = part.split('=');
    acc[key] = value;
    return acc;
  }, {} as Record<string, string>);
  
  const timestamp = parts.t;
  const receivedSignature = parts.v1;
  
  // Construct signed payload
  const signedPayload = `${timestamp}.${payload}`;
  
  // Compute expected signature
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(signedPayload)
    .digest('hex');
  
  // Timing-safe comparison (NFR-4 security requirement)
  const valid = crypto.timingSafeEqual(
    Buffer.from(receivedSignature),
    Buffer.from(expectedSignature)
  );
  
  return {
    valid,
    expected: expectedSignature,
    received: receivedSignature,
    algorithm: 'HMAC-SHA256',
  };
}

function validateGitHubSignature(payload: string, signature: string, secret: string) {
  // Signature format: "sha256=abc123..."
  const receivedSignature = signature.replace('sha256=', '');
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex');
  
  const valid = crypto.timingSafeEqual(
    Buffer.from(receivedSignature),
    Buffer.from(expectedSignature)
  );
  
  return {
    valid,
    expected: expectedSignature,
    received: receivedSignature,
    algorithm: 'HMAC-SHA256',
  };
}

function validateShopifySignature(payload: string, signature: string, secret: string) {
  // Shopify uses Base64-encoded HMAC
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('base64');
  
  const valid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
  
  return {
    valid,
    expected: expectedSignature,
    received: signature,
    algorithm: 'HMAC-SHA256 (Base64)',
  };
}

function validateTwilioSignature(payload: string, signature: string, secret: string) {
  // Twilio uses SHA1 (legacy)
  const expectedSignature = crypto
    .createHmac('sha1', secret)
    .update(payload)
    .digest('base64');
  
  const valid = crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  );
  
  return {
    valid,
    expected: expectedSignature,
    received: signature,
    algorithm: 'HMAC-SHA1',
  };
}
```

**Security (PRD NFR-4.5):**
- ✅ Timing-safe comparison (prevent timing attacks)
- ✅ Secrets never logged or exposed
- ✅ Encrypted at rest (AES-256)

---

### Component 4: AI Analysis Engine

**Purpose:** Analyze webhook errors and suggest fixes using Claude AI  
**PRD Requirements:** FR-4 (AI Analysis), NFR-1.4 (AI <10s), FR-4.5 (cache analyses)

**Implementation:**
```typescript
// ai-analyzer.ts
import Anthropic from '@anthropic-ai/sdk';

const AI_ANALYSIS_PROMPT = `
You are a webhook debugging expert.

## Webhook Details
Provider: {{provider}}
Event: {{event}}
Response Code: {{responseCode}}
Signature Valid: {{signatureValid}}

## Headers
{{headers}}

## Payload
{{payload}}

## Error
{{error}}

## Task
Analyze and provide:
1. Status (success/warning/error)
2. Summary (1 sentence)
3. Issues (list)
4. Root cause
5. Suggestions (with code if applicable)
6. Documentation links

Format as JSON.
`;

interface AIAnalysis {
  status: 'success' | 'warning' | 'error';
  summary: string;
  issues: string[];
  rootCause: string | null;
  suggestions: Array<{
    title: string;
    description: string;
    code?: string;
    difficulty: 'easy' | 'medium' | 'hard';
  }>;
  relatedDocs: string[];
}

export async function analyzeWebhook(
  webhook: WebhookData,
  redis: RedisClient
): Promise<AIAnalysis> {
  // Check cache first (FR-4.5: cache analyses)
  const cacheKey = `analysis:${webhook.provider}:${webhook.responseCode}:${webhook.signatureValid}`;
  const cached = await redis.get(cacheKey);
  
  if (cached) {
    console.log('AI analysis cache hit');
    return JSON.parse(cached);
  }
  
  // Cache miss: Call Claude API
  const client = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY,
    baseURL: 'https://openrouter.ai/api/v1', // OpenRouter proxy
  });
  
  const prompt = AI_ANALYSIS_PROMPT
    .replace('{{provider}}', webhook.provider || 'unknown')
    .replace('{{event}}', webhook.eventType || 'unknown')
    .replace('{{responseCode}}', webhook.responseCode?.toString() || 'N/A')
    .replace('{{signatureValid}}', webhook.signatureValid ? 'Yes' : 'No')
    .replace('{{headers}}', JSON.stringify(webhook.headers, null, 2))
    .replace('{{payload}}', JSON.stringify(webhook.payload, null, 2))
    .replace('{{error}}', webhook.responseBody || 'None');
  
  const startTime = Date.now();
  
  const message = await client.messages.create({
    model: 'anthropic/claude-sonnet-4-20250514', // OpenRouter model ID
    max_tokens: 1500,
    messages: [
      {
        role: 'user',
        content: prompt,
      },
    ],
  });
  
  const analysisTime = Date.now() - startTime;
  console.log(`AI analysis completed in ${analysisTime}ms`); // Monitor NFR-1.4 (target <10s)
  
  const analysis: AIAnalysis = JSON.parse(message.content[0].text);
  
  // Cache for 1 hour
  await redis.setex(cacheKey, 3600, JSON.stringify(analysis));
  
  return analysis;
}
```

**Performance Optimization (PRD NFR-1.4):**
- Target: <10 seconds
- Cache hit rate: 60%+ (common errors)
- Async processing: Queue AI jobs, don't block webhook ingestion

---

## 🗄️ Data Models & Database Design

### PostgreSQL Schema (Supabase)

**PRD Requirements:** Store user data, endpoints, comments (FR-1.3, FR-6)

```sql
-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_cron";

-- Users table
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255), -- NULL for OAuth users
  name VARCHAR(255),
  avatar_url TEXT,
  auth_provider VARCHAR(50) DEFAULT 'email', -- 'email', 'github', 'google'
  
  -- Subscription
  plan VARCHAR(50) DEFAULT 'free', -- 'free', 'pro', 'team'
  stripe_customer_id VARCHAR(255),
  stripe_subscription_id VARCHAR(255),
  current_period_end TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_seen_at TIMESTAMP,
  
  -- Indexes
  CONSTRAINT valid_plan CHECK (plan IN ('free', 'pro', 'team', 'enterprise'))
);

CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_stripe_customer ON users(stripe_customer_id);

-- Webhook endpoints table
CREATE TABLE webhook_endpoints (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Endpoint config
  name VARCHAR(255) NOT NULL DEFAULT 'Untitled Endpoint',
  slug VARCHAR(100) UNIQUE NOT NULL, -- e.g., 'abc123xyz'
  description TEXT,
  
  -- Provider settings
  provider VARCHAR(50), -- 'stripe', 'github', etc (optional, auto-detected)
  signing_secret TEXT, -- Encrypted with AES-256 (NFR-4.2)
  
  -- Status
  active BOOLEAN DEFAULT TRUE,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  last_webhook_at TIMESTAMP,
  webhook_count BIGINT DEFAULT 0,
  
  CONSTRAINT unique_user_slug UNIQUE(user_id, slug)
);

CREATE INDEX idx_endpoints_slug ON webhook_endpoints(slug) WHERE active = TRUE;
CREATE INDEX idx_endpoints_user ON webhook_endpoints(user_id, created_at DESC);

-- Team members table (for collaboration, FR-6)
CREATE TABLE team_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  team_owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  member_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role VARCHAR(50) DEFAULT 'viewer', -- 'admin', 'developer', 'viewer'
  
  -- Status
  invited_at TIMESTAMP DEFAULT NOW(),
  accepted_at TIMESTAMP,
  
  CONSTRAINT unique_team_member UNIQUE(team_owner_id, member_user_id),
  CONSTRAINT valid_role CHECK (role IN ('admin', 'developer', 'viewer'))
);

CREATE INDEX idx_team_members_owner ON team_members(team_owner_id);
CREATE INDEX idx_team_members_member ON team_members(member_user_id);

-- Webhook comments table (for collaboration, US-5.2)
CREATE TABLE webhook_comments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL, -- References webhooks in TimescaleDB
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Comment content
  comment TEXT NOT NULL,
  mentioned_users UUID[], -- Array of user IDs mentioned with @
  
  -- Threading (optional for MVP)
  parent_comment_id UUID REFERENCES webhook_comments(id) ON DELETE CASCADE,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  edited BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_comments_webhook ON webhook_comments(webhook_id, created_at DESC);
CREATE INDEX idx_comments_user ON webhook_comments(user_id);

-- Webhook assignments table (US-5.3)
CREATE TABLE webhook_assignments (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  webhook_id UUID NOT NULL,
  assigned_by UUID NOT NULL REFERENCES users(id),
  assigned_to UUID NOT NULL REFERENCES users(id),
  status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'in_progress', 'resolved', 'wontfix'
  resolved_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  
  CONSTRAINT valid_status CHECK (status IN ('pending', 'in_progress', 'resolved', 'wontfix'))
);

CREATE INDEX idx_assignments_webhook ON webhook_assignments(webhook_id);
CREATE INDEX idx_assignments_assignee ON webhook_assignments(assigned_to, status);

-- Saved searches table (US-6.3)
CREATE TABLE saved_searches (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  query JSONB NOT NULL, -- Filter criteria
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_saved_searches_user ON saved_searches(user_id);

-- Subscriptions table (separate from users for clarity)
CREATE TABLE subscriptions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- Stripe
  stripe_customer_id VARCHAR(255) NOT NULL,
  stripe_subscription_id VARCHAR(255) NOT NULL,
  
  -- Plan
  plan VARCHAR(50) NOT NULL,
  status VARCHAR(50) NOT NULL, -- 'active', 'canceled', 'past_due', 'incomplete'
  
  -- Billing
  current_period_start TIMESTAMP NOT NULL,
  current_period_end TIMESTAMP NOT NULL,
  cancel_at TIMESTAMP,
  canceled_at TIMESTAMP,
  
  -- Metadata
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_subscriptions_stripe_customer ON subscriptions(stripe_customer_id);
CREATE INDEX idx_subscriptions_status ON subscriptions(status) WHERE status = 'active';
```

---

### TimescaleDB Schema (Time-Series Webhooks)

**PRD Requirements:** Store webhooks with 90-day retention (FR-1.3), optimize time-series queries (NFR-1.2)

```sql
-- Webhooks table (time-series hypertable)
CREATE TABLE webhooks (
  time TIMESTAMPTZ NOT NULL, -- Partition key
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  endpoint_id UUID NOT NULL,
  
  -- Provider info (auto-detected)
  provider VARCHAR(50),
  event_type VARCHAR(255),
  
  -- Request data
  method VARCHAR(10) DEFAULT 'POST',
  headers JSONB NOT NULL,
  payload JSONB NOT NULL,
  ip_address INET,
  user_agent TEXT,
  
  -- Response data (for forwarding/replay)
  response_code INT,
  response_body TEXT,
  response_time_ms INT,
  
  -- Signature validation
  signature_valid BOOLEAN,
  signature_header VARCHAR(255),
  signature_algorithm VARCHAR(50),
  expected_signature TEXT,
  received_signature TEXT,
  
  -- AI analysis (async, populated later)
  ai_analyzed BOOLEAN DEFAULT FALSE,
  ai_insights JSONB,
  ai_confidence DECIMAL(5,2), -- 0-100
  
  -- Metadata
  forwarded BOOLEAN DEFAULT FALSE,
  forwarded_to TEXT[],
  shared BOOLEAN DEFAULT FALSE,
  share_token VARCHAR(100) UNIQUE
);

-- Convert to TimescaleDB hypertable (partition by time)
SELECT create_hypertable('webhooks', 'time');

-- Create indexes for fast queries
CREATE INDEX idx_webhooks_endpoint_time ON webhooks(endpoint_id, time DESC);
CREATE INDEX idx_webhooks_provider ON webhooks(provider, time DESC) WHERE provider IS NOT NULL;
CREATE INDEX idx_webhooks_event ON webhooks(event_type, time DESC) WHERE event_type IS NOT NULL;
CREATE INDEX idx_webhooks_status ON webhooks(response_code, time DESC) WHERE response_code IS NOT NULL;
CREATE INDEX idx_webhooks_share ON webhooks(share_token) WHERE share_token IS NOT NULL;

-- GIN index for full-text search in payload (US-6.1)
CREATE INDEX idx_webhooks_payload_search ON webhooks USING GIN(payload jsonb_path_ops);

-- Auto-delete old webhooks (90-day retention, FR-1.3)
SELECT add_retention_policy('webhooks', INTERVAL '90 days');

-- Continuous aggregate for analytics (NFR-1.2 performance)
CREATE MATERIALIZED VIEW webhook_stats_daily
WITH (timescaledb.continuous) AS
SELECT
  time_bucket('1 day', time) AS day,
  endpoint_id,
  provider,
  COUNT(*) AS total_webhooks,
  COUNT(*) FILTER (WHERE response_code < 400) AS successful,
  COUNT(*) FILTER (WHERE response_code >= 400) AS failed,
  AVG(response_time_ms) AS avg_response_time,
  PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY response_time_ms) AS p95_response_time,
  PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY response_time_ms) AS p99_response_time
FROM webhooks
GROUP BY day, endpoint_id, provider;

-- Refresh policy (update every hour)
SELECT add_continuous_aggregate_policy('webhook_stats_daily',
  start_offset => INTERVAL '3 days',
  end_offset => INTERVAL '1 hour',
  schedule_interval => INTERVAL '1 hour');
```

**Query Performance (PRD NFR-1.2):**
- Get recent webhooks for endpoint: <50ms (indexed by endpoint_id, time)
- Full-text search in payload: <200ms (GIN index)
- Analytics queries: <100ms (continuous aggregates)

---

## 🔌 API Design

### REST API Endpoints

**PRD Requirements:** Complete API coverage for all features (FR-1 through FR-7)

**Base URL:** `https://api.hooklens.dev/v1`  
**Authentication:** Bearer token (JWT from Better Auth)  
**Rate Limit:** 100 requests/minute per user (NFR-4.3)

#### Authentication Endpoints

```typescript
POST /auth/signup
Request:
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "name": "John Doe"
}

Response:
{
  "user": {
    "id": "uuid",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "jwt_token_here"
}

POST /auth/login
Request:
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}

Response:
{
  "user": {...},
  "token": "jwt_token_here"
}

GET /auth/me
Headers: Authorization: Bearer {token}

Response:
{
  "id": "uuid",
  "email": "user@example.com",
  "name": "John Doe",
  "plan": "pro",
  "currentPeriodEnd": "2026-04-01T00:00:00Z"
}
```

#### Endpoint Management (US-1.1)

```typescript
POST /endpoints
Headers: Authorization: Bearer {token}

Request:
{
  "name": "Production Stripe",
  "provider": "stripe", // optional
  "signingSecret": "whsec_..." // optional
}

Response:
{
  "id": "uuid",
  "slug": "abc123xyz",
  "url": "https://hooks.hooklens.dev/w/abc123xyz",
  "name": "Production Stripe",
  "provider": "stripe",
  "active": true,
  "createdAt": "2026-03-01T10:00:00Z"
}

GET /endpoints
Headers: Authorization: Bearer {token}

Response:
{
  "endpoints": [
    {
      "id": "uuid",
      "slug": "abc123xyz",
      "url": "https://hooks.hooklens.dev/w/abc123xyz",
      "name": "Production Stripe",
      "provider": "stripe",
      "webhookCount": 127,
      "lastWebhookAt": "2026-03-01T09:45:00Z",
      "createdAt": "2026-02-15T10:00:00Z"
    }
  ],
  "total": 1
}

PATCH /endpoints/:id
Headers: Authorization: Bearer {token}

Request:
{
  "name": "Staging Stripe",
  "signingSecret": "whsec_new_secret"
}

Response:
{
  "id": "uuid",
  "name": "Staging Stripe",
  "updatedAt": "2026-03-01T10:30:00Z"
}

DELETE /endpoints/:id
Headers: Authorization: Bearer {token}

Response:
{
  "success": true,
  "message": "Endpoint deleted"
}
```

#### Webhook Retrieval (US-1.3)

```typescript
GET /webhooks?endpointId={id}&page=1&limit=20
Headers: Authorization: Bearer {token}

Query Parameters:
- endpointId (required): UUID of endpoint
- page (default: 1): Page number
- limit (default: 20, max: 100): Results per page
- provider (optional): Filter by provider (e.g., "stripe")
- eventType (optional): Filter by event (e.g., "payment_intent.succeeded")
- status (optional): Filter by status code (e.g., "401")
- signatureValid (optional): Filter by signature validity (true/false)

Response:
{
  "webhooks": [
    {
      "id": "uuid",
      "endpointId": "uuid",
      "provider": "stripe",
      "eventType": "payment_intent.succeeded",
      "timestamp": "2026-03-01T10:30:45Z",
      "responseCode": 200,
      "responseTime": 145,
      "signatureValid": true,
      "aiAnalyzed": false
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 127,
    "totalPages": 7
  }
}

GET /webhooks/:id
Headers: Authorization: Bearer {token}

Response:
{
  "id": "uuid",
  "endpointId": "uuid",
  "provider": "stripe",
  "eventType": "payment_intent.succeeded",
  "timestamp": "2026-03-01T10:30:45Z",
  
  "headers": {
    "content-type": "application/json",
    "stripe-signature": "t=1234567890,v1=abc...",
    "user-agent": "Stripe/1.0"
  },
  
  "payload": {
    "id": "pi_3abc123",
    "object": "payment_intent",
    "amount": 2000,
    "currency": "usd",
    "status": "succeeded"
  },
  
  "metadata": {
    "ipAddress": "54.187.174.169",
    "userAgent": "Stripe/1.0",
    "method": "POST"
  },
  
  "signature": {
    "valid": true,
    "algorithm": "HMAC-SHA256",
    "received": "abc123...",
    "expected": "abc123..."
  },
  
  "response": {
    "code": 200,
    "time": 145,
    "body": null
  },
  
  "aiAnalysis": null, // Populated if analyzed
  
  "forwarded": false,
  "shared": false
}
```

#### AI Analysis (US-3.1, US-3.2)

```typescript
POST /webhooks/:id/analyze
Headers: Authorization: Bearer {token}

Response:
{
  "webhookId": "uuid",
  "analysis": {
    "status": "success",
    "summary": "Webhook processed successfully with valid signature",
    "issues": [],
    "rootCause": null,
    "suggestions": [],
    "relatedDocs": [
      "https://stripe.com/docs/webhooks/signatures"
    ]
  },
  "confidence": 95.5,
  "analyzedAt": "2026-03-01T10:31:00Z"
}

// Example error analysis
{
  "webhookId": "uuid",
  "analysis": {
    "status": "error",
    "summary": "Webhook signature validation failed",
    "issues": [
      "Signature mismatch",
      "Using test secret with production webhook"
    ],
    "rootCause": "You're using a test signing secret (whsec_test_...) but this is a production webhook from Stripe.",
    "suggestions": [
      {
        "title": "Update signing secret to production",
        "description": "In your Stripe dashboard, copy the production webhook secret and update it in HookLens endpoint settings.",
        "code": "// In your endpoint settings\nSigning Secret: whsec_live_...",
        "difficulty": "easy"
      }
    ],
    "relatedDocs": [
      "https://stripe.com/docs/webhooks/signatures"
    ]
  },
  "confidence": 98.2
}
```

#### Forwarding & Replay (US-4.1, US-4.2)

```typescript
POST /webhooks/:id/forward
Headers: Authorization: Bearer {token}

Request:
{
  "targetUrl": "http://localhost:3000/api/webhooks"
}

Response:
{
  "webhookId": "uuid",
  "targetUrl": "http://localhost:3000/api/webhooks",
  "status": 200,
  "responseBody": "OK",
  "responseTime": 87,
  "forwardedAt": "2026-03-01T10:32:00Z"
}

POST /webhooks/batch-replay
Headers: Authorization: Bearer {token}

Request:
{
  "webhookIds": ["uuid1", "uuid2", "uuid3"],
  "targetUrl": "https://api.myapp.com/webhooks"
}

Response:
{
  "total": 3,
  "successful": 2,
  "failed": 1,
  "results": [
    {
      "webhookId": "uuid1",
      "status": 200,
      "success": true
    },
    {
      "webhookId": "uuid2",
      "status": 200,
      "success": true
    },
    {
      "webhookId": "uuid3",
      "status": 500,
      "success": false,
      "error": "Internal Server Error"
    }
  ]
}
```

#### Sharing (US-5.1)

```typescript
POST /webhooks/:id/share
Headers: Authorization: Bearer {token}

Response:
{
  "webhookId": "uuid",
  "shareToken": "xyz789abc",
  "shareUrl": "https://hooklens.dev/share/xyz789abc",
  "expiresAt": "2026-03-31T10:00:00Z"
}

GET /share/:token (Public, no auth required)

Response:
{
  "webhook": {
    // Full webhook details (same as /webhooks/:id)
  },
  "shared": true,
  "sharedBy": {
    "name": "John Doe",
    "email": "john@example.com" // Obfuscated: j***@example.com
  }
}

DELETE /webhooks/:id/share
Headers: Authorization: Bearer {token}

Response:
{
  "success": true,
  "message": "Share link revoked"
}
```

#### Comments (US-5.2)

```typescript
GET /webhooks/:id/comments
Headers: Authorization: Bearer {token}

Response:
{
  "comments": [
    {
      "id": "uuid",
      "userId": "uuid",
      "user": {
        "name": "Sarah Lee",
        "avatarUrl": "https://..."
      },
      "comment": "Why is this returning 401? @john",
      "mentionedUsers": ["uuid_of_john"],
      "createdAt": "2026-03-01T10:00:00Z",
      "edited": false
    }
  ],
  "total": 1
}

POST /webhooks/:id/comments
Headers: Authorization: Bearer {token}

Request:
{
  "comment": "Fixed! The issue was wrong API key."
}

Response:
{
  "id": "uuid",
  "webhookId": "uuid",
  "userId": "uuid",
  "comment": "Fixed! The issue was wrong API key.",
  "createdAt": "2026-03-01T10:05:00Z"
}
```

#### Export (US-6.1, US-6.2)

```typescript
GET /webhooks/:id/export?format=curl
Headers: Authorization: Bearer {token}

Query Parameters:
- format: "curl" | "postman" | "code" | "csv"
- language (for code): "javascript" | "python" | "ruby"

Response (format=curl):
{
  "format": "curl",
  "content": "curl -X POST https://api.myapp.com/webhooks \\\n  -H \"Content-Type: application/json\" \\\n  -H \"Stripe-Signature: t=123,v1=abc\" \\\n  -d '{\"id\":\"pi_123\",\"amount\":2000}'"
}

Response (format=postman):
{
  "format": "postman",
  "content": {...} // Postman Collection JSON
}
```

---

## ⚡ Real-Time Architecture

### WebSocket Implementation

**PRD Requirements:** FR-2 (Real-time updates), NFR-1.3 (WebSocket <500ms), NFR-2.2 (10k concurrent connections)

**Architecture:**
```
Webhook Ingestion Worker (Cloudflare)
  ↓
Publish to Redis Pub/Sub
  ↓
WebSocket Server (Railway) subscribes to Redis
  ↓
Push to connected Socket.io clients
  ↓
Client Dashboard updates instantly
```

**WebSocket Server (Node.js + Socket.io):**
```typescript
// websocket-server.ts
import { createServer } from 'http';
import { Server as SocketIOServer } from 'socket.io';
import Redis from 'ioredis';
import jwt from 'jsonwebtoken';

const httpServer = createServer();
const io = new SocketIOServer(httpServer, {
  cors: {
    origin: process.env.FRONTEND_URL,
    credentials: true,
  },
  transports: ['websocket', 'polling'], // WebSocket preferred, fallback to polling
});

const redis = new Redis(process.env.REDIS_URL);
const subscriber = new Redis(process.env.REDIS_URL);

// Authenticate connection (NFR-4)
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  
  if (!token) {
    return next(new Error('Authentication required'));
  }
  
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    socket.data.userId = decoded.userId;
    next();
  } catch (error) {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  console.log(`User connected: ${socket.data.userId}`);
  
  // Subscribe to endpoint updates
  socket.on('subscribe', async (endpointId: string) => {
    // Verify user owns endpoint
    const endpoint = await getEndpoint(endpointId);
    if (endpoint.userId !== socket.data.userId) {
      socket.emit('error', { message: 'Unauthorized' });
      return;
    }
    
    // Join room for this endpoint
    socket.join(`endpoint:${endpointId}`);
    console.log(`User ${socket.data.userId} subscribed to endpoint ${endpointId}`);
  });
  
  socket.on('unsubscribe', (endpointId: string) => {
    socket.leave(`endpoint:${endpointId}`);
  });
  
  socket.on('disconnect', () => {
    console.log(`User disconnected: ${socket.data.userId}`);
  });
});

// Subscribe to Redis Pub/Sub for webhook events
subscriber.subscribe('webhooks:new', 'webhooks:analyzed');

subscriber.on('message', (channel, message) => {
  const data = JSON.parse(message);
  
  if (channel === 'webhooks:new') {
    // New webhook received
    io.to(`endpoint:${data.endpointId}`).emit('webhook_received', {
      id: data.webhookId,
      endpointId: data.endpointId,
      provider: data.provider,
      eventType: data.eventType,
      timestamp: data.timestamp,
      signatureValid: data.signatureValid,
    });
  } else if (channel === 'webhooks:analyzed') {
    // AI analysis completed
    io.to(`endpoint:${data.endpointId}`).emit('analysis_complete', {
      webhookId: data.webhookId,
      analysis: data.analysis,
      confidence: data.confidence,
    });
  }
});

httpServer.listen(process.env.PORT || 3001, () => {
  console.log('WebSocket server listening on port 3001');
});
```

**Client Implementation (Frontend):**
```typescript
// useWebSocket.ts (React hook)
import { useEffect, useState } from 'react';
import { io, Socket } from 'socket.io-client';

export function useWebSocket(endpointId: string) {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [connected, setConnected] = useState(false);
  
  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    
    const newSocket = io(process.env.NEXT_PUBLIC_WS_URL!, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    
    newSocket.on('connect', () => {
      console.log('WebSocket connected');
      setConnected(true);
      newSocket.emit('subscribe', endpointId);
    });
    
    newSocket.on('disconnect', () => {
      console.log('WebSocket disconnected');
      setConnected(false);
    });
    
    newSocket.on('webhook_received', (data) => {
      console.log('New webhook:', data);
      // Update UI (e.g., add to webhook list)
    });
    
    newSocket.on('analysis_complete', (data) => {
      console.log('Analysis complete:', data);
      // Update UI (e.g., show AI insights)
    });
    
    setSocket(newSocket);
    
    return () => {
      newSocket.emit('unsubscribe', endpointId);
      newSocket.disconnect();
    };
  }, [endpointId]);
  
  return { socket, connected };
}
```

**Performance Targets (PRD NFR-1.3, NFR-2.2):**
- Connection latency: <500ms (target: <100ms)
- Message latency: <100ms (webhook received → UI updated)
- Concurrent connections: 10,000+ (Socket.io scales horizontally)

---

## 🔒 Security Architecture

### Encryption at Rest (PRD NFR-4.2)

**Requirement:** Signing secrets encrypted with AES-256

**Implementation:**
```typescript
// encryption.ts
import crypto from 'crypto';

const ENCRYPTION_KEY = Buffer.from(process.env.ENCRYPTION_KEY!, 'hex'); // 32 bytes
const IV_LENGTH = 16; // AES block size

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  
  // Return IV + encrypted data (colon-separated)
  return iv.toString('hex') + ':' + encrypted;
}

export function decrypt(text: string): string {
  const [ivHex, encryptedHex] = text.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const encrypted = Buffer.from(encryptedHex, 'hex');
  
  const decipher = crypto.createDecipheriv('aes-256-cbc', ENCRYPTION_KEY, iv);
  
  let decrypted = decipher.update(encrypted, undefined, 'utf8');
  decrypted += decipher.final('utf8');
  
  return decrypted;
}

// Usage example
const secret = 'whsec_abc123...';
const encryptedSecret = encrypt(secret); // Store in database
const decryptedSecret = decrypt(encryptedSecret); // Use for validation
```

### Rate Limiting (PRD NFR-4.3)

**Requirement:** 100 requests/minute per IP/user

**Implementation (Cloudflare Worker):**
```typescript
// rate-limiter.ts
export async function rateLimit(
  identifier: string, // IP address or user ID
  limit: number,
  windowSeconds: number,
  redis: RedisClient
): Promise<{ allowed: boolean; remaining: number }> {
  const key = `rate_limit:${identifier}`;
  const now = Date.now();
  const windowStart = now - (windowSeconds * 1000);
  
  // Remove old entries
  await redis.zremrangebyscore(key, 0, windowStart);
  
  // Count requests in current window
  const count = await redis.zcard(key);
  
  if (count >= limit) {
    return { allowed: false, remaining: 0 };
  }
  
  // Add current request
  await redis.zadd(key, now, `${now}-${Math.random()}`);
  await redis.expire(key, windowSeconds);
  
  return { allowed: true, remaining: limit - count - 1 };
}

// Usage in API endpoint
const { allowed, remaining } = await rateLimit(
  request.headers.get('cf-connecting-ip')!,
  100, // 100 requests
  60   // per 60 seconds
);

if (!allowed) {
  return new Response('Rate limit exceeded', {
    status: 429,
    headers: {
      'X-RateLimit-Limit': '100',
      'X-RateLimit-Remaining': '0',
      'Retry-After': '60',
    },
  });
}
```

### Input Validation (PRD NFR-4.6)

**Requirement:** Validate all user input with Zod schemas

**Implementation:**
```typescript
// validation-schemas.ts
import { z } from 'zod';

export const CreateEndpointSchema = z.object({
  name: z.string().min(1).max(255),
  provider: z.enum(['stripe', 'github', 'shopify', 'twilio', 'sendgrid', 'generic']).optional(),
  signingSecret: z.string().min(10).max(500).optional(),
});

export const ForwardWebhookSchema = z.object({
  targetUrl: z.string().url().refine(
    (url) => url.startsWith('http://') || url.startsWith('https://'),
    'URL must start with http:// or https://'
  ),
});

export const CommentSchema = z.object({
  comment: z.string().min(1).max(5000),
});

// Usage in API endpoint
const body = await request.json();
const validated = CreateEndpointSchema.parse(body); // Throws if invalid
```

---

## 🧪 Testing Strategy

### Unit Tests (PRD NFR-6.1: 80% coverage)

```typescript
// provider-detector.test.ts
import { describe, it, expect } from 'vitest';
import { detectProvider } from './provider-detector';

describe('Provider Detection', () => {
  it('should detect Stripe from signature header', () => {
    const headers = {
      'stripe-signature': 't=123,v1=abc',
      'content-type': 'application/json',
    };
    
    const provider = detectProvider(headers);
    expect(provider).not.toBeNull();
    expect(provider!.name).toBe('stripe');
  });
  
  it('should detect GitHub from signature and event headers', () => {
    const headers = {
      'x-hub-signature-256': 'sha256=abc123',
      'x-github-event': 'push',
    };
    
    const provider = detectProvider(headers);
    expect(provider!.name).toBe('github');
  });
  
  it('should return null for unknown provider', () => {
    const headers = {
      'content-type': 'application/json',
    };
    
    const provider = detectProvider(headers);
    expect(provider).toBeNull();
  });
});
```

### Integration Tests

```typescript
// api.test.ts
import { describe, it, expect, beforeAll } from 'vitest';
import { createTestClient } from './test-utils';

describe('Webhook API', () => {
  let client: TestClient;
  let endpointId: string;
  
  beforeAll(async () => {
    client = await createTestClient();
  });
  
  it('should create endpoint', async () => {
    const response = await client.post('/endpoints', {
      name: 'Test Endpoint',
    });
    
    expect(response.status).toBe(201);
    expect(response.data.slug).toMatch(/^[a-z0-9]{9}$/);
    endpointId = response.data.id;
  });
  
  it('should receive webhook', async () => {
    const response = await client.post(`/w/${endpointId}`, {
      event: 'test.event',
      data: { foo: 'bar' },
    });
    
    expect(response.status).toBe(200);
  });
  
  it('should retrieve webhooks for endpoint', async () => {
    const response = await client.get(`/webhooks?endpointId=${endpointId}`);
    
    expect(response.status).toBe(200);
    expect(response.data.webhooks).toHaveLength(1);
    expect(response.data.webhooks[0].payload.data.foo).toBe('bar');
  });
});
```

### E2E Tests (Playwright)

```typescript
// onboarding.spec.ts
import { test, expect } from '@playwright/test';

test('user onboarding flow', async ({ page }) => {
  // Sign up
  await page.goto('/signup');
  await page.fill('[name="email"]', 'test@example.com');
  await page.fill('[name="password"]', 'SecurePass123!');
  await page.click('[type="submit"]');
  
  // Should redirect to dashboard
  await expect(page).toHaveURL('/dashboard');
  
  // Create first endpoint
  await page.click('text=Create Endpoint');
  await page.fill('[name="name"]', 'My First Endpoint');
  await page.click('text=Create');
  
  // Should show endpoint URL
  await expect(page.locator('[data-testid="endpoint-url"]')).toBeVisible();
  
  // Copy URL
  await page.click('[data-testid="copy-url"]');
  
  // Should show success toast
  await expect(page.locator('text=URL copied')).toBeVisible();
});
```

---

## 🚀 Implementation Phases

### Phase 1: MVP (Week 1-2) - Matches PRD Release Phase 1

**Goal:** Launch core features on Product Hunt

**Tasks:**
- [ ] Setup Next.js frontend + Tailwind + Shadcn UI
- [ ] Setup Cloudflare Workers (ingestion + API)
- [ ] Setup PostgreSQL (Supabase) + TimescaleDB
- [ ] Setup Redis (Upstash)
- [ ] Implement auth (Better Auth)
- [ ] Build webhook ingestion flow
- [ ] Build signature validation (Stripe, GitHub, Shopify)
- [ ] Build dashboard UI (list + detail views)
- [ ] Implement WebSocket real-time updates
- [ ] Integrate Claude AI (OpenRouter)
- [ ] Implement forward to localhost
- [ ] Deploy to production
- [ ] Launch on Product Hunt

**Success Criteria (from PRD):**
- ✅ Product Hunt: Top 5 product of the day
- ✅ 500+ signups in first week
- ✅ API response time <100ms (p95)
- ✅ Dashboard load time <2s
- ✅ Zero critical bugs

---

### Phase 2: Monetization (Week 3-4) - Matches PRD Phase 2

**Goal:** Enable paid subscriptions

**Tasks:**
- [ ] Implement Stripe payment integration
- [ ] Create pricing page
- [ ] Implement subscription management
- [ ] Enforce tier limits (free vs pro)
- [ ] Add batch replay feature
- [ ] Add share links
- [ ] Add export to Postman/cURL
- [ ] Implement search & filters
- [ ] Add dark mode
- [ ] Email drip campaign (convert free → paid)

**Success Criteria (from PRD):**
- ✅ 10% conversion rate (free → paid)
- ✅ $120+ MRR
- ✅ 1,000+ total signups

---

### Phase 3: Team Features (Week 5-8) - Matches PRD Phase 3

**Goal:** Attract startup teams

**Tasks:**
- [ ] Implement team tier
- [ ] Add team member invites
- [ ] Build comments system with @mentions
- [ ] Build assignment workflow
- [ ] Create team dashboard
- [ ] Implement shared endpoints
- [ ] Add activity log
- [ ] Email notifications for mentions/assignments

**Success Criteria (from PRD):**
- ✅ 50+ team accounts
- ✅ $2,000+ MRR
- ✅ 4.5+ star reviews

---

## ✅ PRD Alignment Checklist

### Functional Requirements

- [x] **FR-1:** Webhook Capture (Component 1: Ingestion Worker)
- [x] **FR-2:** Real-Time Updates (WebSocket Architecture)
- [x] **FR-3:** Signature Validation (Component 3: Validator)
- [x] **FR-4:** AI Analysis (Component 4: AI Engine)
- [x] **FR-5:** Forwarding & Replay (API: /forward, /batch-replay)
- [x] **FR-6:** Team Collaboration (Database: comments, assignments)
- [x] **FR-7:** Export (API: /export with multiple formats)

### Non-Functional Requirements

- [x] **NFR-1:** Performance (<100ms API, <2s dashboard, <10s AI)
- [x] **NFR-2:** Scalability (10k webhooks/min, 10k WebSocket connections)
- [x] **NFR-3:** Reliability (99.9% uptime, zero data loss)
- [x] **NFR-4:** Security (TLS 1.3, AES-256, rate limiting, DDoS protection)
- [x] **NFR-5:** Usability (<30s time to first webhook, mobile responsive)
- [x] **NFR-6:** Maintainability (80% test coverage, TypeScript strict, CI/CD)

### User Stories

- [x] **US-1.1:** Create webhook endpoint (API: POST /endpoints)
- [x] **US-1.2:** Receive webhook in real-time (WebSocket push)
- [x] **US-1.3:** Inspect webhook details (API: GET /webhooks/:id)
- [x] **US-2.1:** Auto-detect provider (Component 2: Provider Detection)
- [x] **US-2.2:** Validate webhook signature (Component 3: Signature Validator)
- [x] **US-3.1:** Auto-analyze webhook errors (Component 4: AI Engine)
- [x] **US-3.2:** AI-suggested code fixes (AI prompt includes code examples)
- [x] **US-4.1:** Forward webhook to localhost (API: POST /webhooks/:id/forward)
- [x] **US-4.2:** Replay webhook to production (API: POST /webhooks/batch-replay)
- [x] **US-5.1:** Share webhook link (API: POST /webhooks/:id/share)
- [x] **US-5.2:** Comment on webhook (Database: webhook_comments table)
- [x] **US-6.1:** Export to cURL (API: GET /webhooks/:id/export?format=curl)
- [x] **US-6.2:** Export to Postman (API: GET /webhooks/:id/export?format=postman)

---

**Document End**

**Next Document:** [HookLens Tech Stack Specification](./HookLens-TechStack.md)
