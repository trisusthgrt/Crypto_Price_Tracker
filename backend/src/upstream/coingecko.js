import axios from 'axios'
import { z } from 'zod'

const coinGeckoSimplePriceResponseSchema = z.record(
  z.string(),
  z.record(z.string(), z.number()),
)

function chunk(arr, size) {
  const out = []
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size))
  return out
}


export async function fetchCoinGeckoLatestPrices({
  apiBase,
  coinIds,
  vsCurrency,
  timeoutMs,
}) {
  if (!coinIds?.length) return []

  const batches = chunk(coinIds, 200)

  const results = []

  for (const batch of batches) {
    const { data } = await axios.get(`${apiBase}/simple/price`, {
      timeout: timeoutMs,
      params: {
        ids: batch.join(','),
        vs_currencies: vsCurrency,
        include_last_updated_at: true,
        include_24hr_change: true,
      },
    })

    const parsed = coinGeckoSimplePriceResponseSchema.safeParse(data)
    if (!parsed.success) {
      throw new Error('Unexpected CoinGecko response shape')
    }

    for (const [coinId, obj] of Object.entries(parsed.data)) {
      const price = obj[vsCurrency]
      const change24h = obj[`${vsCurrency}_24h_change`]
      const lastUpdatedAt = obj.last_updated_at

      results.push({
        coinId,
        vsCurrency,
        price: typeof price === 'number' ? price : null,
        change24h:
          typeof change24h === 'number' && Number.isFinite(change24h)
            ? change24h
            : null,
        lastUpdatedAt:
          typeof lastUpdatedAt === 'number' ? new Date(lastUpdatedAt * 1000) : null,
        source: 'coingecko',
      })
    }
  }

  return results
}

