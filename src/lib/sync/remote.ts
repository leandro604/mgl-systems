import type { BrowserSupabaseClient } from '@/lib/supabase/client'
import type {
  BudgetItemRow,
  MaterialRequestItemRow,
  MaterialRequestRow,
  ProfileRow,
  ProjectMemberRow,
  ProjectRow,
  SyncEntity,
  SyncResponse,
  PendingMutation,
  VerifiedIdentity,
} from '@/types/domain'
import { pendingMutationSchema, syncResponseSchema } from './schemas'
import type { DocumentRow, SstRecordRow, TaskDependencyRow, TaskRow } from '@/types/domain'

export type RemoteSyncRow =
  | TaskRow
  | TaskDependencyRow
  | DocumentRow
  | SstRecordRow
  | BudgetItemRow
  | MaterialRequestRow
  | MaterialRequestItemRow

export class SyncRemoteError extends Error {
  constructor(
    message: string,
    readonly kind: 'auth' | 'permission' | 'retryable' | 'permanent',
    readonly code: string | null = null,
  ) {
    super(message)
    this.name = 'SyncRemoteError'
  }
}

export interface SyncRemote {
  verifyIdentity(identity: VerifiedIdentity): Promise<void>
  applyMutation(mutation: PendingMutation): Promise<SyncResponse>
  listVisibleProjects(): Promise<ProjectRow[]>
  listProfiles(companyId: string): Promise<ProfileRow[]>
  listProjectMembers(projectId: string): Promise<ProjectMemberRow[]>
  pullEntityPage(input: {
    entity: SyncEntity
    projectId: string
    from: number
    to: number
    serverUpdatedAtGte?: string
  }): Promise<RemoteSyncRow[]>
}

export class SupabaseSyncRemote implements SyncRemote {
  constructor(private readonly client: BrowserSupabaseClient) {}

  async verifyIdentity(identity: VerifiedIdentity): Promise<void> {
    const { data, error } = await this.client.auth.getUser()
    if (error || !data.user) throw new SyncRemoteError(error?.message ?? 'No authenticated user', 'auth', error?.code ?? null)
    if (data.user.id !== identity.userId) throw new SyncRemoteError('Authenticated user changed', 'auth')

    const { data: profile, error: profileError } = await this.client
      .from('profiles')
      .select('company_id,user_id,deleted_at')
      .eq('user_id', identity.userId)
      .eq('company_id', identity.companyId)
      .is('deleted_at', null)
      .maybeSingle()
    if (profileError) throw classifyPostgrest(profileError)
    if (!profile) throw new SyncRemoteError('Local identity is no longer active', 'permission')
  }

  async applyMutation(raw: PendingMutation): Promise<SyncResponse> {
    const mutation = pendingMutationSchema.parse(raw)

    const isMaterialTransition = mutation.entity === 'material_requests' && typeof mutation.payload.transition === 'string'
    const result = mutation.entity === 'budget_items'
      ? await this.client.rpc('sync_budget_item_actual', {
          p_mutation_id: mutation.mutationId,
          p_entity_id: mutation.entityId,
          p_project_id: mutation.projectId,
          p_operation: mutation.operation,
          p_updated_at: mutation.updatedAt,
          p_payload: mutation.payload,
        })
      : mutation.entity === 'tasks'
        ? await this.client.rpc('sync_task_mutation', {
            p_mutation_id: mutation.mutationId,
            p_entity_id: mutation.entityId,
            p_project_id: mutation.projectId,
            p_operation: mutation.operation,
            p_updated_at: mutation.updatedAt,
            p_payload: mutation.payload,
          })
        : isMaterialTransition
          ? await this.client.rpc('sync_material_request_transition', {
              p_mutation_id: mutation.mutationId,
              p_entity_id: mutation.entityId,
              p_project_id: mutation.projectId,
              p_updated_at: mutation.updatedAt,
              p_payload: mutation.payload,
            })
          : mutation.entity === 'material_requests' || mutation.entity === 'material_request_items'
            ? await this.client.rpc('sync_material_mutation', {
                p_mutation_id: mutation.mutationId,
                p_entity_type: mutation.entity,
                p_entity_id: mutation.entityId,
                p_project_id: mutation.projectId,
                p_operation: mutation.operation,
                p_updated_at: mutation.updatedAt,
                p_payload: mutation.payload,
              })
            : await this.client.rpc('sync_mutation', {
                p_mutation_id: mutation.mutationId,
                p_entity_type: mutation.entity,
                p_entity_id: mutation.entityId,
                p_project_id: mutation.projectId,
                p_operation: mutation.operation,
                p_updated_at: mutation.updatedAt,
                p_payload: mutation.payload,
              })

    if (result.error) throw classifyPostgrest(result.error)
    return syncResponseSchema.parse(result.data)
  }

  async listVisibleProjects(): Promise<ProjectRow[]> {
    const { data, error } = await this.client.from('projects').select('*').order('id', { ascending: true })
    if (error) throw classifyPostgrest(error)
    return data
  }

  async listProfiles(companyId: string): Promise<ProfileRow[]> {
    const { data, error } = await this.client
      .from('profiles')
      .select('*')
      .eq('company_id', companyId)
      .order('id', { ascending: true })
    if (error) throw classifyPostgrest(error)
    return data
  }

  async listProjectMembers(projectId: string): Promise<ProjectMemberRow[]> {
    const { data, error } = await this.client
      .from('project_members')
      .select('*')
      .eq('project_id', projectId)
      .order('id', { ascending: true })
    if (error) throw classifyPostgrest(error)
    return data
  }

  async pullEntityPage(input: {
    entity: SyncEntity
    projectId: string
    from: number
    to: number
    serverUpdatedAtGte?: string
  }): Promise<RemoteSyncRow[]> {
    switch (input.entity) {
      case 'tasks': {
        let query = this.client.from('tasks').select('*').eq('project_id', input.projectId)
        if (input.serverUpdatedAtGte) query = query.gte('server_updated_at', input.serverUpdatedAtGte)
        const { data, error } = await query.order('server_updated_at').order('id').range(input.from, input.to)
        if (error) throw classifyPostgrest(error)
        return data
      }
      case 'task_dependencies': {
        let query = this.client.from('task_dependencies').select('*').eq('project_id', input.projectId)
        if (input.serverUpdatedAtGte) query = query.gte('server_updated_at', input.serverUpdatedAtGte)
        const { data, error } = await query.order('server_updated_at').order('id').range(input.from, input.to)
        if (error) throw classifyPostgrest(error)
        return data
      }
      case 'documents': {
        let query = this.client.from('documents').select('*').eq('project_id', input.projectId)
        if (input.serverUpdatedAtGte) query = query.gte('server_updated_at', input.serverUpdatedAtGte)
        const { data, error } = await query.order('server_updated_at').order('id').range(input.from, input.to)
        if (error) throw classifyPostgrest(error)
        return data
      }
      case 'sst_records': {
        let query = this.client.from('sst_records').select('*').eq('project_id', input.projectId)
        if (input.serverUpdatedAtGte) query = query.gte('server_updated_at', input.serverUpdatedAtGte)
        const { data, error } = await query.order('server_updated_at').order('id').range(input.from, input.to)
        if (error) throw classifyPostgrest(error)
        return data
      }
      case 'budget_items': {
        let query = this.client.from('budget_items').select('*').eq('project_id', input.projectId)
        if (input.serverUpdatedAtGte) query = query.gte('server_updated_at', input.serverUpdatedAtGte)
        const { data, error } = await query.order('server_updated_at').order('id').range(input.from, input.to)
        if (error) throw classifyPostgrest(error)
        return data
      }
      case 'material_requests': {
        let query = this.client.from('material_requests').select('*').eq('project_id', input.projectId)
        if (input.serverUpdatedAtGte) query = query.gte('server_updated_at', input.serverUpdatedAtGte)
        const { data, error } = await query.order('server_updated_at').order('id').range(input.from, input.to)
        if (error) throw classifyPostgrest(error)
        return data
      }
      case 'material_request_items': {
        let query = this.client.from('material_request_items').select('*').eq('project_id', input.projectId)
        if (input.serverUpdatedAtGte) query = query.gte('server_updated_at', input.serverUpdatedAtGte)
        const { data, error } = await query.order('server_updated_at').order('id').range(input.from, input.to)
        if (error) throw classifyPostgrest(error)
        return data
      }
    }
  }
}

function classifyPostgrest(error: { code?: string; message: string }): SyncRemoteError {
  const code = error.code ?? null
  if (code === '42501') return new SyncRemoteError(error.message, 'permission', code)
  if (code === '28000' || code === 'PGRST301' || code === 'PGRST302') return new SyncRemoteError(error.message, 'auth', code)
  if (code && (/^23/.test(code) || /^22/.test(code))) return new SyncRemoteError(error.message, 'permanent', code)
  if (/failed to fetch|network|timeout|temporar|rate limit/i.test(error.message)) {
    return new SyncRemoteError(error.message, 'retryable', code)
  }
  // PostgREST/API failures without a deterministic SQL validation code are retried with a cap/backoff.
  return new SyncRemoteError(error.message, 'retryable', code)
}
