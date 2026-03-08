import { Redis } from '@upstash/redis';

export function createRedis(url: string, token: string) {
  return new Redis({ url, token });
}

export type RedisClient = ReturnType<typeof createRedis>;

// Cache helpers
export async function getCached<T>(redis: RedisClient, key: string): Promise<T | null> {
  const cached = await redis.get(key);
  if (cached === null || cached === undefined) return null;
  return typeof cached === 'string' ? JSON.parse(cached) : cached as T;
}

export async function setCache(redis: RedisClient, key: string, data: unknown, ttlSeconds: number) {
  await redis.setex(key, ttlSeconds, JSON.stringify(data));
}

// Pub/Sub helper
export async function publishEvent(redis: RedisClient, channel: string, data: unknown) {
  await redis.publish(channel, JSON.stringify(data));
}
