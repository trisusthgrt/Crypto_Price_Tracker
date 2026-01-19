import mongoose from 'mongoose'

const AlertRuleSchema = new mongoose.Schema(
  {
    coinId: { type: String, required: true, trim: true, index: true },
    vsCurrency: { type: String, required: true, trim: true, default: 'usd' },

    condition: {
      type: String,
      required: true,
      enum: ['above', 'below'], // crossing direction
    },

    threshold: { type: Number, required: true },
    active: { type: Boolean, required: true, default: true, index: true },

    cooldownMinutes: { type: Number, required: true, default: 0 },

   
    lastTriggeredAt: { type: Date, required: false, default: null },
    lastState: {
      type: String,
      required: true,
      enum: ['unknown', 'above', 'below'],
      default: 'unknown',
    },
  },
  { timestamps: true },
)

AlertRuleSchema.index({ active: 1, coinId: 1 })

export const AlertRule =
  mongoose.models.AlertRule || mongoose.model('AlertRule', AlertRuleSchema)

