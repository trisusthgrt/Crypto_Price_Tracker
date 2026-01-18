import dotenv from 'dotenv'
import express from 'express'
import cron from 'node-cron'
import mongoose from 'mongoose'
import morgan from 'morgan'

import { config } from './config.js'
import { connectToMongo } from './mongo.js'
import { AlertEvent, AlertRule, LatestPrice } from './models/index.js'
import {
  coinIdSchema,
  createAlertRuleSchema,
  listAlertEventsQuerySchema,
  markReadBatchSchema,
  objectIdSchema,
  updateAlertRuleSchema,
} from './validation.js'
import { fetchLatestPricesFromUpstream } from './upstream/index.js'
import { createPollerState, startPricePoller } from './services/poller.js'
import { cleanupOldPricePoints } from './services/retention.js'
import {
  getLatestPricesCacheFirst,
  getPriceHistoryCacheFirst,
  parseBucketToMs,
  parseCoinsQuery,
  parseRangeToDates,
} from './services/priceCache.js'
import { createCorsMiddleware } from './middleware/cors.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { createApiRateLimiter } from './middleware/rateLimit.js'

dotenv.config({ quiet: true })

const app = express()
const pollerState = createPollerState()

app.disable('x-powered-by')

if (config.logRequests) {
  app.use(morgan('tiny'))
}

app.use(
  createCorsMiddleware({
    originsCsv: config.corsOrigins,
  }),
)

app.use(
  createApiRateLimiter({
    enabled: config.rateLimitEnabled,
    windowMs: config.rateLimitWindowMs,
    max: config.rateLimitMax,
  }),
)

app.use(express.json())

function ensureMongoConnected(res) {
  // 1 = connected
  if (mongoose.connection.readyState === 1) return true
  res.status(503).json({
    ok: false,
    error: {
      message:
        'MongoDB is not connected. Ensure backend/.env has MONGODB_URI (and optional MONGODB_DB_NAME) then restart the server.',
    },
  })
  return false
}

app.get('/api/health', (_req, res) => {
  res.json({
    ok: true,
    service: 'crypto-tracker-backend',
    time: new Date().toISOString(),
    mongoConnected: mongoose.connection.readyState === 1,
    upstream: {
      provider: config.upstreamProvider,
      watchlist: config.coinWatchlist,
      vsCurrency: config.vsCurrency,
    },
    poller: {
      enabled: config.pollEnabled,
      intervalSeconds: config.pollIntervalSeconds,
      running: pollerState.running,
      lastAttemptAt: pollerState.lastAttemptAt,
      lastSuccessAt: pollerState.lastSuccessAt,
      lastErrorAt: pollerState.lastErrorAt,
      lastErrorMessage: pollerState.lastErrorMessage,
      lastResult: pollerState.lastResult,
    },
  })
})

// Foundation demo: shows axios + zod wired up (we'll replace with real price routes later).
app.get('/api/demo/validate', (req, res) => {
  const parsed = coinIdSchema.safeParse(req.query.coin)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() })
  }
  return res.json({ ok: true, coin: parsed.data })
})

// Step 2 implementation: fetch from selected upstream provider for configured watchlist.
app.get('/api/prices/upstream/latest', async (req, res) => {
  const coinsRaw = typeof req.query.coins === 'string' ? req.query.coins : undefined
  const coins = coinsRaw
    ? coinsRaw
        .split(',')
        .map((x) => x.trim())
        .filter(Boolean)
    : undefined

  const vsCurrency =
    typeof req.query.vsCurrency === 'string' ? req.query.vsCurrency : undefined

  const data = await fetchLatestPricesFromUpstream({ coinIds: coins, vsCurrency })
  res.json({
    ok: true,
    provider: config.upstreamProvider,
    watchlist: coins ?? config.coinWatchlist,
    vsCurrency: vsCurrency ?? config.vsCurrency,
    data,
  })
})

// Step 2 (cache-first): Latest prices read from MongoDB cache.
app.get('/api/prices/latest', async (req, res) => {
  if (!ensureMongoConnected(res)) return
  const coins = parseCoinsQuery(req.query.coins)
  const vsCurrency =
    typeof req.query.vsCurrency === 'string' ? req.query.vsCurrency : undefined

  try {
    const result = await getLatestPricesCacheFirst({ coinIds: coins, vsCurrency })
    res.json({ ok: true, ...result })
  } catch (err) {
    res.status(500).json({ ok: false, error: { message: 'Failed to read cache.' } })
  }
})

// Step 2 (cache-first): History points read from MongoDB for charts.
app.get('/api/prices/history', async (req, res) => {
  if (!ensureMongoConnected(res)) return
  const coinParsed = coinIdSchema.safeParse(req.query.coin)
  if (!coinParsed.success) {
    return res.status(400).json({ ok: false, error: coinParsed.error.flatten() })
  }

  const range = parseRangeToDates(req.query.range)
  if (!range) {
    return res.status(400).json({
      ok: false,
      error: {
        message: 'Invalid range. Use one of: 1h, 6h, 24h, 7d, 30d',
      },
    })
  }

  const bucketMs = parseBucketToMs(req.query.bucket)
  if (!bucketMs) {
    return res.status(400).json({
      ok: false,
      error: {
        message: 'Invalid bucket. Use one of: 10s, 30s, 1m, 5m, 15m, 1h',
      },
    })
  }

  const vsCurrency =
    typeof req.query.vsCurrency === 'string' ? req.query.vsCurrency : undefined

  const result = await getPriceHistoryCacheFirst({
    coinId: coinParsed.data,
    vsCurrency,
    from: range.from,
    to: range.to,
    bucketMs,
  })

  return res.json({ ok: true, ...result })
})

// Alerts CRUD
app.get('/api/alerts', async (_req, res) => {
  if (!ensureMongoConnected(res)) return
  const rules = await AlertRule.find({}).sort({ createdAt: -1 }).lean().exec()
  res.json({ ok: true, data: rules })
})

app.post('/api/alerts', async (req, res) => {
  if (!ensureMongoConnected(res)) return
  const parsed = createAlertRuleSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() })
  }

  const doc = await AlertRule.create({
    coinId: parsed.data.coinId,
    condition: parsed.data.condition,
    threshold: parsed.data.threshold,
    active: parsed.data.active ?? true,
    cooldownMinutes: parsed.data.cooldownMinutes ?? 0,
    vsCurrency: parsed.data.vsCurrency ?? config.vsCurrency,
    lastState: 'unknown',
  })

  res.status(201).json({ ok: true, data: doc.toObject() })
})

app.patch('/api/alerts/:id', async (req, res) => {
  if (!ensureMongoConnected(res)) return
  const idParsed = objectIdSchema.safeParse(req.params.id)
  if (!idParsed.success) {
    return res.status(400).json({ ok: false, error: idParsed.error.flatten() })
  }

  const bodyParsed = updateAlertRuleSchema.safeParse(req.body)
  if (!bodyParsed.success) {
    return res.status(400).json({ ok: false, error: bodyParsed.error.flatten() })
  }

  const set = { ...bodyParsed.data }

  // If threshold changes, reset state so next tick establishes a fresh baseline.
  if (typeof bodyParsed.data.threshold === 'number') {
    set.lastState = 'unknown'
  }

  const updated = await AlertRule.findByIdAndUpdate(
    idParsed.data,
    { $set: set },
    { new: true },
  )
    .lean()
    .exec()

  if (!updated) {
    return res.status(404).json({ ok: false, error: { message: 'Alert not found' } })
  }

  return res.json({ ok: true, data: updated })
})

app.delete('/api/alerts/:id', async (req, res) => {
  if (!ensureMongoConnected(res)) return
  const idParsed = objectIdSchema.safeParse(req.params.id)
  if (!idParsed.success) {
    return res.status(400).json({ ok: false, error: idParsed.error.flatten() })
  }

  const deleted = await AlertRule.findByIdAndDelete(idParsed.data).lean().exec()
  if (!deleted) {
    return res.status(404).json({ ok: false, error: { message: 'Alert not found' } })
  }

  return res.json({ ok: true, data: deleted })
})

// Notifications (in-app)
app.get('/api/alert-events', async (req, res) => {
  if (!ensureMongoConnected(res)) return

  const parsed = listAlertEventsQuerySchema.safeParse(req.query)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() })
  }

  const unreadOnly = parsed.data.unreadOnly ?? false
  const limit = parsed.data.limit ?? 50

  const filter = {}
  if (unreadOnly) filter.read = false
  if (parsed.data.coinId) filter.coinId = parsed.data.coinId
  if (parsed.data.vsCurrency) filter.vsCurrency = parsed.data.vsCurrency

  const events = await AlertEvent.find(filter)
    .sort({ triggeredAt: -1, _id: -1 })
    .limit(limit)
    .lean()
    .exec()

  return res.json({ ok: true, data: events, meta: { unreadOnly, limit } })
})

app.post('/api/alert-events/:id/read', async (req, res) => {
  if (!ensureMongoConnected(res)) return
  const idParsed = objectIdSchema.safeParse(req.params.id)
  if (!idParsed.success) {
    return res.status(400).json({ ok: false, error: idParsed.error.flatten() })
  }

  const updated = await AlertEvent.findByIdAndUpdate(
    idParsed.data,
    { $set: { read: true } },
    { new: true },
  )
    .lean()
    .exec()

  if (!updated) {
    return res.status(404).json({ ok: false, error: { message: 'Alert event not found' } })
  }

  return res.json({ ok: true, data: updated })
})

app.post('/api/alert-events/mark-read', async (req, res) => {
  if (!ensureMongoConnected(res)) return
  const parsed = markReadBatchSchema.safeParse(req.body)
  if (!parsed.success) {
    return res.status(400).json({ ok: false, error: parsed.error.flatten() })
  }

  const ids = parsed.data.ids.map((id) => mongoose.Types.ObjectId.createFromHexString(id))

  const result = await AlertEvent.updateMany(
    { _id: { $in: ids } },
    { $set: { read: true } },
  ).exec()

  return res.json({
    ok: true,
    data: {
      matchedCount: result.matchedCount ?? 0,
      modifiedCount: result.modifiedCount ?? 0,
    },
  })
})

// Optional realtime: Server-Sent Events stream for prices + alert events.
app.get('/api/stream', async (req, res) => {
  if (!ensureMongoConnected(res)) return

  const coins = parseCoinsQuery(req.query.coins) ?? config.coinWatchlist
  const vsCurrency =
    typeof req.query.vsCurrency === 'string' ? req.query.vsCurrency : config.vsCurrency

  res.status(200)
  res.setHeader('Content-Type', 'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache, no-transform')
  res.setHeader('Connection', 'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no')

  const send = (event, payload) => {
    res.write(`event: ${event}\n`)
    res.write(`data: ${JSON.stringify(payload)}\n\n`)
  }

  send('hello', {
    ok: true,
    coins,
    vsCurrency,
    time: new Date().toISOString(),
  })

  const latestDoc = await AlertEvent.findOne({}).sort({ _id: -1 }).lean().exec()
  let lastEventId = latestDoc?._id ?? null

  let running = false
  const intervalMs = 5_000

  const tick = async () => {
    if (running) return
    running = true
    try {
      const prices = await LatestPrice.find({ coinId: { $in: coins }, vsCurrency })
        .lean()
        .exec()
      send('prices', { time: new Date().toISOString(), data: prices })

      // Stream all alert events for this currency (don't restrict by coins),
      // otherwise clients may miss events for coins outside the backend watchlist.
      const eventFilter = { vsCurrency }
      if (lastEventId) eventFilter._id = { $gt: lastEventId }

      const newEvents = await AlertEvent.find(eventFilter)
        .sort({ _id: 1 })
        .limit(200)
        .lean()
        .exec()

      if (newEvents.length) {
        lastEventId = newEvents[newEvents.length - 1]._id
        send('alertEvents', { time: new Date().toISOString(), data: newEvents })
      }

      send('heartbeat', {
        time: new Date().toISOString(),
        pollerLastSuccessAt: pollerState.lastSuccessAt,
      })
    } catch (err) {
      send('error', {
        time: new Date().toISOString(),
        message: err instanceof Error ? err.message : String(err),
      })
    } finally {
      running = false
    }
  }

  const timer = setInterval(tick, intervalMs)
  req.on('close', () => clearInterval(timer))
})

app.use(notFoundHandler)
app.use(errorHandler)

async function start() {
  await connectToMongo({ optional: true })

  // Scheduler foundation: runs every minute (placeholder).
  cron.schedule('* * * * *', () => {
    // Later: fetch prices, cache in Mongo, evaluate alerts.
    // Keeping it lightweight for now to prove scheduling works.
    // eslint-disable-next-line no-console
    console.log(`[cron] heartbeat ${new Date().toISOString()}`)
  })

  // Retention safety-net (TTL also exists, but cleanup helps keep DB tidy).
  cron.schedule('0 * * * *', async () => {
    if (!config.pricePointCleanupEnabled) return
    if (mongoose.connection.readyState !== 1) return
    try {
      const r = await cleanupOldPricePoints()
      // eslint-disable-next-line no-console
      console.log(
        `[retention] deleted=${r.deletedCount} cutoff=${r.cutoff.toISOString()}`,
      )
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn('[retention] cleanup failed:', err)
    }
  })

  startPricePoller({ state: pollerState })

  app.listen(config.port, () => {
    // eslint-disable-next-line no-console
    console.log(`API listening on http://localhost:${config.port}`)
  })
}

start().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Fatal startup error:', err)
  process.exit(1)
})
