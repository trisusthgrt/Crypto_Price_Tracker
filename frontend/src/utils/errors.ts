import axios from 'axios'

export function getErrorMessage(err: unknown) {
  if (axios.isAxiosError(err)) {
    const status = err.response?.status
    if (!status) {
      return 'Network error (backend unreachable).'
    }
    if (status === 429) return 'Rate limited (429). Try again in a bit.'
    if (status === 503) return 'Service unavailable (503). Is MongoDB connected?'
    const msg =
      (err.response?.data as any)?.error?.message ??
      (err.response?.data as any)?.message ??
      err.message
    return msg ? `Request failed (${status}). ${msg}` : `Request failed (${status}).`
  }

  if (err instanceof Error) return err.message
  return 'Something went wrong.'
}

