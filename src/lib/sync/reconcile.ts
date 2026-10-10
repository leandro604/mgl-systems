import type { Table } from 'dexie'
import { purgeProjectData, type MglLocalDb } from '@/lib/db/dexie'
import type {
  LocalBudgetItem,
  LocalDocument,
  LocalMaterialRequest,
  LocalMaterialRequestItem,
  LocalProfile,
  LocalProject,
  LocalProjectMember,
  LocalSstRecord,
  LocalTask,
  LocalTaskDependency,
  SyncCursorRecord,
} from '@/lib/db/schema'
import type {
  BudgetItemRow,
  MaterialRequestItemRow,
  MaterialRequestRow,
  DocumentRow,
  ProfileRow,
  ProjectMemberRow,
  ProjectRow,
  SstRecordRow,
  SyncEntity,
  TaskDependencyRow,
  TaskRow,
  VerifiedIdentity,
} from '@/types/domain'
import type { RemoteSyncRow, SyncRemote } from './remote'

const PAGE_SIZE = 500
const OVERLAP_MS = 30_000
const FULL_RECONCILE_MS = 24 * 60 * 60_000
const SYNC_ENTITIES: readonly SyncEntity[] = [
  'tasks',
  'task_dependencies',
  'documents',
  'sst_records',
  'budget_items',
  'material_requests',
  'material_request_items',
]

export async function reconcileVisibleProjects(
  db: MglLocalDb,
  remote: SyncRemote,
  identity: VerifiedIdentity,
): Promise<ProjectRow[]> {
  const [projects, profiles] = await Promise.all([
    remote.listVisibleProjects(),
    remote.listProfiles(identity.companyId),
  ])

  const visibleIds = new Set(projects.map((project) => project.id))
  const localProjects = await db.projects.toArray()
  for (const local of localProjects) {
    if (!visibleIds.has(local.id)) await purgeProjectData(db, local.id, 'project_access_revoked')
  }

  await db.transaction('rw', db.projects, db.profiles, async () => {
    await db.projects.bulkPut(projects.map(toLocalProject))
    await mergeProfiles(db, profiles)
  })

  for (const project of projects) {
    const members = await remote.listProjectMembers(project.id)
    await replaceProjectMembers(db, project.id, members)
  }

  return projects
}

export async function reconcileProjectEntities(
  db: MglLocalDb,
  remote: SyncRemote,
  projectId: string,
): Promise<void> {
  for (const entity of SYNC_ENTITIES) {
    await reconcileEntity(db, remote, projectId, entity)
  }
}

export async function reconcileEntity(
  db: MglLocalDb,
  remote: SyncRemote,
  projectId: string,
  entity: SyncEntity,
): Promise<void> {
  const cursorId = `${projectId}:${entity}`
  const cursor = await db.cursors.get(cursorId)
  const fullDue = !cursor?.lastFullReconcileAt || Date.now() - cursor.lastFullReconcileAt >= FULL_RECONCILE_MS

  if (!cursor || fullDue) {
    await fullSnapshot(db, remote, projectId, entity, cursorId)
    return
  }

  const overlapStart = new Date(new Date(cursor.serverUpdatedAt).getTime() - OVERLAP_MS).toISOString()
  let from = 0
  let max = { serverUpdatedAt: cursor.serverUpdatedAt, serverId: cursor.serverId }

  for (;;) {
    const rows = await remote.pullEntityPage({
      entity,
      projectId,
      from,
      to: from + PAGE_SIZE - 1,
      serverUpdatedAtGte: overlapStart,
    })
    for (const row of rows) {
      await mergeRemoteRow(db, entity, row)
      max = newerTuple(max, row)
    }
    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  await db.cursors.put({
    ...cursor,
    serverUpdatedAt: max.serverUpdatedAt,
    serverId: max.serverId,
  })
}

async function fullSnapshot(
  db: MglLocalDb,
  remote: SyncRemote,
  projectId: string,
  entity: SyncEntity,
  cursorId: string,
) {
  const remoteIds = new Set<string>()
  let from = 0
  let max = { serverUpdatedAt: '1970-01-01T00:00:00.000Z', serverId: '00000000-0000-0000-0000-000000000000' }

  for (;;) {
    const rows = await remote.pullEntityPage({ entity, projectId, from, to: from + PAGE_SIZE - 1 })
    for (const row of rows) {
      remoteIds.add(row.id)
      await mergeRemoteRow(db, entity, row)
      max = newerTuple(max, row)
    }
    if (rows.length < PAGE_SIZE) break
    from += PAGE_SIZE
  }

  const table = entityTable(db, entity)
  const localRows = await table.where('project_id').equals(projectId).toArray()
  const staleIds = localRows.filter((row) => !row.pending_sync && !remoteIds.has(row.id)).map((row) => row.id)
  if (staleIds.length) await table.bulkDelete(staleIds)

  const record: SyncCursorRecord = {
    id: cursorId,
    projectId,
    entity,
    serverUpdatedAt: max.serverUpdatedAt,
    serverId: max.serverId,
    lastFullReconcileAt: Date.now(),
  }
  await db.cursors.put(record)
}

async function mergeRemoteRow(db: MglLocalDb, entity: SyncEntity, row: RemoteSyncRow) {
  const table = entityTable(db, entity)
  const local = await table.get(row.id)
  if (local?.pending_sync) return
  await table.put(toLocalEntity(row))
}

type LocalEntity =
  | LocalTask
  | LocalTaskDependency
  | LocalDocument
  | LocalSstRecord
  | LocalBudgetItem
  | LocalMaterialRequest
  | LocalMaterialRequestItem

function entityTable(db: MglLocalDb, entity: SyncEntity): Table<LocalEntity, string> {
  switch (entity) {
    case 'tasks': return db.tasks as unknown as Table<LocalEntity, string>
    case 'task_dependencies': return db.taskDependencies as unknown as Table<LocalEntity, string>
    case 'documents': return db.documents as unknown as Table<LocalEntity, string>
    case 'sst_records': return db.sstRecords as unknown as Table<LocalEntity, string>
    case 'budget_items': return db.budgetItems as unknown as Table<LocalEntity, string>
    case 'material_requests': return db.materialRequests as unknown as Table<LocalEntity, string>
    case 'material_request_items': return db.materialRequestItems as unknown as Table<LocalEntity, string>
  }
}

function toLocalEntity(row: RemoteSyncRow): LocalEntity {
  return {
    ...row,
    pending_sync: false,
    sync_error: null,
    local_updated_at: row.updated_at,
  } as LocalEntity
}

function toLocalProject(row: ProjectRow): LocalProject {
  return {
    ...row,
    pending_sync: false,
    sync_error: null,
    local_updated_at: row.updated_at,
  } as LocalProject
}

function toLocalProfile(row: ProfileRow): LocalProfile {
  return {
    phone: null,
    phone_secondary: null,
    dni: null,
    birth_date: null,
    hire_date: null,
    position: null,
    department: null,
    emergency_contact_name: null,
    emergency_contact_phone: null,
    emergency_contact_relation: null,
    blood_type: null,
    photo_drive_id: null,
    notes: '',
    version: 1,
    ...row,
    pending_sync: false,
    sync_error: null,
    local_updated_at: row.updated_at,
  } as LocalProfile
}

function toLocalMember(row: ProjectMemberRow): LocalProjectMember {
  return { ...row, pending_sync: false, sync_error: null, local_updated_at: row.updated_at }
}

async function mergeProfiles(db: MglLocalDb, profiles: ProfileRow[]) {
  const remoteIds = new Set(profiles.map((row) => row.id))
  for (const row of profiles) {
    const local = await db.profiles.get(row.id)
    if (!local?.pending_sync) await db.profiles.put(toLocalProfile(row))
  }
  const local = await db.profiles.toArray()
  const stale = local.filter((row) => !row.pending_sync && !remoteIds.has(row.id)).map((row) => row.id)
  if (stale.length) await db.profiles.bulkDelete(stale)
}

async function replaceProjectMembers(db: MglLocalDb, projectId: string, members: ProjectMemberRow[]) {
  await db.transaction('rw', db.projectMembers, async () => {
    const remoteIds = new Set(members.map((row) => row.id))
    for (const row of members) {
      const local = await db.projectMembers.get(row.id)
      if (!local?.pending_sync) await db.projectMembers.put(toLocalMember(row))
    }
    const local = await db.projectMembers.where('project_id').equals(projectId).toArray()
    const stale = local.filter((row) => !row.pending_sync && !remoteIds.has(row.id)).map((row) => row.id)
    if (stale.length) await db.projectMembers.bulkDelete(stale)
  })
}

function newerTuple(
  current: { serverUpdatedAt: string; serverId: string },
  row: TaskRow | TaskDependencyRow | DocumentRow | SstRecordRow | BudgetItemRow | MaterialRequestRow | MaterialRequestItemRow,
) {
  if (row.server_updated_at > current.serverUpdatedAt) {
    return { serverUpdatedAt: row.server_updated_at, serverId: row.id }
  }
  if (row.server_updated_at === current.serverUpdatedAt && row.id > current.serverId) {
    return { serverUpdatedAt: row.server_updated_at, serverId: row.id }
  }
  return current
}
