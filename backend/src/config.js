import dotenv from 'dotenv'
import { z } from 'zod'

dotenv.config({ quiet: true })

const envSchema = z.object({
  PORT: z.string().optional(),

  MONGODB_URI: z.string().optional(),
  MONGODB_DB_NAME: z.string().optional(),

  UPSTREAM_PROVIDER: z.enum(['coingecko']).default('coingecko'),
  COINGECKO_API_BASE: z.string().url().default('https://api.coingecko.com/api/v3'),
  UPSTREAM_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

  CACHE_MAX_AGE_SECONDS: z.coerce.number().int().positive().default(30),
  POLL_INTERVAL_SECONDS: z.coerce.number().int().positive().default(20),
  POLL_ENABLED: z.coerce.boolean().default(true),

  PRICE_POINT_RETENTION_DAYS: z.coerce.number().int().positive().default(7),
  PRICE_POINT_BUCKET_SECONDS: z.coerce.number().int().positive().default(60),
  PRICE_POINT_CLEANUP_ENABLED: z.coerce.boolean().default(true),

  CORS_ORIGINS: z.string().optional(),
  LOG_REQUESTS: z.coerce.boolean().default(true),
  RATE_LIMIT_ENABLED: z.coerce.boolean().default(false),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
  RATE_LIMIT_MAX: z.coerce.number().int().positive().default(300),

  COIN_WATCHLIST: z
    .string()
    .default('bitcoin,ethereum')
    .transform((s) =>
      s
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean),
    ),

  VS_CURRENCY: z.string().default('usd'),
})

const parsed = envSchema.safeParse(process.env)

if (!parsed.success) {
  console.error('Invalid environment configuration:', parsed.error.flatten())
  throw new Error('Invalid environment configuration')
}

export const config = {
  port: Number(parsed.data.PORT) || 5000,

  mongoUri: parsed.data.MONGODB_URI,
  mongoDbName: parsed.data.MONGODB_DB_NAME,

  upstreamProvider: parsed.data.UPSTREAM_PROVIDER,
  coingeckoApiBase: parsed.data.COINGECKO_API_BASE,
  upstreamTimeoutMs: parsed.data.UPSTREAM_TIMEOUT_MS,
  cacheMaxAgeSeconds: parsed.data.CACHE_MAX_AGE_SECONDS,
  pollIntervalSeconds: parsed.data.POLL_INTERVAL_SECONDS,
  pollEnabled: parsed.data.POLL_ENABLED,

  pricePointRetentionDays: parsed.data.PRICE_POINT_RETENTION_DAYS,
  pricePointBucketSeconds: parsed.data.PRICE_POINT_BUCKET_SECONDS,
  pricePointCleanupEnabled: parsed.data.PRICE_POINT_CLEANUP_ENABLED,

  corsOrigins: parsed.data.CORS_ORIGINS,
  logRequests: parsed.data.LOG_REQUESTS,
  rateLimitEnabled: parsed.data.RATE_LIMIT_ENABLED,
  rateLimitWindowMs: parsed.data.RATE_LIMIT_WINDOW_MS,
  rateLimitMax: parsed.data.RATE_LIMIT_MAX,

  coinWatchlist: parsed.data.COIN_WATCHLIST,
  vsCurrency: parsed.data.VS_CURRENCY,
}

