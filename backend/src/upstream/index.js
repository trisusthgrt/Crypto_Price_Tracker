import { config } from '../config.js'
import { fetchCoinGeckoLatestPrices } from './coingecko.js'

export async function fetchLatestPricesFromUpstream({
  coinIds = config.coinWatchlist,
  vsCurrency = config.vsCurrency,
} = {}) {
  switch (config.upstreamProvider) {
    case 'coingecko':
      return fetchCoinGeckoLatestPrices({
        apiBase: config.coingeckoApiBase,
        coinIds,
        vsCurrency,
        timeoutMs: config.upstreamTimeoutMs,
      })
    default:
      throw new Error(`Unsupported UPSTREAM_PROVIDER: ${config.upstreamProvider}`)
  }
}

