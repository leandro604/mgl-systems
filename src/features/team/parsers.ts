import type { Json } from '@/lib/supabase/database.types'
import type { AppRole, MyWorkspaceInvitation, WorkspaceInvitationAdmin } from './types'

const roles = new Set<AppRole>(['admin', 'pm', 'supervisor', 'field_worker'])

function record(value: Json | undefined | null): Record<string, Json | undefined> | null {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, Json | undefined> : null
}

function text(value: Json | undefined): string | null {
  return typeof value === 'string' ? value : null
}

function role(value: Json | undefined): AppRole | null {
  return typeof value === 'string' && roles.has(value as AppRole) ? value as AppRole : null
}

export function parseMyWorkspaceInvitation(value: Json | null): MyWorkspaceInvitation | null {
  const row = record(value)
  if (!row) return null
  const id = text(row.id)
  const companyId = text(row.company_id)
  const companyName = text(row.company_name)
  const email = text(row.email)
  const invitationRole = role(row.role)
  const expiresAt = text(row.expires_at)
  if (!id || !companyId || !companyName || !email || !invitationRole || !expiresAt || typeof row.can_transfer !== 'boolean') return null

  const projects = Array.isArray(row.projects)
    ? row.projects.flatMap((item) => {
        const project = record(item)
        const projectId = project ? text(project.id) : null
        const code = project ? text(project.code) : null
        const name = project ? text(project.name) : null
        return projectId && code && name ? [{ id: projectId, code, name }] : []
      })
    : []

  return { id, company_id: companyId, company_name: companyName, email, role: invitationRole, projects, expires_at: expiresAt, can_transfer: row.can_transfer }
}

export function parseWorkspaceInvitations(value: Json | null): WorkspaceInvitationAdmin[] {
  if (!Array.isArray(value)) return []
  return value.flatMap((item) => {
    const row = record(item)
    if (!row) return []
    const id = text(row.id)
    const email = text(row.email)
    const invitationRole = role(row.role)
    const status = text(row.status)
    const createdAt = text(row.created_at)
    const expiresAt = text(row.expires_at)
    if (!id || !email || !invitationRole || !createdAt || !expiresAt || !status || !['pending', 'accepted', 'revoked', 'expired'].includes(status)) return []
    return [{
      id,
      email,
      role: invitationRole,
      project_ids: Array.isArray(row.project_ids) ? row.project_ids.filter((v): v is string => typeof v === 'string') : [],
      project_names: Array.isArray(row.project_names) ? row.project_names.filter((v): v is string => typeof v === 'string') : [],
      status: status as WorkspaceInvitationAdmin['status'],
      created_at: createdAt,
      expires_at: expiresAt,
      accepted_at: text(row.accepted_at),
    }]
  })
}
