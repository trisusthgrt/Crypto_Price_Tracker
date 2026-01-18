import { config } from '../config.js'
import { LatestPrice, PricePoint } from '../models/index.js'
import { fetchLatestPricesFromUpstream } from '../upstream/index.js'

function uniq(arr) {
  return Array.from(new Set(arr))
}

export function parseCoinsQuery(coinsRaw) {
  if (!coinsRaw) return undefined
  if (typeof coinsRaw !== 'string') return undefined
  const coins = coinsRaw
    .split(',')
    .map((x) => x.trim())
    .filter(Boolean)
  return coins.length ? uniq(coins) : undefined
}

export function parseRangeToDates(range) {
  const now = new Date()

  if (!range) {
    return { from: new Date(now.getTime() - 24 * 60 * 60 * 1000), to: now }
  }

  const s = String(range).trim().toLowerCase()

  const map = {
    '1h': 1 * 60 * 60 * 1000,
    '6h': 6 * 60 * 60 * 1000,
    '24h': 24 * 60 * 60 * 1000,
    '7d': 7 * 24 * 60 * 60 * 1000,
    '30d': 30 * 24 * 60 * 60 * 1000,
  }

  const ms = map[s]
  if (!ms) return null
  return { from: new Date(now.getTime() - ms), to: now }
}

export function parseBucketToMs(bucket) {
  const s = (bucket ?? '1m').toString().trim().toLowerCase()
  const map = {
    '10s': 10 * 1000,
    '30s': 30 * 1000,
    '1m': 60 * 1000,
    '5m': 5 * 60 * 1000,
    '15m': 15 * 60 * 1000,
    '1h': 60 * 60 * 1000,
  }
  return map[s] ?? null
}

function bucketTimestamp(ts, bucketMs) {
  const t = ts instanceof Date ? ts.getTime() : new Date(ts).getTime()
  const rounded = Math.floor(t / bucketMs) * bucketMs
  return new Date(rounded)
}

export async function refreshLatestPrices({ coinIds, vsCurrency } = {}) {
  const coins = coinIds?.length ? coinIds : config.coinWatchlist
  const currency = vsCurrency ?? config.vsCurrency

  const upstream = await fetchLatestPricesFromUpstream({
    coinIds: coins,
    vsCurrency: currency,
  })

  const ops = []
  const now = new Date()
  const bucketMs = config.pricePointBucketSeconds * 1000
  const bucketTs = bucketTimestamp(now, bucketMs)
  const pointOps = []

  for (const row of upstream) {
    if (typeof row.price !== 'number' || !Number.isFinite(row.price)) continue

    ops.push({
      updateOne: {
        filter: { coinId: row.coinId },
        update: {
          $set: {
            coinId: row.coinId,
            vsCurrency: row.vsCurrency,
            price: row.price,
            change24h: row.change24h ?? null,
            source: row.source ?? config.upstreamProvider,
            lastUpstreamUpdatedAt: row.lastUpdatedAt ?? null,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        upsert: true,
      },
    })

    // Bucketed history: one point per (coinId, vsCurrency, bucketTs).
    // This reduces DB size when polling frequently.
    pointOps.push({
      updateOne: {
        filter: { coinId: row.coinId, vsCurrency: row.vsCurrency, ts: bucketTs },
        update: {
          $set: {
            coinId: row.coinId,
            vsCurrency: row.vsCurrency,
            ts: bucketTs,
            price: row.price,
            source: row.source ?? config.upstreamProvider,
            updatedAt: now,
          },
          $setOnInsert: { createdAt: now },
        },
        upsert: true,
      },
    })
  }

  if (ops.length) await LatestPrice.bulkWrite(ops, { ordered: false })
  if (pointOps.length) await PricePoint.bulkWrite(pointOps, { ordered: false })

  return {
    refreshedAt: now,
    upstreamCount: upstream.length,
    written: ops.length,
    pointBucketSeconds: config.pricePointBucketSeconds,
    pointBucketTs: bucketTs,
  }
}

export async function getLatestPricesCacheFirst({ coinIds, vsCurrency } = {}) {
  const coins = coinIds?.length ? coinIds : config.coinWatchlist
  const currency = vsCurrency ?? config.vsCurrency

  const maxAgeMs = config.cacheMaxAgeSeconds * 1000
  const now = Date.now()

  let docs = await LatestPrice.find({ coinId: { $in: coins } })
    .lean()
    .exec()

  const byCoin = new Map(docs.map((d) => [d.coinId, d]))

  const missingOrStale = []
  for (const coinId of coins) {
    const d = byCoin.get(coinId)
    if (!d) {
      missingOrStale.push(coinId)
      continue
    }
    const ageMs = now - new Date(d.updatedAt).getTime()
    if (!Number.isFinite(ageMs) || ageMs > maxAgeMs) missingOrStale.push(coinId)
  }

  let refresh = null
  let warning = null

  if (missingOrStale.length) {
    try {
      refresh = await refreshLatestPrices({ coinIds: missingOrStale, vsCurrency: currency })
      docs = await LatestPrice.find({ coinId: { $in: coins } }).lean().exec()
    } catch (err) {
      warning =
        'Cache refresh failed; returning best-effort cached data (may be stale).'
    }
  }

  // Normalize response order to match requested coins.
  const normalized = []
  const docMap = new Map(docs.map((d) => [d.coinId, d]))
  for (const coinId of coins) {
    const d = docMap.get(coinId)
    if (!d) continue
    const ageMs = Date.now() - new Date(d.updatedAt).getTime()
    normalized.push({
      coinId: d.coinId,
      vsCurrency: d.vsCurrency,
      price: d.price,
      change24h: d.change24h ?? null,
      source: d.source ?? null,
      updatedAt: d.updatedAt,
      stale: Number.isFinite(ageMs) ? ageMs > maxAgeMs : true,
    })
  }

  return {
    coins,
    vsCurrency: currency,
    cacheMaxAgeSeconds: config.cacheMaxAgeSeconds,
    refreshed: Boolean(refresh),
    refresh,
    warning,
    data: normalized,
  }
}

export async function getPriceHistoryCacheFirst({
  coinId,
  vsCurrency,
  from,
  to,
  bucketMs,
}) {
  const currency = vsCurrency ?? config.vsCurrency

  const points = await PricePoint.find({
    coinId,
    vsCurrency: currency,
    ts: { $gte: from, $lte: to },
  })
    .sort({ ts: 1 })
    .lean()
    .exec()

  // If no data at all, attempt a one-shot refresh (helps first-run UX).
  if (!points.length) {
    try {
      await refreshLatestPrices({ coinIds: [coinId], vsCurrency: currency })
    } catch {
      // ignore; we'll return empty history
    }
  }

  const pointsAfter = points.length
    ? points
    : await PricePoint.find({
        coinId,
        vsCurrency: currency,
        ts: { $gte: from, $lte: to },
      })
        .sort({ ts: 1 })
        .lean()
        .exec()

  if (!bucketMs) {
    return {
      coinId,
      vsCurrency: currency,
      from,
      to,
      bucket: null,
      data: pointsAfter.map((p) => ({ ts: p.ts, price: p.price })),
    }
  }

  const buckets = new Map()
  for (const p of pointsAfter) {
    const b = bucketTimestamp(p.ts, bucketMs).toISOString()
    // Keep the latest point in each bucket.
    buckets.set(b, { ts: new Date(b), price: p.price })
  }

  const data = Array.from(buckets.values()).sort((a, b) => a.ts - b.ts)

  return {
    coinId,
    vsCurrency: currency,
    from,
    to,
    bucket: bucketMs,
    data,
  }
}

