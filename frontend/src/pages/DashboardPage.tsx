import { useEffect, useState } from 'react'

import { fetchLatestPrices } from '../api/client'
import type { PriceRow } from '../api/types'
import { ChartPanel } from '../components/ChartPanel'
import { PriceCards } from '../components/PriceCards'
import { WatchlistSelector } from '../components/WatchlistSelector'
import { useWatchlist } from '../hooks/useWatchlist'
import { getErrorMessage } from '../utils/errors'

export function DashboardPage() {
  const { watchlist, setWatchlist, coinOptions } = useWatchlist()
  const [selectedCoin, setSelectedCoin] = useState<string>('bitcoin')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<PriceRow[]>([])

  useEffect(() => {
    if (!watchlist.includes(selectedCoin)) {
      setSelectedCoin(watchlist[0] ?? 'bitcoin')
    }
  }, [watchlist, selectedCoin])

  useEffect(() => {
    let cancelled = false
    let timer: number | undefined

    async function run() {
      setLoading(true)
      setError(null)
      try {
        const res = await fetchLatestPrices({ coins: watchlist })
        if (cancelled) return
        setRows(res.data)
      } catch (e) {
        if (cancelled) return
        setError(getErrorMessage(e))
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    run()
    timer = window.setInterval(run, 10_000)

    return () => {
      cancelled = true
      if (timer) window.clearInterval(timer)
    }
  }, [watchlist])

  return (
    <div className="grid2">
      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2 className="panelTitle" style={{ margin: 0 }}>
              Dashboard
            </h2>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Watchlist · Prices update every 10s
            </div>
          </div>
          <div className="row">
            <span className="pill">{loading ? 'syncing…' : 'ready'}</span>
            {error ? <span className="pill">{error}</span> : null}
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
            Select watchlist
          </div>
          <WatchlistSelector value={watchlist} onChange={setWatchlist} />
        </div>

        <div style={{ marginTop: 14 }}>
          <PriceCards rows={rows} />
        </div>

        <div style={{ marginTop: 14 }} className="row">
          <span className="muted" style={{ fontSize: 12 }}>
            Chart coin
          </span>
          <select
            className="select"
            value={selectedCoin}
            onChange={(e) => setSelectedCoin(e.target.value)}
          >
            {coinOptions.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} ({c.symbol})
              </option>
            ))}
          </select>
        </div>
      </div>

      <ChartPanel coinId={selectedCoin} />
    </div>
  )
}

