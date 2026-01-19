import mongoose from 'mongoose'

import { config } from '../config.js'
import { AlertRule, LatestPrice } from '../models/index.js'
import { refreshLatestPrices } from './priceCache.js'
import { evaluateAlertsForCoins } from './alertEvaluator.js'

export function createPollerState() {
  return {
    running: false,
    lastAttemptAt: null,
    lastSuccessAt: null,
    lastErrorAt: null,
    lastErrorMessage: null,
    lastResult: null,
  }
}

export function startPricePoller({ state }) {
  if (!config.pollEnabled) {
    console.log('Price poller disabled (POLL_ENABLED=false).')
    return () => {}
  }

  const intervalMs = config.pollIntervalSeconds * 1000

  const tick = async () => {
    if (state.running) return
    if (mongoose.connection.readyState !== 1) return

    state.running = true
    state.lastAttemptAt = new Date()

    try {
      const activeAlertCoins = await AlertRule.distinct('coinId', {
        active: true,
        vsCurrency: config.vsCurrency,
      }).exec()

      const coinsToPoll = Array.from(
        new Set([...(config.coinWatchlist ?? []), ...(activeAlertCoins ?? [])]),
      )

      const prevDocs = await LatestPrice.find({
        coinId: { $in: coinsToPoll },
        vsCurrency: config.vsCurrency,
      })
        .lean()
        .exec()
      const prevPricesByCoin = new Map(prevDocs.map((d) => [d.coinId, d.price]))

      const refresh = await refreshLatestPrices({
        coinIds: coinsToPoll,
        vsCurrency: config.vsCurrency,
      })

      const nowDocs = await LatestPrice.find({
        coinId: { $in: coinsToPoll },
        vsCurrency: config.vsCurrency,
      })
        .lean()
        .exec()
      const nowPricesByCoin = new Map(nowDocs.map((d) => [d.coinId, d.price]))

      const alerts = await evaluateAlertsForCoins({
        coinIds: coinsToPoll,
        vsCurrency: config.vsCurrency,
        prevPricesByCoin,
        nowPricesByCoin,
      })

      state.lastSuccessAt = new Date()
      state.lastResult = { refresh, alerts, coinsToPoll }
      state.lastErrorAt = null
      state.lastErrorMessage = null
    } catch (err) {
      state.lastErrorAt = new Date()
      state.lastErrorMessage = err instanceof Error ? err.message : String(err)
    } finally {
      state.running = false
    }
  }

  const startupTimer = setTimeout(tick, 1_000)
  const interval = setInterval(tick, intervalMs)

  console.log(`Price poller running every ${config.pollIntervalSeconds}s`)

  return () => {
    clearTimeout(startupTimer)
    clearInterval(interval)
  }
}

