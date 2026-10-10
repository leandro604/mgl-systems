import type { MglLocalDb } from '@/lib/db/dexie'
import type { LocalTask, LocalTaskDependency } from '@/lib/db/schema'
import { commitLocalMutation } from '@/lib/sync/local-write'
import { makeMutation, nowIso } from '@/lib/sync/mutation'
import { compactPayload } from '@/lib/sync/payload'
import {
  dependencyPayloadSchema,
  taskCanonicalSchema,
  taskCreatePayloadSchema,
  taskUpdatePayloadSchema,
} from '@/lib/sync/schemas'
import type { VerifiedIdentity } from '@/types/domain'

export type TaskCreateInput = Parameters<typeof taskCreatePayloadSchema.parse>[0]
export type TaskUpdateInput = Parameters<typeof taskUpdatePayloadSchema.parse>[0]

export async function createTaskLocal(
  db: MglLocalDb,
  identity: VerifiedIdentity,
  projectId: string,
  raw: TaskCreateInput,
): Promise<LocalTask> {
  const parsed = taskCreatePayloadSchema.parse(raw)
  const id = crypto.randomUUID()
  const updatedAt = nowIso()
  const status = parsed.status ?? 'todo'
  const progress = parsed.progress ?? 0
  const assigneeId = identity.role === 'field_worker' ? identity.userId : (parsed.assignee_id ?? null)

  const canonical = taskCanonicalSchema.parse({
    title: parsed.title,
    description: parsed.description ?? '',
    status,
    priority: parsed.priority ?? 2,
    assignee_id: assigneeId,
    starts_on: parsed.starts_on ?? null,
    due_on: parsed.due_on ?? null,
    progress,
    position: parsed.position ?? 0,
    wbs_code: parsed.wbs_code ?? '',
    task_type: parsed.task_type ?? 'activity',
    parent_task_id: parsed.parent_task_id ?? null,
    planned_weight: parsed.planned_weight ?? 1,
    stage_id: parsed.stage_id,
    budget_item_id: parsed.budget_item_id ?? null,
  })
  const parentMutations = canonical.parent_task_id ? await db.outbox
    .where('entityId').equals(canonical.parent_task_id)
    .and((item) => item.entity === 'tasks' && item.operation === 'create' && item.status !== 'blocked')
    .toArray() : []
  const mutation = makeMutation({
    identity,
    projectId,
    entityId: id,
    entity: 'tasks',
    operation: 'create',
    updatedAt,
    payload: compactPayload(canonical),
    dependsOnMutationIds: parentMutations.map((item) => item.mutationId),
  })

  const row: LocalTask = {
    id,
    company_id: identity.companyId,
    project_id: projectId,
    created_at: updatedAt,
    updated_at: updatedAt,
    server_updated_at: updatedAt,
    mutation_id: mutation.mutationId,
    deleted_at: null,
    created_by: identity.userId,
    ...canonical,
    version: 1,
    pending_sync: true,
    sync_error: null,
    local_updated_at: updatedAt,
  }
  await commitLocalMutation(db, db.tasks, row, mutation)
  return row
}

export async function updateTaskLocal(
  db: MglLocalDb,
  identity: VerifiedIdentity,
  taskId: string,
  raw: TaskUpdateInput,
): Promise<LocalTask> {
  const patch = taskUpdatePayloadSchema.parse(raw)
  const current = await db.tasks.get(taskId)
  if (!current || current.deleted_at) throw new Error('Task not available locally')
  if (current.company_id !== identity.companyId) throw new Error('Tenant mismatch')

  if (identity.role === 'field_worker') {
    if (current.assignee_id !== identity.userId) throw new Error('Field worker can edit only assigned tasks')
    const keys = Object.keys(patch)
    if (keys.some((key) => key !== 'status' && key !== 'progress')) {
      throw new Error('Field worker can update only status and progress')
    }
  }

  const canonical = taskCanonicalSchema.parse({
    title: patch.title ?? current.title,
    description: patch.description ?? current.description,
    status: patch.status ?? current.status,
    priority: patch.priority ?? current.priority,
    assignee_id: patch.assignee_id === undefined ? current.assignee_id : patch.assignee_id,
    starts_on: patch.starts_on === undefined ? current.starts_on : patch.starts_on,
    due_on: patch.due_on === undefined ? current.due_on : patch.due_on,
    progress: patch.progress ?? current.progress,
    position: patch.position ?? current.position,
    wbs_code: patch.wbs_code === undefined ? current.wbs_code : patch.wbs_code,
    task_type: patch.task_type === undefined ? current.task_type : patch.task_type,
    parent_task_id: patch.parent_task_id === undefined ? current.parent_task_id : patch.parent_task_id,
    planned_weight: patch.planned_weight === undefined ? current.planned_weight : patch.planned_weight,
    stage_id: patch.stage_id === undefined ? current.stage_id : patch.stage_id,
    budget_item_id: patch.budget_item_id === undefined ? current.budget_item_id : patch.budget_item_id,
  })
  const updatedAt = nowIso()
  const payload = compactPayload(patch)
  const parentMutations = patch.parent_task_id ? await db.outbox
    .where('entityId').equals(patch.parent_task_id)
    .and((item) => item.entity === 'tasks' && item.operation === 'create' && item.status !== 'blocked')
    .toArray() : []
  const mutation = makeMutation({
    identity,
    projectId: current.project_id,
    entityId: taskId,
    entity: 'tasks',
    operation: 'update',
    updatedAt,
    payload,
    dependsOnMutationIds: parentMutations.map((item) => item.mutationId),
  })
  const row: LocalTask = {
    ...current,
    ...canonical,
    updated_at: updatedAt,
    mutation_id: mutation.mutationId,
    version: current.version + 1,
    pending_sync: true,
    sync_error: null,
    local_updated_at: updatedAt,
  }
  await commitLocalMutation(db, db.tasks, row, mutation)
  return row
}

export async function setTaskDeletedLocal(
  db: MglLocalDb,
  identity: VerifiedIdentity,
  taskId: string,
  deleted: boolean,
): Promise<LocalTask> {
  if (identity.role === 'field_worker') throw new Error('Field workers cannot delete or restore tasks')
  const current = await db.tasks.get(taskId)
  if (!current) throw new Error('Task not available locally')
  const updatedAt = nowIso()
  const mutation = makeMutation({
    identity,
    projectId: current.project_id,
    entityId: taskId,
    entity: 'tasks',
    operation: deleted ? 'soft_delete' : 'restore',
    updatedAt,
    payload: {},
  })
  const row: LocalTask = {
    ...current,
    deleted_at: deleted ? updatedAt : null,
    updated_at: updatedAt,
    mutation_id: mutation.mutationId,
    version: current.version + 1,
    pending_sync: true,
    sync_error: null,
    local_updated_at: updatedAt,
  }
  await commitLocalMutation(db, db.tasks, row, mutation)
  return row
}

export async function createDependencyLocal(
  db: MglLocalDb,
  identity: VerifiedIdentity,
  projectId: string,
  raw: Parameters<typeof dependencyPayloadSchema.parse>[0],
): Promise<LocalTaskDependency> {
  if (identity.role === 'field_worker') throw new Error('Field workers cannot modify task dependencies')
  const payload = dependencyPayloadSchema.parse(raw)
  const id = crypto.randomUUID()
  const updatedAt = nowIso()
  const taskMutations = await db.outbox
    .where('entityId')
    .anyOf(payload.task_id, payload.depends_on_task_id)
    .and((item) => item.entity === 'tasks' && item.operation === 'create' && item.status !== 'blocked')
    .toArray()
  const mutation = makeMutation({
    identity,
    projectId,
    entityId: id,
    entity: 'task_dependencies',
    operation: 'create',
    updatedAt,
    payload: compactPayload(payload),
    dependsOnMutationIds: taskMutations.map((item) => item.mutationId),
  })
  const row: LocalTaskDependency = {
    id,
    company_id: identity.companyId,
    project_id: projectId,
    task_id: payload.task_id,
    depends_on_task_id: payload.depends_on_task_id,
    dependency_type: payload.dependency_type,
    lag_days: payload.lag_days,
    created_at: updatedAt,
    updated_at: updatedAt,
    server_updated_at: updatedAt,
    mutation_id: mutation.mutationId,
    deleted_at: null,
    pending_sync: true,
    sync_error: null,
    local_updated_at: updatedAt,
  }
  await commitLocalMutation(db, db.taskDependencies, row, mutation)
  return row
}

export async function updateDependencyLocal(
  db: MglLocalDb,
  identity: VerifiedIdentity,
  dependencyId: string,
  raw: Partial<Pick<LocalTaskDependency, 'dependency_type' | 'lag_days'>>,
): Promise<LocalTaskDependency> {
  if (identity.role === 'field_worker') throw new Error('Field workers cannot modify task dependencies')
  const current = await db.taskDependencies.get(dependencyId)
  if (!current || current.deleted_at) throw new Error('Dependency not available locally')
  const payload = dependencyPayloadSchema.partial().parse(raw)
  const updatedAt = nowIso()
  const mutation = makeMutation({
    identity,
    projectId: current.project_id,
    entityId: dependencyId,
    entity: 'task_dependencies',
    operation: 'update',
    updatedAt,
    payload: compactPayload(payload),
  })
  const row: LocalTaskDependency = {
    ...current,
    dependency_type: payload.dependency_type ?? current.dependency_type,
    lag_days: payload.lag_days ?? current.lag_days,
    updated_at: updatedAt,
    mutation_id: mutation.mutationId,
    pending_sync: true,
    sync_error: null,
    local_updated_at: updatedAt,
  }
  await commitLocalMutation(db, db.taskDependencies, row, mutation)
  return row
}

export async function setDependencyDeletedLocal(
  db: MglLocalDb,
  identity: VerifiedIdentity,
  dependencyId: string,
  deleted: boolean,
): Promise<LocalTaskDependency> {
  if (identity.role === 'field_worker') throw new Error('Field workers cannot modify task dependencies')
  const current = await db.taskDependencies.get(dependencyId)
  if (!current) throw new Error('Dependency not available locally')
  const updatedAt = nowIso()
  const mutation = makeMutation({
    identity,
    projectId: current.project_id,
    entityId: dependencyId,
    entity: 'task_dependencies',
    operation: deleted ? 'soft_delete' : 'restore',
    updatedAt,
    payload: {},
  })
  const row: LocalTaskDependency = {
    ...current,
    deleted_at: deleted ? updatedAt : null,
    updated_at: updatedAt,
    mutation_id: mutation.mutationId,
    pending_sync: true,
    sync_error: null,
    local_updated_at: updatedAt,
  }
  await commitLocalMutation(db, db.taskDependencies, row, mutation)
  return row
}
