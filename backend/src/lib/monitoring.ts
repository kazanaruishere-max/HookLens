import { sql, eq } from 'drizzle-orm';
import { createDb } from './db';
import { webhookEndpoints, webhookMonitoring, webhooks } from '../db/schema';
import { AppEnv } from '../types';

/**
 * Uptime & Latency Monitoring Service
 * Called by Cloudflare Cron Triggers every X minutes
 */
export async function runMonitoringCheck(env: AppEnv['Bindings']) {
  const db = createDb(env.DATABASE_URL);

  // 1. Get all active endpoints
  const endpoints = await db.select({
    id: webhookEndpoints.id,
    slackWebhookUrl: webhookEndpoints.slackWebhookUrl,
    discordWebhookUrl: webhookEndpoints.discordWebhookUrl,
    name: webhookEndpoints.name,
  }).from(webhookEndpoints).where(eq(webhookEndpoints.active, true));

  const checkTime = new Date();
  // Look back window (e.g. last 15 mins)
  const lookBack = new Date(checkTime.getTime() - 15 * 60000);

  for (const ep of endpoints) {
    // 2. Aggregate stats for this endpoint in the lookback window
    const statsResult = await db.execute(sql`
      SELECT 
        COUNT(*) as total,
        COUNT(CASE WHEN response_code >= 400 THEN 1 END) as errors,
        AVG(response_time_ms)::int as avg_ms
      FROM webhooks
      WHERE endpoint_id = ${ep.id} AND created_at >= ${lookBack.toISOString()}
    `);

    const stats = statsResult[0] as { total: string; errors: string; avg_ms: string | null };
    const total = parseInt(stats?.total || '0');
    const errors = parseInt(stats?.errors || '0');
    const avgMs = stats?.avg_ms ? parseInt(stats.avg_ms) : null;
    const successRate = total > 0 ? Math.round(((total - errors) / total) * 100) : 100;

    // 3. Store snapshot
    await db.insert(webhookMonitoring).values({
      endpointId: ep.id,
      checkTime,
      webhookCount: total,
      errorCount: errors,
      avgResponseTimeMs: avgMs,
      successRate,
    });

    // 4. Alerting logic (e.g., Error Spike)
    if (total > 5 && successRate < 80) { // Arbitrary threshold: High error rate
      const content = `🔥 *High Error Rate Alert* 🔥\nEndpoint: **${ep.name}**\nSuccess Rate dropped to **${successRate}%** in the last 15 minutes! (${errors}/${total} failed).`;
      
      if (ep.slackWebhookUrl) {
        fetch(ep.slackWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ text: content })
        }).catch(console.error);
      }
      
      if (ep.discordWebhookUrl) {
        fetch(ep.discordWebhookUrl, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content })
        }).catch(console.error);
      }
    }
  }
}
