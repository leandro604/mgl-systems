import type { Database } from '@/lib/supabase/database.types'

export type AppRole = Database['public']['Enums']['app_role']

export type InvitationProject = {
  id: string
  code: string
  name: string
}

export type MyWorkspaceInvitation = {
  id: string
  company_id: string
  company_name: string
  email: string
  role: AppRole
  projects: InvitationProject[]
  expires_at: string
  can_transfer: boolean
}

export type WorkspaceInvitationAdmin = {
  id: string
  email: string
  role: AppRole
  project_ids: string[]
  project_names: string[]
  status: 'pending' | 'accepted' | 'revoked' | 'expired'
  created_at: string
  expires_at: string
  accepted_at: string | null
}

export type InviteMemberState = {
  status: 'idle' | 'success' | 'error'
  message: string
  inviteUrl?: string
}

export const roleLabels: Record<AppRole, string> = {
  admin: 'Administrador',
  pm: 'Project Manager',
  supervisor: 'Supervisor',
  field_worker: 'Trabajador de campo',
}
