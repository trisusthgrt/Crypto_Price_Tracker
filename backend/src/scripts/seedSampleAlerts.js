import dotenv from 'dotenv'

dotenv.config({ quiet: true })

const { connectToMongo } = await import('../mongo.js')
const { config } = await import('../config.js')
const { fetchLatestPricesFromUpstream } = await import('../upstream/index.js')
const { AlertRule } = await import('../models/index.js')

await connectToMongo({ optional: false })

const existing = await AlertRule.countDocuments().exec()
if (existing > 0) {
  // eslint-disable-next-line no-console
  console.log(
    `Seed skipped: AlertRule already has ${existing} document(s). Delete them if you want to re-seed.`,
  )
  process.exit(0)
}

const coins = config.coinWatchlist
const vsCurrency = config.vsCurrency

const latest = await fetchLatestPricesFromUpstream({ coinIds: coins, vsCurrency })

const now = new Date()
const docs = []

for (const row of latest) {
  if (typeof row.price !== 'number' || !Number.isFinite(row.price)) continue

  // Choose thresholds close to current price so they’re likely to trigger soon.
  const above = Number((row.price * 1.002).toFixed(2))
  const below = Number((row.price * 0.998).toFixed(2))

  docs.push({
    coinId: row.coinId,
    vsCurrency,
    condition: 'above',
    threshold: above,
    active: true,
    cooldownMinutes: 5,
    lastState: 'unknown',
    createdAt: now,
    updatedAt: now,
  })

  docs.push({
    coinId: row.coinId,
    vsCurrency,
    condition: 'below',
    threshold: below,
    active: true,
    cooldownMinutes: 5,
    lastState: 'unknown',
    createdAt: now,
    updatedAt: now,
  })
}

if (!docs.length) {
  // eslint-disable-next-line no-console
  console.log('Seed failed: could not fetch any upstream prices.')
  process.exit(1)
}

await AlertRule.insertMany(docs, { ordered: false })

// eslint-disable-next-line no-console
console.log(`Seeded ${docs.length} alert rule(s) for coins: ${coins.join(', ')}`)

