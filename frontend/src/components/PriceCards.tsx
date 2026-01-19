import { useEffect, useState } from 'react'

import type { PriceRow } from '../api/types'
import { coinLabel } from '../constants/coins'
import { formatAgeShort, formatMoney, formatPercent, formatTime } from '../utils/format'

export function PriceCards(props: { rows: PriceRow[] }) {
  const { rows } = props
  const [nowMs, setNowMs] = useState(() => Date.now())

  useEffect(() => {
    const t = window.setInterval(() => setNowMs(Date.now()), 1_000)
    return () => window.clearInterval(t)
  }, [])

  return (
    <div className="cards">
      {rows.map((r) => {
        const change = r.change24h
        const changeClass =
          typeof change === 'number' ? (change >= 0 ? 'good' : 'bad') : undefined

        return (
          <div key={r.coinId} className="priceCard">
            <div className="priceTop">
              <div className="priceName">{coinLabel(r.coinId)}</div>
              <div className="priceValue">{formatMoney(r.price, r.vsCurrency)}</div>
            </div>
            <div className="priceMeta">
              <span className={changeClass}>
                {typeof change === 'number' ? formatPercent(change) : '—'}
              </span>
              <span title={formatTime(r.updatedAt)}>
                {r.stale ? 'stale' : 'live'} · updated {formatAgeShort(r.updatedAt, nowMs)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

