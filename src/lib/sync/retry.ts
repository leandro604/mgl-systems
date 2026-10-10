const MAX_BACKOFF_MS = 5 * 60_000
const BASE_BACKOFF_MS = 1_000

export function retryDelayMs(attempt: number, random = Math.random): number {
  const exponent = Math.min(Math.max(attempt, 0), 12)
  const raw = Math.min(MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** exponent)
  const jitter = 0.5 + random()
  return Math.round(raw * jitter)
}

export function nextAttemptAt(attempt: number, now = Date.now(), random = Math.random): number {
  return now + retryDelayMs(attempt, random)
}
