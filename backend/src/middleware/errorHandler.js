import { ZodError } from 'zod'

function normalizeError(err) {
  if (err instanceof ZodError) {
    return {
      status: 400,
      body: { ok: false, error: err.flatten() },
    }
  }

  // Express JSON parse errors often have a "type" or "status".
  const status =
    typeof err?.status === 'number'
      ? err.status
      : typeof err?.statusCode === 'number'
        ? err.statusCode
        : 500

  const message =
    status === 500
      ? 'Internal server error'
      : err?.message
        ? String(err.message)
        : 'Request failed'

  return {
    status,
    body: {
      ok: false,
      error: {
        message,
      },
    },
  }
}

export function notFoundHandler(req, res) {
  res.status(404).json({
    ok: false,
    error: { message: `Route not found: ${req.method} ${req.path}` },
  })
}

// eslint-disable-next-line no-unused-vars
export function errorHandler(err, _req, res, _next) {
  const normalized = normalizeError(err)
  res.status(normalized.status).json(normalized.body)
}

