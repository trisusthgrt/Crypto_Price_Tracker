import cors from 'cors'

function parseOrigins(value) {
  if (!value) return []
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function createCorsMiddleware({ originsCsv }) {
  const allowedOrigins = parseOrigins(originsCsv)

  // If not configured, fall back to allowing all (dev-friendly),
  // but you should set CORS_ORIGINS in production.
  if (!allowedOrigins.length) return cors()

  return cors({
    origin(origin, cb) {
      // Allow non-browser clients / same-origin
      if (!origin) return cb(null, true)
      if (allowedOrigins.includes(origin)) return cb(null, true)
      return cb(new Error(`CORS blocked origin: ${origin}`))
    },
    credentials: false,
  })
}

