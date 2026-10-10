import type { MglLocalDb } from './dexie'
import type { Json } from '@/lib/supabase/database.types'

export async function setMeta(db: MglLocalDb, key: string, value: Json) {
  await db.meta.put({ key, value, updatedAt: Date.now() })
}

export async function getMeta<T extends Json>(db: MglLocalDb, key: string): Promise<T | null> {
  const row = await db.meta.get(key)
  return (row?.value as T | undefined) ?? null
}
