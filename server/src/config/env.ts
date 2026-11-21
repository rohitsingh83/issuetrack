import path from 'path';
import dotenv from 'dotenv';
import { z } from 'zod';

dotenv.config();

const boolish = z
  .union([z.string(), z.boolean()])
  .transform((v) =>
    typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase()),
  );

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z.string().min(1, 'MONGODB_URI is required'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  FILE_TOKEN_EXPIRES_IN: z.string().default('15m'),
  COOKIE_NAME: z.string().default('it_token'),
  COOKIE_SECURE: boolish.default(false),
  COOKIE_SAME_SITE: z.enum(['lax', 'strict', 'none']).default('lax'),
  CLIENT_ORIGIN: z.string().default('http://localhost:5173'),
  /** Extra origin patterns (comma separated, `*` = wildcard), e.g. https://*.my-preview.app */
  CLIENT_ORIGIN_PATTERNS: z.string().default(''),
  TRUST_PROXY: boolish.default(false),
  UPLOAD_DIR: z.string().default(path.join(process.cwd(), 'uploads')),
  MAX_UPLOAD_MB: z.coerce.number().positive().default(5),
  AUTH_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().positive().default(15),
  AUTH_RATE_LIMIT_MAX: z.coerce.number().positive().default(30),
  API_RATE_LIMIT_WINDOW_MINUTES: z.coerce.number().positive().default(15),
  API_RATE_LIMIT_MAX: z.coerce.number().positive().default(2000),
  SEED_DEMO_PASSWORD: z.string().default('Password123!'),
  /** Clerk secret key (sk_test_… / sk_live_…). Enables "Continue with Clerk" sign-in. */
  CLERK_SECRET_KEY: z.string().trim().default(''),
});

export type Env = z.infer<typeof envSchema>;

function loadEnv(): Env {
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const details = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    // eslint-disable-next-line no-console
    console.error(
      `\n❌ Invalid environment configuration:\n${details}\n\nCopy .env.example to .env and fill the values.\n`,
    );
    process.exit(1);
  }
  return parsed.data;
}

export const env = loadEnv();
export const isProd = env.NODE_ENV === 'production';
export const isTest = env.NODE_ENV === 'test';

function splitList(value: string): string[] {
  return value
    .split(',')
    .map((o) => o.trim().replace(/\/$/, ''))
    .filter(Boolean);
}

/** CORS / socket.io allow-list derived from CLIENT_ORIGIN (comma separated). */
export const allowedOrigins = splitList(env.CLIENT_ORIGIN);

/**
 * Wildcard origin patterns. Development automatically trusts HTTPS sandbox
 * preview hosts (e.g. https://5173-<id>.e2b.app) so the proxied app can call
 * the API without a hard-coded hostname; production only trusts what you set.
 */
export const allowedOriginPatterns = [
  ...splitList(env.CLIENT_ORIGIN_PATTERNS),
  ...(isProd || isTest ? [] : ['https://*.e2b.app']),
];

function patternToRegExp(pattern: string): RegExp {
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '[^.]*');
  return new RegExp(`^${escaped}$`, 'i');
}

const patternRegExps = allowedOriginPatterns.map(patternToRegExp);

/** True when the browser origin is allowed by CORS, credentials and Socket.io. */
export function isOriginAllowed(origin?: string | null): boolean {
  if (!origin) return true; // same-origin, server-to-server, curl
  const normalised = origin.replace(/\/$/, '');
  if (allowedOrigins.includes(normalised)) return true;
  return patternRegExps.some((re) => re.test(normalised));
}

export const isClerkEnabled = env.CLERK_SECRET_KEY.length > 0;

export const MAX_UPLOAD_BYTES = Math.round(env.MAX_UPLOAD_MB * 1024 * 1024);
export const ALLOWED_UPLOAD_MIME = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
];
