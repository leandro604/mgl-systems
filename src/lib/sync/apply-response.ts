import type { Table } from 'dexie'
import type { MglLocalDb } from '@/lib/db/dexie'
import type {
  LocalBudgetItem,
  LocalDocument,
  LocalMaterialRequest,
  LocalMaterialRequestItem,
  LocalSstRecord,
  LocalTask,
  LocalTaskDependency,
  OutboxRecord,
} from '@/lib/db/schema'
import type { Json } from '@/lib/supabase/database.types'
import type { SyncEntity, SyncResponse } from '@/types/domain'

export async function applySyncResponse(db: MglLocalDb, item: OutboxRecord, response: SyncResponse) {
  const hasLaterMutation = await db.outbox
    .where('entityId')
    .equals(item.entityId)
    .and((candidate) =>
      candidate.mutationId !== item.mutationId &&
      candidate.entity === item.entity &&
      (candidate.sequence ?? 0) > (item.sequence ?? 0) &&
      candidate.status !== 'blocked',
    )
    .count()

  if (response.result === 'rejected') {
    await blockMutation(db, item, response.code ?? 'rejected', response.message ?? 'Mutation rejected by server')
    return
  }

  const table = entityTable(db, item.entity)
  await db.transaction('rw', table, db.outbox, db.conflicts, async () => {
    if (response.result === 'conflict') {
      await db.conflicts.put({
        id: crypto.randomUUID(),
        mutationId: item.mutationId,
        companyId: item.companyId,
        projectId: item.projectId,
        entity: item.entity,
        entityId: item.entityId,
        operation: item.operation,
        localPayload: item.payload,
        canonicalRow: response.row ?? null,
        code: response.code ?? null,
        message: response.message ?? null,
        createdAt: Date.now(),
        resolution: 'server_won',
      })
    }

    // Do not overwrite a newer optimistic edit for the same row.
    if (!hasLaterMutation && response.row) {
      await putCanonical(table, response.row)
    }
    await deleteOutboxItem(db, item)
  })
}

export async function blockMutation(db: MglLocalDb, item: OutboxRecord, code: string, message: string) {
  const table = entityTable(db, item.entity)
  await db.transaction('rw', table, db.outbox, async () => {
    if (item.sequence !== undefined) {
      await db.outbox.update(item.sequence, { status: 'blocked', lastError: `${code}: ${message}` })
    }
    const local = await table.get(item.entityId)
    if (local) {
      await table.put({ ...local, pending_sync: true, sync_error: `${code}: ${message}` } as never)
    }
  })
}

export async function markRetry(db: MglLocalDb, item: OutboxRecord, nextAttemptAt: number, message: string) {
  if (item.sequence === undefined) return
  const table = entityTable(db, item.entity)
  await db.transaction('rw', table, db.outbox, async () => {
    await db.outbox.update(item.sequence!, {
      status: 'retry',
      attemptCount: item.attemptCount + 1,
      nextAttemptAt,
      lastError: message,
    })
    const local = await table.get(item.entityId)
    if (local) {
      await table.put({ ...local, pending_sync: true, sync_error: `Reintentando: ${message}` } as never)
    }
  })
}

async function deleteOutboxItem(db: MglLocalDb, item: OutboxRecord) {
  if (item.sequence !== undefined) await db.outbox.delete(item.sequence)
  else await db.outbox.where('mutationId').equals(item.mutationId).delete()
}

type LocalSyncRow =
  | LocalTask
  | LocalTaskDependency
  | LocalDocument
  | LocalSstRecord
  | LocalBudgetItem
  | LocalMaterialRequest
  | LocalMaterialRequestItem

function entityTable(db: MglLocalDb, entity: SyncEntity): Table<LocalSyncRow, string> {
  switch (entity) {
    case 'tasks': return db.tasks as unknown as Table<LocalSyncRow, string>
    case 'task_dependencies': return db.taskDependencies as unknown as Table<LocalSyncRow, string>
    case 'documents': return db.documents as unknown as Table<LocalSyncRow, string>
    case 'sst_records': return db.sstRecords as unknown as Table<LocalSyncRow, string>
    case 'budget_items': return db.budgetItems as unknown as Table<LocalSyncRow, string>
    case 'material_requests': return db.materialRequests as unknown as Table<LocalSyncRow, string>
    case 'material_request_items': return db.materialRequestItems as unknown as Table<LocalSyncRow, string>
  }
}

async function putCanonical(table: Table<LocalSyncRow, string>, raw: Record<string, Json>) {
  const updatedAt = typeof raw.updated_at === 'string' ? raw.updated_at : new Date().toISOString()
  const row = {
    ...raw,
    pending_sync: false,
    sync_error: null,
    local_updated_at: updatedAt,
  } as unknown as LocalSyncRow
  await table.put(row)
}
