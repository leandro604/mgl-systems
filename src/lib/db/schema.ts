import type {
  BudgetItemRow,
  DocumentRow,
  MaterialRequestItemRow,
  MaterialRequestRow,
  ProfileRow,
  ProjectMemberRow,
  ProjectRow,
  SstRecordRow,
  SyncEntity,
  SyncOperation,
  SyncPayload,
  TaskDependencyRow,
  TaskRow,
} from '@/types/domain'
import type { Json } from '@/lib/supabase/database.types'

export type LocalSyncMeta = {
  pending_sync: boolean
  sync_error: string | null
  local_updated_at: string
}

export type ProjectStageType =
  | 'management'
  | 'engineering'
  | 'procurement'
  | 'field_execution'
  | 'finance'
  | 'quotation_closed'
  | 'execution_versioned'

export type CostStatus = 'dentro_presupuesto' | 'alerta_menor' | 'alerta_mayor' | 'critico'
export type NotificationChannel = 'in_app' | 'email' | 'push'
export type NotificationDeliveryStatus = 'pending' | 'scheduled' | 'sent' | 'skipped' | 'failed'
export type MaterialRequestWorkflowStatus = 'draft' | 'pending' | 'approved' | 'rejected' | 'delivered' | 'cancelled'
export type MaterialRequestPriority = 'low' | 'normal' | 'high' | 'urgent'

export type ProfileTask1Fields = {
  phone: string | null
  phone_secondary: string | null
  dni: string | null
  birth_date: string | null
  hire_date: string | null
  position: string | null
  department: string | null
  emergency_contact_name: string | null
  emergency_contact_phone: string | null
  emergency_contact_relation: string | null
  blood_type: string | null
  photo_drive_id: string | null
  notes: string
  version: number
}

export type ProjectTask1Fields = {
  cost_alert_minor_max_pct: number
  cost_alert_major_max_pct: number
}

export type TaskTask1Fields = {
  stage_id: string | null
  version: number
}

export type DocumentTask1Fields = {
  stage_id: string | null
  description: string
  folder_path: string
  version: number
}

export type BudgetItemTask1Fields = {
  stage_id: string
  qty_actual: number
  unit_price_actual: number
  qty_quoted: number
  unit_price_quoted: number
  actual_amount: number
  deviation_amount: number
  deviation_pct: number | null
  cost_status: CostStatus
  version: number
}

export type MaterialRequestTask1Fields = {
  title: string
  rejection_reason: string | null
  workflow_status: MaterialRequestWorkflowStatus
  approver_id: string | null
  priority: MaterialRequestPriority
  stage_id: string
  budget_item_id: string | null
  version: number
}

export type LocalProject = ProjectRow & ProjectTask1Fields & LocalSyncMeta
export type LocalProfile = ProfileRow & ProfileTask1Fields & LocalSyncMeta
export type LocalProjectMember = ProjectMemberRow & LocalSyncMeta
export type LocalTask = Omit<TaskRow, 'stage_id' | 'version'> & TaskTask1Fields & LocalSyncMeta
export type LocalTaskDependency = TaskDependencyRow & LocalSyncMeta
export type LocalDocument = Omit<DocumentRow, 'stage_id' | 'description' | 'folder_path' | 'version' | 'search_vector'> & DocumentTask1Fields & LocalSyncMeta
export type LocalSstRecord = SstRecordRow & LocalSyncMeta
export type LocalBudgetItem = BudgetItemRow & BudgetItemTask1Fields & LocalSyncMeta
export type LocalMaterialRequest = MaterialRequestRow & MaterialRequestTask1Fields & LocalSyncMeta
export type MaterialRequestItemTask10Fields = {
  estimated_unit_price: number
  estimated_amount: number | null
}

export type LocalMaterialRequestItem = MaterialRequestItemRow & MaterialRequestItemTask10Fields & LocalSyncMeta

export type LocalProjectStage = LocalSyncMeta & {
  id: string
  created_at: string
  updated_at: string
  server_updated_at: string
  mutation_id: string
  version: number
  deleted_at: string | null
  company_id: string
  project_id: string
  stage_type: ProjectStageType
  code: string
  name: string
  sort_order: number
  is_locked: boolean
  created_by: string
}

export type LocalNotification = LocalSyncMeta & {
  id: string
  created_at: string
  updated_at: string
  server_updated_at: string
  mutation_id: string
  version: number
  deleted_at: string | null
  company_id: string
  project_id: string | null
  recipient_id: string
  actor_id: string | null
  kind: string
  title: string
  body: string
  entity_type: string | null
  entity_id: string | null
  action_url: string | null
  metadata: Json
  read_at: string | null
}

export type LocalNotificationDelivery = LocalSyncMeta & {
  id: string
  created_at: string
  updated_at: string
  server_updated_at: string
  mutation_id: string
  version: number
  deleted_at: string | null
  company_id: string
  notification_id: string
  recipient_id: string
  channel: NotificationChannel
  status: NotificationDeliveryStatus
  scheduled_for: string
  attempted_at: string | null
  sent_at: string | null
  attempt_count: number
  provider_message_id: string | null
  last_error: string | null
}

export type LocalPushSubscription = LocalSyncMeta & {
  id: string
  created_at: string
  updated_at: string
  server_updated_at: string
  mutation_id: string
  version: number
  deleted_at: string | null
  company_id: string
  user_id: string
  endpoint: string
  p256dh: string
  auth_key: string
  device_id: string
  user_agent: string
  enabled: boolean
  last_seen_at: string
}

export type LocalUserPreference = LocalSyncMeta & {
  id: string
  created_at: string
  updated_at: string
  server_updated_at: string
  mutation_id: string
  version: number
  deleted_at: string | null
  company_id: string
  user_id: string
  in_app_enabled: boolean
  email_enabled: boolean
  push_enabled: boolean
  quiet_hours_enabled: boolean
  quiet_start: string | null
  quiet_end: string | null
  timezone: string
  sidebar_collapsed: boolean
  compact_mode: boolean
}

/**
 * Entities that can have a local pull cursor. This remains wider than
 * SyncEntity because several Task 1 tables are read/cache-only for now.
 * Task 5 adds budget_items to SyncEntity, but only its real-cost fields are
 * writable through the dedicated sync_budget_item_actual RPC.
 */
export type LocalCacheEntity =
  | SyncEntity
  | 'project_stages'
  | 'budget_items'
  | 'notifications'
  | 'notification_deliveries'
  | 'push_subscriptions'
  | 'material_requests'
  | 'material_request_items'
  | 'user_preferences'

export type OutboxStatus = 'pending' | 'retry' | 'blocked'

export type OutboxRecord = {
  sequence?: number
  mutationId: string
  entityId: string
  companyId: string
  projectId: string
  actorId: string
  entity: SyncEntity
  operation: SyncOperation
  updatedAt: string
  payload: SyncPayload
  dependsOnMutationIds: string[]
  status: OutboxStatus
  attemptCount: number
  nextAttemptAt: number
  lastError: string | null
  createdAt: number
}

export type ConflictRecord = {
  id: string
  mutationId: string
  companyId: string
  projectId: string
  entity: SyncEntity
  entityId: string
  operation: SyncOperation
  localPayload: SyncPayload
  canonicalRow: Record<string, Json> | null
  code: string | null
  message: string | null
  createdAt: number
  resolution: 'server_won' | 'manual_required'
}

export type SyncCursorRecord = {
  id: string
  projectId: string
  entity: LocalCacheEntity | 'projects' | 'profiles' | 'project_members'
  serverUpdatedAt: string
  serverId: string
  lastFullReconcileAt: number | null
}

export type TemporaryBlobRecord = {
  id: string
  projectId: string
  entityId: string
  fileName: string
  mimeType: string
  sizeBytes: number
  blob: Blob
  createdAt: number
}

export type BlockedReceipt = {
  id: string
  mutationId: string
  projectId: string
  entity: SyncEntity
  entityId: string
  reason: string
  createdAt: number
}


export type IntegrationJobRecord = {
  id: string
  kind: 'intifact_send'
  companyId: string
  projectId: string
  userId: string
  entityId: string
  status: 'pending' | 'retry' | 'done' | 'blocked'
  attemptCount: number
  nextAttemptAt: number
  lastError: string | null
  createdAt: number
  updatedAt: number
}

export type LocalMetaRecord = {
  key: string
  value: Json
  updatedAt: number
}
