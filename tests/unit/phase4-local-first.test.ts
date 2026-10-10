import 'fake-indexeddb/auto'
import { afterEach, describe, expect, it } from 'vitest'
import { closeLocalDb, destroyLocalDb, getLocalDb } from '@/lib/db/dexie'
import { createTaskLocal, updateTaskLocal } from '@/features/tasks/repository'
import { createDocumentMetadataLocal } from '@/features/documents/repository'
import { createSstRecordLocal } from '@/features/sst/repository'
import type { VerifiedIdentity } from '@/types/domain'

const identity: VerifiedIdentity = {
  companyId: '10000000-0000-4000-8000-000000000001',
  userId: '10000000-0000-4000-8000-000000000002',
  role: 'admin',
  fullName: 'Phase Four Admin',
  verifiedAt: new Date().toISOString(),
}
const projectId = '10000000-0000-4000-8000-000000000003'
const stageId = '10000000-0000-4000-8000-000000000004'

afterEach(async () => {
  closeLocalDb()
  await destroyLocalDb(identity)
})

describe('phase 4 local-first operations', () => {
  it('writes a task and its outbox mutation atomically', async () => {
    const db = getLocalDb(identity)
    const task = await createTaskLocal(db, identity, projectId, { title: 'Instalar gabinete', priority: 3, progress: 0, status: 'todo', stage_id: stageId })
    expect((await db.tasks.get(task.id))?.pending_sync).toBe(true)
    const outbox = await db.outbox.toArray()
    expect(outbox).toHaveLength(1)
    expect(outbox[0]?.entity).toBe('tasks')
    expect(outbox[0]?.entityId).toBe(task.id)
  })

  it('chains a second task edit behind the first pending mutation', async () => {
    const db = getLocalDb(identity)
    const task = await createTaskLocal(db, identity, projectId, { title: 'Certificar enlace', progress: 0, status: 'todo', stage_id: stageId })
    const first = (await db.outbox.toArray())[0]
    await updateTaskLocal(db, identity, task.id, { status: 'in_progress', progress: 30 })
    const rows = await db.outbox.orderBy('sequence').toArray()
    expect(rows).toHaveLength(2)
    expect(rows[1]?.dependsOnMutationIds).toContain(first?.mutationId)
  })

  it('queues document metadata and SST records for offline synchronization', async () => {
    const db = getLocalDb(identity)
    const document = await createDocumentMetadataLocal(db, identity, projectId, {
      name: 'Plano de comunicaciones',
      stage_id: stageId,
      provider: 'google_drive',
      provider_account_id: 'manual-link',
      external_file_id: 'drive-test-id',
      web_url: 'https://drive.google.com/example',
      mime_type: 'application/pdf',
      size_bytes: 1024,
      sha256: null,
    })
    await createSstRecordLocal(db, identity, projectId, {
      record_type: 'inspection',
      title: 'Inspección de bandejas',
      occurred_at: new Date().toISOString(),
      details: { notes: 'Sin observaciones' },
      document_id: document.id,
    })
    const mutations = await db.outbox.orderBy('sequence').toArray()
    expect(mutations.map((row) => row.entity)).toEqual(['documents', 'sst_records'])
    expect(await db.documents.count()).toBe(1)
    expect(await db.sstRecords.count()).toBe(1)
  })
})
