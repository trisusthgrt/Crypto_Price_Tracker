import mongoose from 'mongoose'
import { config } from '../config.js'

const PricePointSchema = new mongoose.Schema(
  {
    coinId: { type: String, required: true, trim: true, index: true },
    vsCurrency: { type: String, required: true, trim: true, default: 'usd' },

    ts: { type: Date, required: true },
    price: { type: Number, required: true },
    source: { type: String, required: false, default: 'coingecko' },
  },
  { timestamps: true },
)

// Efficient chart queries by coin + time range.
PricePointSchema.index({ coinId: 1, vsCurrency: 1, ts: 1 }, { unique: true })

// Retention (keeps DB small): auto-delete after N days.
PricePointSchema.index(
  { ts: 1 },
  { expireAfterSeconds: 60 * 60 * 24 * config.pricePointRetentionDays },
)

export const PricePoint =
  mongoose.models.PricePoint || mongoose.model('PricePoint', PricePointSchema)

