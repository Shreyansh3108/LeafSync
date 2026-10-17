const { z } = require('zod');
require('dotenv').config();

const envSchema = z.object({
  NODE_ENV: z.string().default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().url(),
  JWT_SECRET: z.string().min(10),
  AI_PROVIDER: z.enum(['gemini', 'anthropic', 'openai']).default('gemini'),
  AI_API_KEY: z.string().optional().default(''),
  AI_MODEL_CLASSIFY: z.string().default('gemini-2.5-flash-lite'),
  AI_MODEL_DRAFT: z.string().default('gemini-2.5-flash-lite'),
  AI_TIMEOUT_MS: z.coerce.number().int().positive().default(10000),
  AI_MAX_RETRIES: z.coerce.number().int().min(0).max(5).default(2),
  AI_DAILY_CALL_LIMIT: z.coerce.number().int().positive().default(200),
  DEMO_PASSWORD: z.string().default('Password123'),
});

const parsed = envSchema.safeParse(process.env);
if (!parsed.success) {
  console.error('Environment validation failed:', parsed.error.format());
  process.exit(1);
}

module.exports = parsed.data;