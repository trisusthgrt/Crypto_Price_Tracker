import mongoose from 'mongoose'

const LatestPriceSchema = new mongoose.Schema(
  {
    coinId: { type: String, required: true, trim: true, index: true, unique: true },
    vsCurrency: { type: String, required: true, trim: true, default: 'usd' },

    price: { type: Number, required: true },
    change24h: { type: Number, required: false, default: null },
    source: { type: String, required: false, default: 'coingecko' },

    lastUpstreamUpdatedAt: { type: Date, required: false, default: null },
  },
  { timestamps: true },
)

export const LatestPrice =
  mongoose.models.LatestPrice || mongoose.model('LatestPrice', LatestPriceSchema)

