import { z } from 'zod';
import { config as dotenvConfig } from 'dotenv';
import { resolve } from 'path';

// Load .env file
dotenvConfig({ path: resolve(process.cwd(), '.env') });

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000').transform(Number),
  DATABASE_URL: z.string(),
  REDIS_URL: z.string().url().optional(),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  REFRESH_TOKEN_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z.string().default('http://localhost:3000'),
  S3_BUCKET: z.string().optional(),
  S3_REGION: z.string().optional(),
});

const env = envSchema.parse(process.env);

export const config = {
  env: env.NODE_ENV,
  isDev: env.NODE_ENV === 'development',
  isProd: env.NODE_ENV === 'production',
  isTest: env.NODE_ENV === 'test',
  port: env.PORT,
  database: {
    url: env.DATABASE_URL,
  },
  redis: {
    url: env.REDIS_URL,
  },
  jwt: {
    secret: env.JWT_SECRET,
    expiresIn: env.JWT_EXPIRES_IN,
    refreshExpiresIn: env.REFRESH_TOKEN_EXPIRES_IN,
  },
  corsOrigins: env.CORS_ORIGINS.split(','),
  s3: {
    bucket: env.S3_BUCKET,
    region: env.S3_REGION,
  },
} as const;

export type Config = typeof config;
