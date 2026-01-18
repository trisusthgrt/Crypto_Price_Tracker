import type { PriceRow } from '../api/types'
import { coinLabel } from '../constants/coins'
import { formatMoney, formatPercent, formatTime } from '../utils/format'

export function PriceCards(props: { rows: PriceRow[] }) {
  const { rows } = props

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
                {r.stale ? 'stale' : 'live'} · {formatTime(r.updatedAt)}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

