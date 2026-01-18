import { useEffect, useMemo, useState } from 'react'

import { COINS } from '../constants/coins'

const STORAGE_KEY = 'crypto_tracker_watchlist_v1'

function normalizeWatchlist(ids: string[]) {
  const allowed = new Set(COINS.map((c) => c.id))
  const out: string[] = []
  for (const id of ids) {
    const v = String(id).trim()
    if (!v) continue
    if (!allowed.has(v)) continue
    if (out.includes(v)) continue
    out.push(v)
  }
  return out.length ? out : ['bitcoin', 'ethereum']
}

export function useWatchlist() {
  const [watchlist, setWatchlistState] = useState<string[]>(['bitcoin', 'ethereum'])

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return
      const parsed = JSON.parse(raw)
      if (!Array.isArray(parsed)) return
      setWatchlistState(normalizeWatchlist(parsed))
    } catch {
      // ignore
    }
  }, [])

  const setWatchlist = (next: string[]) => {
    const normalized = normalizeWatchlist(next)
    setWatchlistState(normalized)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized))
    } catch {
      // ignore
    }
  }

  const coinOptions = useMemo(
    () => COINS.filter((c) => watchlist.includes(c.id)),
    [watchlist],
  )

  return { watchlist, setWatchlist, coinOptions }
}

