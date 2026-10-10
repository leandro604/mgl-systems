import type { MglLocalDb } from '@/lib/db/dexie'
import type {
  LocalMaterialRequest,
  LocalMaterialRequestItem,
  MaterialRequestWorkflowStatus,
} from '@/lib/db/schema'
import { commitLocalMutation } from '@/lib/sync/local-write'
import { makeMutation, nowIso } from '@/lib/sync/mutation'
import { compactPayload } from '@/lib/sync/payload'
import {
  materialRequestCreatePayloadSchema,
  materialRequestItemCreatePayloadSchema,
  materialRequestItemUpdatePayloadSchema,
  materialRequestTransitionPayloadSchema,
  materialRequestUpdatePayloadSchema,
} from '@/lib/sync/schemas'
import type { VerifiedIdentity } from '@/types/domain'

export async function createMaterialRequestLocal(
  db: MglLocalDb,
  identity: VerifiedIdentity,
  projectId: string,
  raw: unknown,
): Promise<LocalMaterialRequest> {
  const payload = materialRequestCreatePayloadSchema.parse(raw)
  const id = crypto.randomUUID()
  const updatedAt = nowIso()
  const mutation = makeMutation({
    identity,
    projectId,
    entityId: id,
    entity: 'material_requests',
    operation: 'create',
    updatedAt,
    payload: compactPayload(payload),
  })
  const row: LocalMaterialRequest = {
    id,
    company_id: identity.companyId,
    project_id: projectId,
    created_at: updatedAt,
    updated_at: updatedAt,
    server_updated_at: updatedAt,
    mutation_id: mutation.mutationId,
    deleted_at: null,
    number: payload.number,
    needed_on: payload.needed_on ?? null,
    status: 'draft',
    notes: payload.notes ?? '',
    requested_by: identity.userId,
    approved_by: null,
    approved_at: null,
    title: payload.title,
    rejection_reason: null,
    workflow_status: 'draft',
    approver_id: payload.approver_id,
    priority: payload.priority,
    stage_id: payload.stage_id,
    budget_item_id: payload.budget_item_id ?? null,
    version: 1,
    pending_sync: true,
    sync_error: null,
    local_updated_at: updatedAt,
  }
  await commitLocalMutation(db, db.materialRequests, row, mutation)
  return row
}

export async function updateMaterialRequestLocal(
  db: MglLocalDb,
  identity: VerifiedIdentity,
  requestId: string,
  raw: unknown,
): Promise<LocalMaterialRequest> {
  const patch = materialRequestUpdatePayloadSchema.parse(raw)
  const current = await db.materialRequests.get(requestId)
  if (!current || current.deleted_at) throw new Error('Petición no disponible')
  if (current.workflow_status !== 'draft') throw new Error('Solo se editan borradores')
  if (identity.role === 'field_worker' && current.requested_by !== identity.userId) throw new Error('Sin permiso')
  const updatedAt = nowIso()
  const mutation = makeMutation({
    identity,
    projectId: current.project_id,
    entityId: requestId,
    entity: 'material_requests',
    operation: 'update',
    updatedAt,
    payload: compactPayload(patch),
  })
  const row: LocalMaterialRequest = {
    ...current,
    ...(patch.number !== undefined ? { number: patch.number } : {}),
    ...(patch.title !== undefined ? { title: patch.title } : {}),
    ...(patch.needed_on !== undefined ? { needed_on: patch.needed_on } : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    ...(patch.approver_id !== undefined ? { approver_id: patch.approver_id } : {}),
    ...(patch.priority !== undefined ? { priority: patch.priority } : {}),
    ...(patch.stage_id !== undefined ? { stage_id: patch.stage_id } : {}),
    ...(patch.budget_item_id !== undefined ? { budget_item_id: patch.budget_item_id } : {}),
    updated_at: updatedAt,
    mutation_id: mutation.mutationId,
    version: current.version + 1,
    pending_sync: true,
    sync_error: null,
    local_updated_at: updatedAt,
  }
  await commitLocalMutation(db, db.materialRequests, row, mutation)
  return row
}

export async function addMaterialRequestItemLocal(
  db: MglLocalDb,
  identity: VerifiedIdentity,
  projectId: string,
  raw: unknown,
): Promise<LocalMaterialRequestItem> {
  const payload = materialRequestItemCreatePayloadSchema.parse(raw)
  const request = await db.materialRequests.get(payload.request_id)
  if (!request || request.deleted_at) throw new Error('Petición no disponible')
  if (request.workflow_status !== 'draft') throw new Error('La petición ya fue enviada')
  const id = crypto.randomUUID()
  const updatedAt = nowIso()
  const requestCreates = await db.outbox
    .where('entityId').equals(payload.request_id)
    .and((item) => item.entity === 'material_requests' && item.operation === 'create' && item.status !== 'blocked')
    .toArray()
  const mutation = makeMutation({
    identity,
    projectId,
    entityId: id,
    entity: 'material_request_items',
    operation: 'create',
    updatedAt,
    payload: compactPayload(payload),
    dependsOnMutationIds: requestCreates.map((item) => item.mutationId),
  })
  const row: LocalMaterialRequestItem = {
    id,
    company_id: identity.companyId,
    project_id: projectId,
    request_id: payload.request_id,
    material_id: payload.material_id,
    budget_item_id: payload.budget_item_id ?? null,
    quantity: payload.quantity,
    estimated_unit_price: payload.estimated_unit_price,
    estimated_amount: Math.round(payload.quantity * payload.estimated_unit_price * 100) / 100,
    notes: payload.notes ?? '',
    created_at: updatedAt,
    updated_at: updatedAt,
    server_updated_at: updatedAt,
    mutation_id: mutation.mutationId,
    deleted_at: null,
    pending_sync: true,
    sync_error: null,
    local_updated_at: updatedAt,
  }
  await commitLocalMutation(db, db.materialRequestItems, row, mutation)
  return row
}

export async function updateMaterialRequestItemLocal(
  db: MglLocalDb,
  identity: VerifiedIdentity,
  itemId: string,
  raw: unknown,
): Promise<LocalMaterialRequestItem> {
  const patch = materialRequestItemUpdatePayloadSchema.parse(raw)
  const current = await db.materialRequestItems.get(itemId)
  if (!current || current.deleted_at) throw new Error('Ítem no disponible')
  const request = await db.materialRequests.get(current.request_id)
  if (!request || request.workflow_status !== 'draft') throw new Error('La petición ya fue enviada')
  const updatedAt = nowIso()
  const mutation = makeMutation({
    identity,
    projectId: current.project_id,
    entityId: itemId,
    entity: 'material_request_items',
    operation: 'update',
    updatedAt,
    payload: compactPayload(patch),
  })
  const quantity = patch.quantity ?? current.quantity
  const unitPrice = patch.estimated_unit_price ?? current.estimated_unit_price
  const row: LocalMaterialRequestItem = {
    ...current,
    ...(patch.budget_item_id !== undefined ? { budget_item_id: patch.budget_item_id } : {}),
    ...(patch.quantity !== undefined ? { quantity: patch.quantity } : {}),
    ...(patch.estimated_unit_price !== undefined ? { estimated_unit_price: patch.estimated_unit_price } : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes } : {}),
    estimated_amount: Math.round(quantity * unitPrice * 100) / 100,
    updated_at: updatedAt,
    mutation_id: mutation.mutationId,
    pending_sync: true,
    sync_error: null,
    local_updated_at: updatedAt,
  }
  await commitLocalMutation(db, db.materialRequestItems, row, mutation)
  return row
}

export async function transitionMaterialRequestLocal(
  db: MglLocalDb,
  identity: VerifiedIdentity,
  requestId: string,
  raw: unknown,
): Promise<LocalMaterialRequest> {
  const payload = materialRequestTransitionPayloadSchema.parse(raw)
  const current = await db.materialRequests.get(requestId)
  if (!current || current.deleted_at) throw new Error('Petición no disponible')
  const items = await db.materialRequestItems.where('request_id').equals(requestId).filter((row) => !row.deleted_at).toArray()
  if (payload.transition === 'pending' && items.length === 0) throw new Error('Agrega al menos un material')

  const updatedAt = nowIso()
  const dependencies = await db.outbox
    .filter((item) => item.projectId === current.project_id && item.status !== 'blocked' && (
      (item.entity === 'material_requests' && item.entityId === requestId) ||
      (item.entity === 'material_request_items' && items.some((line) => line.id === item.entityId))
    ))
    .toArray()
  const mutation = makeMutation({
    identity,
    projectId: current.project_id,
    entityId: requestId,
    entity: 'material_requests',
    operation: 'update',
    updatedAt,
    payload: compactPayload(payload),
    dependsOnMutationIds: dependencies.map((item) => item.mutationId),
  })
  const nextWorkflow = optimisticWorkflow(payload.transition)
  const row: LocalMaterialRequest = {
    ...current,
    status: toServerStatus(nextWorkflow),
    workflow_status: nextWorkflow,
    rejection_reason: payload.transition === 'rejected' ? payload.reason ?? null : current.rejection_reason,
    approved_by: payload.transition === 'approved' ? identity.userId : current.approved_by,
    approved_at: payload.transition === 'approved' ? updatedAt : current.approved_at,
    updated_at: updatedAt,
    mutation_id: mutation.mutationId,
    version: current.version + 1,
    pending_sync: true,
    sync_error: null,
    local_updated_at: updatedAt,
  }
  await commitLocalMutation(db, db.materialRequests, row, mutation)
  return row
}

function optimisticWorkflow(transition: 'pending' | 'approved' | 'rejected' | 'cancelled' | 'delivered'): MaterialRequestWorkflowStatus {
  return transition
}

function toServerStatus(workflow: MaterialRequestWorkflowStatus): string {
  if (workflow === 'pending') return 'submitted'
  if (workflow === 'delivered') return 'fulfilled'
  return workflow
}
