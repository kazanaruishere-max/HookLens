import { defineConfig } from 'drizzle-kit';
import { config } from 'dotenv';

// Load .env from project root (one level up from /backend)
config({ path: '../.env' });
// Also try local .env in case running from /backend folder
config({ path: '.env' });

export default defineConfig({
  schema: './src/db/schema.ts',
  out: './drizzle',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!,
  },
});
