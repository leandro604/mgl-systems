import type { MglLocalDb } from '@/lib/db/dexie'
import type { OutboxRecord } from '@/lib/db/schema'
import type { VerifiedIdentity } from '@/types/domain'
import { applySyncResponse, blockMutation, markRetry } from './apply-response'
import { toPendingMutation } from './mutation'
import { reconcileProjectEntities, reconcileVisibleProjects } from './reconcile'
import { nextAttemptAt } from './retry'
import { SyncRemoteError, type SyncRemote } from './remote'

const MAX_MUTATIONS_PER_CYCLE = 50
const MAX_RETRIES = 8

export type SyncCycleSummary = {
  projects: number
  applied: number
  conflicts: number
  rejected: number
  retried: number
  blockedDependencies: number
}

export async function wakeRetryableOutbox(db: MglLocalDb, actorId: string): Promise<number> {
  return db.outbox
    .filter((item) => item.actorId === actorId && item.status === 'retry')
    .modify({ status: 'pending', nextAttemptAt: Date.now() })
}

export async function runSyncCycle(
  db: MglLocalDb,
  remote: SyncRemote,
  identity: VerifiedIdentity,
): Promise<SyncCycleSummary> {
  const summary: SyncCycleSummary = {
    projects: 0,
    applied: 0,
    conflicts: 0,
    rejected: 0,
    retried: 0,
    blockedDependencies: 0,
  }

  await remote.verifyIdentity(identity)

  // Tarea 9.2: flush the local outbox before any broad reconciliation.
  // A failure while pulling an unrelated module must never prevent a user's
  // freshly-created task from reaching Supabase. This also recovers pending
  // mutations immediately after upgrading from an older client.
  await flushOutbox(db, remote, identity.userId, summary)

  const projects = await reconcileVisibleProjects(db, remote, identity)
  summary.projects = projects.length

  for (const project of projects) {
    await reconcileProjectEntities(db, remote, project.id)
  }

  // Flush again in case reconciliation unblocked a dependency chain.
  await flushOutbox(db, remote, identity.userId, summary)

  // Pull once more so applied mutations and server-side trigger values become canonical locally.
  const currentProjects = await db.projects.toArray()
  for (const project of currentProjects) {
    await reconcileProjectEntities(db, remote, project.id)
  }

  return summary
}


async function flushOutbox(
  db: MglLocalDb,
  remote: SyncRemote,
  actorId: string,
  summary: SyncCycleSummary,
): Promise<void> {
  for (let index = 0; index < MAX_MUTATIONS_PER_CYCLE; index += 1) {
    const item = await nextActiveMutation(db, actorId)
    if (!item) break
    if (item.nextAttemptAt > Date.now()) break // strict FIFO: do not overtake a mutation in backoff.

    const dependencyState = await inspectDependencies(db, item)
    if (dependencyState === 'waiting') break
    if (dependencyState === 'blocked') {
      await blockMutation(db, item, 'dependency_blocked', 'A prerequisite mutation failed permanently')
      summary.blockedDependencies += 1
      continue
    }

    try {
      const response = await remote.applyMutation(toPendingMutation(item))
      await applySyncResponse(db, item, response)
      if (response.result === 'applied') summary.applied += 1
      else if (response.result === 'conflict') summary.conflicts += 1
      else summary.rejected += 1
    } catch (error) {
      const remoteError = error instanceof SyncRemoteError
        ? error
        : new SyncRemoteError(error instanceof Error ? error.message : 'Unknown sync error', 'retryable')

      if (remoteError.kind === 'auth') throw remoteError
      if (remoteError.kind === 'permission' || remoteError.kind === 'permanent') {
        await blockMutation(db, item, remoteError.code ?? remoteError.kind, remoteError.message)
        summary.rejected += 1
        continue
      }

      if (item.attemptCount + 1 >= MAX_RETRIES) {
        await blockMutation(db, item, 'retry_exhausted', remoteError.message)
        summary.rejected += 1
        continue
      }
      await markRetry(db, item, nextAttemptAt(item.attemptCount + 1), remoteError.message)
      summary.retried += 1
      break // strict FIFO while the head item is waiting for retry.
    }
  }
}

async function nextActiveMutation(db: MglLocalDb, actorId: string): Promise<OutboxRecord | undefined> {
  return db.outbox
    .orderBy('sequence')
    .filter((item) => item.actorId === actorId && (item.status === 'pending' || item.status === 'retry'))
    .first()
}

async function inspectDependencies(db: MglLocalDb, item: OutboxRecord): Promise<'ready' | 'waiting' | 'blocked'> {
  for (const mutationId of item.dependsOnMutationIds) {
    const dependency = await db.outbox.where('mutationId').equals(mutationId).first()
    if (!dependency) continue
    if (dependency.status === 'blocked') return 'blocked'
    return 'waiting'
  }
  return 'ready'
}
