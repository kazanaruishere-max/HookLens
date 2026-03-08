/**
 * Rate Limiting Middleware — 100 req/min per IP using Upstash Redis
 * PRD: NFR-4.3
 */
import { Context, Next } from 'hono';
import { createRedis } from '../lib/redis';

export function rateLimitMiddleware(limit: number = 100, windowSeconds: number = 60) {
  return async (c: Context, next: Next) => {
    const redis = createRedis(c.env.UPSTASH_REDIS_REST_URL, c.env.UPSTASH_REDIS_REST_TOKEN);
    const ip = c.req.header('cf-connecting-ip') || c.req.header('x-forwarded-for') || 'unknown';
    const key = `rl:${ip}`;

    try {
      const current = await redis.incr(key);

      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }

      const remaining = Math.max(0, limit - current);

      c.header('X-RateLimit-Limit', limit.toString());
      c.header('X-RateLimit-Remaining', remaining.toString());

      if (current > limit) {
        c.header('Retry-After', windowSeconds.toString());
        return c.json({ error: 'Rate limit exceeded' }, 429);
      }
    } catch (err) {
      // Don't block on Redis failures — fail open
      console.error('Rate limit error:', err);
    }

    await next();
  };
}
