export type Coin = {
  id: string // CoinGecko id
  symbol: string
  name: string
}

export const COINS: Coin[] = [
  { id: 'bitcoin', symbol: 'BTC', name: 'Bitcoin' },
  { id: 'ethereum', symbol: 'ETH', name: 'Ethereum' },
  { id: 'solana', symbol: 'SOL', name: 'Solana' },
  { id: 'ripple', symbol: 'XRP', name: 'XRP' },
  { id: 'cardano', symbol: 'ADA', name: 'Cardano' },
]

export function coinLabel(coinId: string) {
  const c = COINS.find((x) => x.id === coinId)
  return c ? `${c.name} (${c.symbol})` : coinId
}

