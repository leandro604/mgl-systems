import type { MglLocalDb } from '@/lib/db/dexie'
import type { LocalDocument, TemporaryBlobRecord } from '@/lib/db/schema'
import { commitLocalMutation } from '@/lib/sync/local-write'
import { makeMutation, nowIso } from '@/lib/sync/mutation'
import { compactPayload } from '@/lib/sync/payload'
import { documentPayloadSchema, documentUpdatePayloadSchema } from '@/lib/sync/schemas'
import type { VerifiedIdentity } from '@/types/domain'

export async function stageTemporaryBlob(
  db: MglLocalDb,
  projectId: string,
  entityId: string,
  file: Blob,
  fileName: string,
): Promise<TemporaryBlobRecord> {
  const row: TemporaryBlobRecord = {
    id: crypto.randomUUID(),
    projectId,
    entityId,
    fileName,
    mimeType: file.type || 'application/octet-stream',
    sizeBytes: file.size,
    blob: file,
    createdAt: Date.now(),
  }
  await db.tempBlobs.put(row)
  return row
}

export async function createDocumentMetadataLocal(
  db: MglLocalDb,
  identity: VerifiedIdentity,
  projectId: string,
  raw: unknown,
): Promise<LocalDocument> {
  const parsed = documentPayloadSchema.parse(raw)
  const id = crypto.randomUUID()
  const updatedAt = nowIso()
  const mutation = makeMutation({
    identity,
    projectId,
    entityId: id,
    entity: 'documents',
    operation: 'create',
    updatedAt,
    payload: compactPayload(parsed),
  })
  const row: LocalDocument = {
    id,
    company_id: identity.companyId,
    project_id: projectId,
    created_at: updatedAt,
    updated_at: updatedAt,
    server_updated_at: updatedAt,
    mutation_id: mutation.mutationId,
    deleted_at: null,
    name: parsed.name,
    provider: parsed.provider,
    provider_account_id: parsed.provider_account_id,
    external_file_id: parsed.external_file_id,
    web_url: parsed.web_url,
    mime_type: parsed.mime_type,
    size_bytes: parsed.size_bytes,
    sha256: parsed.sha256 ?? null,
    uploaded_by: identity.userId,
    stage_id: parsed.stage_id,
    description: parsed.description ?? '',
    folder_path: parsed.folder_path ?? '/',
    version: 1,
    pending_sync: true,
    sync_error: null,
    local_updated_at: updatedAt,
  }
  await commitLocalMutation(db, db.documents, row, mutation)
  return row
}

export async function updateDocumentMetadataLocal(
  db: MglLocalDb,
  identity: VerifiedIdentity,
  documentId: string,
  raw: unknown,
): Promise<LocalDocument> {
  const patch = documentUpdatePayloadSchema.parse(raw)
  const current = await db.documents.get(documentId)
  if (!current || current.deleted_at) throw new Error('Document not available locally')
  if (current.company_id !== identity.companyId) throw new Error('Tenant mismatch')
  if (identity.role === 'field_worker' && current.uploaded_by !== identity.userId) {
    throw new Error('Field worker can update only documents they uploaded')
  }
  const updatedAt = nowIso()
  const mutation = makeMutation({
    identity,
    projectId: current.project_id,
    entityId: documentId,
    entity: 'documents',
    operation: 'update',
    updatedAt,
    payload: compactPayload(patch),
  })
  const row: LocalDocument = {
    ...current,
    ...(patch.stage_id !== undefined ? { stage_id: patch.stage_id } : {}),
    ...(patch.description !== undefined ? { description: patch.description } : {}),
    ...(patch.folder_path !== undefined ? { folder_path: patch.folder_path } : {}),
    ...(patch.name !== undefined ? { name: patch.name } : {}),
    ...(patch.provider !== undefined ? { provider: patch.provider } : {}),
    ...(patch.provider_account_id !== undefined ? { provider_account_id: patch.provider_account_id } : {}),
    ...(patch.external_file_id !== undefined ? { external_file_id: patch.external_file_id } : {}),
    ...(patch.web_url !== undefined ? { web_url: patch.web_url } : {}),
    ...(patch.mime_type !== undefined ? { mime_type: patch.mime_type } : {}),
    ...(patch.size_bytes !== undefined ? { size_bytes: patch.size_bytes } : {}),
    ...(patch.sha256 !== undefined ? { sha256: patch.sha256 } : {}),
    updated_at: updatedAt,
    mutation_id: mutation.mutationId,
    version: current.version + 1,
    pending_sync: true,
    sync_error: null,
    local_updated_at: updatedAt,
  }
  await commitLocalMutation(db, db.documents, row, mutation)
  return row
}

export async function setDocumentDeletedLocal(
  db: MglLocalDb,
  identity: VerifiedIdentity,
  documentId: string,
  deleted: boolean,
): Promise<LocalDocument> {
  const current = await db.documents.get(documentId)
  if (!current) throw new Error('Document not available locally')
  if (current.company_id !== identity.companyId) throw new Error('Tenant mismatch')
  if (identity.role === 'field_worker' && current.uploaded_by !== identity.userId) {
    throw new Error('Field worker can update only documents they uploaded')
  }
  const updatedAt = nowIso()
  const mutation = makeMutation({
    identity,
    projectId: current.project_id,
    entityId: documentId,
    entity: 'documents',
    operation: deleted ? 'soft_delete' : 'restore',
    updatedAt,
    payload: {},
  })
  const row: LocalDocument = {
    ...current,
    deleted_at: deleted ? updatedAt : null,
    updated_at: updatedAt,
    mutation_id: mutation.mutationId,
    version: current.version + 1,
    pending_sync: true,
    sync_error: null,
    local_updated_at: updatedAt,
  }
  await commitLocalMutation(db, db.documents, row, mutation)
  return row
}
