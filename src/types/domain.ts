import type { Json, Tables } from '@/lib/supabase/database.types'

export type AppRole = 'admin' | 'pm' | 'supervisor' | 'field_worker'
export type TaskStatus = 'todo' | 'in_progress' | 'blocked' | 'done'

export type SyncEntity =
  | 'tasks'
  | 'task_dependencies'
  | 'documents'
  | 'sst_records'
  | 'budget_items'
  | 'material_requests'
  | 'material_request_items'
export type SyncOperation = 'create' | 'update' | 'soft_delete' | 'restore'
export type SyncResult = 'applied' | 'conflict' | 'rejected'

export type VerifiedIdentity = {
  companyId: string
  userId: string
  role: AppRole
  fullName: string
  verifiedAt: string
}

export type SyncPayload = Record<string, Json>

export type PendingMutation = {
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
}

export type SyncResponse = {
  result: SyncResult
  mutation_id: string
  entity?: SyncEntity | undefined
  entity_id?: string | undefined
  row?: Record<string, Json> | null | undefined
  code?: string | undefined
  message?: string | undefined
}

export type CompanyRow = Tables<'companies'>
export type ProfileRow = Tables<'profiles'>
export type ProjectRow = Tables<'projects'>
export type ProjectMemberRow = Tables<'project_members'>
export type TaskRow = Tables<'tasks'>
export type TaskDependencyRow = Tables<'task_dependencies'>
export type DocumentRow = Tables<'documents'>
export type SstRecordRow = Tables<'sst_records'>
export type BudgetItemRow = Tables<'budget_items'>
export type MaterialRequestRow = Tables<'material_requests'>
export type MaterialRequestItemRow = Tables<'material_request_items'>
