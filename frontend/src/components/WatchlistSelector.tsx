import { COINS, type Coin } from '../constants/coins'

export function WatchlistSelector(props: {
  value: string[]
  onChange: (coinIds: string[]) => void
}) {
  const { value, onChange } = props
  const selected = new Set(value)

  const toggle = (coin: Coin) => {
    const next = new Set(selected)
    if (next.has(coin.id)) next.delete(coin.id)
    else next.add(coin.id)
    const arr = Array.from(next)
    onChange(arr.length ? arr : [COINS[0].id])
  }

  return (
    <div className="row" style={{ gap: 8 }}>
      {COINS.map((c) => (
        <label key={c.id} className="pill" style={{ cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={selected.has(c.id)}
            onChange={() => toggle(c)}
            style={{ marginRight: 6 }}
          />
          {c.symbol}
        </label>
      ))}
    </div>
  )
}

