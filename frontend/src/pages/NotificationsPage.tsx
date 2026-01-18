import { useEffect, useMemo, useState } from 'react'

import { listAlertEvents, markAlertEventRead, markAlertEventsRead } from '../api/client'
import type { AlertEvent } from '../api/types'
import { coinLabel } from '../constants/coins'
import { formatMoney, formatTime } from '../utils/format'

export function NotificationsPage(props: { onUnreadCount: (n: number) => void }) {
  const { onUnreadCount } = props
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [events, setEvents] = useState<AlertEvent[]>([])

  async function refresh() {
    setLoading(true)
    setError(null)
    try {
      const res = await listAlertEvents({ unreadOnly: false, limit: 50 })
      setEvents(res.data)
      onUnreadCount(res.data.filter((e) => !e.read).length)
    } catch {
      setError('Failed to load alert events.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    refresh()
    const t = window.setInterval(refresh, 10_000)
    return () => window.clearInterval(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const unread = useMemo(() => events.filter((e) => !e.read), [events])

  const markAllRead = async () => {
    if (!unread.length) return
    setLoading(true)
    setError(null)
    try {
      await markAlertEventsRead(unread.map((e) => e._id))
      await refresh()
    } catch {
      setError('Failed to mark read.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="panel">
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <h2 className="panelTitle" style={{ margin: 0 }}>
            Notifications
          </h2>
          <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
            In-app alert events · refreshes every 10s
          </div>
        </div>
        <div className="row">
          <button className="btn" onClick={refresh} disabled={loading}>
            Refresh
          </button>
          <button className="btn btnPrimary" onClick={markAllRead} disabled={loading}>
            Mark all read ({unread.length})
          </button>
          {error ? <span className="pill">{error}</span> : null}
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'grid', gap: 10 }}>
        {events.length === 0 ? (
          <div className="muted">No alert events yet.</div>
        ) : (
          events.map((e) => <EventRow key={e._id} event={e} onRead={refresh} />)
        )}
      </div>
    </div>
  )
}

function EventRow(props: { event: AlertEvent; onRead: () => void }) {
  const { event, onRead } = props

  const title = `${coinLabel(event.coinId)} ${event.direction === 'above' ? '↑' : '↓'} ${formatMoney(
    event.threshold,
    event.vsCurrency,
  )}`

  const body = `Triggered at ${formatMoney(event.triggerPrice, event.vsCurrency)} · ${formatTime(
    event.triggeredAt,
  )}`

  return (
    <div className="panel" style={{ padding: 12 }}>
      <div className="row" style={{ justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontWeight: 800 }}>
            {title} {!event.read ? <span className="badge">new</span> : null}
          </div>
          <div className="muted" style={{ fontSize: 12, marginTop: 2 }}>
            {body}
          </div>
        </div>
        {!event.read ? (
          <button
            className="btn"
            onClick={async () => {
              await markAlertEventRead(event._id)
              onRead()
            }}
          >
            Mark read
          </button>
        ) : (
          <span className="pill">read</span>
        )}
      </div>
    </div>
  )
}

