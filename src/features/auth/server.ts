import { cache } from 'react'
import { redirect } from 'next/navigation'
import type { Database } from '@/lib/supabase/database.types'
import { createClient } from '@/lib/supabase/server'
import { isFieldWorkerRole } from './roles'

type Profile = Pick<Database['public']['Tables']['profiles']['Row'], 'id' | 'company_id' | 'user_id' | 'full_name' | 'role' | 'deleted_at'>
type Company = Pick<Database['public']['Tables']['companies']['Row'], 'id' | 'legal_name' | 'ruc' | 'timezone' | 'currency' | 'deleted_at'>
type Project = Pick<Database['public']['Tables']['projects']['Row'], 'id' | 'company_id' | 'code' | 'name' | 'description' | 'status' | 'starts_on' | 'ends_on' | 'created_by' | 'created_at' | 'updated_at' | 'server_updated_at'>

type WorkspaceRpcPayload = {
  user_id: string
  email: string
  profile: Profile
  company: Company
  projects: Project[]
}

export const getVerifiedSubject = cache(async () => {
  const supabase = await createClient()
  const { data } = await supabase.auth.getClaims()
  const sub = data?.claims?.sub
  return { supabase, claims: data?.claims ?? null, userId: typeof sub === 'string' ? sub : null }
})

export async function requireAuthenticatedUser() {
  const auth = await getVerifiedSubject()
  if (!auth.userId) redirect('/login')
  return { ...auth, userId: auth.userId }
}

/**
 * One database round-trip for the shell context.
 *
 * Previous versions performed profile -> company -> projects sequentially on
 * every server navigation. On higher-latency connections that added several
 * seconds before a page query could even start. The RPC runs as SECURITY
 * INVOKER, so the same RLS policies continue to define visible projects.
 * React cache() also deduplicates repeated calls from a layout + page during
 * the same RSC render.
 */
export const requireWorkspaceContext = cache(async () => {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc('get_workspace_context')

  if (error) {
    if (error.code === '42501') redirect('/login')
    throw error
  }
  if (!data) redirect('/onboarding')

  const payload = data as WorkspaceRpcPayload
  if (!payload.user_id || !payload.profile || !payload.company) redirect('/onboarding')

  return {
    supabase,
    claims: null,
    userId: payload.user_id,
    profile: payload.profile,
    company: payload.company,
    projects: Array.isArray(payload.projects) ? payload.projects : [],
    email: typeof payload.email === 'string' ? payload.email : '',
  }
})

/**
 * Managerial shell guard. Field workers never render the administrative UI;
 * direct navigation to /app is redirected to the operational experience.
 */
export const requireManagementWorkspaceContext = cache(async () => {
  const context = await requireWorkspaceContext()
  if (isFieldWorkerRole(context.profile.role)) redirect('/field/hoy')
  return context
})

/**
 * Operational shell guard. Admin, PM and supervisor accounts use /app so each
 * role has one predictable interface and browser history cannot mix shells.
 */
export const requireFieldWorkspaceContext = cache(async () => {
  const context = await requireWorkspaceContext()
  if (!isFieldWorkerRole(context.profile.role)) redirect('/app')
  return context
})

