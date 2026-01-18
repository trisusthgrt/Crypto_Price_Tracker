import rateLimit from 'express-rate-limit'

export function createApiRateLimiter({ enabled, windowMs, max }) {
  if (!enabled) return (_req, _res, next) => next()

  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    message: {
      ok: false,
      error: { message: 'Too many requests. Please slow down.' },
    },
  })
}

