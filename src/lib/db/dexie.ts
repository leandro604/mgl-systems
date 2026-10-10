import Dexie, { type EntityTable } from 'dexie'
import type { VerifiedIdentity } from '@/types/domain'
import type {
  BlockedReceipt,
  ConflictRecord,
  LocalBudgetItem,
  LocalDocument,
  LocalMaterialRequest,
  LocalMaterialRequestItem,
  LocalMetaRecord,
  LocalNotification,
  LocalNotificationDelivery,
  LocalProfile,
  LocalProject,
  LocalProjectMember,
  LocalProjectStage,
  LocalPushSubscription,
  LocalSstRecord,
  LocalTask,
  LocalTaskDependency,
  LocalUserPreference,
  IntegrationJobRecord,
  OutboxRecord,
  SyncCursorRecord,
  TemporaryBlobRecord,
} from './schema'

export const LOCAL_DB_PREFIX = 'mgl-systems-v2'
export const CURRENT_LOCAL_DB_VERSION = 4

export function localDbName(identity: Pick<VerifiedIdentity, 'companyId' | 'userId'>): string {
  return `${LOCAL_DB_PREFIX}:${identity.companyId}:${identity.userId}`
}

export const LOCAL_STORES_V1 = {
  projects: 'id,company_id,server_updated_at,deleted_at',
  profiles: 'id,&user_id,company_id,server_updated_at,deleted_at',
  projectMembers: 'id,[company_id+project_id+user_id],project_id,user_id,server_updated_at,deleted_at',
  tasks: 'id,project_id,assignee_id,status,server_updated_at,deleted_at,pending_sync',
  taskDependencies: 'id,project_id,task_id,depends_on_task_id,server_updated_at,deleted_at,pending_sync',
  documents: 'id,project_id,server_updated_at,deleted_at,pending_sync',
  sstRecords: 'id,project_id,record_type,server_updated_at,deleted_at,pending_sync',
  outbox: '++sequence,&mutationId,[actorId+status+nextAttemptAt],projectId,entityId,entity,status,nextAttemptAt',
  conflicts: 'id,&mutationId,projectId,entity,createdAt',
  cursors: 'id,projectId,entity',
  tempBlobs: 'id,projectId,entityId,createdAt',
  blockedReceipts: 'id,&mutationId,projectId,entity,createdAt',
  meta: 'key,updatedAt',
} as const

export const LOCAL_STORES_V2 = {
  tasks: 'id,project_id,assignee_id,status,server_updated_at,deleted_at,pending_sync',
  taskDependencies: 'id,project_id,task_id,depends_on_task_id,server_updated_at,deleted_at,pending_sync',
} as const

/**
 * Task 2 schema. Existing tables are only re-declared when an index changes.
 * New domain tables mirror the Task 1 backend without widening the Phase 2
 * mutation allow-list; write/sync workflows are added in their later tasks.
 */
export const LOCAL_STORES_V3 = {
  projects: 'id,company_id,server_updated_at,deleted_at',
  profiles: 'id,&user_id,company_id,role,dni,server_updated_at,deleted_at',
  tasks: 'id,project_id,stage_id,budget_item_id,assignee_id,status,server_updated_at,deleted_at,pending_sync',
  documents: 'id,project_id,stage_id,folder_path,mime_type,uploaded_by,server_updated_at,deleted_at,pending_sync',
  projectStages: 'id,[company_id+project_id+stage_type],project_id,stage_type,sort_order,server_updated_at,deleted_at,pending_sync',
  budgetItems: 'id,project_id,budget_id,stage_id,parent_id,code,cost_status,server_updated_at,deleted_at,pending_sync',
  notifications: 'id,recipient_id,project_id,read_at,created_at,server_updated_at,deleted_at,pending_sync',
  notificationDeliveries: 'id,notification_id,recipient_id,channel,status,scheduled_for,server_updated_at,deleted_at,pending_sync',
  pushSubscriptions: 'id,user_id,enabled,server_updated_at,deleted_at,pending_sync',
  materialRequests: 'id,project_id,requested_by,approver_id,workflow_status,priority,stage_id,budget_item_id,server_updated_at,deleted_at,pending_sync',
  materialRequestItems: 'id,project_id,request_id,material_id,budget_item_id,server_updated_at,deleted_at,pending_sync',
  userPreferences: 'id,&[company_id+user_id],user_id,server_updated_at,deleted_at,pending_sync',
} as const

export const LOCAL_STORES_V4 = {
  integrationJobs: 'id,[userId+status+nextAttemptAt],projectId,entityId,kind,status,nextAttemptAt',
} as const

export class MglLocalDb extends Dexie {
  projects!: EntityTable<LocalProject, 'id'>
  profiles!: EntityTable<LocalProfile, 'id'>
  projectMembers!: EntityTable<LocalProjectMember, 'id'>
  tasks!: EntityTable<LocalTask, 'id'>
  taskDependencies!: EntityTable<LocalTaskDependency, 'id'>
  documents!: EntityTable<LocalDocument, 'id'>
  sstRecords!: EntityTable<LocalSstRecord, 'id'>

  projectStages!: EntityTable<LocalProjectStage, 'id'>
  budgetItems!: EntityTable<LocalBudgetItem, 'id'>
  notifications!: EntityTable<LocalNotification, 'id'>
  notificationDeliveries!: EntityTable<LocalNotificationDelivery, 'id'>
  pushSubscriptions!: EntityTable<LocalPushSubscription, 'id'>
  materialRequests!: EntityTable<LocalMaterialRequest, 'id'>
  materialRequestItems!: EntityTable<LocalMaterialRequestItem, 'id'>
  userPreferences!: EntityTable<LocalUserPreference, 'id'>
  integrationJobs!: EntityTable<IntegrationJobRecord, 'id'>

  outbox!: EntityTable<OutboxRecord, 'sequence'>
  conflicts!: EntityTable<ConflictRecord, 'id'>
  cursors!: EntityTable<SyncCursorRecord, 'id'>
  tempBlobs!: EntityTable<TemporaryBlobRecord, 'id'>
  blockedReceipts!: EntityTable<BlockedReceipt, 'id'>
  meta!: EntityTable<LocalMetaRecord, 'key'>

  constructor(identity: Pick<VerifiedIdentity, 'companyId' | 'userId'>) {
    // Keep the physical database name stable so IndexedDB data from earlier
    // phases upgrades in place instead of silently creating a fresh cache.
    super(localDbName(identity))

    this.version(1).stores(LOCAL_STORES_V1)

    // Phase 8 planning migration. Kept exactly as an in-place upgrade.
    this.version(2).stores(LOCAL_STORES_V2).upgrade(async (tx) => {
      await tx.table('tasks').toCollection().modify((task: Partial<LocalTask>) => {
        task.wbs_code ??= ''
        task.task_type ??= 'activity'
        task.parent_task_id ??= null
        task.planned_weight ??= 1
        task.budget_item_id ??= null
      })
      await tx.table('taskDependencies').toCollection().modify((dependency: Partial<LocalTaskDependency>) => {
        dependency.dependency_type ??= 'FS'
        dependency.lag_days ??= 0
      })
    })

    // Task 2: the prompt calls this "Dexie v2", but this repository already
    // reached Dexie version(2) in Phase 8. Therefore the safe production
    // migration is version(3), preserving every existing local row.
    this.version(3).stores(LOCAL_STORES_V3).upgrade(async (tx) => {
      await tx.table('projects').toCollection().modify((project: Partial<LocalProject>) => {
        project.cost_alert_minor_max_pct ??= 10
        project.cost_alert_major_max_pct ??= 25
      })

      await tx.table('profiles').toCollection().modify((profile: Partial<LocalProfile>) => {
        profile.phone ??= null
        profile.phone_secondary ??= null
        profile.dni ??= null
        profile.birth_date ??= null
        profile.hire_date ??= null
        profile.position ??= null
        profile.department ??= null
        profile.emergency_contact_name ??= null
        profile.emergency_contact_phone ??= null
        profile.emergency_contact_relation ??= null
        profile.blood_type ??= null
        profile.photo_drive_id ??= null
        profile.notes ??= ''
        profile.version ??= 1
      })

      await tx.table('tasks').toCollection().modify((task: Partial<LocalTask>) => {
        task.stage_id ??= null
        task.version ??= 1
      })

      await tx.table('documents').toCollection().modify((document: Partial<LocalDocument>) => {
        document.stage_id ??= null
        document.description ??= ''
        document.folder_path ??= '/'
        document.version ??= 1
      })
    })

    this.version(CURRENT_LOCAL_DB_VERSION).stores(LOCAL_STORES_V4)
  }
}

const instances = new Map<string, MglLocalDb>()
let activeKey: string | null = null

export function getLocalDb(identity: Pick<VerifiedIdentity, 'companyId' | 'userId'>): MglLocalDb {
  const key = `${identity.companyId}:${identity.userId}`
  let db = instances.get(key)
  if (!db) {
    db = new MglLocalDb(identity)
    instances.set(key, db)
  }
  activeKey = key
  return db
}

export function closeLocalDb(identity?: Pick<VerifiedIdentity, 'companyId' | 'userId'>) {
  const key = identity ? `${identity.companyId}:${identity.userId}` : activeKey
  if (!key) return
  const db = instances.get(key)
  db?.close()
  instances.delete(key)
  if (activeKey === key) activeKey = null
}

export async function destroyLocalDb(identity: Pick<VerifiedIdentity, 'companyId' | 'userId'>) {
  closeLocalDb(identity)
  await Dexie.delete(localDbName(identity))
}

export async function purgeProjectData(db: MglLocalDb, projectId: string, reason: string) {
  await db.transaction(
    'rw',
    [
      db.projects,
      db.projectMembers,
      db.tasks,
      db.taskDependencies,
      db.documents,
      db.sstRecords,
      db.projectStages,
      db.budgetItems,
      db.notifications,
      db.notificationDeliveries,
      db.materialRequests,
      db.materialRequestItems,
      db.integrationJobs,
      db.outbox,
      db.conflicts,
      db.cursors,
      db.tempBlobs,
      db.blockedReceipts,
    ],
    async () => {
      const pending = await db.outbox.where('projectId').equals(projectId).toArray()
      for (const item of pending) {
        await db.blockedReceipts.put({
          id: crypto.randomUUID(),
          mutationId: item.mutationId,
          projectId,
          entity: item.entity,
          entityId: item.entityId,
          reason,
          createdAt: Date.now(),
        })
      }

      const projectNotifications = await db.notifications.where('project_id').equals(projectId).toArray()
      const notificationIds = projectNotifications.map((row) => row.id)

      await Promise.all([
        db.projects.delete(projectId),
        db.projectMembers.where('project_id').equals(projectId).delete(),
        db.tasks.where('project_id').equals(projectId).delete(),
        db.taskDependencies.where('project_id').equals(projectId).delete(),
        db.documents.where('project_id').equals(projectId).delete(),
        db.sstRecords.where('project_id').equals(projectId).delete(),
        db.projectStages.where('project_id').equals(projectId).delete(),
        db.budgetItems.where('project_id').equals(projectId).delete(),
        db.materialRequests.where('project_id').equals(projectId).delete(),
        db.materialRequestItems.where('project_id').equals(projectId).delete(),
        db.integrationJobs.where('projectId').equals(projectId).delete(),
        notificationIds.length ? db.notificationDeliveries.where('notification_id').anyOf(notificationIds).delete() : Promise.resolve(0),
        db.notifications.where('project_id').equals(projectId).delete(),
        db.outbox.where('projectId').equals(projectId).delete(),
        db.conflicts.where('projectId').equals(projectId).delete(),
        db.cursors.where('projectId').equals(projectId).delete(),
        db.tempBlobs.where('projectId').equals(projectId).delete(),
      ])
    },
  )
}
