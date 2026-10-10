import type { MglLocalDb } from '@/lib/db/dexie'
import type { LocalSstRecord } from '@/lib/db/schema'
import { commitLocalMutation } from '@/lib/sync/local-write'
import { makeMutation, nowIso } from '@/lib/sync/mutation'
import { compactPayload } from '@/lib/sync/payload'
import { sstPayloadSchema, sstUpdatePayloadSchema } from '@/lib/sync/schemas'
import type { Json } from '@/lib/supabase/database.types'
import type { VerifiedIdentity } from '@/types/domain'

export async function createSstRecordLocal(
  db: MglLocalDb,
  identity: VerifiedIdentity,
  projectId: string,
  raw: unknown,
): Promise<LocalSstRecord> {
  const parsed = sstPayloadSchema.parse(raw)
  const id = crypto.randomUUID()
  const updatedAt = nowIso()
  const mutation = makeMutation({
    identity,
    projectId,
    entityId: id,
    entity: 'sst_records',
    operation: 'create',
    updatedAt,
    payload: compactPayload(parsed),
  })
  const row: LocalSstRecord = {
    id,
    company_id: identity.companyId,
    project_id: projectId,
    created_at: updatedAt,
    updated_at: updatedAt,
    server_updated_at: updatedAt,
    mutation_id: mutation.mutationId,
    deleted_at: null,
    record_type: parsed.record_type,
    title: parsed.title,
    occurred_at: parsed.occurred_at,
    details: (parsed.details ?? {}) as Json,
    document_id: parsed.document_id ?? null,
    recorded_by: identity.userId,
    pending_sync: true,
    sync_error: null,
    local_updated_at: updatedAt,
  }
  await commitLocalMutation(db, db.sstRecords, row, mutation)
  return row
}

export async function updateSstRecordLocal(
  db: MglLocalDb,
  identity: VerifiedIdentity,
  recordId: string,
  raw: unknown,
): Promise<LocalSstRecord> {
  const patch = sstUpdatePayloadSchema.parse(raw)
  const current = await db.sstRecords.get(recordId)
  if (!current || current.deleted_at) throw new Error('SST record not available locally')
  if (identity.role === 'field_worker' && current.recorded_by !== identity.userId) {
    throw new Error('Field worker can update only SST records they created')
  }
  const updatedAt = nowIso()
  const mutation = makeMutation({
    identity,
    projectId: current.project_id,
    entityId: recordId,
    entity: 'sst_records',
    operation: 'update',
    updatedAt,
    payload: compactPayload(patch),
  })
  const row: LocalSstRecord = {
    ...current,
    ...(patch.record_type !== undefined ? { record_type: patch.record_type } : {}),
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.occurred_at !== undefined ? { occurred_at: patch.occurred_at } : {}),
    ...(patch.details !== undefined ? { details: patch.details as Json } : {}),
    ...(patch.document_id !== undefined ? { document_id: patch.document_id } : {}),
    updated_at: updatedAt,
    mutation_id: mutation.mutationId,
    pending_sync: true,
    sync_error: null,
    local_updated_at: updatedAt,
  }
  await commitLocalMutation(db, db.sstRecords, row, mutation)
  return row
}

export async function setSstDeletedLocal(
  db: MglLocalDb,
  identity: VerifiedIdentity,
  recordId: string,
  deleted: boolean,
): Promise<LocalSstRecord> {
  const current = await db.sstRecords.get(recordId)
  if (!current) throw new Error('SST record not available locally')
  if (identity.role === 'field_worker' && current.recorded_by !== identity.userId) {
    throw new Error('Field worker can update only SST records they created')
  }
  const updatedAt = nowIso()
  const mutation = makeMutation({
    identity,
    projectId: current.project_id,
    entityId: recordId,
    entity: 'sst_records',
    operation: deleted ? 'soft_delete' : 'restore',
    updatedAt,
    payload: {},
  })
  const row: LocalSstRecord = {
    ...current,
    deleted_at: deleted ? updatedAt : null,
    updated_at: updatedAt,
    mutation_id: mutation.mutationId,
    pending_sync: true,
    sync_error: null,
    local_updated_at: updatedAt,
  }
  await commitLocalMutation(db, db.sstRecords, row, mutation)
  return row
}
