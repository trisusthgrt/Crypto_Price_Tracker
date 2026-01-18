import { AlertEvent, AlertRule } from '../models/index.js'

function stateForPrice({ price, threshold }) {
  if (typeof price !== 'number' || !Number.isFinite(price)) return 'unknown'
  return price >= threshold ? 'above' : 'below'
}

function crosses({ prev, now, threshold, condition }) {
  if (typeof prev !== 'number' || !Number.isFinite(prev)) return false
  if (typeof now !== 'number' || !Number.isFinite(now)) return false

  if (condition === 'above') return prev < threshold && now >= threshold
  if (condition === 'below') return prev > threshold && now <= threshold
  return false
}

function canTriggerCooldown({ cooldownMinutes, lastTriggeredAt, now }) {
  const cd = Number(cooldownMinutes) || 0
  if (cd <= 0) return true
  if (!lastTriggeredAt) return true
  const elapsedMs = now.getTime() - new Date(lastTriggeredAt).getTime()
  return elapsedMs >= cd * 60 * 1000
}

/**
 * Evaluate active alert rules for coins using prev vs current cached prices.
 * - prevPricesByCoin: Map<string, number> (previous cached prices BEFORE refresh)
 * - nowPricesByCoin: Map<string, number> (current cached prices AFTER refresh)
 */
export async function evaluateAlertsForCoins({
  coinIds,
  vsCurrency,
  prevPricesByCoin,
  nowPricesByCoin,
}) {
  if (!coinIds?.length) return { evaluated: 0, triggered: 0 }

  const rules = await AlertRule.find({
    active: true,
    coinId: { $in: coinIds },
    vsCurrency,
  }).exec()

  if (!rules.length) return { evaluated: 0, triggered: 0 }

  const now = new Date()
  const ruleUpdates = []
  const events = []

  for (const rule of rules) {
    const prevPrice = prevPricesByCoin?.get(rule.coinId)
    const nowPrice = nowPricesByCoin?.get(rule.coinId)

    // If we don't have a previous price, we can't detect a crossing yet.
    const crossed = crosses({
      prev: prevPrice,
      now: nowPrice,
      threshold: rule.threshold,
      condition: rule.condition,
    })

    const cooldownOk = canTriggerCooldown({
      cooldownMinutes: rule.cooldownMinutes,
      lastTriggeredAt: rule.lastTriggeredAt,
      now,
    })

    const currentState = stateForPrice({ price: nowPrice, threshold: rule.threshold })

    if (crossed && cooldownOk) {
      events.push({
        alertRuleId: rule._id,
        coinId: rule.coinId,
        vsCurrency: rule.vsCurrency,
        direction: rule.condition,
        threshold: rule.threshold,
        triggerPrice: nowPrice,
        triggeredAt: now,
        read: false,
      })

      ruleUpdates.push({
        updateOne: {
          filter: { _id: rule._id },
          update: { $set: { lastState: currentState, lastTriggeredAt: now } },
        },
      })
    } else {
      // Keep state updated even when no trigger (or when prev missing / cooldown).
      ruleUpdates.push({
        updateOne: {
          filter: { _id: rule._id },
          update: { $set: { lastState: currentState } },
        },
      })
    }
  }

  if (events.length) await AlertEvent.insertMany(events, { ordered: false })
  if (ruleUpdates.length) await AlertRule.bulkWrite(ruleUpdates, { ordered: false })

  return { evaluated: rules.length, triggered: events.length }
}

