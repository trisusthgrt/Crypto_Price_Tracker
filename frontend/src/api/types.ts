export type CoinId = string

export type PriceRow = {
  coinId: string
  vsCurrency: string
  price: number
  change24h: number | null
  source: string | null
  updatedAt: string
  stale: boolean
}

export type LatestPricesResponse = {
  ok: true
  coins: string[]
  vsCurrency: string
  cacheMaxAgeSeconds: number
  refreshed: boolean
  warning: string | null
  data: PriceRow[]
}

export type HistoryPoint = {
  ts: string
  price: number
}

export type HistoryResponse = {
  ok: true
  coinId: string
  vsCurrency: string
  from: string
  to: string
  bucket: number
  data: HistoryPoint[]
}

export type AlertRule = {
  _id: string
  coinId: string
  vsCurrency: string
  condition: 'above' | 'below'
  threshold: number
  active: boolean
  cooldownMinutes: number
  lastTriggeredAt: string | null
  lastState: 'unknown' | 'above' | 'below'
  createdAt: string
  updatedAt: string
}

export type AlertEvent = {
  _id: string
  alertRuleId: string
  coinId: string
  vsCurrency: string
  direction: 'above' | 'below'
  threshold: number
  triggerPrice: number
  triggeredAt: string
  read: boolean
  createdAt: string
  updatedAt: string
}

