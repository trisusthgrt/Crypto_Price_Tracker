import { useEffect, useMemo, useState } from 'react'
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'

import { fetchPriceHistory } from '../api/client'
import type { HistoryPoint } from '../api/types'
import { coinLabel } from '../constants/coins'
import { formatMoney } from '../utils/format'

type Range = '1h' | '6h' | '24h' | '7d' | '30d'
type Bucket = '10s' | '30s' | '1m' | '5m' | '15m' | '1h'

function defaultBucketForRange(range: Range): Bucket {
  if (range === '1h') return '30s'
  if (range === '6h') return '1m'
  if (range === '24h') return '5m'
  if (range === '7d') return '1h'
  return '1h'
}

export function ChartPanel(props: { coinId: string; vsCurrency?: string }) {
  const { coinId, vsCurrency } = props
  const [range, setRange] = useState<Range>('24h')
  const [bucket, setBucket] = useState<Bucket>(() => defaultBucketForRange('24h'))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [data, setData] = useState<HistoryPoint[]>([])

  useEffect(() => {
    setBucket(defaultBucketForRange(range))
  }, [range])

  useEffect(() => {
    let cancelled = false
    async function run() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetchPriceHistory({ coin: coinId, range, bucket, vsCurrency })
        if (cancelled) return
        setData(res.data)
      } catch (e) {
        if (cancelled) return
        setError('Failed to load chart data. Check backend + Mongo connection.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [coinId, range, bucket, vsCurrency])

  const chartData = useMemo(
    () =>
      data.map((p) => ({
        ts: new Date(p.ts).getTime(),
        price: p.price,
      })),
    [data],
  )

  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <div className="panelTitle" style={{ marginBottom: 2 }}>
            Chart · {coinLabel(coinId)}
          </div>
          <div className="muted" style={{ fontSize: 12 }}>
            Range: {range} · Bucket: {bucket}
          </div>
        </div>
        <div className="row" style={{ gap: 8 }}>
          <select
            className="select"
            value={range}
            onChange={(e) => setRange(e.target.value as Range)}
          >
            <option value="1h">1h</option>
            <option value="6h">6h</option>
            <option value="24h">24h</option>
            <option value="7d">7d</option>
            <option value="30d">30d</option>
          </select>
        </div>
      </div>

      <div style={{ height: 260, marginTop: 12 }}>
        {loading ? (
          <div className="muted">Loading chart…</div>
        ) : error ? (
          <div className="muted">{error}</div>
        ) : chartData.length < 2 ? (
          <div className="muted">Not enough history yet. Leave poller running for a bit.</div>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <XAxis
                dataKey="ts"
                type="number"
                domain={['dataMin', 'dataMax']}
                tickFormatter={(v) => new Date(v).toLocaleTimeString()}
                stroke="rgba(255,255,255,0.45)"
              />
              <YAxis
                dataKey="price"
                tickFormatter={(v) => formatMoney(Number(v), vsCurrency ?? 'usd')}
                stroke="rgba(255,255,255,0.45)"
                width={90}
              />
              <Tooltip
                labelFormatter={(v) => new Date(Number(v)).toLocaleString()}
                formatter={(v) => formatMoney(Number(v), vsCurrency ?? 'usd')}
              />
              <Line
                type="monotone"
                dataKey="price"
                stroke="rgba(124,92,255,0.95)"
                dot={false}
                strokeWidth={2}
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  )
}

