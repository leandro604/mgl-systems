import 'fake-indexeddb/auto'
import Dexie from 'dexie'
import { afterEach, describe, expect, it } from 'vitest'
import {
  CURRENT_LOCAL_DB_VERSION,
  LOCAL_STORES_V1,
  LOCAL_STORES_V2,
  closeLocalDb,
  destroyLocalDb,
  getLocalDb,
  localDbName,
} from '@/lib/db/dexie'
import {
  DEFAULT_COST_THRESHOLDS,
  calculateCostDeviation,
  roundSqlNumeric,
} from '@/features/budget/cost-calculator'
import type { VerifiedIdentity } from '@/types/domain'

const identity: VerifiedIdentity = {
  companyId: '20000000-0000-4000-8000-000000000001',
  userId: '20000000-0000-4000-8000-000000000002',
  role: 'admin',
  fullName: 'Task Two Admin',
  verifiedAt: '2026-09-25T00:00:00.000Z',
}

const projectId = '20000000-0000-4000-8000-000000000003'

async function createLegacyV2Db(): Promise<Dexie> {
  const db = new Dexie(localDbName(identity))
  db.version(1).stores(LOCAL_STORES_V1)
  db.version(2).stores(LOCAL_STORES_V2)
  await db.open()
  return db
}

afterEach(async () => {
  closeLocalDb()
  await destroyLocalDb(identity)
})

describe('Task 2 cost calculator', () => {
  it('mirrors the real S/ 16,000 -> S/ 80,000 overrun example', () => {
    expect(calculateCostDeviation({
      qtyQuoted: 1,
      unitPriceQuoted: 16_000,
      qtyActual: 1,
      unitPriceActual: 80_000,
    })).toEqual({
      quotedTotal: 16_000,
      actualTotal: 80_000,
      deviationAmount: 64_000,
      deviationPct: 400,
      status: 'critico',
    })
  })

  it('uses the same default 10% / 25% thresholds as PostgreSQL', () => {
    expect(DEFAULT_COST_THRESHOLDS).toEqual({ minorMaxPct: 10, majorMaxPct: 25 })
    expect(calculateCostDeviation({ qtyQuoted: 1, unitPriceQuoted: 100, qtyActual: 1, unitPriceActual: 100 }).status)
      .toBe('dentro_presupuesto')
    expect(calculateCostDeviation({ qtyQuoted: 1, unitPriceQuoted: 100, qtyActual: 1, unitPriceActual: 110 }).status)
      .toBe('alerta_menor')
    expect(calculateCostDeviation({ qtyQuoted: 1, unitPriceQuoted: 100, qtyActual: 1, unitPriceActual: 125 }).status)
      .toBe('alerta_mayor')
    expect(calculateCostDeviation({ qtyQuoted: 1, unitPriceQuoted: 100, qtyActual: 1, unitPriceActual: 126 }).status)
      .toBe('critico')
  })

  it('matches PostgreSQL zero-baseline and half-away-from-zero rounding semantics', () => {
    expect(calculateCostDeviation({ qtyQuoted: 0, unitPriceQuoted: 0, qtyActual: 0, unitPriceActual: 10 }))
      .toMatchObject({ deviationPct: null, status: 'dentro_presupuesto' })
    expect(calculateCostDeviation({ qtyQuoted: 0, unitPriceQuoted: 0, qtyActual: 1, unitPriceActual: 10 }))
      .toMatchObject({ deviationPct: null, status: 'critico' })
    expect(roundSqlNumeric(1.005, 2)).toBe(1.01)
    expect(roundSqlNumeric(-1.005, 2)).toBe(-1.01)
  })
})

describe('Task 2 Dexie migration', () => {
  it('upgrades an existing Phase 8 v2 database in place without deleting rows', async () => {
    const legacy = await createLegacyV2Db()
    const timestamp = '2026-09-25T01:00:00.000Z'

    await legacy.table('projects').put({
      id: projectId,
      company_id: identity.companyId,
      code: 'LEGACY',
      name: 'Legacy project',
      description: '',
      status: 'planning',
      starts_on: null,
      ends_on: null,
      created_by: identity.userId,
      created_at: timestamp,
      updated_at: timestamp,
      server_updated_at: timestamp,
      mutation_id: '20000000-0000-4000-8000-000000000010',
      deleted_at: null,
      pending_sync: false,
      sync_error: null,
      local_updated_at: timestamp,
    })
    await legacy.table('profiles').put({
      id: '20000000-0000-4000-8000-000000000011',
      company_id: identity.companyId,
      user_id: identity.userId,
      full_name: identity.fullName,
      role: 'admin',
      created_at: timestamp,
      updated_at: timestamp,
      server_updated_at: timestamp,
      mutation_id: '20000000-0000-4000-8000-000000000012',
      deleted_at: null,
      pending_sync: false,
      sync_error: null,
      local_updated_at: timestamp,
    })
    await legacy.table('tasks').put({
      id: '20000000-0000-4000-8000-000000000020',
      company_id: identity.companyId,
      project_id: projectId,
      title: 'Legacy task',
      description: '',
      status: 'todo',
      priority: 2,
      assignee_id: null,
      created_by: identity.userId,
      starts_on: null,
      due_on: null,
      progress: 0,
      position: 0,
      wbs_code: '',
      task_type: 'activity',
      parent_task_id: null,
      planned_weight: 1,
      budget_item_id: null,
      created_at: timestamp,
      updated_at: timestamp,
      server_updated_at: timestamp,
      mutation_id: '20000000-0000-4000-8000-000000000021',
      deleted_at: null,
      pending_sync: false,
      sync_error: null,
      local_updated_at: timestamp,
    })
    await legacy.table('documents').put({
      id: '20000000-0000-4000-8000-000000000030',
      company_id: identity.companyId,
      project_id: projectId,
      name: 'Legacy document',
      provider: 'google_drive',
      provider_account_id: 'drive',
      external_file_id: 'file',
      web_url: 'https://drive.google.com/example',
      mime_type: 'application/pdf',
      size_bytes: 100,
      sha256: null,
      uploaded_by: identity.userId,
      created_at: timestamp,
      updated_at: timestamp,
      server_updated_at: timestamp,
      mutation_id: '20000000-0000-4000-8000-000000000031',
      deleted_at: null,
      pending_sync: false,
      sync_error: null,
      local_updated_at: timestamp,
    })
    legacy.close()

    const db = getLocalDb(identity)
    await db.open()

    expect(db.verno).toBe(CURRENT_LOCAL_DB_VERSION)
    expect(await db.projects.count()).toBe(1)
    expect(await db.tasks.count()).toBe(1)
    expect(await db.documents.count()).toBe(1)

    expect(await db.projects.get(projectId)).toMatchObject({
      cost_alert_minor_max_pct: 10,
      cost_alert_major_max_pct: 25,
    })
    expect(await db.profiles.get('20000000-0000-4000-8000-000000000011')).toMatchObject({
      phone: null,
      dni: null,
      notes: '',
      version: 1,
    })
    expect(await db.tasks.get('20000000-0000-4000-8000-000000000020')).toMatchObject({
      stage_id: null,
      version: 1,
    })
    expect(await db.documents.get('20000000-0000-4000-8000-000000000030')).toMatchObject({
      stage_id: null,
      description: '',
      folder_path: '/',
      version: 1,
    })
  })

  it('creates all Task 1 local stores needed by later offline workflows', async () => {
    const db = getLocalDb(identity)
    await db.open()
    const names = new Set(db.tables.map((table) => table.name))

    for (const name of [
      'projectStages',
      'budgetItems',
      'notifications',
      'notificationDeliveries',
      'pushSubscriptions',
      'materialRequests',
      'materialRequestItems',
      'userPreferences',
    ]) {
      expect(names.has(name)).toBe(true)
    }
  })
})
