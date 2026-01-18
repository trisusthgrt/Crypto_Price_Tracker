import axios from 'axios'

import type {
  AlertEvent,
  AlertRule,
  HistoryResponse,
  LatestPricesResponse,
} from './types'

const baseURL = import.meta.env.VITE_API_BASE_URL || ''

export const http = axios.create({
  baseURL,
  timeout: 15_000,
})

export async function fetchLatestPrices(params: {
  coins: string[]
  vsCurrency?: string
}) {
  const res = await http.get<LatestPricesResponse>('/api/prices/latest', {
    params: { coins: params.coins.join(','), vsCurrency: params.vsCurrency },
  })
  return res.data
}

export async function fetchPriceHistory(params: {
  coin: string
  range: '1h' | '6h' | '24h' | '7d' | '30d'
  bucket: '10s' | '30s' | '1m' | '5m' | '15m' | '1h'
  vsCurrency?: string
}) {
  const res = await http.get<HistoryResponse>('/api/prices/history', { params })
  return res.data
}

export async function listAlerts() {
  const res = await http.get<{ ok: true; data: AlertRule[] }>('/api/alerts')
  return res.data
}

export async function createAlert(input: {
  coinId: string
  condition: 'above' | 'below'
  threshold: number
  active?: boolean
  cooldownMinutes?: number
  vsCurrency?: string
}) {
  const res = await http.post<{ ok: true; data: AlertRule }>('/api/alerts', input)
  return res.data
}

export async function updateAlert(
  id: string,
  patch: Partial<Pick<AlertRule, 'threshold' | 'active' | 'cooldownMinutes'>>,
) {
  const res = await http.patch<{ ok: true; data: AlertRule }>(`/api/alerts/${id}`, patch)
  return res.data
}

export async function deleteAlert(id: string) {
  const res = await http.delete<{ ok: true; data: AlertRule }>(`/api/alerts/${id}`)
  return res.data
}

export async function listAlertEvents(params?: {
  unreadOnly?: boolean
  limit?: number
  coinId?: string
  vsCurrency?: string
}) {
  const res = await http.get<{
    ok: true
    data: AlertEvent[]
    meta: { unreadOnly: boolean; limit: number }
  }>('/api/alert-events', { params })
  return res.data
}

export async function markAlertEventRead(id: string) {
  const res = await http.post<{ ok: true; data: AlertEvent }>(
    `/api/alert-events/${id}/read`,
  )
  return res.data
}

export async function markAlertEventsRead(ids: string[]) {
  const res = await http.post<{
    ok: true
    data: { matchedCount: number; modifiedCount: number }
  }>('/api/alert-events/mark-read', { ids })
  return res.data
}

