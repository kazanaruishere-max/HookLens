import {
  pgTable, uuid, varchar, text, timestamp, boolean,
  integer, jsonb, index, primaryKey
} from 'drizzle-orm/pg-core';

// ============================================
// Users Table
// ============================================
export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull().unique(),
  passwordHash: varchar('password_hash', { length: 255 }),
  name: varchar('name', { length: 255 }),
  avatarUrl: text('avatar_url'),
  authProvider: varchar('auth_provider', { length: 50 }).default('email'),
  plan: varchar('plan', { length: 50 }).default('free'), // free | pro | team
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }),
  // Preferences
  notifyOnWebhook: boolean('notify_on_webhook').default(false),
  notifyOnFailure: boolean('notify_on_failure').default(true),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastSeenAt: timestamp('last_seen_at'),
});

// ============================================
// Webhook Endpoints Table
// ============================================
export const webhookEndpoints = pgTable('webhook_endpoints', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id'), // null = personal, set = shared with team
  name: varchar('name', { length: 255 }).notNull().default('Untitled Endpoint'),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  description: text('description'),
  provider: varchar('provider', { length: 50 }),
  signingSecret: text('signing_secret'), // Encrypted AES-256
  
  // Phase 4: Advanced validations & integrations
  schemaValidation: jsonb('schema_validation'), // JSON schema for custom validation
  slackWebhookUrl: text('slack_webhook_url'), // For Slack notifications
  discordWebhookUrl: text('discord_webhook_url'), // For Discord alerts

  active: boolean('active').default(true),
  retentionDays: integer('retention_days').default(7), // 7 free, 30 pro, 90 team
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  lastWebhookAt: timestamp('last_webhook_at'),
  webhookCount: integer('webhook_count').default(0),
}, (t) => ({
  userIdx: index('endpoint_user_idx').on(t.userId),
  teamIdx: index('endpoint_team_idx').on(t.teamId),
}));

// ============================================
// Webhooks Table (Time-Series)
// ============================================
export const webhooks = pgTable('webhooks', {
  id: uuid('id').primaryKey().defaultRandom(),
  endpointId: uuid('endpoint_id').notNull().references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),

  // Provider info
  provider: varchar('provider', { length: 50 }),
  eventType: varchar('event_type', { length: 255 }),

  // Request data
  method: varchar('method', { length: 10 }).default('POST'),
  headers: jsonb('headers').notNull(),
  payload: jsonb('payload').notNull(),
  ipAddress: varchar('ip_address', { length: 45 }),
  userAgent: text('user_agent'),

  // Response data
  responseCode: integer('response_code'),
  responseBody: text('response_body'),
  responseTimeMs: integer('response_time_ms'),

  // Signature validation
  signatureValid: boolean('signature_valid'),
  signatureHeader: varchar('signature_header', { length: 255 }),
  signatureAlgorithm: varchar('signature_algorithm', { length: 50 }),
  expectedSignature: text('expected_signature'),
  receivedSignature: text('received_signature'),

  // AI analysis
  aiAnalyzed: boolean('ai_analyzed').default(false),
  aiInsights: jsonb('ai_insights'),

  // Metadata
  forwarded: boolean('forwarded').default(false),
  forwardedUrl: text('forwarded_url'),
  shared: boolean('shared').default(false),
  shareToken: varchar('share_token', { length: 100 }).unique(),

  // Assignment (Phase 3)
  assignedTo: uuid('assigned_to').references(() => users.id),
  resolved: boolean('resolved').default(false),
}, (t) => ({
  endpointIdx: index('webhook_endpoint_idx').on(t.endpointId),
  createdAtIdx: index('webhook_created_at_idx').on(t.createdAt),
  providerIdx: index('webhook_provider_idx').on(t.provider),
  eventTypeIdx: index('webhook_event_type_idx').on(t.eventType),
  shareTokenIdx: index('webhook_share_token_idx').on(t.shareToken),
}));

// ============================================
// Teams Table (Phase 3)
// ============================================
export const teams = pgTable('teams', {
  id: uuid('id').primaryKey().defaultRandom(),
  ownerId: uuid('owner_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  slug: varchar('slug', { length: 100 }).notNull().unique(),
  avatarUrl: text('avatar_url'),
  plan: varchar('plan', { length: 50 }).default('team'),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// Team Members Table
// ============================================
export const teamMembers = pgTable('team_members', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').notNull().references(() => teams.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  email: varchar('email', { length: 255 }).notNull(), // for pending invites
  role: varchar('role', { length: 50 }).default('member'), // owner | admin | member | viewer
  status: varchar('status', { length: 50 }).default('pending'), // pending | active | removed
  inviteToken: varchar('invite_token', { length: 100 }).unique(),
  invitedAt: timestamp('invited_at').defaultNow(),
  acceptedAt: timestamp('accepted_at'),
}, (t) => ({
  teamUserIdx: index('team_member_idx').on(t.teamId, t.userId),
}));

// ============================================
// Webhook Comments Table (Phase 3)
// ============================================
export const webhookComments = pgTable('webhook_comments', {
  id: uuid('id').primaryKey().defaultRandom(),
  webhookId: uuid('webhook_id').notNull().references(() => webhooks.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  parentId: uuid('parent_id'), // For nested replies
  mentions: jsonb('mentions').default([]), // Array of user IDs
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
  edited: boolean('edited').default(false),
  deleted: boolean('deleted').default(false),
}, (t) => ({
  webhookIdx: index('comment_webhook_idx').on(t.webhookId),
}));

// ============================================
// Activity Log Table (Phase 3)
// ============================================
export const activityLog = pgTable('activity_log', {
  id: uuid('id').primaryKey().defaultRandom(),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  userId: uuid('user_id').references(() => users.id),
  action: varchar('action', { length: 100 }).notNull(), // 'webhook.received', 'endpoint.created', etc.
  resourceType: varchar('resource_type', { length: 50 }), // 'webhook' | 'endpoint' | 'comment'
  resourceId: uuid('resource_id'),
  metadata: jsonb('metadata').default({}),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  teamIdx: index('activity_team_idx').on(t.teamId),
  createdIdx: index('activity_created_idx').on(t.createdAt),
}));

// ============================================
// Subscriptions Table (Phase 2)
// ============================================
export const subscriptions = pgTable('subscriptions', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').references(() => users.id, { onDelete: 'cascade' }),
  teamId: uuid('team_id').references(() => teams.id, { onDelete: 'cascade' }),
  stripeCustomerId: varchar('stripe_customer_id', { length: 255 }).notNull(),
  stripeSubscriptionId: varchar('stripe_subscription_id', { length: 255 }).unique(),
  stripePriceId: varchar('stripe_price_id', { length: 255 }),
  plan: varchar('plan', { length: 50 }).notNull().default('free'),
  status: varchar('status', { length: 50 }), // active | canceled | past_due | trialing
  currentPeriodStart: timestamp('current_period_start'),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').default(false),
  createdAt: timestamp('created_at').defaultNow(),
  updatedAt: timestamp('updated_at').defaultNow(),
});

// ============================================
// API Keys Table (Phase 4)
// ============================================
export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: varchar('name', { length: 255 }).notNull(),
  keyHash: varchar('key_hash', { length: 255 }).notNull(), // SHA-256 hash of the key
  keyPrefix: varchar('key_prefix', { length: 12 }).notNull(), // First 12 chars for display
  scopes: jsonb('scopes').default(['read']), // ['read', 'write', 'admin']
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  active: boolean('active').default(true),
  createdAt: timestamp('created_at').defaultNow(),
}, (t) => ({
  userIdx: index('api_key_user_idx').on(t.userId),
}));

// ============================================
// Webhook Monitoring Table (Phase 4)
// ============================================
export const webhookMonitoring = pgTable('webhook_monitoring', {
  id: uuid('id').primaryKey().defaultRandom(),
  endpointId: uuid('endpoint_id').notNull().references(() => webhookEndpoints.id, { onDelete: 'cascade' }),
  checkTime: timestamp('check_time').defaultNow(),
  webhookCount: integer('webhook_count').default(0),
  errorCount: integer('error_count').default(0),
  avgResponseTimeMs: integer('avg_response_time_ms'),
  successRate: integer('success_rate'), // 0-100
}, (t) => ({
  endpointIdx: index('monitoring_endpoint_idx').on(t.endpointId),
  timeIdx: index('monitoring_time_idx').on(t.checkTime),
}));

// ============================================
// Type Exports
// ============================================
export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;
export type WebhookEndpoint = typeof webhookEndpoints.$inferSelect;
export type NewWebhookEndpoint = typeof webhookEndpoints.$inferInsert;
export type Webhook = typeof webhooks.$inferSelect;
export type NewWebhook = typeof webhooks.$inferInsert;
export type Team = typeof teams.$inferSelect;
export type NewTeam = typeof teams.$inferInsert;
export type TeamMember = typeof teamMembers.$inferSelect;
export type WebhookComment = typeof webhookComments.$inferSelect;
export type ActivityLog = typeof activityLog.$inferSelect;
export type Subscription = typeof subscriptions.$inferSelect;
export type ApiKey = typeof apiKeys.$inferSelect;
