import mongoose from 'mongoose'

const AlertEventSchema = new mongoose.Schema(
  {
    alertRuleId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'AlertRule',
      required: true,
      index: true,
    },

    coinId: { type: String, required: true, trim: true, index: true },
    vsCurrency: { type: String, required: true, trim: true, default: 'usd' },

    direction: { type: String, required: true, enum: ['above', 'below'] },
    threshold: { type: Number, required: true },
    triggerPrice: { type: Number, required: true },

    triggeredAt: { type: Date, required: true, default: () => new Date(), index: true },
    read: { type: Boolean, required: true, default: false, index: true },
  },
  { timestamps: true },
)

AlertEventSchema.index({ read: 1, triggeredAt: -1 })

export const AlertEvent =
  mongoose.models.AlertEvent || mongoose.model('AlertEvent', AlertEventSchema)

