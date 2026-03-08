/**
 * Webhook Ingestion Route — Public endpoint for receiving webhooks
 * POST /w/:endpointId
 * PRD: FR-1, NFR-1.1 (<100ms), NFR-2.1 (10k/min)
 */
import { Hono } from 'hono';
import { eq, sql } from 'drizzle-orm';
import { createDb } from '../lib/db';
import { createRedis, publishEvent, getCached, setCache } from '../lib/redis';
import { webhookEndpoints, webhooks } from '../db/schema';
import { detectProvider, extractEventType } from '../services/provider-detector';
import { validateSignature } from '../services/signature-validator';
import { decrypt } from '../lib/crypto';
import { AppEnv } from '../types';
import Ajv from 'ajv'; // JSON Schema validator
import { Context } from 'hono';

const ingestion = new Hono<AppEnv>();
const ajv = new Ajv();

// Helper to fire notifications async
async function sendChatNotifications(endpoint: any, payload: any, provider: string | null) {
  const content = `New Webhook Received via HookLens!\n*Endpoint:* ${endpoint.name}\n*Provider:* ${provider || 'Unknown'}\n\`\`\`json\n${JSON.stringify(payload).slice(0, 1000)}\n\`\`\``;

  if (endpoint.slackWebhookUrl) {
    fetch(endpoint.slackWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: content })
    }).catch(console.error);
  }

  if (endpoint.discordWebhookUrl) {
    fetch(endpoint.discordWebhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    }).catch(console.error);
  }
}

// POST /w/:slug — Main webhook receiver
ingestion.post('/:slug', async (c) => {
  const startTime = Date.now();
  const slug = c.req.param('slug');

  try {
    const db = createDb(c.env.DATABASE_URL);
    const redis = createRedis(c.env.UPSTASH_REDIS_REST_URL, c.env.UPSTASH_REDIS_REST_TOKEN);

    // 1. Validate endpoint exists (cache for 5 min)
    let endpoint = await getCached<{ 
      id: string; userId: string; signingSecret: string | null; provider: string | null;
      schemaValidation: any; slackWebhookUrl: string | null; discordWebhookUrl: string | null; 
      name: string;
    }>(
      redis, `ep:${slug}`
    );

    if (!endpoint) {
      const [ep] = await db.select({
        id: webhookEndpoints.id,
        userId: webhookEndpoints.userId,
        name: webhookEndpoints.name,
        signingSecret: webhookEndpoints.signingSecret,
        provider: webhookEndpoints.provider,
        schemaValidation: webhookEndpoints.schemaValidation,
        slackWebhookUrl: webhookEndpoints.slackWebhookUrl,
        discordWebhookUrl: webhookEndpoints.discordWebhookUrl,
      }).from(webhookEndpoints)
        .where(eq(webhookEndpoints.slug, slug))
        .limit(1);

      if (!ep) {
        return c.json({ error: 'Endpoint not found' }, 404);
      }

      endpoint = ep;
      await setCache(redis, `ep:${slug}`, ep, 300);
    }

    // 2. Capture request data
    const rawBody = await c.req.text();
    const headers: Record<string, string> = {};
    c.req.raw.headers.forEach((value, key) => {
      headers[key] = value;
    });

    let payload: Record<string, unknown> = {};
    try {
      payload = JSON.parse(rawBody);
    } catch {
      payload = { _raw: rawBody };
    }

    // 3. Detect provider
    const providerConfig = detectProvider(headers);
    const providerName = providerConfig?.name || endpoint.provider || null;
    const eventType = providerName
      ? extractEventType(providerName, headers, payload)
      : null;

    // 4. Validate payload against JSON schema (if configured)
    let schemaErrors = null;
    let schemaValid = true;
    if (endpoint.schemaValidation) {
      try {
        const validate = ajv.compile(endpoint.schemaValidation);
        schemaValid = validate(payload) as boolean;
        if (!schemaValid) {
          schemaErrors = validate.errors;
        }
      } catch (err) {
        console.error('Schema compilation error', err);
        schemaErrors = [{ message: 'Invalid schema configured on endpoint' }];
        schemaValid = false;
      }
    }

    if (!schemaValid) {
      // Return 400 Bad Request if schema validation fails
      return c.json({ error: 'Payload failed schema validation', details: schemaErrors }, 400);
    }

    // 5. Validate signature (if secret configured)
    let signatureResult = null;
    if (endpoint.signingSecret && providerName) {
      try {
        const secret = await decrypt(endpoint.signingSecret, c.env.ENCRYPTION_KEY);
        signatureResult = await validateSignature(providerName, rawBody, headers, secret);
      } catch (err) {
        console.error('Signature validation error:', err);
      }
    }

    // 5. Store webhook
    const [webhook] = await db.insert(webhooks).values({
      endpointId: endpoint.id,
      provider: providerName,
      eventType,
      method: c.req.method,
      headers,
      payload,
      ipAddress: c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || null,
      userAgent: c.req.header('user-agent') || null,
      responseCode: 200,
      responseTimeMs: Date.now() - startTime,
      signatureValid: signatureResult?.valid ?? null,
      signatureHeader: providerConfig?.signatureHeader || null,
      signatureAlgorithm: signatureResult?.algorithm || null,
      expectedSignature: signatureResult?.expected || null,
      receivedSignature: signatureResult?.received || null,
    }).returning();

    // 6. Update endpoint stats
    await db.update(webhookEndpoints).set({
      lastWebhookAt: new Date(),
      webhookCount: sql`${webhookEndpoints.webhookCount} + 1`,
    }).where(eq(webhookEndpoints.id, endpoint.id));

    // 8. Publish to Redis for real-time updates
    await publishEvent(redis, 'webhooks:new', {
      webhookId: webhook.id,
      endpointId: endpoint.id,
      provider: providerName,
      eventType,
      signatureValid: signatureResult?.valid ?? null,
      timestamp: webhook.createdAt,
    });

    // 9. Send notifications (fire and forget)
    c.executionCtx.waitUntil(sendChatNotifications(endpoint, payload, providerName));

    // 8. Return 200 OK
    const responseTime = Date.now() - startTime;
    return c.text('OK', 200, {
      'X-HookLens-Id': webhook.id,
      'X-Response-Time': `${responseTime}ms`,
    });

  } catch (error) {
    console.error('Webhook ingestion error:', error);
    return c.text('Internal Error', 500);
  }
});

export default ingestion;
