import type { Table } from 'dexie'
import type { MglLocalDb } from '@/lib/db/dexie'
import type { OutboxRecord } from '@/lib/db/schema'
import { requestBackgroundSync } from '@/workers/register'

export async function commitLocalMutation<Row extends { id: string }>(
  db: MglLocalDb,
  table: Table<Row, string, any>,
  row: Row,
  mutation: Omit<OutboxRecord, 'sequence'>,
): Promise<string> {
  await db.transaction('rw', table, db.outbox, async () => {
    const earlier = await db.outbox
      .where('entityId')
      .equals(mutation.entityId)
      .and((item) => item.entity === mutation.entity && item.status !== 'blocked')
      .toArray()

    const enriched: Omit<OutboxRecord, 'sequence'> = {
      ...mutation,
      dependsOnMutationIds: [...new Set([
        ...mutation.dependsOnMutationIds,
        ...earlier.map((item) => item.mutationId),
      ])],
    }
    await table.put(row)
    await db.outbox.add(enriched)
  })
  void requestBackgroundSync()
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('mgl:sync-request'))
  return mutation.mutationId
}
