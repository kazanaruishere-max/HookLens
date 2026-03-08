/**
 * Plan Limits — Enforce tier limitations
 * Free: 50 webhooks/endpoint, 7-day retention, 1 endpoint, no team
 * Pro: unlimited webhooks, 30-day retention, 10 endpoints, AI analysis
 * Team: unlimited everything, 90-day retention, shared endpoints
 */
export const PLAN_LIMITS = {
  free: {
    maxEndpoints: 3,
    maxWebhooksPerEndpoint: 50,
    retentionDays: 7,
    aiAnalysis: true,
    teamFeatures: false,
    exportFeatures: true,
    apiAccess: false,
  },
  pro: {
    maxEndpoints: 20,
    maxWebhooksPerEndpoint: 10000,
    retentionDays: 30,
    aiAnalysis: true,
    teamFeatures: false,
    exportFeatures: true,
    apiAccess: true,
  },
  team: {
    maxEndpoints: 100,
    maxWebhooksPerEndpoint: 100000,
    retentionDays: 90,
    aiAnalysis: true,
    teamFeatures: true,
    exportFeatures: true,
    apiAccess: true,
  },
} as const;

export type Plan = keyof typeof PLAN_LIMITS;

export function getPlanLimits(plan: string) {
  return PLAN_LIMITS[plan as Plan] ?? PLAN_LIMITS.free;
}
