import { cache } from 'react'
import { notFound } from 'next/navigation'
import { requireWorkspaceContext } from '@/features/auth/server'

export const requireProjectContext = cache(async (projectId: string) => {
  const workspace = await requireWorkspaceContext()
  const project = workspace.projects.find((item) => item.id === projectId)
  if (!project) notFound()

  return { ...workspace, project }
})

export const getProjectPeople = cache(async (projectId: string) => {
  const context = await requireProjectContext(projectId)
  const { supabase, company } = context

  const [{ data: memberships, error: membershipError }, { data: profiles, error: profileError }] = await Promise.all([
    supabase
      .from('project_members')
      .select('id,user_id,deleted_at,created_at,server_updated_at')
      .eq('project_id', projectId),
    supabase
      .from('profiles')
      .select('id,user_id,full_name,role,deleted_at')
      .eq('company_id', company.id)
      .is('deleted_at', null)
      .order('full_name'),
  ])

  if (membershipError) throw membershipError
  if (profileError) throw profileError

  const activeMemberships = (memberships ?? []).filter((membership) => membership.deleted_at === null)
  const activeIds = new Set(activeMemberships.map((membership) => membership.user_id))
  const profileByUser = new Map((profiles ?? []).map((profile) => [profile.user_id, profile]))

  return {
    ...context,
    memberships: activeMemberships.map((membership) => ({
      ...membership,
      profile: profileByUser.get(membership.user_id) ?? null,
    })),
    availableProfiles: (profiles ?? []).filter((profile) => !activeIds.has(profile.user_id)),
    allProfiles: profiles ?? [],
  }
})
