import type { Json } from '@/lib/supabase/database.types'
import type { SyncPayload } from '@/types/domain'

export function compactPayload(input: Record<string, unknown>): SyncPayload {
  const output: SyncPayload = {}
  for (const [key, value] of Object.entries(input)) {
    if (value === undefined) continue
    output[key] = value as Json
  }
  return output
}
