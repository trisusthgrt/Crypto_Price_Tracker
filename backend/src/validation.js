import { z } from 'zod'

export const coinIdSchema = z
  .string()
  .min(1)
  .regex(/^[a-z0-9-]+$/i, 'coin id must be alphanumeric/hyphen')

export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-f]{24}$/i, 'invalid id (expected 24 hex chars)')

export const alertConditionSchema = z.enum(['above', 'below'])

export const vsCurrencySchema = z
  .string()
  .min(1)
  .max(10)
  .regex(/^[a-z]+$/i, 'vsCurrency must be alphabetic')

export const createAlertRuleSchema = z.object({
  coinId: coinIdSchema,
  condition: alertConditionSchema,
  threshold: z.coerce.number().finite(),
  active: z.coerce.boolean().optional(),
  cooldownMinutes: z.coerce.number().int().min(0).optional(),
  vsCurrency: vsCurrencySchema.optional(),
})

export const updateAlertRuleSchema = z
  .object({
    threshold: z.coerce.number().finite().optional(),
    active: z.coerce.boolean().optional(),
    cooldownMinutes: z.coerce.number().int().min(0).optional(),
  })
  .refine((obj) => Object.keys(obj).length > 0, {
    message: 'At least one field must be provided',
  })

export const listAlertEventsQuerySchema = z.object({
  unreadOnly: z
    .union([z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (v === 'true' ? true : v === 'false' ? false : undefined)),
  limit: z.coerce.number().int().min(1).max(200).optional(),
  coinId: coinIdSchema.optional(),
  vsCurrency: vsCurrencySchema.optional(),
})

export const markReadBatchSchema = z.object({
  ids: z.array(objectIdSchema).min(1).max(500),
})

