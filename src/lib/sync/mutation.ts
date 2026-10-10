import type { OutboxRecord } from '@/lib/db/schema'
import type { PendingMutation, SyncEntity, SyncOperation, SyncPayload, VerifiedIdentity } from '@/types/domain'

export function nowIso() {
  return new Date().toISOString()
}

export function makeMutation(input: {
  identity: VerifiedIdentity
  projectId: string
  entityId: string
  entity: SyncEntity
  operation: SyncOperation
  updatedAt: string
  payload: SyncPayload
  dependsOnMutationIds?: string[]
}): Omit<OutboxRecord, 'sequence'> {
  return {
    mutationId: crypto.randomUUID(),
    entityId: input.entityId,
    companyId: input.identity.companyId,
    projectId: input.projectId,
    actorId: input.identity.userId,
    entity: input.entity,
    operation: input.operation,
    updatedAt: input.updatedAt,
    payload: input.payload,
    dependsOnMutationIds: input.dependsOnMutationIds ?? [],
    status: 'pending',
    attemptCount: 0,
    nextAttemptAt: Date.now(),
    lastError: null,
    createdAt: Date.now(),
  }
}

export function toPendingMutation(row: OutboxRecord): PendingMutation {
  return {
    mutationId: row.mutationId,
    entityId: row.entityId,
    companyId: row.companyId,
    projectId: row.projectId,
    actorId: row.actorId,
    entity: row.entity,
    operation: row.operation,
    updatedAt: row.updatedAt,
    payload: row.payload,
    dependsOnMutationIds: row.dependsOnMutationIds,
  }
}
