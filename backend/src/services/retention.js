import { config } from '../config.js'
import { PricePoint } from '../models/index.js'

export async function cleanupOldPricePoints() {
  const days = config.pricePointRetentionDays
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

  const result = await PricePoint.deleteMany({ ts: { $lt: cutoff } }).exec()
  return { cutoff, deletedCount: result.deletedCount ?? 0 }
}

