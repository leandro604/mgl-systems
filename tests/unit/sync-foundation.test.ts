import { describe, expect, it } from 'vitest'

import { compactPayload } from '@/lib/sync/payload'
import { retryDelayMs, nextAttemptAt } from '@/lib/sync/retry'
import { jsonValueSchema } from '@/lib/sync/schemas'

describe('sync foundation', () => {
  it('compacts undefined fields without losing valid JSON values', () => {
    expect(
      compactPayload({
        title: 'Tarea de prueba',
        omitted: undefined,
        progress: 0,
        active: false,
        nullable: null,
        nested: { items: [1, 'dos', true, null] },
      }),
    ).toEqual({
      title: 'Tarea de prueba',
      progress: 0,
      active: false,
      nullable: null,
      nested: { items: [1, 'dos', true, null] },
    })
  })

  it('accepts recursive JSON values used by Supabase', () => {
    const value = {
      text: 'ok',
      number: 42,
      enabled: true,
      empty: null,
      nested: [{ child: 'value' }, 7, false],
    }

    expect(jsonValueSchema.parse(value)).toEqual(value)
  })

  it('uses deterministic exponential backoff with jitter and a five-minute cap', () => {
    expect(retryDelayMs(0, () => 0)).toBe(500)
    expect(retryDelayMs(1, () => 0.5)).toBe(2_000)
    expect(retryDelayMs(20, () => 0.5)).toBe(300_000)
    expect(nextAttemptAt(2, 10_000, () => 0.5)).toBe(14_000)
  })
})
