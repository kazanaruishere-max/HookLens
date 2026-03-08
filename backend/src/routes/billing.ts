/**
 * Stripe Payment Routes — Phase 2
 * POST /billing/checkout     — Create checkout session
 * POST /billing/portal       — Customer portal
 * POST /billing/webhook      — Stripe webhook handler
 * GET  /billing/status       — Current subscription status
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { validateSignature } from '../services/signature-validator';
import { AppEnv } from '../types';
import { createDb } from '../lib/db';
import { users, subscriptions } from '../db/schema';

const billing = new Hono<AppEnv>();

// ==========================================
// GET /billing/status
// ==========================================
billing.get('/status', async (c) => {
  const userId = c.get('userId');
  const db = createDb(c.env.DATABASE_URL);

  const [user] = await db.select({
    plan: users.plan,
    stripeCustomerId: users.stripeCustomerId,
  }).from(users).where(eq(users.id, userId));

  const [sub] = await db.select().from(subscriptions)
    .where(eq(subscriptions.userId, userId));

  return c.json({
    plan: user?.plan || 'free',
    subscription: sub ? {
      status: sub.status,
      currentPeriodEnd: sub.currentPeriodEnd,
      cancelAtPeriodEnd: sub.cancelAtPeriodEnd,
    } : null,
  });
});

// ==========================================
// POST /billing/checkout
// ==========================================
billing.post('/checkout', async (c) => {
  const userId = c.get('userId');
  const body = await c.req.json<{ plan: 'pro' | 'team' }>();

  if (!body.plan || !['pro', 'team'].includes(body.plan)) {
    return c.json({ error: 'Invalid plan' }, 400);
  }

  const PRICE_IDS: Record<string, string> = {
    pro: 'price_pro_monthly',   // Replace with real Stripe price ID
    team: 'price_team_monthly', // Replace with real Stripe price ID
  };

  const db = createDb(c.env.DATABASE_URL);

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) return c.json({ error: 'User not found' }, 404);

  // Create Stripe checkout session via fetch (no Node.js SDK needed)
  const stripeResponse = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      'mode': 'subscription',
      'payment_method_types[]': 'card',
      'customer_email': user.email,
      'line_items[0][price]': PRICE_IDS[body.plan],
      'line_items[0][quantity]': '1',
      'success_url': `${c.env.FRONTEND_URL}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
      'cancel_url': `${c.env.FRONTEND_URL}/billing`,
      'metadata[userId]': userId,
      'metadata[plan]': body.plan,
    }).toString(),
  });

  if (!stripeResponse.ok) {
    const err = await stripeResponse.text();
    console.error('Stripe error:', err);
    return c.json({ error: 'Failed to create checkout session' }, 500);
  }

  const session = await stripeResponse.json() as { url: string; id: string };
  return c.json({ url: session.url, sessionId: session.id });
});

// ==========================================
// POST /billing/portal
// ==========================================
billing.post('/portal', async (c) => {
  const userId = c.get('userId');
  const db = createDb(c.env.DATABASE_URL);

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user?.stripeCustomerId) {
    return c.json({ error: 'No billing account found' }, 400);
  }

  const portalResponse = await fetch('https://api.stripe.com/v1/billing_portal/sessions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${c.env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      'customer': user.stripeCustomerId,
      'return_url': `${c.env.FRONTEND_URL}/billing`,
    }).toString(),
  });

  if (!portalResponse.ok) {
    return c.json({ error: 'Failed to create portal session' }, 500);
  }

  const portal = await portalResponse.json() as { url: string };
  return c.json({ url: portal.url });
});

// ==========================================
// POST /billing/webhook (Stripe events)
// ==========================================
billing.post('/webhook', async (c) => {
  const body = await c.req.text();
  const sig = c.req.header('stripe-signature');

  if (!sig || !c.env.STRIPE_WEBHOOK_SECRET) {
    return c.json({ error: 'Missing signature' }, 400);
  }

  // Verify Stripe signature using Web Crypto API
  const isValid = await verifyStripeSignature(body, sig, c.env.STRIPE_WEBHOOK_SECRET);
  if (!isValid) {
    return c.json({ error: 'Invalid signature' }, 400);
  }

  const event = JSON.parse(body) as {
    type: string;
    data: { object: Record<string, unknown> };
  };

  const db = createDb(c.env.DATABASE_URL);

  switch (event.type) {
    case 'checkout.session.completed': {
      const session = event.data.object as {
        metadata: { userId: string; plan: string };
        customer: string;
        subscription: string;
      };

      const { userId, plan } = session.metadata;

      // Update user plan
      await db.update(users).set({
        plan,
        stripeCustomerId: session.customer,
        updatedAt: new Date(),
      }).where(eq(users.id, userId));

      // Upsert subscription
      await db.insert(subscriptions).values({
        userId,
        stripeCustomerId: session.customer,
        stripeSubscriptionId: session.subscription,
        plan,
        status: 'active',
      }).onConflictDoUpdate({
        target: subscriptions.stripeSubscriptionId,
        set: { status: 'active', updatedAt: new Date() },
      });

      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as {
        id: string;
        status: string;
        cancel_at_period_end: boolean;
        current_period_start: number;
        current_period_end: number;
        metadata: { plan: string };
      };

      await db.update(subscriptions).set({
        status: sub.status,
        cancelAtPeriodEnd: sub.cancel_at_period_end,
        currentPeriodStart: new Date(sub.current_period_start * 1000),
        currentPeriodEnd: new Date(sub.current_period_end * 1000),
        updatedAt: new Date(),
      }).where(eq(subscriptions.stripeSubscriptionId, sub.id));

      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as { id: string; customer: string };

      // Downgrade to free
      await db.update(subscriptions).set({
        status: 'canceled',
        updatedAt: new Date(),
      }).where(eq(subscriptions.stripeSubscriptionId, sub.id));

      // Find user by stripe customer ID and downgrade
      await db.update(users).set({
        plan: 'free',
        updatedAt: new Date(),
      }).where(eq(users.stripeCustomerId, sub.customer));

      break;
    }
  }

  return c.json({ received: true });
});

// ==========================================
// Stripe Signature Verification (Web Crypto)
// ==========================================
async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string
): Promise<boolean> {
  try {
    const parts = Object.fromEntries(
      header.split(',').map((p) => {
        const [k, v] = p.split('=');
        return [k.trim(), v?.trim()];
      })
    );

    const timestamp = parts['t'];
    const signature = parts['v1'];

    if (!timestamp || !signature) return false;

    // Reject old timestamps (>5 min)
    if (Math.abs(Date.now() / 1000 - parseInt(timestamp)) > 300) return false;

    const signedPayload = `${timestamp}.${payload}`;
    const key = await crypto.subtle.importKey(
      'raw',
      new TextEncoder().encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    );

    const mac = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(signedPayload));
    const expected = Array.from(new Uint8Array(mac))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('');

    return expected === signature;
  } catch {
    return false;
  }
}

export default billing;
