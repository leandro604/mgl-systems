import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { closeLocalDb, destroyLocalDb, getLocalDb } from '@/lib/db/dexie'
import { createDocumentMetadataLocal, updateDocumentMetadataLocal, setDocumentDeletedLocal } from '@/features/documents/repository'
import { buildDocumentTree, emptyDocumentFilters, filterDocuments } from '@/features/documents/document-search'
import { documentPayloadSchema } from '@/lib/sync/schemas'
import type { VerifiedIdentity } from '@/types/domain'
const identity: VerifiedIdentity = { companyId: '70000000-0000-4000-8000-000000000001', userId: '70000000-0000-4000-8000-000000000002', role: 'admin', fullName: 'Test', verifiedAt: new Date().toISOString() }
const projectId = '70000000-0000-4000-8000-000000000003'
const stageId = '70000000-0000-4000-8000-000000000004'
const input = { name: 'Memoria de cálculo', stage_id: stageId, description: 'Diseño estructural', folder_path: '01_Ingeniería//01_Input/', provider: 'google_drive', provider_account_id: 'manual-link', external_file_id: 'test-file', web_url: 'https://drive.google.com/file/d/test-file/view', mime_type: 'application/pdf', size_bytes: 100 }
afterEach(async () => { closeLocalDb(); await destroyLocalDb(identity) })
describe('Task 7 documents', () => {
  it('requires stage and rejects unsafe URLs and ambiguous paths', () => {
    expect(documentPayloadSchema.safeParse({ ...input, stage_id: undefined }).success).toBe(false)
    expect(documentPayloadSchema.safeParse({ ...input, web_url: 'javascript:alert(1)' }).success).toBe(false)
    expect(documentPayloadSchema.safeParse({ ...input, folder_path: '/a/../b' }).success).toBe(false)
    expect(documentPayloadSchema.safeParse({ ...input, folder_path: '/a/ ../b' }).success).toBe(false)
  })
  it('preserves metadata atomically through create, update and soft delete in FIFO outbox', async () => {
    const db = getLocalDb(identity)
    const row = await createDocumentMetadataLocal(db, identity, projectId, input)
    expect(row.folder_path).toBe('/01_Ingeniería/01_Input')
    await updateDocumentMetadataLocal(db, identity, row.id, { description: 'Nueva descripción', folder_path: '/Planos' })
    await setDocumentDeletedLocal(db, identity, row.id, true)
    const queued = await db.outbox.orderBy('sequence').toArray()
    expect(queued.map((mutation) => mutation.operation)).toEqual(['create', 'update', 'soft_delete'])
    expect(queued[0]?.payload).toMatchObject({ stage_id: stageId, description: input.description, folder_path: '/01_Ingeniería/01_Input' })
    expect(queued[1]?.dependsOnMutationIds).toContain(queued[0]?.mutationId)
    expect((await db.documents.get(row.id))?.deleted_at).toBeTruthy()
    expect(filterDocuments(await db.documents.toArray(), emptyDocumentFilters)).toEqual([])
  })
  it('combines accent-insensitive terms, metadata and inclusive date filters', async () => {
    const row = await createDocumentMetadataLocal(getLocalDb(identity), identity, projectId, input)
    row.created_at = '2026-09-26T12:00:00Z'
    const filters = { ...emptyDocumentFilters, query: 'calculo ingenieria', project: projectId, stage: stageId, type: 'PDF', author: identity.userId, from: '2026-09-26', to: '2026-09-26' }
    expect(filterDocuments([row], filters)).toHaveLength(1)
    expect(filterDocuments([row], { ...filters, type: 'Excel' })).toHaveLength(0)
    expect(filterDocuments([row], { ...filters, from: '2026-09-27' })).toHaveLength(0)
    expect(filterDocuments([row], { ...filters, project: 'other' })).toHaveLength(0)
    expect(filterDocuments([row], { ...filters, query: 'leandro' }, { [identity.userId]: 'Leandro' })).toHaveLength(1)
  })
  it('builds nested folders and keeps root documents', async () => {
    const row = await createDocumentMetadataLocal(getLocalDb(identity), identity, projectId, input)
    const tree = buildDocumentTree([row, { ...row, id: 'root', folder_path: '/' }])
    expect(tree.documents[0]?.id).toBe('root')
    expect(tree.folders[0]?.folders[0]?.documents[0]?.id).toBe(row.id)
    expect(tree.folders[0]?.folders[0]?.path).toBe('/01_Ingeniería/01_Input')
  })
})
