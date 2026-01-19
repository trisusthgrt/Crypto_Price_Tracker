import { useEffect, useMemo, useState } from 'react'

import { createAlert, deleteAlert, listAlerts, updateAlert } from '../api/client'
import type { AlertRule } from '../api/types'
import { WatchlistSelector } from '../components/WatchlistSelector'
import { coinLabel } from '../constants/coins'
import { useWatchlist } from '../hooks/useWatchlist'
import { getErrorMessage } from '../utils/errors'

export function AlertsPage() {
  const { watchlist, coinOptions, setWatchlist } = useWatchlist()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [alerts, setAlerts] = useState<AlertRule[]>([])

  const [coinId, setCoinId] = useState('bitcoin')
  const [condition, setCondition] = useState<'above' | 'below'>('above')
  const [threshold, setThreshold] = useState<string>('100000')
  const [cooldownMinutes, setCooldownMinutes] = useState<string>('10')

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const res = await listAlerts()
      setAlerts(res.data)
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
  }, [])

  useEffect(() => {
    if (!watchlist.includes(coinId)) {
      setCoinId(watchlist[0] ?? 'bitcoin')
    }
  }, [watchlist, coinId])

  const sorted = useMemo(
    () => [...alerts].sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1)),
    [alerts],
  )

  const onCreate = async () => {
    const th = Number(threshold)
    const cd = Number(cooldownMinutes)
    if (!Number.isFinite(th)) return setError('Threshold must be a number.')
    if (!Number.isFinite(cd) || cd < 0) return setError('Cooldown must be >= 0.')

    setLoading(true)
    setError(null)
    try {
      await createAlert({
        coinId,
        condition,
        threshold: th,
        cooldownMinutes: cd,
        active: true,
      })
      await refresh()
    } catch (e) {
      setError(getErrorMessage(e))
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid2">
      <div className="panel">
        <div className="row" style={{ justifyContent: 'space-between' }}>
          <div>
            <h2 className="panelTitle" style={{ margin: 0 }}>
              Alerts
            </h2>
            <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
              Create threshold alerts and manage existing rules
            </div>
          </div>
          <div className="row">
            <button className="btn" onClick={refresh} disabled={loading}>
              Refresh
            </button>
            {error ? <span className="pill">{error}</span> : null}
          </div>
        </div>

        <div style={{ marginTop: 12 }} className="panel">
          <div className="panelTitle">Create alert</div>
          <div className="muted" style={{ fontSize: 12, marginBottom: 8 }}>
            Coin dropdown is based on your watchlist (edit it below).
          </div>

          <div style={{ marginBottom: 10 }}>
            <WatchlistSelector value={watchlist} onChange={setWatchlist} />
          </div>

          <div className="row">
            <select className="select" value={coinId} onChange={(e) => setCoinId(e.target.value)}>
              {coinOptions.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.symbol})
                </option>
              ))}
            </select>

            <select
              className="select"
              value={condition}
              onChange={(e) => setCondition(e.target.value as 'above' | 'below')}
            >
              <option value="above">crosses above</option>
              <option value="below">crosses below</option>
            </select>

            <input
              className="input"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              placeholder="Threshold"
              inputMode="decimal"
            />

            <input
              className="input"
              value={cooldownMinutes}
              onChange={(e) => setCooldownMinutes(e.target.value)}
              placeholder="Cooldown (min)"
              inputMode="numeric"
            />

            <button className="btn btnPrimary" onClick={onCreate} disabled={loading}>
              Create
            </button>
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 8 }}>
            Example: bitcoin crosses above 100000 with cooldown 10 minutes
          </div>
        </div>

        <div style={{ marginTop: 12 }}>
          <div className="panelTitle">Existing alerts</div>
          {sorted.length === 0 ? (
            <div className="muted">No alerts yet.</div>
          ) : (
            <div style={{ display: 'grid', gap: 10 }}>
              {sorted.map((a) => (
                <AlertRow
                  key={a._id}
                  alert={a}
                  onChange={async (patch) => {
                    await updateAlert(a._id, patch)
                    await refresh()
                  }}
                  onDelete={async () => {
                    await deleteAlert(a._id)
                    await refresh()
                  }}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="panel">
        <div className="panelTitle">Tips</div>
        <div className="muted" style={{ fontSize: 13 }}>
          - Alerts trigger only when the price crosses the threshold between two poll ticks.
          <br />- If you don’t see history/alerts yet, keep the backend poller running for a bit.
        </div>
      </div>
    </div>
  )
}

function AlertRow(props: {
  alert: AlertRule
  onChange: (patch: Partial<Pick<AlertRule, 'threshold' | 'active' | 'cooldownMinutes'>>) => void
  onDelete: () => void
}) {
  const { alert, onChange, onDelete } = props
  const [threshold, setThreshold] = useState(String(alert.threshold))
  const [cooldownMinutes, setCooldownMinutes] = useState(String(alert.cooldownMinutes))

  return (
    <div className="panel" style={{ padding: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 800 }}>{coinLabel(alert.coinId)}</div>
          <div className="muted" style={{ fontSize: 12 }}>
            {alert.condition === 'above' ? 'crosses above' : 'crosses below'} ·{' '}
            {alert.vsCurrency.toUpperCase()}
          </div>
        </div>
        <div className="row">
          <button
            className="btn"
            onClick={() => onChange({ active: !alert.active })}
            title="Enable/disable"
          >
            {alert.active ? 'Active' : 'Paused'}
          </button>
          <button className="btn btnDanger" onClick={onDelete}>
            Delete
          </button>
        </div>
      </div>

      <div className="row" style={{ marginTop: 10 }}>
        <label className="muted" style={{ fontSize: 12 }}>
          Threshold
        </label>
        <input
          className="input"
          value={threshold}
          onChange={(e) => setThreshold(e.target.value)}
          inputMode="decimal"
        />
        <label className="muted" style={{ fontSize: 12 }}>
          Cooldown (min)
        </label>
        <input
          className="input"
          value={cooldownMinutes}
          onChange={(e) => setCooldownMinutes(e.target.value)}
          inputMode="numeric"
        />
        <button
          className="btn btnPrimary"
          onClick={() =>
            onChange({
              threshold: Number(threshold),
              cooldownMinutes: Number(cooldownMinutes),
            })
          }
        >
          Save
        </button>
      </div>
    </div>
  )
}

