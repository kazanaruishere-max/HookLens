export type AppEnv = {
  Bindings: {
    DATABASE_URL: string;
    JWT_SECRET: string;
    ENCRYPTION_KEY: string;
    UPSTASH_REDIS_REST_URL: string;
    UPSTASH_REDIS_REST_TOKEN: string;
    OPENROUTER_API_KEY: string;
    STRIPE_SECRET_KEY: string;
    STRIPE_WEBHOOK_SECRET: string;
    FRONTEND_URL: string;
  };
  Variables: {
    userId: string;
    userPlan: string;
  };
};
