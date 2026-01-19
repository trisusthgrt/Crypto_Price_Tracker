import { NavLink, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'

import './App.css'

import { DashboardPage } from './pages/DashboardPage'
import { AlertsPage } from './pages/AlertsPage'
import { NotificationsPage } from './pages/NotificationsPage'
import { fetchHealth, listAlertEvents } from './api/client'
import type { AlertEvent, HealthResponse } from './api/types'
import { ToastHost, type Toast } from './components/ToastHost'
import { coinLabel } from './constants/coins'
import { useOnlineStatus } from './hooks/useOnlineStatus'
import { formatAgeShort, formatMoney, formatTime } from './utils/format'

function App() {
  const [unreadCount, setUnreadCount] = useState(0)
  const [toasts, setToasts] = useState<Toast[]>([])
  const [health, setHealth] = useState<HealthResponse | null>(null)
  const [healthError, setHealthError] = useState<string | null>(null)
  const online = useOnlineStatus()

  useEffect(() => {
    let cancelled = false
    const seen = new Set<string>()
    const mode = (import.meta.env.VITE_NOTIFICATIONS_MODE as string | undefined) || 'polling'

    const pushToastForEvent = (e: AlertEvent) => {
      const title = `${coinLabel(e.coinId)} ${
        e.direction === 'above' ? 'crossed above' : 'crossed below'
      } ${formatMoney(e.threshold, e.vsCurrency)}`
      const body = `Price: ${formatMoney(e.triggerPrice, e.vsCurrency)} · ${formatTime(
        e.triggeredAt,
      )}`

      const toast: Toast = { id: `event:${e._id}`, title, body }

      setToasts((prev) => [...prev, toast])
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== toast.id))
      }, 8000)
    }

    async function refreshUnread() {
      try {
        const res = await listAlertEvents({ unreadOnly: true, limit: 200 })
        if (cancelled) return
        setUnreadCount(res.data.length)

        // Polling mode: show toasts for newly seen unread events.
        if (mode === 'polling') {
          for (const e of [...res.data].reverse()) {
            if (seen.has(e._id)) continue
            seen.add(e._id)
            pushToastForEvent(e)
          }
        }
      } catch {
        // ignore
      }
    }

    // SSE mode: push toasts instantly (still poll unread count for correctness).
    let es: EventSource | null = null
    if (mode === 'sse') {
      try {
        es = new EventSource('/api/stream')
        es.addEventListener('alertEvents', (evt) => {
          try {
            const parsed = JSON.parse((evt as MessageEvent).data) as {
              data?: AlertEvent[]
            }
            const events = parsed.data ?? []
            for (const e of events) {
              if (seen.has(e._id)) continue
              seen.add(e._id)
              if (!e.read) pushToastForEvent(e)
            }
          } catch {
            // ignore
          }
        })
      } catch {
        // ignore
      }
    }

    refreshUnread()
    const t = window.setInterval(refreshUnread, 10_000)
    return () => {
      cancelled = true
      window.clearInterval(t)
      es?.close()
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    async function refreshHealth() {
      try {
        const h = await fetchHealth()
        if (cancelled) return
        setHealth(h)
        setHealthError(null)
      } catch {
        if (cancelled) return
        setHealth(null)
        setHealthError('API unreachable')
      }
    }

    refreshHealth()
    const t = window.setInterval(refreshHealth, 10_000)
    return () => {
      cancelled = true
      window.clearInterval(t)
    }
  }, [])

  return (
    <div className="appShell">
      <header className="topbar">
        <div className="brand">
          <div className="brandTitle">Crypto Price Tracker</div>
          <div className="brandSub">prices · charts · alerts</div>
        </div>

        <nav className="nav">
          <NavLink
            to="/"
            end
            className={({ isActive }) => (isActive ? 'navLink navLinkActive' : 'navLink')}
          >
            Dashboard
          </NavLink>
          <NavLink
            to="/alerts"
            className={({ isActive }) => (isActive ? 'navLink navLinkActive' : 'navLink')}
          >
            Alerts
          </NavLink>
          <NavLink
            to="/notifications"
            className={({ isActive }) => (isActive ? 'navLink navLinkActive' : 'navLink')}
          >
            Notifications
            {unreadCount > 0 ? <span className="badge">{unreadCount}</span> : null}
          </NavLink>
        </nav>

        <div className="row" style={{ justifyContent: 'flex-end' }}>
          {!online ? <span className="pill">Offline</span> : null}
          <span
            className="pill"
            title={
              health
                ? `Upstream: ${health.upstream.provider} · vsCurrency: ${health.upstream.vsCurrency}`
                : undefined
            }
          >
            {health ? 'API: up' : `API: down`}
          </span>
          {health ? (
            <>
              <span className="pill">{health.mongoConnected ? 'Mongo: ok' : 'Mongo: down'}</span>
              <span className="pill">
                Poller:{' '}
                {health.poller.lastSuccessAt
                  ? formatAgeShort(health.poller.lastSuccessAt)
                  : 'never'}
              </span>
            </>
          ) : healthError ? (
            <span className="pill">{healthError}</span>
          ) : null}
        </div>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/alerts" element={<AlertsPage />} />
          <Route
            path="/notifications"
            element={<NotificationsPage onUnreadCount={setUnreadCount} />}
          />
        </Routes>
      </main>

      <ToastHost toasts={toasts} />
    </div>
  )
}

export default App
