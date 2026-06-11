import { z } from 'zod';
import dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  MONGODB_URI: z.string().url().startsWith('mongodb'),
  REDIS_URL: z.string().url().startsWith('redis'),

  JWT_SECRET: z
    .string()
    .min(32, 'JWT_SECRET must be at least 32 characters')
    .refine((v) => v !== 'changeme', 'JWT_SECRET must not be the placeholder'),
  JWT_EXPIRES_IN: z.string().default('24h'),

  COOKIE_DOMAIN: z.string().default('localhost'),
  FRONTEND_ORIGIN: z.string().url(),

  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('Invalid environment variables:');
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;